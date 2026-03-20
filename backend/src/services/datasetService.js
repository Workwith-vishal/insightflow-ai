import { clearDataset, readDataset, saveDataset } from "../storage/datasetStore.js";
import { parseCsv, summarizeDataset } from "../utils/csv.js";

const previewLimit = 100;

export const storeDataset = async ({ csv, fileName }) => {
  const parsed = parseCsv(csv);
  const summary = summarizeDataset(parsed);

  const dataset = {
    id: "current",
    fileName,
    uploadedAt: new Date().toISOString(),
    headers: parsed.headers,
    rows: parsed.rows,
    totalRows: parsed.totalRows,
    previewRows: parsed.rows.slice(0, previewLimit),
    summary,
  };

  await saveDataset(dataset);

  return {
    id: "current",
    fileName: dataset.fileName,
    uploadedAt: dataset.uploadedAt,
    headers: dataset.headers,
    totalRows: dataset.totalRows,
    previewRows: dataset.previewRows,
    summary: dataset.summary,
  };
};

export const getCurrentDataset = async () => {
  const dataset = await readDataset();
  if (!dataset) return null;

  return {
    id: "current",
    fileName: dataset.fileName,
    uploadedAt: dataset.uploadedAt,
    headers: dataset.headers,
    totalRows: dataset.totalRows,
    previewRows: dataset.previewRows,
    summary: dataset.summary,
  };
};

export const getDatasetForAnalysis = async () => readDataset();

export const removeCurrentDataset = async () => {
  await clearDataset();
};
