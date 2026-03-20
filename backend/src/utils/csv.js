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

export const summarizeDataset = (dataset) => {
  const { headers, rows } = dataset;
  const columnStats = headers.map((header, index) => {
    const values = rows.map((row) => row[index]).filter((value) => value !== "");
    const numericValues = values.filter(isNumeric).map(Number);
    const uniqueValues = new Set(values);

    const base = {
      name: header,
      filled: values.length,
      unique: uniqueValues.size,
      sampleValues: values.slice(0, 5),
      numeric: numericValues.length === values.length && numericValues.length > 0,
    };

    if (!base.numeric) {
      return base;
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
    };
  });

  const numericColumns = columnStats.filter((column) => column.numeric);
  const categoricalColumns = columnStats.filter((column) => !column.numeric);
  const primaryMetric = numericColumns[0] || null;
  const primaryCategory = categoricalColumns[0] || null;

  const insights = [];

  if (primaryMetric) {
    insights.push(
      `${primaryMetric.name} has an average value of ${primaryMetric.average.toFixed(2)} across ${rows.length} rows.`,
    );
    insights.push(
      `${primaryMetric.name} ranges from ${primaryMetric.min.toFixed(2)} to ${primaryMetric.max.toFixed(2)}.`,
    );
  }

  if (primaryCategory) {
    const counts = new Map();
    rows.forEach((row) => {
      const key = row[headers.indexOf(primaryCategory.name)] || "Unknown";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const topValues = [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3);

    if (topValues.length > 0) {
      insights.push(
        `Top ${primaryCategory.name} values: ${topValues
          .map(([value, count]) => `${value} (${count})`)
          .join(", ")}.`,
      );
    }
  }

  const chartSuggestions = [];

  if (primaryCategory && primaryMetric) {
    const categoryIndex = headers.indexOf(primaryCategory.name);
    const metricIndex = headers.indexOf(primaryMetric.name);
    const grouped = new Map();

    rows.forEach((row) => {
      const key = row[categoryIndex] || "Unknown";
      const value = Number(row[metricIndex] || 0);
      grouped.set(key, (grouped.get(key) || 0) + value);
    });

    chartSuggestions.push({
      title: `${primaryMetric.name} by ${primaryCategory.name}`,
      type: "bar",
      dataKey: "value",
      data: [...grouped.entries()].slice(0, 8).map(([name, value]) => ({
        name,
        value: Number(value.toFixed(2)),
      })),
    });
  }

  if (primaryMetric) {
    chartSuggestions.push({
      title: `${primaryMetric.name} distribution preview`,
      type: "line",
      dataKey: "value",
      data: rows.slice(0, 12).map((row, index) => ({
        name: `Row ${index + 1}`,
        value: Number(row[headers.indexOf(primaryMetric.name)] || 0),
      })),
    });
  }

  const kpis = numericColumns.slice(0, 4).map((column) => ({
    label: column.name,
    value:
      Math.abs(column.sum) >= 1000
        ? column.sum.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : column.average.toFixed(2),
    helperText:
      Math.abs(column.sum) >= 1000
        ? `Sum across ${rows.length} rows`
        : `Average across ${rows.length} rows`,
  }));

  return {
    rowCount: rows.length,
    columnCount: headers.length,
    columns: columnStats,
    kpis,
    insights,
    chartSuggestions,
  };
};
