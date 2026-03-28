import type { ChatChartPayload, ChatResponse, DatasetRecord } from "@/shared/types/dataset";
import { analyticsTracker } from "@/analytics/tracker";
import { runLocalDatasetQuery } from "@/ai-engine/analystEngine";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
type JsonRecord = Record<string, unknown>;

type ApiRequestErrorKind = "network" | "http" | "parse";

class ApiRequestError extends Error {
  kind: ApiRequestErrorKind;
  status?: number;

  constructor(message: string, kind: ApiRequestErrorKind, status?: number) {
    super(message);
    this.name = "ApiRequestError";
    this.kind = kind;
    this.status = status;
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new ApiRequestError("Unable to reach the API.", "network");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(
      payload?.error || `Request failed with status ${response.status}`,
      "http",
      response.status,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiRequestError("API returned invalid JSON.", "parse", response.status);
  }
};

const canUseLocalChatFallback = (error: unknown) =>
  error instanceof ApiRequestError && error.kind === "network";

const asRecord = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" ? (value as JsonRecord) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asNumber = (value: unknown, fallback = 0): number => {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const asOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
};

const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback;

const asStringArray = (value: unknown): string[] =>
  asArray(value).map((item) => String(item));

const asStringMatrix = (value: unknown): string[][] =>
  asArray(value).map((row) => asArray(row).map((cell) => String(cell)));

const asPrimitive = (value: unknown): string | number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  return String(value);
};

const asPrimitiveArray = (value: unknown): Array<string | number | null> =>
  asArray(value).map((item) => asPrimitive(item));

const toTitleCase = (value: string): string =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const normalizeDomainSummary = (
  value: unknown,
): DatasetRecord["summary"]["domain"] | undefined => {
  if (typeof value === "string" && value.trim()) {
    const key = value.trim().toLowerCase();
    const label = toTitleCase(key);
    return {
      key,
      label,
      confidence: 0.7,
      matchedColumns: [],
      description: `Detected dataset domain: ${label}.`,
    };
  }

  const domain = asRecord(value);
  if (!Object.keys(domain).length) return undefined;

  const key = asString(domain.key, "general").toLowerCase();
  const label = asString(domain.label, toTitleCase(key));
  const confidence = asNumber(domain.confidence, 0.7);
  const matchedColumns = asStringArray(domain.matchedColumns ?? domain.matched_columns);
  const description = asString(
    domain.description,
    `Detected dataset domain: ${label}.`,
  );

  return {
    key,
    label,
    confidence,
    matchedColumns,
    description,
  };
};

const normalizeChartType = (
  value: unknown,
): "bar" | "line" | "pie" | "area" | "scatter" => {
  if (
    value === "bar" ||
    value === "line" ||
    value === "pie" ||
    value === "area" ||
    value === "scatter"
  ) {
    return value;
  }
  return "bar";
};

const normalizeDatasetChartPoint = (
  value: unknown,
  index: number,
): NonNullable<DatasetRecord["summary"]["chartSuggestions"][number]["data"]>[number] | null => {
  const point = asRecord(value);
  const rawLabel = point.name ?? point.label ?? point.x ?? `Item ${index + 1}`;
  const primitiveLabel = asPrimitive(rawLabel);
  const label = primitiveLabel === null ? `Item ${index + 1}` : String(primitiveLabel);
  const numericValue = asNumber(point.value ?? point.y, Number.NaN);

  if (!label || !Number.isFinite(numericValue)) {
    return null;
  }

  return {
    ...point,
    name: label,
    value: numericValue,
    x: asPrimitive(point.x) ?? label,
    label: asPrimitive(point.label) ?? label,
    y: asOptionalNumber(point.y),
  };
};

const normalizeDatasetChart = (
  value: unknown,
): DatasetRecord["summary"]["chartSuggestions"][number] | null => {
  const chart = asRecord(value);
  if (!Object.keys(chart).length) return null;

  let data = asArray(chart.data)
    .map((point, index) => normalizeDatasetChartPoint(point, index))
    .filter((point): point is NonNullable<typeof point> => Boolean(point));

  if (!data.length) {
    const labels = asPrimitiveArray(chart.labels);
    const datasets = asArray(chart.datasets).map((datasetRaw) => {
      const dataset = asRecord(datasetRaw);
      return {
        label: asString(dataset.label) || undefined,
        data: asPrimitiveArray(dataset.data),
      };
    });

    const primaryDataset = datasets[0];
    if (labels.length && primaryDataset?.data?.length) {
      data = labels
        .map((label, index) =>
          normalizeDatasetChartPoint(
            {
              name: label ?? `Item ${index + 1}`,
              value: primaryDataset.data?.[index],
              x: label,
              label,
            },
            index,
          ),
        )
        .filter((point): point is NonNullable<typeof point> => Boolean(point));
    }
  }

  if (!data.length) {
    return null;
  }

  return {
    title: asString(chart.title, "Chart"),
    type: normalizeChartType(chart.type ?? chart.chartType ?? chart.chart_type),
    xKey: asString(chart.xKey ?? chart.x_key, "name"),
    dataKey: asString(chart.dataKey ?? chart.yKey ?? chart.y_key, "value"),
    data,
    labels: asPrimitiveArray(chart.labels),
    datasets: asArray(chart.datasets).map((datasetRaw) => {
      const dataset = asRecord(datasetRaw);
      return {
        label: asString(dataset.label) || undefined,
        data: asPrimitiveArray(dataset.data),
      };
    }),
    config: asRecord(chart.config) as DatasetRecord["summary"]["chartSuggestions"][number]["config"],
  };
};

