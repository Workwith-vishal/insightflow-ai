import { getDatasetForAnalysis } from "../services/datasetService.js";
import { generateDatasetAnswer } from "../services/geminiService.js";
import { buildStructuredChatResponse } from "../services/chatStructuredResponse.js";
import { json, readJsonBody } from "../utils/http.js";

export const chatController = async (req, res) => {
  const dataset = await getDatasetForAnalysis();
  if (!dataset) {
    json(res, 400, {
      error: "Upload a dataset before starting chat.",
    });
    return;
  }

  const body = await readJsonBody(req);
  if (!body.message || typeof body.message !== "string") {
    json(res, 400, { error: "Request must include a message string." });
    return;
  }

  let result;
  try {
    result = await generateDatasetAnswer({
      dataset,
      question: body.message,
    });
  } catch {
    result = {
      answer: "",
      sql: "",
      insights: [],
      chart: null,
      source: "fallback",
    };
  }

  const structured = buildStructuredChatResponse({
    dataset,
    question: body.message,
    baseAnswer: result.answer,
  });

  json(res, 200, {
    ...result,
    answer: structured.answer || result.answer,
    responseType: structured.responseType,
    chart: structured.chart || null,
    table: structured.table || null,
    meta: structured.meta,
    dataset: {
      fileName: dataset.fileName,
      totalRows: dataset.totalRows,
      headers: dataset.headers,
    },
  });
};
