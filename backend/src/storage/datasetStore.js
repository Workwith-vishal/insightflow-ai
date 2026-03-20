import { DatasetModel } from "./models/DatasetModel.js";

const CURRENT_DATASET_SLUG = "current";

export const saveDataset = async (dataset) =>
  DatasetModel.findOneAndUpdate(
    { slug: CURRENT_DATASET_SLUG },
    { ...dataset, slug: CURRENT_DATASET_SLUG },
    {
      upsert: true,
      setDefaultsOnInsert: true,
      returnDocument: "after",
      lean: true,
    },
  );

export const readDataset = async () =>
  DatasetModel.findOne({ slug: CURRENT_DATASET_SLUG }).lean();

export const clearDataset = async () => {
  await DatasetModel.deleteOne({ slug: CURRENT_DATASET_SLUG });
};
