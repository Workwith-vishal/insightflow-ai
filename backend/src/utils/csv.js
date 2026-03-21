const splitCsvLine = (line) => {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

export const parseCsv = (csvText) => {
  const rows = csvText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCsvLine);

  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = rows[0];
  const dataRows = rows
    .slice(1)
    .map((row) => headers.map((_, index) => row[index] ?? ""));

  return {
    headers,
    rows: dataRows,
    totalRows: dataRows.length,
  };
};

const isNumeric = (value) => {
  if (value === "") return false;
  return Number.isFinite(Number(value));
};

const isYearLike = (value) => {
  if (!isNumeric(value)) return false;
  const num = Number(value);
  return Number.isInteger(num) && num >= 1900 && num <= 2100;
};

const isDateLike = (value) => {
  if (value === "") return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
};

const looksLikeId = (header, values, rowCount) => {
  const lower = header.toLowerCase();
  if (/(^id$|_id$|^id_|id$)/i.test(lower) || lower.includes("uuid") || lower.includes("guid")) {
    return true;
  }
  if (!rowCount || values.length === 0) return false;
  const uniqueCount = new Set(values).size;
  const uniqueRatio = uniqueCount / rowCount;
  if (uniqueRatio < 0.9) return false;
  const sample = values.slice(0, 5).join("");
  const avgLength = sample.length / Math.max(values.slice(0, 5).length, 1);
  return avgLength <= 12;
};

const detectMultiValue = (values) => {
  if (!values.length) return false;
  const delimiters = [",", ";", "|", "/"];
  let multiCount = 0;
  values.forEach((value) => {
    const str = String(value || "");
    if (str.includes(",")) {
      const parts = str.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        multiCount += 1;
        return;
      }
    }
    for (const delimiter of delimiters) {
      if (!str.includes(delimiter)) continue;
      const parts = str.split(delimiter).map((p) => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        multiCount += 1;
        return;
      }
    }
  });

  return multiCount / values.length >= 0.2;
};

const splitMultiValues = (value) =>
  String(value || "")
    .split(/[,;|/]/g)
    .map((part) => part.trim())
    .filter(Boolean);

