export interface ParsedData {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export interface DatasetColumnSummary {
  name: string;
  filled: number;
  unique: number;
  sampleValues: string[];
  numeric: boolean;
  min?: number;
  max?: number;
  average?: number;
  sum?: number;
}

export interface DatasetKpi {
  label: string;
  value: string;
  helperText: string;
}

export interface DatasetChart {
  title: string;
  type: "bar" | "line" | "pie" | "area" | "scatter";
  dataKey: string;
  data: Array<{ name: string; value: number }>;
}

export interface DatasetSummary {
  rowCount: number;
  columnCount: number;
  columns: DatasetColumnSummary[];
  kpis: DatasetKpi[];
  insights: string[];
  chartSuggestions: DatasetChart[];
}

export interface DatasetRecord {
  id: string;
  fileName: string;
  uploadedAt: string;
  headers: string[];
  totalRows: number;
  previewRows: string[][];
  summary: DatasetSummary;
}

export interface ChatResponse {
  answer: string;
  sql: string;
  insights: string[];
  chart: DatasetChart | null;
  source: "gemini" | "fallback";
  dataset: {
    fileName: string;
    totalRows: number;
    headers: string[];
  };
}
