import { useMemo, useState } from "react";
import ChartPanel from "@/features/dashboard/components/charts/ChartPanel";
import { CHART_TYPE_OPTIONS, PRESET_PALETTES } from "@/features/dashboard/components/charts/chartOptions";
import type { ChatChartPayload, DatasetChart } from "@/shared/types/dataset";

type MiniChart = ChatChartPayload | DatasetChart | null | undefined;

const isDatasetChart = (chart: MiniChart): chart is DatasetChart =>
  !!chart && "type" in chart && "dataKey" in chart && Array.isArray(chart.data);

const isChatChart = (chart: MiniChart): chart is ChatChartPayload =>
  !!chart && "chartType" in chart && "xKey" in chart && "yKey" in chart && Array.isArray(chart.rows);

const toDatasetChart = (chart: ChatChartPayload): DatasetChart => ({
  title: chart.title,
  type: chart.chartType,
  dataKey: "value",
  data: chart.rows.map((row) => ({
    name: row[chart.xKey] as string | number,
    value: Number(row[chart.yKey] ?? 0),
  })),
});

const isSupportedType = (type: string) => ["bar", "line", "pie", "area", "scatter"].includes(type);

const isValidChart = (chart: DatasetChart) =>
  isSupportedType(chart.type) && Array.isArray(chart.data) && chart.data.length > 0;

const normalizePalette = (palette?: string) => {
  if (!palette) return "Cyan";
  const lower = palette.toLowerCase();
  if (lower in { cyan: true, blue: true }) return "Cyan";
  if (lower in { amber: true, orange: true }) return "Amber";
  if (lower in { emerald: true, green: true }) return "Emerald";
  if (lower in { rose: true, pink: true }) return "Rose";
  return Object.keys(PRESET_PALETTES).find((key) => key.toLowerCase() === lower) || "Cyan";
};

export default function MiniChartCard({
  chart,
  showControls = false,
}: {
  chart: MiniChart;
  showControls?: boolean;
}) {
  if (!chart) return null;

  const normalized = isChatChart(chart) ? toDatasetChart(chart) : chart;
  if (!isDatasetChart(normalized) || !isValidChart(normalized)) return null;

  const limitedData = normalized.data.slice(0, 8);
  const paletteDefault = isChatChart(chart) ? normalizePalette(chart.config?.palette) : "Cyan";

  const [chartType, setChartType] = useState(normalized.type);
  const [palette, setPalette] = useState(paletteDefault);

  const chartOptions = useMemo(
    () => CHART_TYPE_OPTIONS.filter((opt) => isSupportedType(opt.value)),
    [],
  );

  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-card/60 p-2">
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
        <ChartPanel
          title={normalized.title}
          type={chartType}
          data={limitedData}
          dataKey={normalized.dataKey}
          config={{ xLabel: "", yLabel: "", palette }}
          editable={false}
          hideHeader
        />
      </div>
    </div>
  );
}
