import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { datasetApi } from "@/shared/services/api";
import type { DatasetRecord, ParsedData } from "@/shared/types/dataset";

interface DataContextValue {
  dataset: DatasetRecord | null;
  parsed: ParsedData | null;
  fileName: string;
  isLoading: boolean;
  uploadDataset: (payload: { fileName: string; csv: string }) => Promise<DatasetRecord>;
  clearData: () => Promise<void>;
  refreshDataset: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const isDatasetRecord = (value: unknown): value is DatasetRecord => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const dataset = value as Partial<DatasetRecord>;

  return (
    typeof dataset.fileName === "string" &&
    typeof dataset.totalRows === "number" &&
    Array.isArray(dataset.headers) &&
    Array.isArray(dataset.previewRows) &&
    !!dataset.summary &&
    typeof dataset.summary === "object" &&
    Array.isArray(dataset.summary.kpis) &&
    Array.isArray(dataset.summary.insights) &&
    Array.isArray(dataset.summary.chartSuggestions)
  );
};

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [dataset, setDataset] = useState<DatasetRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshDataset = async () => {
    setIsLoading(true);
    try {
      const current = await datasetApi.getCurrent();
      setDataset(isDatasetRecord(current) ? current : null);
    } catch {
      setDataset(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshDataset();
  }, []);

  const uploadDataset = async (payload: { fileName: string; csv: string }) => {
    setIsLoading(true);
    try {
      const current = await datasetApi.upload(payload);
      if (!isDatasetRecord(current)) {
        throw new Error("Backend returned an invalid dataset payload.");
      }

      setDataset(current);
      return current;
    } finally {
      setIsLoading(false);
    }
  };

  const clearData = async () => {
    setIsLoading(true);
    try {
      await datasetApi.clear();
      setDataset(null);
    } finally {
      setIsLoading(false);
    }
  };

  const parsed: ParsedData | null = dataset
    ? {
        headers: dataset.headers,
        rows: dataset.previewRows,
        totalRows: dataset.totalRows,
      }
    : null;

  const fileName = dataset?.fileName || "";

  const value = useMemo(
    () => ({ dataset, parsed, fileName, isLoading, uploadDataset, clearData, refreshDataset }),
    [dataset, parsed, fileName, isLoading],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useDataset = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useDataset must be used within DataProvider");
  }
  return context;
};
