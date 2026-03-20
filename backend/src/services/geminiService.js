import { env } from "../config/env.js";

const buildDatasetPrompt = ({ dataset, question }) => {
  const summary = dataset.summary;
  const preview = dataset.previewRows.slice(0, 8);

  return `
You are an analytics assistant for a CSV dataset.

Dataset file: ${dataset.fileName}
Row count: ${dataset.totalRows}
Columns: ${dataset.headers.join(", ")}

Summary:
${JSON.stringify(summary, null, 2)}

Preview rows:
${JSON.stringify(preview, null, 2)}

User question:
${question}

Return a JSON object with this exact shape:
{
  "answer": "short markdown answer",
  "sql": "optional SQL query string or empty string",
  "insights": ["bullet insight"],
  "chart": {
    "title": "optional chart title",
    "type": "bar|line|pie|area|scatter",
    "dataKey": "value",
    "data": [{"name":"label","value":123}]
  }
}

If SQL is not relevant, set it to an empty string. Keep the answer concise and grounded in the supplied data.
  `.trim();
};

const parseGeminiResponse = (payload) => {
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!text) {
    throw new Error("Gemini response did not include text output.");
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      answer: text,
      sql: "",
      insights: [],
      chart: null,
    };
  }

  return JSON.parse(match[0]);
};

const generateFallback = ({ dataset, question }) => {
  const summary = dataset.summary;
  const lowerQuestion = question.toLowerCase();
  const primaryInsight =
    summary.insights[0] || `The dataset contains ${dataset.totalRows} rows and ${dataset.headers.length} columns.`;

  let sql = "";
  if (lowerQuestion.includes("top") || lowerQuestion.includes("highest")) {
    const numericColumn = summary.columns.find((column) => column.numeric);
    sql = numericColumn
      ? `SELECT *\nFROM dataset\nORDER BY "${numericColumn.name}" DESC\nLIMIT 5;`
      : "";
  }

  return {
    answer: `${primaryInsight}\n\n${summary.insights.slice(1, 3).join("\n")}`.trim(),
    sql,
    insights: summary.insights,
    chart: summary.chartSuggestions[0] || null,
    source: "fallback",
  };
};

export const generateDatasetAnswer = async ({ dataset, question }) => {
  if (!env.geminiApiKey) {
    return generateFallback({ dataset, question });
  }

  const response = await fetch(
    `${env.geminiApiUrl}/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildDatasetPrompt({ dataset, question }) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini request failed with ${response.status}: ${text}`);
  }

  const payload = await response.json();
  const result = parseGeminiResponse(payload);

  return {
    answer: result.answer || "No answer returned.",
    sql: result.sql || "",
    insights: Array.isArray(result.insights) ? result.insights : [],
    chart: result.chart || null,
    source: "gemini",
  };
};
