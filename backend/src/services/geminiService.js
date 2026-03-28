import { GoogleGenerativeAI } from "@google/generative-ai";
import { env, isGeminiConfigured } from "../config/env.js";

const VALID_CHART_TYPES = new Set(["bar", "line", "pie", "area", "scatter"]);

let modelInstance;

const getModel = () => {
  if (!isGeminiConfigured) {
    return null;
  }

  if (!modelInstance) {
    const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    modelInstance = client.getGenerativeModel({ model: env.GEMINI_MODEL });
  }

  return modelInstance;
};

const stripCodeFences = (value) =>
  String(value ?? "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const extractJsonObject = (value) => {
  const text = stripCodeFences(value);
  const match = text.match(/\{[\s\S]*\}/);
  return {
    text,
    json: match?.[0] ?? null,
  };
};

const normalizeText = (value) => String(value ?? "").trim();

const normalizeTable = (table) => {
  if (!table || typeof table !== "object") return null;
  if (!Array.isArray(table.columns) || !Array.isArray(table.rows)) return null;

  return {
    columns: table.columns.map((column) => String(column)),
    rows: table.rows,
  };
};

const toChartPoint = (point, index = 0) => {
  if (!point || typeof point !== "object") {
    return null;
  }

  const rawLabel = point.name ?? point.label ?? point.x ?? point.period ?? point.category;
  const rawValue = point.value ?? point.y;
  const label = normalizeText(rawLabel || `Item ${index + 1}`);
  const value = typeof rawValue === "number" ? rawValue : Number(rawValue);

  if (!label || !Number.isFinite(value)) {
    return null;
  }

  return {
    ...point,
    name: label,
    value: Number(value),
    x: normalizeText(point.x ?? label),
    label: normalizeText(point.label ?? label),
  };
};

const validateChart = (chart) => {
  if (!chart || typeof chart !== "object") {
    return null;
  }

  let points = [];
  if (Array.isArray(chart.data)) {
    points = chart.data;
  } else if (Array.isArray(chart.rows)) {
    const xKey = normalizeText(chart.xKey || "name");
    const yKey = normalizeText(chart.yKey || chart.dataKey || "value");
    points = chart.rows.map((row) => ({
      ...row,
      name: row?.[xKey] ?? row?.name ?? row?.label ?? row?.x,
      value: row?.[yKey] ?? row?.value ?? row?.y,
      x: row?.[xKey] ?? row?.x ?? row?.name,
      label: row?.label ?? row?.[xKey] ?? row?.name,
    }));
  }

  const validData = points
    .map((point, index) => toChartPoint(point, index))
    .filter(Boolean);

  if (!validData.length) {
    return null;
  }

  const rawType = normalizeText(chart.type || chart.chartType || "bar").toLowerCase();
  const type = VALID_CHART_TYPES.has(rawType) ? rawType : "bar";

  return {
    title: normalizeText(chart.title || "Chart"),
    type,
    xKey: normalizeText(chart.xKey || "name"),
    dataKey: normalizeText(chart.dataKey || chart.yKey || "value"),
    data: validData.slice(0, 8),
    config: chart.config && typeof chart.config === "object" ? chart.config : {},
  };
};

