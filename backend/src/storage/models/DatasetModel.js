import mongoose from "mongoose";

const datasetSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    fileName: { type: String, required: true },
    uploadedAt: { type: String, required: true },
    headers: { type: [String], required: true },
    rows: { type: [[String]], required: true },
    totalRows: { type: Number, required: true },
    previewRows: { type: [[String]], required: true },
    summary: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  {
    versionKey: false,
    timestamps: false,
  },
);

export const DatasetModel =
  mongoose.models.Dataset || mongoose.model("Dataset", datasetSchema);
