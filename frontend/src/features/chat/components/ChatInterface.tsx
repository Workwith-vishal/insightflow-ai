import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Sparkles, User, AlertCircle, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useDataset } from "@/shared/data/DataContext";
import { chatApi } from "@/shared/services/api";
import type { ChatChartPayload, ChatTablePayload, DatasetChart } from "@/shared/types/dataset";
import ChatChartCard from "@/features/chat/components/ChatChartCard";
import ChartPanel from "@/features/dashboard/components/charts/ChartPanel";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  sql?: string;
  chart?: DatasetChart | null;
  chartPayload?: ChatChartPayload | null;
  table?: ChatTablePayload | null;
}

let counter = 0;
const uid = () => `msg-${Date.now()}-${++counter}`;

const buildWelcome = (hasDataset: boolean): Message => ({
  id: "welcome",
  role: "assistant",
  content: hasDataset
    ? "Dataset loaded. Ask me anything about your data.\n\nTry: *\"What are the top 5 products by revenue?\"*"
    : "Welcome to **InsightFlow AI**. Upload a dataset and ask a question about it.\n\nTry: *\"What are the top 5 products by revenue?\"*",
});

const isStructuredChart = (chart: unknown): chart is ChatChartPayload => {
  if (!chart || typeof chart !== "object") return false;
  return "chartType" in chart && "rows" in chart && "xKey" in chart && "yKey" in chart;
};

const isLegacyStructuredChart = (
  chart: unknown,
): chart is ChatChartPayload & { chart_type: ChatChartPayload["chartType"] } => {
  if (!chart || typeof chart !== "object") return false;
  return "chart_type" in chart && "rows" in chart && "xKey" in chart && "yKey" in chart;
};

const isDatasetChart = (chart: unknown): chart is DatasetChart => {
  if (!chart || typeof chart !== "object") return false;
  return "type" in chart && "dataKey" in chart;
};

const normalizeDatasetChart = (chart: DatasetChart): DatasetChart | null => {
  const rawData = Array.isArray(chart.data) ? chart.data : [];
  const data = rawData
    .map((point, index) => {
      const rawLabel = point?.name ?? point?.label ?? point?.x ?? `Item ${index + 1}`;
      const value = typeof point?.value === "number" ? point.value : Number(point?.value);
      const label = String(rawLabel);

      if (!label || !Number.isFinite(value)) {
        return null;
      }

      return {
        ...point,
        name: label,
        value: Number(value),
        x: point?.x ?? label,
        label: point?.label ?? label,
      };
    })
    .filter((point): point is NonNullable<typeof point> => Boolean(point));

  if (!data.length) {
    return null;
  }

  return {
    ...chart,
    xKey: chart.xKey || "name",
    dataKey: chart.dataKey || "value",
    data,
  };
};

const toDatasetChart = (payload: ChatChartPayload): DatasetChart => ({
  title: payload.title,
  type: payload.chartType,
  xKey: payload.xKey,
  dataKey: payload.yKey,
  config: payload.config,
  data: payload.rows.map((row, index) => {
    const rawLabel = row[payload.xKey] ?? row.name ?? row.label ?? row.x ?? `Item ${index + 1}`;
    const label = String(rawLabel);
    return {
      ...row,
      name: label,
      value: Number(row[payload.yKey] ?? row.value ?? row.y ?? 0),
      x: String(row.x ?? row[payload.xKey] ?? label),
      label: String(row.label ?? row[payload.xKey] ?? label),
    };
  }),
});

const toChatChartPayload = (chart: DatasetChart): ChatChartPayload => {
  const normalized = normalizeDatasetChart(chart);
  const xKey = normalized?.xKey || "name";
  const yKey = normalized?.dataKey || "value";
  const rows = (normalized?.data || []).map((entry) => {
    const label = String(entry[xKey] ?? entry.name ?? entry.label ?? entry.x ?? "");
    return {
      ...entry,
      [xKey]: label,
      [yKey]: Number(entry[yKey] ?? entry.value ?? entry.y ?? 0),
    };
  });

  return {
    title: normalized?.title || chart.title,
    chartType: normalized?.type || chart.type,
    xKey,
    yKey,
    rows,
    config: {
      xLabel: normalized?.config?.xLabel || "",
      yLabel: normalized?.config?.yLabel || "",
      palette: normalized?.config?.palette || "cyan",
      showGrid: normalized?.config?.showGrid ?? true,
      showLegend: normalized?.config?.showLegend ?? ((normalized?.type || chart.type) === "pie"),
      curved:
        normalized?.config?.curved ??
        ((normalized?.type || chart.type) === "line" || (normalized?.type || chart.type) === "area"),
    },
  };
};

function ChartPreview({ chart }: { chart: DatasetChart }) {
  const normalized = normalizeDatasetChart(chart);
  if (!normalized || !normalized.data.length) {
    return null;
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border">
      <ChartPanel
        title={normalized.title || "Chart"}
        type={normalized.type || "bar"}
        data={normalized.data}
        dataKey={normalized.dataKey || "value"}
        xKey={normalized.xKey || "name"}
        editable={false}
        config={{
          showGrid: normalized.config?.showGrid ?? true,
          showLegend: normalized.config?.showLegend ?? normalized.type === "pie",
          curved: normalized.config?.curved ?? (normalized.type === "line" || normalized.type === "area"),
          palette: normalized.config?.palette || "cyan",
          xLabel: normalized.config?.xLabel || "",
          yLabel: normalized.config?.yLabel || "",
        }}
      />
    </div>
  );
}

