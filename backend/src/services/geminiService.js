import { GoogleGenerativeAI } from "@google/generative-ai";
import { env, isGeminiConfigured } from "../config/env.js";

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
  value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const normalizeChart = (chart) => {
  if (!chart || typeof chart !== "object") return null;
  if (!chart.chartType || !chart.xKey || !chart.yKey || !Array.isArray(chart.rows)) return null;

  return {
    title: typeof chart.title === "string" ? chart.title : "AI Chart",
    chartType: chart.chartType,
    xKey: chart.xKey,
    yKey: chart.yKey,
    rows: chart.rows,
    config: chart.config && typeof chart.config === "object" ? chart.config : {},
  };
};

const normalizeTable = (table) => {
  if (!table || typeof table !== "object") return null;
  if (!Array.isArray(table.columns) || !Array.isArray(table.rows)) return null;

  return {
    columns: table.columns.map((column) => String(column)),
    rows: table.rows,
  };
};

const normalizeGeminiPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    answer: typeof payload.answer === "string" ? payload.answer : "Gemini returned an empty answer.",
    sql: typeof payload.sql === "string" ? payload.sql : "",
    insights: Array.isArray(payload.insights) ? payload.insights.map((item) => String(item)) : [],
    chart: normalizeChart(payload.chart),
    table: normalizeTable(payload.table),
    meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {},
    source: "gemini",
  };
};

const buildPrompt = ({ message, dataset, history }) => {
  const slimDataset = {
    fileName: dataset.fileName,
    headers: dataset.headers,
    totalRows: dataset.totalRows,
    summary: dataset.summary,
    sampleRows: dataset.records.slice(0, 25),
  };

  return `You are InsightFlow AI, a data analysis assistant.
Return only valid JSON with this exact top-level structure:
{
  "answer": string,
  "sql": string,
  "insights": string[],
  "chart": {
    "title": string,
    "chartType": "bar" | "line" | "pie" | "area" | "scatter",
    "xKey": string,
    "yKey": string,
    "rows": Array<object>,
    "config": object
  } | null,
  "table": {
    "columns": string[],
    "rows": Array<object>
  } | null,
  "meta": {
    "queryIntent": string,
    "confidence": number,
    "sql_source": string
  }
}

Rules:
- Keep the answer concise and factual.
- If you include chart rows, make sure every row has keys matching xKey and yKey.
- Do not wrap JSON in markdown unless necessary.
- Use the dataset provided. Do not invent missing columns.

Conversation history:
${JSON.stringify(history, null, 2)}

Dataset:
${JSON.stringify(slimDataset, null, 2)}

User question:
${message}`;
};

export const generateDatasetAnswer = async ({ message, dataset, history = [] }) => {
  const model = getModel();
  if (!model) {
    return null;
  }

  try {
    const prompt = buildPrompt({ message, dataset, history });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(stripCodeFences(text));

    return normalizeGeminiPayload(parsed);
  } catch (error) {
    console.error("[gemini] failed to generate dataset answer", error);
    return null;
  }
};
