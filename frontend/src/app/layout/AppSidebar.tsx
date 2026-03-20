import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Upload, MessageSquare, Sparkles, Database } from "lucide-react";
import { motion } from "framer-motion";
import { useDataset } from "@/shared/data/DataContext";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/upload", icon: Upload, label: "Upload" },
  { to: "/chat", icon: MessageSquare, label: "AI Chat" },
];

export default function AppSidebar() {
  const location = useLocation();
  const { dataset } = useDataset();
  const datasetSummary =
    dataset && Number.isFinite(dataset.totalRows)
      ? `${dataset.fileName} | ${dataset.totalRows.toLocaleString()} rows`
      : "No dataset loaded";

  return (
    <aside className="w-16 lg:w-56 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <span className="hidden lg:block text-sm font-semibold text-foreground tracking-tight">
          InsightFlow AI
        </span>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group"
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-md bg-sidebar-accent"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <item.icon
                className={`relative z-10 w-4 h-4 ${
                  isActive ? "text-primary" : "text-sidebar-foreground group-hover:text-foreground"
                }`}
              />
              <span
                className={`relative z-10 hidden lg:block ${
                  isActive ? "text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground group-hover:text-foreground"
                }`}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2">
          <Database className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="hidden lg:block text-xs text-muted-foreground">{datasetSummary}</span>
        </div>
      </div>
    </aside>
  );
}
