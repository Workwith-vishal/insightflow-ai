import { TrendingUp, Users, DollarSign, Activity, Lightbulb } from "lucide-react";
import ChartPanel from "@/features/dashboard/components/charts/ChartPanel";
import KpiCard from "@/features/dashboard/components/kpi/KpiCard";
import { motion } from "framer-motion";

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
  { text: "Revenue grew 37% month-over-month in June, driven by Electronics.", type: "trend" as const },
  { text: "Electronics outsells the next category (Clothing) by 40%.", type: "comparison" as const },
  { text: "Consider expanding Food category — steady 20% share with low marketing spend.", type: "recommendation" as const },
];

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Click the ⚙ icon on any chart to customize type, colors, and labels.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Revenue" value="$36,600" change="+12.5% vs last period" changeType="positive" icon={DollarSign} />
        <KpiCard label="Transactions" value="1,842" change="+8.2% vs last period" changeType="positive" icon={Activity} />
        <KpiCard label="Customers" value="634" change="-2.1% vs last period" changeType="negative" icon={Users} />
        <KpiCard label="Avg. Order" value="$19.87" change="No change" changeType="neutral" icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPanel title="Revenue Over Time" subtitle="Monthly revenue trend" type="area" data={revenueData} dataKey="value" config={{ xLabel: "Month", yLabel: "Revenue ($)" }} />
        <ChartPanel title="Sales by Category" subtitle="Distribution breakdown" type="pie" data={categoryData} dataKey="value" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartPanel title="Weekly Active Users" subtitle="8-week trend" type="bar" data={trendData} dataKey="value" />
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
            {sampleInsights.map((insight, i) => (
              <div key={i} className="flex gap-2">
                <div className={`w-1 rounded-full shrink-0 ${
                  insight.type === "trend" ? "bg-chart-cyan" :
                  insight.type === "comparison" ? "bg-chart-amber" : "bg-chart-emerald"
                }`} />
                <p className="text-xs text-secondary-foreground leading-relaxed">{insight.text}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
