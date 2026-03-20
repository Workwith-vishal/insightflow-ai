import { getDatasetForAnalysis } from "../services/datasetService.js";
import { generateDatasetAnswer } from "../services/geminiService.js";
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

  const result = await generateDatasetAnswer({
    dataset,
    question: body.message,
  });

  json(res, 200, {
    ...result,
    dataset: {
      fileName: dataset.fileName,
      totalRows: dataset.totalRows,
      headers: dataset.headers,
    },
  });
};
