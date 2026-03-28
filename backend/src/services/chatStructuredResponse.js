const normalizeText = (value) => String(value ?? "").trim();

const parseNumber = (value) => {
  const raw = normalizeText(value);
  if (!raw) return null;
  const numeric = Number(raw.replace(/,/g, "").replace(/[^\d.+-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const looksLikeDate = (value) => {
  const raw = normalizeText(value);
  if (!raw) return false;
  if (/^\d{4}$/.test(raw)) return true;
  return Number.isFinite(Date.parse(raw));
};

const toMonthKey = (value) => {
  const raw = normalizeText(value);
  if (/^\d{4}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
};

const formatTable = (columns, rows) => ({
  columns,
  rows,
});

const toChartPoint = (label, value, extra = {}) => ({
  ...extra,
  name: String(label ?? "Unknown"),
  value: Number(value),
  x: String(label ?? "Unknown"),
  label: String(label ?? "Unknown"),
});

const normalizeChart = (chart) => {
  if (!chart || typeof chart !== "object" || !Array.isArray(chart.data)) {
    return null;
  }

  const data = chart.data
    .map((point, index) =>
      toChartPoint(
        point?.name ?? point?.label ?? point?.x ?? point?.period ?? `Item ${index + 1}`,
        point?.value ?? point?.y ?? 0,
        point,
      ),
    )
    .filter((point) => Number.isFinite(point.value));

  if (!data.length) {
    return null;
  }

  return {
    title: String(chart.title || "Chart"),
    type: chart.type || "bar",
    xKey: "name",
    dataKey: "value",
    data,
    config: {
      palette: "cyan",
      showGrid: chart.type !== "pie",
      showLegend: chart.type === "pie",
      curved: chart.type === "line" || chart.type === "area",
      ...(chart.config && typeof chart.config === "object" ? chart.config : {}),
    },
  };
};

const buildChart = (title, type, rows, config = {}) =>
  normalizeChart({
    title,
    type,
    data: rows,
    config,
  });

const findColumns = (dataset, question) => {
  const columns = dataset.summary?.columns || [];
  const questionLower = question.toLowerCase();

  const mentioned = (list) =>
    list.find((column) => questionLower.includes(column.name.toLowerCase()));

  const numericColumns = columns.filter((column) => column.numeric);
  const categoricalColumns = columns.filter((column) => column.detectedType === "categorical");
  const dateColumns = columns.filter((column) => column.detectedType === "datetime");

  return {
    numeric: mentioned(numericColumns) || numericColumns[0],
    categorical: mentioned(categoricalColumns) || categoricalColumns[0],
    date: mentioned(dateColumns) || dateColumns[0],
  };
};

const buildDatasetOverviewResponse = (dataset) => {
  const summary = dataset.summary;
  const chart = summary?.chartSuggestions?.[0];

  return {
    answer: `The current dataset **${dataset.fileName}** has ${dataset.totalRows.toLocaleString()} rows and ${dataset.headers.length} columns.`,
    sql: "",
    insights: summary?.insights?.slice(0, 3) || [],
    chart: normalizeChart(chart),
    table: formatTable(dataset.headers, dataset.previewRows.slice(0, 10).map((row) => (
      Object.fromEntries(dataset.headers.map((header, index) => [header, row[index] ?? ""]))
    ))),
    meta: {
      queryIntent: "overview",
      confidence: 0.45,
      rows_returned: dataset.previewRows.length,
      sql_source: "fallback",
    },
    source: "fallback",
  };
};

const buildCategoricalAggregation = (dataset, question, metricMode) => {
  const { numeric, categorical } = findColumns(dataset, question);
  if (!categorical) return null;

  const rows = dataset.records;
  const grouped = new Map();

  rows.forEach((row) => {
    const key = normalizeText(row[categorical.name]);
    if (!key) return;

    if (metricMode === "count" || !numeric) {
      grouped.set(key, (grouped.get(key) || 0) + 1);
      return;
    }

    const numericValue = parseNumber(row[numeric.name]);
    if (numericValue === null) return;

    const current = grouped.get(key) || { sum: 0, count: 0 };
    grouped.set(key, { sum: current.sum + numericValue, count: current.count + 1 });
  });

  const resultRows = [...grouped.entries()].map(([name, value]) => {
    if (metricMode === "count" || !numeric) {
      return toChartPoint(name, value);
    }

    if (metricMode === "average") {
      return toChartPoint(name, Number((value.sum / Math.max(value.count, 1)).toFixed(2)));
    }

    return toChartPoint(name, Number(value.sum.toFixed(2)));
  });

  resultRows.sort((a, b) => b.value - a.value);

  const limit = question.toLowerCase().includes("top 5") ? 5 : 10;
  const limitedRows = resultRows.slice(0, limit);
  const titlePrefix =
    metricMode === "average"
      ? `Average ${numeric?.name || "Value"} by ${categorical.name}`
      : metricMode === "sum"
        ? `Total ${numeric?.name || "Value"} by ${categorical.name}`
        : `${categorical.name} Distribution`;

  const sql =
    metricMode === "average" && numeric
      ? `SELECT ${categorical.name}, AVG(${numeric.name}) AS value FROM dataset GROUP BY ${categorical.name} ORDER BY value DESC LIMIT ${limit};`
      : metricMode === "sum" && numeric
        ? `SELECT ${categorical.name}, SUM(${numeric.name}) AS value FROM dataset GROUP BY ${categorical.name} ORDER BY value DESC LIMIT ${limit};`
        : `SELECT ${categorical.name}, COUNT(*) AS value FROM dataset GROUP BY ${categorical.name} ORDER BY value DESC LIMIT ${limit};`;

  return {
    answer: `I analyzed **${categorical.name}** and found ${limitedRows.length} grouped result${limitedRows.length === 1 ? "" : "s"}.`,
    sql,
    insights: [
      `${categorical.name} is the grouping dimension for this answer.`,
      limitedRows[0] ? `${limitedRows[0].name} is the leading category with value ${limitedRows[0].value}.` : "No grouped values were found.",
    ],
    chart: buildChart(
      titlePrefix,
      limitedRows.length <= 6 && metricMode === "count" ? "pie" : "bar",
      limitedRows,
      {
        xLabel: categorical.name,
        yLabel: metricMode === "count" ? "Count" : numeric?.name || "Value",
      },
    ),
    table: formatTable(["name", "value"], limitedRows),
    meta: {
      queryIntent: metricMode,
      confidence: 0.62,
      rows_returned: limitedRows.length,
      sql_source: "fallback",
    },
    source: "fallback",
  };
};

const buildTrendResponse = (dataset, question) => {
  const { numeric, date } = findColumns(dataset, question);
  if (!numeric || !date) return null;

  const grouped = new Map();
  dataset.records.forEach((row) => {
    const dateKey = toMonthKey(row[date.name]);
    const numericValue = parseNumber(row[numeric.name]);
    if (!dateKey || numericValue === null) return;
    grouped.set(dateKey, (grouped.get(dateKey) || 0) + numericValue);
  });

  const rows = [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 24)
    .map(([period, value]) => toChartPoint(period, Number(value.toFixed(2)), { period }));

  if (rows.length < 2) return null;

  return {
    answer: `I found ${rows.length} time periods for **${numeric.name}** over **${date.name}**.`,
    sql: `SELECT ${date.name}, SUM(${numeric.name}) AS value FROM dataset GROUP BY ${date.name} ORDER BY ${date.name} ASC;`,
    insights: [
      `${numeric.name} was aggregated over time using ${date.name}.`,
      `${rows[0].period} to ${rows[rows.length - 1].period} are included in the trend view.`,
    ],
    chart: buildChart(
      `${numeric.name} Over Time`,
      "line",
      rows,
      {
        xLabel: date.name,
        yLabel: numeric.name,
        curved: true,
        palette: "emerald",
      },
    ),
    table: formatTable(["period", "value"], rows),
    meta: {
      queryIntent: "trend",
      confidence: 0.66,
      rows_returned: rows.length,
      sql_source: "fallback",
    },
    source: "fallback",
  };
};

export const buildFallbackChatResponse = ({ message, dataset }) => {
  const question = message.trim().toLowerCase();
  if (!question) {
    return {
      answer: "Please ask a question about the uploaded dataset.",
      sql: "",
      insights: [],
      chart: null,
      table: null,
      meta: {
        queryIntent: "empty",
        confidence: 0.2,
        rows_returned: 0,
        sql_source: "fallback",
      },
      source: "fallback",
    };
  }

  if (question.includes("trend") || question.includes("over time")) {
    const trend = buildTrendResponse(dataset, question);
    if (trend) return trend;
  }

  if (question.includes("average") || question.includes("avg")) {
    const average = buildCategoricalAggregation(dataset, question, "average");
    if (average) return average;
  }

  if (question.includes("sum") || question.includes("total")) {
    const sum = buildCategoricalAggregation(dataset, question, "sum");
    if (sum) return sum;
  }

  if (question.includes("count") || question.includes("distribution") || question.includes("breakdown")) {
    const count = buildCategoricalAggregation(dataset, question, "count");
    if (count) return count;
  }

  if (question.includes("top")) {
    const top = buildCategoricalAggregation(dataset, question, "sum")
      || buildCategoricalAggregation(dataset, question, "average")
      || buildCategoricalAggregation(dataset, question, "count");
    if (top) return top;
  }

  return buildDatasetOverviewResponse(dataset);
};
