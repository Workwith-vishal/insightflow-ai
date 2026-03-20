import { TrendingUp, Users, DollarSign, Activity, Lightbulb } from "lucide-react";
import ChartPanel from "@/features/dashboard/components/charts/ChartPanel";
import KpiCard from "@/features/dashboard/components/kpi/KpiCard";
import { motion } from "framer-motion";
import { useDataset } from "@/shared/data/DataContext";

const revenueData = [
  { name: "Jan", value: 4200 }, { name: "Feb", value: 5800 }, { name: "Mar", value: 4900 },
  { name: "Apr", value: 7200 }, { name: "May", value: 6100 }, { name: "Jun", value: 8400 },
];

const categoryData = [
  { name: "Electronics", value: 35 }, { name: "Clothing", value: 25 },
  { name: "Food", value: 20 }, { name: "Books", value: 12 }, { name: "Other", value: 8 },
];

const trendData = [
  { name: "W1", value: 120 }, { name: "W2", value: 190 }, { name: "W3", value: 160 },
  { name: "W4", value: 240 }, { name: "W5", value: 210 }, { name: "W6", value: 320 },
  { name: "W7", value: 290 }, { name: "W8", value: 380 },
];

const scatterData = [
  { name: "A", value: 40 }, { name: "B", value: 85 }, { name: "C", value: 55 },
  { name: "D", value: 70 }, { name: "E", value: 30 }, { name: "F", value: 95 },
];

const sampleInsights = [
  "Revenue grew 37% month-over-month in June, driven by Electronics.",
  "Electronics outsells the next category (Clothing) by 40%.",
  "Consider expanding Food category; steady 20% share with low marketing spend.",
];

export default function Dashboard() {
  const { dataset, parsed, fileName } = useDataset();
  const summary = dataset?.summary;

  const activeKpis = summary?.kpis?.length
    ? summary.kpis
    : [
        { label: "Total Revenue", value: "$36,600", helperText: "+12.5% vs last period" },
        { label: "Transactions", value: "1,842", helperText: "+8.2% vs last period" },
        { label: "Customers", value: "634", helperText: "-2.1% vs last period" },
        { label: "Avg. Order", value: "$19.87", helperText: "No change" },
      ];

  const activeCharts = summary?.chartSuggestions?.length
    ? summary.chartSuggestions
    : [
        { title: "Revenue Over Time", type: "area" as const, dataKey: "value", data: revenueData },
        { title: "Sales by Category", type: "pie" as const, dataKey: "value", data: categoryData },
        { title: "Weekly Active Users", type: "bar" as const, dataKey: "value", data: trendData },
      ];

  const activeInsights = summary?.insights?.length ? summary.insights : sampleInsights;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {dataset ? `Analyzing ${dataset.fileName}` : "Upload a dataset to replace the sample analytics with your own data."}
        </p>
      </div>
      {parsed && (
        <div className="bg-card rounded-lg card-elevated overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium text-foreground">Analysis Data</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {fileName || "Uploaded dataset"} | {parsed.headers.length} columns | {parsed.totalRows.toLocaleString()} rows
            </p>
          </div>
          <div className="overflow-auto max-h-[360px]">
            <table className="w-full data-grid">
              <thead>
                <tr className="bg-muted/50">
                  {parsed.headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 25).map((row, i) => (
                  <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-1.5 text-xs text-secondary-foreground whitespace-nowrap max-w-[200px] truncate">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {activeKpis.slice(0, 4).map((kpi, index) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            change={kpi.helperText}
            changeType={index === 2 ? "negative" : index === 3 ? "neutral" : "positive"}
            icon={[DollarSign, Activity, Users, TrendingUp][index] || TrendingUp}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPanel title={activeCharts[0]?.title || "Revenue Over Time"} subtitle="Primary data view" type={activeCharts[0]?.type || "area"} data={activeCharts[0]?.data || revenueData} dataKey={activeCharts[0]?.dataKey || "value"} config={{ xLabel: "Dimension", yLabel: "Value" }} />
        <ChartPanel title={activeCharts[1]?.title || "Sales by Category"} subtitle="Secondary breakdown" type={activeCharts[1]?.type || "pie"} data={activeCharts[1]?.data || categoryData} dataKey={activeCharts[1]?.dataKey || "value"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartPanel title={activeCharts[2]?.title || "Weekly Active Users"} subtitle="Additional view" type={activeCharts[2]?.type || "bar"} data={activeCharts[2]?.data || trendData} dataKey={activeCharts[2]?.dataKey || "value"} />
        <ChartPanel title="Performance Scatter" subtitle="Segment comparison" type="scatter" data={scatterData} dataKey="value" config={{ palette: "Amber" }} />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-lg p-4 card-elevated"
        >
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-medium text-foreground">AI Insights</h3>
          </div>
          <div className="space-y-3">
            {activeInsights.map((insight, i) => (
              <div key={i} className="flex gap-2">
                <div className={`w-1 rounded-full shrink-0 ${
                  i === 0 ? "bg-chart-cyan" :
                  i === 1 ? "bg-chart-amber" : "bg-chart-emerald"
                }`} />
                <p className="text-xs text-secondary-foreground leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