const buildDatasetPrompt = ({ dataset, question, history = [] }) => {
  const summary = dataset.summary ?? {};
  const preview = Array.isArray(dataset.previewRows) ? dataset.previewRows.slice(0, 8) : [];
  const recentHistory = Array.isArray(history) ? history.slice(-6) : [];

  return `
You are an expert analytics assistant for CSV datasets. Your role is to:
1. Answer questions about the data accurately
2. Generate SQL queries when relevant
3. Provide actionable insights
4. Return visualizable chart data when appropriate

Dataset file: ${dataset.fileName}
Row count: ${dataset.totalRows}
Columns: ${dataset.headers.join(", ")}

Dataset Summary:
${JSON.stringify(summary, null, 2)}

Preview rows (first 8):
${JSON.stringify(preview, null, 2)}

Recent conversation history:
${JSON.stringify(recentHistory, null, 2)}

User question:
${question}

IMPORTANT: You MUST return a JSON object with this EXACT structure:
{
  "answer": "A clear, concise markdown answer to the user's question. Keep it 1-3 sentences.",
  "sql": "Optional SQL query (empty string if not applicable). Use standard SQL syntax.",
  "insights": ["insight1", "insight2", "insight3"],
  "chart": {
    "title": "Descriptive chart title",
    "type": "bar|line|pie|area|scatter",
    "dataKey": "value",
    "data": [
      {
        "name": "Category A",
        "value": 100,
        "x": "Category A",
        "label": "Category A"
      },
      {
        "name": "Category B",
        "value": 150,
        "x": "Category B",
        "label": "Category B"
      }
    ]
  },
  "table": {
    "columns": ["column1", "column2"],
    "rows": []
  },
  "meta": {
    "queryIntent": "summary",
    "confidence": 0.8,
    "sql_source": "gemini"
  }
}

CHART DATA REQUIREMENTS:
- data array must have 3-8 points for optimal visualization
- Each data point MUST have these fields:
  * "name": string - the category or label name
  * "value": number - the numeric value to plot
  * "x": string - x-axis label (can be same as name)
  * "label": string - tooltip or legend label (can be same as name)
- All numbers in value must be valid numbers, not strings
- Chart type must be one of: bar, line, pie, area, scatter
- If no chart is appropriate, return null for chart

ANSWER REQUIREMENTS:
- Be concise and data-driven
- Reference specific numbers from the data
- Use markdown formatting where useful
- If you cannot answer, explain why

INSIGHTS REQUIREMENTS:
- Return 2-4 key insights
- Each insight should be brief and specific
- Include concrete numbers when possible

SQL REQUIREMENTS:
- Only include SQL if relevant
- Use standard SQL
- Return empty string if not applicable
- Use column names exactly as provided

Return JSON only.
  `.trim();
};

const parseGeminiResponse = (rawText) => {
  const { text, json } = extractJsonObject(rawText);

  if (!text) {
    throw new Error("Gemini response did not include text output.");
  }

  if (!json) {
    return {
      answer: text,
      sql: "",
      insights: [],
      chart: null,
      table: null,
      meta: {},
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    console.error("[gemini] failed to parse JSON payload", error);
    return {
      answer: text,
      sql: "",
      insights: [],
      chart: null,
      table: null,
      meta: {},
    };
  }

  return {
    answer:
      typeof parsed.answer === "string" && parsed.answer.trim()
        ? parsed.answer
        : "No answer available.",
    sql: typeof parsed.sql === "string" ? parsed.sql : "",
    insights: Array.isArray(parsed.insights) ? parsed.insights.map((item) => String(item)) : [],
    chart: validateChart(parsed.chart),
    table: normalizeTable(parsed.table),
    meta: parsed.meta && typeof parsed.meta === "object" ? parsed.meta : {},
  };
};

const generateFallback = ({ dataset, question }) => {
  const summary = dataset.summary ?? {};
  const lowerQuestion = String(question ?? "").toLowerCase();
  const primaryInsight =
    summary.insights?.[0] ||
    `The dataset contains ${dataset.totalRows} rows and ${dataset.headers.length} columns.`;

  const answer = [primaryInsight, ...(summary.insights || []).slice(1, 3)]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  let sql = "";
  if (lowerQuestion.includes("top") || lowerQuestion.includes("highest")) {
    const numericColumn = summary.columns?.find((column) => column.numeric);
    if (numericColumn?.name) {
      sql = `SELECT *\nFROM dataset\nORDER BY "${numericColumn.name}" DESC\nLIMIT 5;`;
    }
  }

  const chart = validateChart(summary.chartSuggestions?.[0] ?? null);

  return {
    answer: answer || "No answer available.",
    sql,
    insights: Array.isArray(summary.insights) ? summary.insights : [],
    chart,
    table: null,
    meta: {
      queryIntent: "fallback",
      confidence: 0.35,
      sql_source: "fallback",
    },
    source: "fallback",
  };
};

export const generateDatasetAnswer = async ({ message, question = message, dataset, history = [] }) => {
  const model = getModel();
  if (!model) {
    return generateFallback({ dataset, question });
  }

  try {
    const prompt = buildDatasetPrompt({ dataset, question, history });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseGeminiResponse(text);

    return {
      answer: parsed.answer || "No answer available.",
      sql: parsed.sql || "",
      insights: parsed.insights || [],
      chart: parsed.chart || null,
      table: parsed.table || null,
      meta: parsed.meta || {},
      source: "gemini",
    };
  } catch (error) {
    console.error("[gemini] failed to generate dataset answer", error);
    return generateFallback({ dataset, question });
  }
};
