import {
  getCurrentDataset,
  removeCurrentDataset,
  storeDataset,
} from "../services/datasetService.js";
import { json, readJsonBody } from "../utils/http.js";

export const getCurrentDatasetController = async (_req, res) => {
  const dataset = await getCurrentDataset();
  if (!dataset) {
    json(res, 200, null);
    return;
  }

  json(res, 200, dataset);
};

export const uploadDatasetController = async (req, res) => {
  const body = await readJsonBody(req);

  if (!body.csv || typeof body.csv !== "string") {
    json(res, 400, { error: "Request must include a CSV string." });
    return;
  }

  const dataset = await storeDataset({
    csv: body.csv,
    fileName: body.fileName || "dataset.csv",
  });

  json(res, 201, dataset);
};

export const deleteCurrentDatasetController = async (_req, res) => {
  await removeCurrentDataset();
  json(res, 200, { success: true });
};
