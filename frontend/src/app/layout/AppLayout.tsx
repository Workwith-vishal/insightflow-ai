import { Outlet, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Plus } from "lucide-react";
import AppSidebar from "@/app/layout/AppSidebar";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useDataset } from "@/shared/data/DataContext";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function AppLayout() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { dataset } = useDataset();

  const routeLabelMap: Record<string, string> = {
    "/": "Dashboard",
    "/upload": "Upload",
  };
  const currentLabel = routeLabelMap[location.pathname] || "InsightFlow";
  const hasDataset = !!dataset;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {!isMobile && <AppSidebar />}

      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex"
          >
            <button
              aria-label="Close sidebar"
              className="absolute inset-0 bg-black/60"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
              className="relative z-50"
            >
              <AppSidebar onNavigate={() => setSidebarOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="h-14 border-b border-border/60 bg-card/40 backdrop-blur flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-md border border-border bg-card hover:bg-muted/40 transition-colors"
                aria-label="Open sidebar"
              >
                <Menu className="w-4 h-4 text-foreground" />
              </button>
            )}
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${hasDataset ? "bg-accent" : "bg-muted-foreground/50"}`} />
              {hasDataset ? "Dataset loaded" : "No dataset"}
            </div>
            <Button asChild size="sm">
              <Link to="/" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Open Chat
              </Link>
            </Button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex-1 min-h-0 overflow-auto"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
