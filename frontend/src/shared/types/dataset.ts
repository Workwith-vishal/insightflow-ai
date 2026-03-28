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
  detectedType?: string;
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
  xKey?: string;
  dataKey: string;
  data?: Array<{
    name: string | number;
    value: number;
    label?: string | number;
    x?: string | number;
    y?: number;
    [key: string]: string | number | null | undefined;
  }>;
  labels?: Array<string | number | null>;
  datasets?: Array<{
    label?: string;
    data?: Array<string | number | null>;
  }>;
  config?: {
    xLabel?: string;
    yLabel?: string;
    palette?: string;
    showGrid?: boolean;
    showLegend?: boolean;
    curved?: boolean;
  };
}

export interface AdvancedInsights {
  descriptive: string[];
  diagnostic: string[];
  prescriptive: string[];
}

export interface DatasetDomainSummary {
  key: string;
  label: string;
  confidence: number;
  matchedColumns: string[];
  description: string;
}

export interface DatasetPattern {
  type: "trend" | "anomaly" | "dominance";
  message: string;
  confidence: number;
}

export interface PredictionChartData {
  chartType: "line";
  labels: string[];
  datasets: Array<{
    label: string;
    data: Array<number | null>;
  }>;
  confidence?: number;
}

export interface DatasetSummary {
  rowCount: number;
  columnCount: number;
  domain?: DatasetDomainSummary;
  columns: DatasetColumnSummary[];
  kpis: DatasetKpi[];
  insights: string[];
  advancedInsights?: AdvancedInsights;
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
  responseType?: ChatResponseType;
  chart?: ChatChartPayload | DatasetChart | null;
  table?: ChatTablePayload | null;
  meta?: {
    queryIntent?: string;
    derivedFrom?: string;
    filterKeyword?: string;
    confidence?: number;
    rows_returned?: number;
    sql_source?: string;
    [key: string]: unknown;
  };
  source: string;
  dataset: {
    fileName?: string;
    totalRows?: number;
    headers?: string[];
    schema?: string;
    columns?: string[];
    [key: string]: unknown;
  };
}

export type ChatResponseType =
  | "text"
  | "table"
  | "chart"
  | "text+chart"
  | "text+table"
  | "text+chart+table";

export interface ChatChartPayload {
  title: string;
  chartType: "bar" | "line" | "pie" | "area" | "scatter";
  xKey: string;
  yKey: string;
  rows: Array<Record<string, string | number>>;
  config?: {
    xLabel?: string;
    yLabel?: string;
    palette?: string;
    showGrid?: boolean;
    showLegend?: boolean;
    curved?: boolean;
  };
}

export interface ChatTablePayload {
  columns: string[];
  rows: Array<Record<string, string | number>>;
}
