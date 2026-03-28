import { Suspense, useEffect, useMemo, useState } from "react";
import { CHART_TYPE_OPTIONS, PRESET_PALETTES, resolvePaletteName } from "@/features/dashboard/components/charts/chartOptions";
import type { ChatChartPayload, DatasetChart } from "@/shared/types/dataset";
import ChartPanel from "@/features/dashboard/components/charts/ChartPanel";

type MiniChart = ChatChartPayload | DatasetChart | null | undefined;

const isDatasetChart = (chart: MiniChart): chart is DatasetChart =>
  !!chart &&
  "type" in chart &&
  "dataKey" in chart &&
  (Array.isArray(chart.data) || (Array.isArray(chart.labels) && Array.isArray(chart.datasets)));

const isChatChart = (chart: MiniChart): chart is ChatChartPayload =>
  !!chart && "chartType" in chart && "xKey" in chart && "yKey" in chart && Array.isArray(chart.rows);

const toDatasetChart = (chart: ChatChartPayload): DatasetChart => ({
  title: chart.title,
  type: chart.chartType,
  xKey: chart.xKey,
  dataKey: chart.yKey,
  data: chart.rows.map((row) => ({
    ...row,
    name: row[chart.xKey] as string | number,
    value: Number(row[chart.yKey] ?? 0),
    x: row.x as string | number | undefined,
    label: row.label as string | number | undefined,
  })),
});

const isSupportedType = (type: string) => ["bar", "line", "pie", "area", "scatter"].includes(type);

const isValidChart = (chart: DatasetChart) =>
  isSupportedType(chart.type) &&
  (
    (Array.isArray(chart.data) && chart.data.length > 0) ||
    (Array.isArray(chart.labels) && Array.isArray(chart.datasets) && chart.labels.length > 0 && chart.datasets.length > 0)
  );

export default function MiniChartCard({
  chart,
  showControls = false,
}: {
  chart: MiniChart;
  showControls?: boolean;
}) {
  const normalized = useMemo(() => {
    if (!chart) return null;
    const candidate = isChatChart(chart) ? toDatasetChart(chart) : chart;
    return isDatasetChart(candidate) && isValidChart(candidate) ? candidate : null;
  }, [chart]);

  const paletteDefault = useMemo(
    () => (isChatChart(chart) ? resolvePaletteName(chart.config?.palette) : "Cyan"),
    [chart],
  );

  const [chartType, setChartType] = useState<DatasetChart["type"]>("bar");
  const [palette, setPalette] = useState("Cyan");

  const chartOptions = useMemo(
    () => CHART_TYPE_OPTIONS.filter((opt) => isSupportedType(opt.value)),
    [],
  );

  useEffect(() => {
    if (!normalized) return;
    setChartType(normalized.type);
    setPalette(paletteDefault);
  }, [normalized, paletteDefault]);

  if (!normalized) return null;

  const limitedData = Array.isArray(normalized.data)
    ? normalized.data.slice(0, 8)
    : {
        labels: normalized.labels?.slice(0, 8) ?? [],
        datasets: normalized.datasets?.map((dataset) => ({
          ...dataset,
          data: dataset.data?.slice(0, 8) ?? [],
        })) ?? [],
      };

  return (
    <div className="mt-2 w-full rounded-lg border border-border/60 bg-card/60 p-2">
      {showControls && (
        <div className="mb-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-1">
            Type
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as typeof chartType)}
              className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
            >
              {chartOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            Palette
            <select
              value={palette}
              onChange={(e) => setPalette(e.target.value)}
              className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
            >
              {Object.keys(PRESET_PALETTES).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="h-40">
        <Suspense
          fallback={
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              Loading chart...
            </div>
          }
        >
          <ChartPanel
            title={normalized.title}
            type={chartType}
            data={limitedData}
            dataKey={normalized.dataKey}
            xKey={normalized.xKey}
            config={{ xLabel: "", yLabel: "", palette }}
            editable={false}
            hideHeader
            chartHeightClass="h-32"
          />
        </Suspense>
      </div>
    </div>
  );
}
