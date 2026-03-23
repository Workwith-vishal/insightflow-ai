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

const isRowIndexHeader = (header) => {
  const lower = String(header || "").trim().toLowerCase();
  return ["row", "row_id", "rowid", "index", "idx"].includes(lower);
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

export const buildCounts = (rows, columnIndex, { multiValue = false } = {}) => {
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

const buildDateCounts = (rows, columnIndex) => {
  const counts = new Map();
  rows.forEach((row) => {
    const raw = row[columnIndex];
    if (!raw) return;
    if (isYearLike(raw)) {
      const year = String(raw);
      counts.set(year, (counts.get(year) || 0) + 1);
      return;
    }
    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) return;
    const label = new Date(parsed).toISOString().split("T")[0];
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
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
    const avgLength = values.length
      ? values.reduce((total, value) => total + String(value || "").length, 0) / values.length
      : 0;
    const isRowIndex = isRowIndexHeader(header);
    const isNearUnique = uniqueRatio >= 0.9 && uniqueValues.size > 10;

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

    const isHighCardText =
      type === "text" && (uniqueRatio > 0.8 || uniqueValues.size > 200 || avgLength > 24);

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
        isHighCardText,
        isNearUnique,
        isRowIndex,
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
      isHighCardText,
      isNearUnique,
      isRowIndex,
    };
  });

  const usableColumns = columnProfiles.filter((column) => !column.isIdLike && !column.isRowIndex);
  const numericColumns = usableColumns.filter((column) => column.type === "numeric");
  const categoricalColumns = usableColumns.filter(
    (column) =>
      column.type === "categorical" && !column.isHighCardText && !column.isNearUnique,
  );
  const dateColumns = usableColumns.filter((column) => column.type === "date");
  const multiValueColumns = usableColumns.filter(
    (column) => column.isMultiValue && !column.isHighCardText && !column.isNearUnique,
  );

  const insights = [];
  const chartSuggestions = [];
  const chartInsightMap = new Map();

  const addInsight = (text) => {
    if (text && insights.length < 8) {
      insights.push(text);
    }
  };

  const candidates = [];
  const pushCandidate = (chart, type, priority, insight) => {
    if (!chart || !Array.isArray(chart.data) || chart.data.length === 0) return;
    candidates.push({ chart, type, priority });
    if (insight) {
      chartInsightMap.set(chart.title, insight);
    }
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

  const typeColumn = findColumn(
    (column) => column.type === "categorical" && column.name.toLowerCase().includes("type"),
  );
  const ratingColumn = findColumn(
    (column) => column.type === "categorical" && column.name.toLowerCase().includes("rating"),
  );
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
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const top = data[0];
    const share = total ? ((top.value / total) * 100).toFixed(1) : "0";
    pushCandidate(
      {
        title: "Content Type Distribution",
        type: "pie",
        dataKey: "value",
        data: data.slice(0, 8),
      },
      "pie",
      90,
      top ? `Most common content type is ${top.name} (${share}% of records).` : null,
    );
  }

  if (releaseYearColumn && (releaseYearColumn.type === "numeric" || releaseYearColumn.type === "date")) {
    const data = buildYearCounts(rows, headers.indexOf(releaseYearColumn.name));
    const peak = data.length
      ? data.reduce((best, current) => (current.value > best.value ? current : best), data[0])
      : null;
    pushCandidate(
      {
        title: "Titles by Release Year",
        type: "line",
        dataKey: "value",
        data,
      },
      "line",
      90,
      peak ? `Peak release year is ${peak.name} with ${peak.value} records.` : null,
    );
  }

  if (ratingColumn) {
    const data = buildCounts(rows, headers.indexOf(ratingColumn.name));
    const top = data[0];
    pushCandidate(
      {
        title: "Ratings Distribution",
        type: "bar",
        dataKey: "value",
        data: data.slice(0, 10),
      },
      "bar",
      80,
      top ? `Top rating is ${top.name} (${top.value} records).` : null,
    );
  }

  if (genreColumn) {
    const isMultiValue = genreColumn.isMultiValue || genreColumn.type === "categorical";
    const data = buildCounts(rows, headers.indexOf(genreColumn.name), { multiValue: isMultiValue });
    const top = data[0];
    pushCandidate(
      {
        title: "Top Genres",
        type: "bar",
        dataKey: "value",
        data: data.slice(0, 10),
      },
      "bar",
      70,
      top ? `Most common genre is ${top.name} (${top.value} records).` : null,
    );
  }

  if (countryColumn) {
    const data = buildCounts(rows, headers.indexOf(countryColumn.name), { multiValue: countryColumn.isMultiValue });
    const top = data[0];
    pushCandidate(
      {
        title: "Top Countries",
        type: "bar",
        dataKey: "value",
        data: data.slice(0, 10),
      },
      "bar",
      75,
      top ? `Top country is ${top.name} (${top.value} records).` : null,
    );
  }

  const lowCardCategorical = categoricalColumns.filter((column) => column.unique <= 8);
  const bestPieColumn = pickBest(lowCardCategorical, ["education", "company", "size", "type", "level"]);
  if (bestPieColumn) {
    const data = buildCounts(rows, headers.indexOf(bestPieColumn.name));
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const top = data[0];
    const share = total ? ((top.value / total) * 100).toFixed(1) : "0";
    pushCandidate(
      {
        title: `${bestPieColumn.name} Distribution`,
        type: "pie",
        dataKey: "value",
        data: data.slice(0, 8),
      },
      "pie",
      85,
      top ? `${top.name} leads ${bestPieColumn.name} (${share}% of records).` : null,
    );
  }

  const bestBarColumn = pickBest(categoricalColumns, ["country", "education", "company", "size", "type"]);
  if (bestBarColumn) {
    const data = buildCounts(rows, headers.indexOf(bestBarColumn.name), { multiValue: bestBarColumn.isMultiValue });
    const top = data[0];
    pushCandidate(
      {
        title: `Top ${bestBarColumn.name}`,
        type: "bar",
        dataKey: "value",
        data: data.slice(0, 12),
      },
      "bar",
      60,
      top ? `Most common ${bestBarColumn.name} is ${top.name} (${top.value} records).` : null,
    );
  }

  const bestMultiValue = pickBest(multiValueColumns, ["language", "framework", "skill", "tool"]);
  if (bestMultiValue) {
    const data = buildCounts(rows, headers.indexOf(bestMultiValue.name), { multiValue: true });
    const top = data[0];
    pushCandidate(
      {
        title: `Top ${bestMultiValue.name}`,
        type: "bar",
        dataKey: "value",
        data: data.slice(0, 12),
      },
      "bar",
      65,
      top ? `Top ${bestMultiValue.name} value is ${top.name} (${top.value} records).` : null,
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
      const maxPoint = data.length
        ? data.reduce((best, current) => (current.value > best.value ? current : best), data[0])
        : null;
      pushCandidate(
        {
          title: `${xCol.name} vs ${yCol.name}`,
          type: "scatter",
          dataKey: "value",
          data,
        },
        "scatter",
        90,
        maxPoint ? `Highest ${yCol.name} observed at ${xCol.name} ${maxPoint.name} (${maxPoint.value}).` : null,
      );
    }
  }

  if (dateColumns.length > 0) {
    const dateCol = pickBest(dateColumns, ["date", "year"]);
    if (dateCol) {
      const dateIndex = headers.indexOf(dateCol.name);
      const numCol = pickBest(numericColumns, ["amount", "revenue", "salary", "price", "score"]);
      let data = [];
      let insight = null;
      if (numCol) {
        const numIndex = headers.indexOf(numCol.name);
        const grouped = new Map();
        rows.forEach((row) => {
          const rawDate = row[dateIndex];
          const rawValue = row[numIndex];
          if (!rawDate || rawValue === "") return;
          const parsed = Date.parse(rawDate);
          if (Number.isNaN(parsed)) return;
          const label = isYearLike(rawDate)
            ? String(rawDate)
            : new Date(parsed).toISOString().split("T")[0];
          const entry = grouped.get(label) || { sum: 0, count: 0 };
          entry.sum += Number(rawValue);
          entry.count += 1;
          grouped.set(label, entry);
        });
        data = [...grouped.entries()]
          .sort((a, b) => (a[0] > b[0] ? 1 : -1))
          .map(([name, bucket]) => ({
            name,
            value: bucket.count ? Number((bucket.sum / bucket.count).toFixed(2)) : 0,
          }));
        const peak = data.length
          ? data.reduce((best, current) => (current.value > best.value ? current : best), data[0])
          : null;
        insight = peak
          ? `Peak ${dateCol.name} is ${peak.name} (avg ${numCol.name} ${peak.value}).`
          : null;
      } else {
        data = buildDateCounts(rows, dateIndex);
        const peak = data.length
          ? data.reduce((best, current) => (current.value > best.value ? current : best), data[0])
          : null;
        insight = peak ? `Peak ${dateCol.name} is ${peak.name} with ${peak.value} records.` : null;
      }
      pushCandidate(
        {
          title: `${dateCol.name} Trend`,
          type: "area",
          dataKey: "value",
          data,
        },
        "area",
        80,
        insight,
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
        yCol ? `Average ${yCol.name} changes across ${xCol.name} buckets.` : `Distribution of ${xCol.name} across buckets.`,
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
          `Average ${numCol.name} is ${(numCol.average || 0).toFixed(2)} (min ${min.toFixed(2)}, max ${max.toFixed(2)}).`,
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

  const primaryCharts = [];
  const barChart = selectedByType.get("bar");
  const pieChart = selectedByType.get("pie");
  const lineChart = selectedByType.get("line");
  const areaChart = selectedByType.get("area");
  const scatterChart = selectedByType.get("scatter");

  if (barChart) primaryCharts.push(barChart);
  if (pieChart) primaryCharts.push(pieChart);
  if (lineChart || areaChart) primaryCharts.push(lineChart || areaChart);
  if (scatterChart) primaryCharts.push(scatterChart);

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

  if (chartSuggestions.length < 6) {
    candidates
      .sort((a, b) => b.priority - a.priority)
      .forEach(({ chart }) => {
        if (chartSuggestions.length >= 6) return;
        if (chartSuggestions.find((existing) => existing.title === chart.title)) return;
        chartSuggestions.push(chart);
      });
  }

  // Fallbacks to keep 4 charts when possible (safe, bounded, and data-aware)
  const addChartSuggestion = (chart) => {
    if (!chart || !Array.isArray(chart.data) || chart.data.length === 0) return;
    if (chartSuggestions.find((existing) => existing.title === chart.title)) return;
    chartSuggestions.push(chart);
  };

  if (chartSuggestions.length < 4) {
    const fallbackCategorical = categoricalColumns.find(
      (column) => !column.isHighCardText && !column.isNearUnique,
    );
    if (fallbackCategorical) {
      const data = buildCounts(rows, headers.indexOf(fallbackCategorical.name), {
        multiValue: fallbackCategorical.isMultiValue,
      }).slice(0, 8);
      addChartSuggestion({
        title: `${fallbackCategorical.name} Breakdown`,
        type: "bar",
        dataKey: "value",
        data,
      });
    }
  }

  if (chartSuggestions.length < 4) {
    const fallbackNumeric = numericColumns[0];
    if (fallbackNumeric) {
      const numericIndex = headers.indexOf(fallbackNumeric.name);
      const values = rows
        .map((row) => Number(row[numericIndex]))
        .filter((value) => Number.isFinite(value));
      if (values.length) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const bins = 6;
        const size = (max - min) / bins || 1;
        const buckets = Array.from({ length: bins }, (_, i) => ({
          name: `${(min + i * size).toFixed(1)}-${(min + (i + 1) * size).toFixed(1)}`,
          value: 0,
        }));
        values.forEach((value) => {
          const index = Math.min(Math.floor((value - min) / size), bins - 1);
          buckets[index].value += 1;
        });
        addChartSuggestion({
          title: `${fallbackNumeric.name} Distribution`,
          type: "bar",
          dataKey: "value",
          data: buckets,
        });
      }
    }
  }

  if (chartSuggestions.length === 0) {
    addInsight(`Dataset contains ${rows.length.toLocaleString()} rows across ${headers.length} columns.`);
  }

  const chartDrivenInsights = [];
  chartSuggestions.forEach((chart) => {
    const insight = chartInsightMap.get(chart.title);
    if (insight) {
      chartDrivenInsights.push(insight);
    }
  });

  chartDrivenInsights.slice(0, 6).forEach((text) => addInsight(text));

  if (!insights.length) {
    addInsight(`Dataset contains ${rows.length.toLocaleString()} rows across ${headers.length} columns.`);
  }

  const keyNumeric = pickBest(numericColumns, ["salary", "amount", "revenue", "price", "score", "value"]);
  const keyCategory = pickBest(categoricalColumns, ["country", "education", "company", "size", "type"]);
  let topCategoryKpi = null;
  let topCategoryHelper = "Usable categorical fields";
  if (keyCategory) {
    const counts = buildCounts(rows, headers.indexOf(keyCategory.name), { multiValue: keyCategory.isMultiValue });
    if (counts[0]) {
      topCategoryKpi = {
        label: `Top ${keyCategory.name}`,
        value: String(counts[0].name),
        helperText: `${counts[0].value} records`,
      };
      topCategoryHelper = `Top ${keyCategory.name}: ${counts[0].name} (${counts[0].value})`;
    }
  }

  const numericHelper = keyNumeric
    ? `Avg ${keyNumeric.name} ${(keyNumeric.average || 0).toFixed(2)} · Max ${keyNumeric.max != null ? keyNumeric.max.toFixed(2) : "n/a"}`
    : "Usable numeric fields";

  const kpis = [
    {
      label: "Total Rows",
      value: rows.length.toLocaleString(),
      helperText: "Rows in dataset",
    },
    {
      label: "Total Columns",
      value: headers.length.toLocaleString(),
      helperText: "Columns detected",
    },
    {
      label: "Numeric Columns",
      value: numericColumns.length.toString(),
      helperText: numericHelper,
    },
    {
      label: "Categorical Columns",
      value: categoricalColumns.length.toString(),
      helperText: topCategoryHelper,
    },
    keyNumeric
      ? {
          label: `Avg ${keyNumeric.name}`,
          value: (keyNumeric.average || 0).toFixed(2),
          helperText: `Max ${keyNumeric.max != null ? keyNumeric.max.toFixed(2) : "n/a"}`,
        }
      : null,
    topCategoryKpi,
  ].filter(Boolean);

  return {
    rowCount: rows.length,
    columnCount: headers.length,
    columns: columnProfiles.map(
      ({ type, isIdLike, isMultiValue, isHighCardText, isNearUnique, isRowIndex, ...rest }) => rest,
    ),
    kpis,
    insights,
    chartSuggestions,
  };
};
