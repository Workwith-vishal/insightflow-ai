import { buildCounts } from "../utils/csv.js";

const CHART_INTENT = /(show|chart|graph|distribution|compare|breakdown|trend|top|vs|histogram|pie|bar|line|scatter)/i;
const TABLE_INTENT = /(table|list|rows|data)/i;
const COUNT_INTENT = /(count|how many|number of)/i;
const EXPERIENCE_INTENT = /(experience|years? of experience|exp)/i;
const EDUCATION_INTENT = /(education|degree)/i;

const PALETTE_MAP = {
  cyan: "Cyan",
  blue: "Cyan",
  amber: "Amber",
  orange: "Amber",
  green: "Emerald",
  emerald: "Emerald",
  rose: "Rose",
  pink: "Rose",
  mixed: "Mixed",
};

const DEFAULT_CONFIG = {
  xLabel: "",
  yLabel: "",
  palette: "Cyan",
  showGrid: true,
  showLegend: false,
  curved: false,
};

const lower = (value) => String(value || "").toLowerCase();

const findColumnByKeywords = (columns, keywords) =>
  columns.find((col) => keywords.some((kw) => lower(col.name).includes(kw)));

const numericKeysFromRows = (rows) => {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  return keys.filter((key) => rows.every((row) => Number.isFinite(Number(row[key]))));
};

const buildAverageByCategory = (rows, categoryKey, numericKey) => {
  const buckets = new Map();
  rows.forEach((row) => {
    const category = row[categoryKey];
    const value = Number(row[numericKey]);
    if (!category || !Number.isFinite(value)) return;
    const entry = buckets.get(category) || { sum: 0, count: 0 };
    entry.sum += value;
    entry.count += 1;
    buckets.set(category, entry);
  });

  return [...buckets.entries()]
    .map(([category, stats]) => ({
      [categoryKey]: category,
      [numericKey]: Number((stats.sum / Math.max(stats.count, 1)).toFixed(2)),
    }))
    .sort((a, b) => Number(b[numericKey]) - Number(a[numericKey]));
};

const buildHistogram = (rows, numericKey, bins = 8) => {
  const values = rows
    .map((row) => Number(row[numericKey]))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const size = (max - min) / bins || 1;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    bucket: `${(min + i * size).toFixed(1)}-${(min + (i + 1) * size).toFixed(1)}`,
    count: 0,
  }));

  values.forEach((value) => {
    const index = Math.min(Math.floor((value - min) / size), bins - 1);
    buckets[index].count += 1;
  });

  return buckets;
};

const filterRowsByKeyword = (rows, columnKey, keyword) => {
  const kw = lower(keyword);
  return rows.filter((row) => lower(row[columnKey]).includes(kw));
};

const detectFilterKeyword = (question) => {
  const keywords = ["master", "bachelor", "phd", "doctorate", "associate", "high school", "diploma"];
  return keywords.find((kw) => lower(question).includes(kw)) || null;
};

const buildChartPayload = ({
  title,
  chartType,
  xKey,
  yKey,
  rows,
  config,
}) => ({
  title,
  chartType,
  xKey,
  yKey,
  rows,
  config: {
    ...DEFAULT_CONFIG,
    ...config,
    palette: PALETTE_MAP[lower(config?.palette)] || config?.palette || DEFAULT_CONFIG.palette,
  },
});