const buildCounts = (rows, columnIndex, { multiValue = false } = {}) => {
  const counts = new Map();
  rows.forEach((row) => {
    const raw = row[columnIndex] ?? "";
    if (!raw) return;
    const values = multiValue ? splitMultiValues(raw) : [String(raw).trim()];
    values.forEach((value) => {
      if (!value) return;
      counts.set(value, (counts.get(value) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
};

const buildYearCounts = (rows, columnIndex) => {
  const counts = new Map();
  rows.forEach((row) => {
    const raw = row[columnIndex];
    if (!isYearLike(raw)) return;
    const year = String(raw);
    counts.set(year, (counts.get(year) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([name, value]) => ({ name, value }));
};

export const summarizeDataset = (dataset) => {
  const { headers, rows } = dataset;
  const columnProfiles = headers.map((header, index) => {
    const values = rows.map((row) => row[index]).filter((value) => value !== "");
    const numericValues = values.filter(isNumeric).map(Number);
    const uniqueValues = new Set(values);
    const numericRatio = values.length ? numericValues.length / values.length : 0;
    const dateRatio = values.length ? values.filter(isDateLike).length / values.length : 0;
    const yearRatio = values.length ? values.filter(isYearLike).length / values.length : 0;
    const isIdLike = looksLikeId(header, values, rows.length);
    const isMultiValue = detectMultiValue(values);
    const uniqueRatio = rows.length ? uniqueValues.size / rows.length : 0;

    let type = "text";
    if (isIdLike) {
      type = "id";
    } else if (yearRatio >= 0.8 && header.toLowerCase().includes("year")) {
      type = "date";
    } else if (dateRatio >= 0.85 && numericRatio < 0.85) {
      type = "date";
    } else if (numericRatio >= 0.9) {
      type = "numeric";
    } else if (uniqueRatio < 0.5 && uniqueValues.size <= 200) {
      type = "categorical";
    }

    const base = {
      name: header,
      filled: values.length,
      unique: uniqueValues.size,
      sampleValues: values.slice(0, 5),
      numeric: numericRatio >= 0.9 && numericValues.length > 0,
    };

    if (!base.numeric) {
      return {
        ...base,
        type,
        isIdLike,
        isMultiValue,
      };
    }

    const sum = numericValues.reduce((total, value) => total + value, 0);
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const average = sum / numericValues.length;

    return {
      ...base,
      min,
      max,
      average,
      sum,
      type,
      isIdLike,
      isMultiValue,
    };
  });

  const usableColumns = columnProfiles.filter((column) => !column.isIdLike);
  const numericColumns = usableColumns.filter((column) => column.type === "numeric");
  const categoricalColumns = usableColumns.filter((column) => column.type === "categorical");
  const dateColumns = usableColumns.filter((column) => column.type === "date");
  const multiValueColumns = usableColumns.filter((column) => column.isMultiValue);

  const insights = [];
  const chartSuggestions = [];

  const addInsight = (text) => {
    if (text && insights.length < 5) {
      insights.push(text);
    }
  };

  const candidates = [];
  const pushCandidate = (chart, type, priority) => {
    if (!chart || !Array.isArray(chart.data) || chart.data.length === 0) return;
    candidates.push({ chart, type, priority });
  };

  const findColumn = (predicate) => usableColumns.find(predicate);
  const scoreByName = (name, keywords) =>
    keywords.reduce((score, keyword) => (name.toLowerCase().includes(keyword) ? score + 1 : score), 0);

  const pickBest = (columns, keywords = []) => {
    if (!columns.length) return null;
    return [...columns]
      .sort((a, b) => {
        const scoreA = scoreByName(a.name, keywords);
        const scoreB = scoreByName(b.name, keywords);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return b.filled - a.filled;
      })[0];
  };

  const buildNumericBuckets = (xIndex, yIndex) => {
    const values = rows
      .map((row) => {
        const x = Number(row[xIndex]);
        const y = yIndex != null ? Number(row[yIndex]) : 1;
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
      })
      .filter(Boolean);

    if (!values.length) return [];
    const xs = values.map((v) => v.x);
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    const bins = 8;
    const size = (max - min) / bins || 1;
    const buckets = Array.from({ length: bins }, (_, i) => ({
      name: `${(min + i * size).toFixed(1)}-${(min + (i + 1) * size).toFixed(1)}`,
      value: 0,
      count: 0,
    }));

    values.forEach(({ x, y }) => {
      const index = Math.min(Math.floor((x - min) / size), bins - 1);
      buckets[index].value += yIndex != null ? y : 1;
      buckets[index].count += 1;
    });

    if (yIndex != null) {
      buckets.forEach((bucket) => {
        bucket.value = bucket.count ? Number((bucket.value / bucket.count).toFixed(2)) : 0;
      });
    }

    return buckets;
  };

  const typeColumn = findColumn((column) => column.type === "categorical" && column.name.toLowerCase().includes("type"));
  const ratingColumn = findColumn((column) => column.type === "categorical" && column.name.toLowerCase().includes("rating"));
  const genreColumn =
    findColumn((column) => column.name.toLowerCase().includes("listed_in")) ||
    findColumn((column) => column.name.toLowerCase().includes("genre")) ||
    findColumn((column) => column.name.toLowerCase().includes("category"));
  const countryColumn = findColumn((column) => column.name.toLowerCase().includes("country"));
  const releaseYearColumn =
    findColumn((column) => column.name.toLowerCase().includes("release_year")) ||
    findColumn((column) => column.name.toLowerCase().includes("year"));

  if (typeColumn) {
    const data = buildCounts(rows, headers.indexOf(typeColumn.name));
    pushCandidate(
      {
        title: "Content Type Distribution",
        type: "pie",
        dataKey: "value",
        data: data.slice(0, 8),
      },
      "pie",
      90,
    );
    if (data[0]) {
      const total = data.reduce((sum, item) => sum + item.value, 0);
      const share = total ? ((data[0].value / total) * 100).toFixed(1) : "0";
      addInsight(`Most common content type is ${data[0].name} (${share}% of titles).`);
    }
  }

  if (releaseYearColumn && (releaseYearColumn.type === "numeric" || releaseYearColumn.type === "date")) {
    const data = buildYearCounts(rows, headers.indexOf(releaseYearColumn.name));
    pushCandidate(
      {
        title: "Titles by Release Year",
        type: "line",
        dataKey: "value",
        data,
      },
      "line",
      90,
    );
    if (data.length) {
      const peak = data.reduce((best, current) => (current.value > best.value ? current : best), data[0]);
      addInsight(`Peak release year is ${peak.name} with ${peak.value} titles.`);
    }
  }

  if (ratingColumn) {
    const data = buildCounts(rows, headers.indexOf(ratingColumn.name));
    pushCandidate(
      {
        title: "Ratings Distribution",
        type: "bar",
        dataKey: "value",
        data: data.slice(0, 10),
      },
      "bar",
      80,
    );
    if (data[0]) {
      addInsight(`Top rating is ${data[0].name} (${data[0].value} titles).`);
    }
  }

  if (genreColumn) {
    const isMultiValue = genreColumn.isMultiValue || genreColumn.type === "categorical";
    const data = buildCounts(rows, headers.indexOf(genreColumn.name), { multiValue: isMultiValue });
    pushCandidate(
      {
        title: "Top Genres",
        type: "bar",
        dataKey: "value",
        data: data.slice(0, 10),
      },
      "bar",
      70,
    );
    if (data[0]) {
      addInsight(`Most common genre is ${data[0].name} (${data[0].value} titles).`);
    }
  }

  if (countryColumn) {
    const data = buildCounts(rows, headers.indexOf(countryColumn.name), { multiValue: countryColumn.isMultiValue });
    pushCandidate(
      {
        title: "Top Countries",
        type: "bar",
        dataKey: "value",
        data: data.slice(0, 10),
      },
      "bar",
      75,
    );
    if (data[0]) {
      addInsight(`Top country is ${data[0].name} (${data[0].value} titles).`);
    }
  }

  const lowCardCategorical = categoricalColumns.filter((column) => column.unique <= 8);
  const bestPieColumn = pickBest(lowCardCategorical, ["education", "company", "size", "type", "level"]);
  if (bestPieColumn) {
    const data = buildCounts(rows, headers.indexOf(bestPieColumn.name));
    pushCandidate(
      {
        title: `${bestPieColumn.name} Distribution`,
        type: "pie",
        dataKey: "value",
        data: data.slice(0, 8),
      },
      "pie",
      85,
    );
  }

  const bestBarColumn = pickBest(categoricalColumns, ["country", "education", "company", "size", "type"]);
  if (bestBarColumn) {
    const data = buildCounts(rows, headers.indexOf(bestBarColumn.name), { multiValue: bestBarColumn.isMultiValue });
    pushCandidate(
      {
        title: `Top ${bestBarColumn.name}`,
        type: "bar",
        dataKey: "value",
        data: data.slice(0, 12),
      },
      "bar",
      60,
    );
  }

  const bestMultiValue = pickBest(multiValueColumns, ["language", "framework", "skill", "tool"]);
  if (bestMultiValue) {
    const data = buildCounts(rows, headers.indexOf(bestMultiValue.name), { multiValue: true });
    pushCandidate(
      {
        title: `Top ${bestMultiValue.name}`,
        type: "bar",
        dataKey: "value",
        data: data.slice(0, 12),
      },
      "bar",
      65,
    );
  }

  if (numericColumns.length >= 2) {
    const xCol = pickBest(numericColumns, ["experience", "age", "year"]);
    const yCol = pickBest(numericColumns.filter((col) => col.name !== xCol?.name), ["salary", "amount", "revenue", "price"]);
    if (xCol && yCol) {
      const xIndex = headers.indexOf(xCol.name);
      const yIndex = headers.indexOf(yCol.name);
      const data = rows
        .map((row) => ({
          name: Number(row[xIndex]),
          value: Number(row[yIndex]),
        }))
        .filter((point) => Number.isFinite(point.name) && Number.isFinite(point.value))
        .slice(0, 300);
      pushCandidate(
        {
          title: `${xCol.name} vs ${yCol.name}`,
          type: "scatter",
          dataKey: "value",
          data,
        },
        "scatter",
        90,
      );
    }
  }

  if (dateColumns.length > 0) {
    const dateCol = pickBest(dateColumns, ["date", "year"]);
    if (dateCol) {
      const data = buildYearCounts(rows, headers.indexOf(dateCol.name));
      pushCandidate(
        {
          title: `${dateCol.name} Trend`,
          type: "area",
          dataKey: "value",
          data,
        },
        "area",
        80,
      );
    }
  } else if (numericColumns.length >= 1) {
    const xCol = pickBest(numericColumns, ["experience", "age", "year"]);
    const yCol = pickBest(numericColumns.filter((col) => col.name !== xCol?.name), ["salary", "amount", "revenue", "price"]);
    if (xCol) {
      const xIndex = headers.indexOf(xCol.name);
      const yIndex = yCol ? headers.indexOf(yCol.name) : null;
      const data = buildNumericBuckets(xIndex, yIndex);
      pushCandidate(
        {
          title: yCol ? `Average ${yCol.name} by ${xCol.name}` : `${xCol.name} Distribution`,
          type: "line",
          dataKey: "value",
          data,
        },
        "line",
        85,
      );
    }
  }

  if (numericColumns.length > 0) {
    const numCol = pickBest(numericColumns, ["salary", "amount", "price", "score"]);
    if (numCol) {
      const values = rows
        .map((row) => Number(row[headers.indexOf(numCol.name)]))
        .filter((value) => Number.isFinite(value));
      if (values.length) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const bins = 8;
        const size = (max - min) / bins || 1;
        const buckets = Array.from({ length: bins }, (_, i) => ({
          name: `${(min + i * size).toFixed(1)}-${(min + (i + 1) * size).toFixed(1)}`,
          value: 0,
        }));
        values.forEach((value) => {
          const index = Math.min(Math.floor((value - min) / size), bins - 1);
          buckets[index].value += 1;
        });
        pushCandidate(
          {
            title: `${numCol.name} Distribution`,
            type: "bar",
            dataKey: "value",
            data: buckets,
          },
          "bar",
          50,
        );
      }
    }
  }

  const selectedByType = new Map();
  candidates
    .sort((a, b) => b.priority - a.priority)
    .forEach(({ chart, type }) => {
      if (!selectedByType.has(type)) {
        selectedByType.set(type, chart);
      }
    });

  const primaryCharts = Array.from(selectedByType.values()).slice(0, 4);

  if (primaryCharts.length < 4) {
    candidates
      .sort((a, b) => b.priority - a.priority)
      .forEach(({ chart }) => {
        if (primaryCharts.length >= 4) return;
        if (primaryCharts.find((existing) => existing.title === chart.title)) return;
        primaryCharts.push(chart);
      });
  }

  primaryCharts.forEach((chart) => {
    if (!chartSuggestions.find((existing) => existing.title === chart.title)) {
      chartSuggestions.push(chart);
    }
  });

  if (chartSuggestions.length === 0) {
    addInsight(`Dataset contains ${rows.length.toLocaleString()} rows across ${headers.length} columns.`);
  }

  const kpis = numericColumns.slice(0, 4).map((column) => ({
    label: column.name,
    value:
      Math.abs(column.sum || 0) >= 1000
        ? (column.sum || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
        : (column.average || 0).toFixed(2),
    helperText:
      Math.abs(column.sum || 0) >= 1000
        ? `Sum across ${rows.length} rows`
        : `Average across ${rows.length} rows`,
  }));

  return {
    rowCount: rows.length,
    columnCount: headers.length,
    columns: columnProfiles.map(({ type, isIdLike, isMultiValue, ...rest }) => rest),
    kpis,
    insights,
    chartSuggestions,
  };
};
