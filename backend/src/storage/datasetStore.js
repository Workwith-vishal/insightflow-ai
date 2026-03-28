import { createDataset, deleteDataset, getCurrentDataset } from "../models/datasetModel.js";
import { connectToDatabase, withTransaction } from "./database.js";

export const saveDataset = async (dataset) => {
  const record = await withTransaction(async (client) => {
    const currentDataset = await getCurrentDataset(client);

    if (currentDataset) {
      await deleteDataset(currentDataset.id, client);
    }

    return createDataset(dataset, client);
  });

  console.info(`[datasetStore] saved dataset ${record.fileName}`);
  return record;
};

export const readDataset = async () => {
  await connectToDatabase();
  return getCurrentDataset();
};

export const clearDataset = async () => {
  await withTransaction(async (client) => {
    const currentDataset = await getCurrentDataset(client);
    if (currentDataset) {
      await deleteDataset(currentDataset.id, client);
    }
  });

  console.info("[datasetStore] cleared current dataset");
  return { success: true };
};

export const getDatasetForAnalysis = async () => {
  const dataset = await readDataset();
  if (!dataset) return null;

  return {
    ...dataset,
    records: Array.isArray(dataset.records) ? dataset.records : [],
  };
};