export const buildStructuredChatResponse = ({ dataset, question, baseAnswer }) => {
  const query = lower(question);
  const wantsChart = CHART_INTENT.test(query) || EDUCATION_INTENT.test(query) || EXPERIENCE_INTENT.test(query);
  const wantsTable = TABLE_INTENT.test(query);
  const wantsCount = COUNT_INTENT.test(query);

  const columns = dataset?.summary?.columns || [];
  const headers = dataset?.headers || [];
  const rows = dataset?.rows || [];

  if (!rows.length || !headers.length) {
    return {
      answer: baseAnswer || "No data available to chart.",
      responseType: "text",
      chart: null,
      table: null,
      meta: {
        queryIntent: "none",
        derivedFrom: "empty_dataset",
      },
    };
  }

  const educationColumn = findColumnByKeywords(columns, ["education", "degree"]);
  const countryColumn = findColumnByKeywords(columns, ["country", "location", "region"]);
  const companySizeColumn = findColumnByKeywords(columns, ["company", "size"]);
  const frameworkColumn = findColumnByKeywords(columns, ["framework", "tool", "language", "stack"]);
  const experienceColumn = findColumnByKeywords(columns, ["experience", "years", "year"]);
  const salaryColumn = findColumnByKeywords(columns, ["salary", "pay", "comp", "income", "amount", "revenue", "price"]);

  const filterKeyword = detectFilterKeyword(question);
  let workingRows = rows;
  if (filterKeyword && educationColumn) {
    workingRows = filterRowsByKeyword(rows, educationColumn.name, filterKeyword);
  }

  let chart = null;
  let table = null;
  let responseType = "text";
  let queryIntent = "text";

  if (wantsChart) {
    if (EXPERIENCE_INTENT.test(query) && experienceColumn) {
      if (query.includes("top") || query.includes("most")) {
        const counts = buildCounts(workingRows, headers.indexOf(experienceColumn.name));
        const chartRows = counts.slice(0, 8).map((entry) => ({
          [experienceColumn.name]: entry.name,
          count: entry.value,
        }));
        chart = buildChartPayload({
          title: `${experienceColumn.name} (Top)` ,
          chartType: "bar",
          xKey: experienceColumn.name,
          yKey: "count",
          rows: chartRows,
          config: { xLabel: experienceColumn.name, yLabel: "Count", palette: "cyan", showGrid: true },
        });
        queryIntent = "top_experience";
      } else {
        const chartRows = buildHistogram(workingRows, experienceColumn.name);
        if (chartRows.length) {
          chart = buildChartPayload({
            title: `${experienceColumn.name} Distribution`,
            chartType: "bar",
            xKey: "bucket",
            yKey: "count",
            rows: chartRows,
            config: { xLabel: experienceColumn.name, yLabel: "Count", palette: "cyan", showGrid: true },
          });
          queryIntent = "experience_histogram";
        }
      }
    } else if (EDUCATION_INTENT.test(query) && educationColumn) {
      const counts = buildCounts(workingRows, headers.indexOf(educationColumn.name));
      const topCounts = counts.slice(0, 5);
      const chartRows = topCounts.map((entry) => ({
        [educationColumn.name]: entry.name,
        count: entry.value,
      }));
      chart = buildChartPayload({
        title: "Top Education Levels",
        chartType: "bar",
        xKey: educationColumn.name,
        yKey: "count",
        rows: chartRows,
        config: { xLabel: educationColumn.name, yLabel: "Count", palette: "cyan", showGrid: true },
      });
      queryIntent = "top_education";
    } else if (query.includes("histogram") && salaryColumn) {
      const chartRows = buildHistogram(workingRows, salaryColumn.name);
      if (chartRows.length) {
        chart = buildChartPayload({
          title: `${salaryColumn.name} Histogram`,
          chartType: "bar",
          xKey: "bucket",
          yKey: "count",
          rows: chartRows,
          config: { xLabel: salaryColumn.name, yLabel: "Count", palette: "cyan", showGrid: true },
        });
        queryIntent = "histogram";
      }
    } else if (query.includes("top") && salaryColumn) {
      const category = countryColumn || companySizeColumn || frameworkColumn || educationColumn;
      if (category) {
        const chartRows = buildAverageByCategory(workingRows, category.name, salaryColumn.name).slice(0, 8);
        chart = buildChartPayload({
          title: `Top ${category.name} by ${salaryColumn.name}`,
          chartType: "bar",
          xKey: category.name,
          yKey: salaryColumn.name,
          rows: chartRows,
          config: { xLabel: category.name, yLabel: salaryColumn.name, palette: "cyan", showGrid: true },
        });
        queryIntent = "top_by_numeric";
      }
    } else if (query.includes("compare") && salaryColumn && countryColumn) {
      const chartRows = buildAverageByCategory(workingRows, countryColumn.name, salaryColumn.name).slice(0, 10);
      chart = buildChartPayload({
        title: `${salaryColumn.name} by ${countryColumn.name}`,
        chartType: "bar",
        xKey: countryColumn.name,
        yKey: salaryColumn.name,
        rows: chartRows,
        config: { xLabel: countryColumn.name, yLabel: salaryColumn.name, palette: "cyan", showGrid: true },
      });
      queryIntent = "compare";
    } else {
      const category =
        findColumnByKeywords(columns, ["education", "degree", "country", "company", "size", "framework", "language", "role"]) ||
        countryColumn ||
        educationColumn ||
        frameworkColumn ||
        companySizeColumn;

      if (category) {
        const counts = buildCounts(workingRows, headers.indexOf(category.name));
        const chartRows = counts.slice(0, 12).map((entry) => ({
          [category.name]: entry.name,
          count: entry.value,
        }));
        const isPie = query.includes("pie");
        const isLine = query.includes("line") || query.includes("trend");
        const chartType = isPie ? "pie" : isLine ? "line" : "bar";
        chart = buildChartPayload({
          title: `${category.name} Distribution`,
          chartType,
          xKey: category.name,
          yKey: "count",
          rows: chartRows,
          config: { xLabel: category.name, yLabel: "Count", palette: "cyan", showGrid: true, showLegend: isPie },
        });
        queryIntent = "categorical_distribution";
      }
    }
  }

  if (chart && (wantsTable || query.includes("table"))) {
    table = {
      columns: [chart.xKey, chart.yKey],
      rows: chart.rows,
    };
  }

  if (!table && wantsTable) {
    table = {
      columns: headers,
      rows: rows.slice(0, 20).map((row) =>
        headers.reduce((acc, header, index) => {
          acc[header] = row[index] ?? "";
          return acc;
        }, {}),
      ),
    };
  }

  if (chart) {
    responseType = table ? "text+chart+table" : "text+chart";
  } else if (table) {
    responseType = "text+table";
  }

  let answer = baseAnswer;
  if (!answer) {
    if (wantsCount && filterKeyword && educationColumn) {
      answer = `There are ${workingRows.length.toLocaleString()} rows matching ${filterKeyword} in ${educationColumn.name}.`;
    } else if (queryIntent === "top_education" && educationColumn) {
      const counts = buildCounts(workingRows, headers.indexOf(educationColumn.name));
      const top = counts[0];
      if (top) {
        answer = `The most common education level is ${top.name}, with ${top.value.toLocaleString()} people. Here is a quick breakdown of the top education categories.`;
      }
    } else {
      answer = "Here is the summary based on your request.";
    }
  }

  return {
    answer,
    responseType,
    chart,
    table,
    meta: {
      queryIntent,
      derivedFrom: filterKeyword ? "filtered_dataset" : "full_dataset",
      filterKeyword: filterKeyword || undefined,
    },
  };
};