const normalizeDatasetRecord = (raw: unknown): DatasetRecord => {
  const rawRecord = asRecord(raw);
  const summaryRecord = asRecord(rawRecord.summary);
  const rawColumns = asArray(summaryRecord.columns);
  const rawKpis = asArray(summaryRecord.kpis);
  const rawCharts = asArray(summaryRecord.chartSuggestions ?? summaryRecord.chart_suggestions);

  return {
    id: asString(rawRecord.id, "current"),
    fileName: asString(rawRecord.fileName ?? rawRecord.file_name, "uploaded.csv"),
    uploadedAt: asString(
      rawRecord.uploadedAt ?? rawRecord.uploaded_at,
      new Date().toISOString(),
    ),
    headers: asStringArray(rawRecord.headers),
    totalRows: asNumber(rawRecord.totalRows ?? rawRecord.total_rows, 0),
    previewRows: asStringMatrix(rawRecord.previewRows ?? rawRecord.preview_rows),
    summary: {
      rowCount: asNumber(summaryRecord.rowCount ?? summaryRecord.row_count, 0),
      columnCount: asNumber(summaryRecord.columnCount ?? summaryRecord.column_count, 0),
      domain: normalizeDomainSummary(summaryRecord.domain),
      columns: rawColumns.map((columnRaw) => {
        const column = asRecord(columnRaw);
        return {
          name: asString(column.name),
          filled: asNumber(column.filled, 0),
          unique: asNumber(column.unique, 0),
          sampleValues: asStringArray(column.sampleValues ?? column.sample_values),
          numeric: asBoolean(column.numeric, false),
          detectedType: asString(column.detectedType ?? column.detected_type) || undefined,
          min: asOptionalNumber(column.min),
          max: asOptionalNumber(column.max),
          average: asOptionalNumber(column.average),
          sum: asOptionalNumber(column.sum),
        };
      }),
      kpis: rawKpis.map((kpiRaw) => {
        const kpi = asRecord(kpiRaw);
        return {
          label: asString(kpi.label),
          value: String(kpi.value ?? ""),
          helperText: asString(kpi.helperText ?? kpi.description),
        };
      }),
      insights: asStringArray(summaryRecord.insights),
      chartSuggestions: rawCharts
        .map((chartRaw) => normalizeDatasetChart(chartRaw))
        .filter((chart): chart is NonNullable<typeof chart> => Boolean(chart)),
    },
  };
};

const normalizeChatResponse = (response: ChatResponse): ChatResponse => {
  if (!response.chart || typeof response.chart !== "object") {
    return response;
  }

  const chart = response.chart as JsonRecord;
  const chartType = chart.chartType ?? chart.chart_type;
  const xKey = chart.xKey ?? chart.x_key;
  const yKey = chart.yKey ?? chart.y_key;

  if (!chartType || !xKey || !yKey || !Array.isArray(chart.rows)) {
    const normalizedDatasetChart = normalizeDatasetChart(chart);
    if (!normalizedDatasetChart) {
      return {
        ...response,
        chart: null,
      };
    }

    return {
      ...response,
      chart: normalizedDatasetChart,
    };
  }

  const normalizedRows = asArray(chart.rows)
    .map((rowRaw, index) => {
      const row = asRecord(rowRaw);
      const primitiveLabel = asPrimitive(row[xKey] ?? row.name ?? row.label ?? row.x);
      const label = primitiveLabel === null ? `Item ${index + 1}` : String(primitiveLabel);
      const numericValue = asNumber(row[yKey] ?? row.value ?? row.y, Number.NaN);
      if (!label || !Number.isFinite(numericValue)) {
        return null;
      }

      return {
        ...row,
        [asString(xKey)]: label,
        [asString(yKey)]: numericValue,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return {
    ...response,
    chart: {
      title: asString(chart.title),
      chartType: normalizeChartType(chartType),
      xKey: asString(xKey),
      yKey: asString(yKey),
      rows: normalizedRows,
      config: asRecord(chart.config) as ChatChartPayload["config"],
    },
  };
};

export const datasetApi = {
  getCurrent: async () => {
    const response = await request<unknown | null>("/api/datasets/current");
    return response ? normalizeDatasetRecord(response) : null;
  },
  upload: (payload: { fileName: string; csv: string }) => {
    const formData = new FormData();
    const blob = new Blob([payload.csv], { type: 'text/csv' });
    formData.append('file', blob, payload.fileName);
    
    return fetch(`${API_BASE_URL}/api/datasets`, {
      method: 'POST',
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || `Upload failed with status ${response.status}`);
      }
      const data = (await response.json()) as unknown;
      return normalizeDatasetRecord(data);
    });
  },
  clear: () =>
    request<{ success: boolean }>("/api/datasets/current", {
      method: "DELETE",
    }),
};

export const chatApi = {
  send: async (
    message: string,
    dataset: DatasetRecord,
    history: { role: "user" | "assistant"; content: string }[],
  ): Promise<ChatResponse> => {
    analyticsTracker.trackFeature("chat_query", {
      dataset: dataset.fileName,
      queryLength: message.length,
    });

    try {
      const response = await request<ChatResponse>("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          history,
        }),
      });
      return normalizeChatResponse(response);
    } catch (error) {
      if (canUseLocalChatFallback(error)) {
        return runLocalDatasetQuery(message, dataset);
      }

      throw error;
    }
  },
};