export default function ChatInterface() {
  const { dataset } = useDataset();
  const [messages, setMessages] = useState<Message[]>(() => [buildWelcome(!!dataset)]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [openSql, setOpenSql] = useState<Record<string, boolean>>({});
  const [openTable, setOpenTable] = useState<Record<string, boolean>>({});

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "welcome") {
        return [buildWelcome(!!dataset)];
      }

      return prev;
    });
  }, [dataset]);

  const handleReset = useCallback(() => {
    setMessages([buildWelcome(!!dataset)]);
    setInput("");
    setOpenSql({});
    setOpenTable({});
    inputRef.current?.focus();
  }, [dataset]);

  const handleSend = useCallback(async () => {
    if (!dataset || !input.trim() || isLoading) return;

    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));
      const resp = await chatApi.send(userMsg.content, dataset, history);

      const structuredChart = resp.chart
        ? isLegacyStructuredChart(resp.chart)
          ? {
              ...resp.chart,
              chartType: resp.chart.chart_type,
            }
          : isStructuredChart(resp.chart)
            ? resp.chart
            : isDatasetChart(resp.chart)
              ? toChatChartPayload(resp.chart)
              : null
        : null;

      const datasetChart = resp.chart
        ? isLegacyStructuredChart(resp.chart)
          ? toDatasetChart({
              ...resp.chart,
              chartType: resp.chart.chart_type,
            })
          : isStructuredChart(resp.chart)
            ? toDatasetChart(resp.chart)
            : isDatasetChart(resp.chart)
              ? normalizeDatasetChart(resp.chart)
              : null
        : null;

      const assistantMsg: Message = {
        id: uid(),
        role: "assistant",
        content: resp.answer || "No answer available.",
        sql: resp.sql || "",
        chart: datasetChart,
        chartPayload: structuredChart,
        table: resp.table || null,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Chat request failed.";
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: errorMsg,
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [dataset, input, isLoading, messages]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && !event.shiftKey && dataset && input.trim() && !isLoading) {
        void handleSend();
      }
    },
    [dataset, handleSend, input, isLoading],
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                    msg.isError ? "bg-destructive/15" : "bg-primary/15"
                  }`}
                >
                  {msg.isError ? (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
              )}

              <div
                className={`max-w-[75%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : msg.isError
                      ? "border border-destructive/20 bg-destructive/10 text-destructive"
                      : "bg-card text-card-foreground card-elevated"
                }`}
              >
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    code: ({ children }) => (
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {children}
                      </code>
                    ),
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>

                {msg.sql && (
                  <div className="mt-3">
                    <button
                      onClick={() => setOpenSql((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {openSql[msg.id] ? "Hide SQL" : "Show SQL"}
                    </button>
                    {openSql[msg.id] && (
                      <div className="mt-2 rounded-md bg-muted p-3">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Generated SQL</p>
                        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-primary">
                          {msg.sql}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {msg.chartPayload && <ChatChartCard payload={msg.chartPayload} table={msg.table} />}
                {!msg.chartPayload && msg.chart && <ChartPreview chart={msg.chart} />}

                {!msg.chartPayload && !msg.chart && msg.table && (
                  <div className="mt-3">
                    <button
                      onClick={() => setOpenTable((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {openTable[msg.id] ? "Hide data table" : "Show data table"}
                    </button>
                    {openTable[msg.id] && (
                      <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/30">
                            <tr>
                              {msg.table.columns.map((column) => (
                                <th
                                  key={column}
                                  className="px-2 py-1 text-left font-medium text-muted-foreground"
                                >
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.table.rows.slice(0, 20).map((row, index) => (
                              <tr key={index} className="border-t border-border/60">
                                {msg.table?.columns.map((column) => (
                                  <td key={column} className="px-2 py-1 text-foreground">
                                    {String(row[column] ?? "")}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary">
                  <User className="h-3.5 w-3.5 text-secondary-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15">
              <Sparkles className="h-3.5 w-3.5 animate-pulse-glow text-primary" />
            </div>
            <div className="rounded-lg bg-card px-4 py-3 card-elevated">
              <div className="flex gap-1">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"
                    style={{ animationDelay: `${index * 200}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-background p-4">
        <div className="flex gap-2">
          {messages.length > 1 && (
            <button
              onClick={handleReset}
              disabled={isLoading}
              title="Reset chat"
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}

          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={dataset ? "Ask about your data" : "Upload a dataset before asking questions"}
            disabled={!dataset || isLoading}
            title={!dataset ? "Upload a dataset first to start chatting" : undefined}
            className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />

          <button
            onClick={() => {
              void handleSend();
            }}
            disabled={!dataset || !input.trim() || isLoading}
            title={!dataset ? "Upload a dataset first" : "Send message"}
            className="rounded-lg bg-primary px-4 py-2.5 text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
