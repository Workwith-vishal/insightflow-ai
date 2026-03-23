import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, MessageSquare, Send, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useDataset } from "@/shared/data/DataContext";
import { chatApi } from "@/shared/services/api";
import MiniChartCard from "@/features/dashboard/components/MiniChartCard";
import type { ChatResponse } from "@/shared/types/dataset";
import { useIsMobile } from "@/shared/hooks/use-mobile";

interface PanelMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  chart?: ChatResponse["chart"];
}

let _panelCounter = 0;
const panelId = () => `panel-msg-${Date.now()}-${++_panelCounter}`;

export default function DashboardChatPanel({ className }: { className?: string }) {
  const { dataset } = useDataset();
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isMobile && collapsed) {
      setCollapsed(false);
    }
  }, [isMobile, collapsed]);

  useEffect(() => {
    if (collapsed) return;
    const container = scrollRef.current;
    if (!container) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: prefersReduced ? "auto" : "smooth",
    });
  }, [messages, isLoading, collapsed]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setInput("");
  }, []);

  const handleSend = useCallback(async () => {
    if (!dataset || !input.trim() || isLoading) return;

    const userMsg: PanelMessage = { id: panelId(), role: "user", content: input.trim() };
    setInput("");
    setIsLoading(true);
    setMessages((prev) => [...prev, userMsg].slice(-20));

    try {
      const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));
      const resp = await chatApi.send(userMsg.content, dataset, history);
      const assistantMsg: PanelMessage = {
        id: panelId(),
        role: "assistant",
        content: resp.answer,
        chart: resp.chart || null,
      };
      setMessages((prev) => [...prev, assistantMsg].slice(-20));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat request failed.";
      const assistantMsg: PanelMessage = { id: panelId(), role: "assistant", content: message };
      setMessages((prev) => [...prev, assistantMsg].slice(-20));
    } finally {
      setIsLoading(false);
    }
  }, [dataset, input, isLoading, messages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        void handleSend();
      }
    },
    [handleSend],
  );

  return (
    <motion.aside
      initial={false}
      animate={{ width: isMobile ? "100%" : collapsed ? 48 : "100%" }}
      transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
      className={`shrink-0 border border-border/70 bg-card/70 backdrop-blur-sm rounded-2xl flex flex-col overflow-hidden ${
        isMobile ? "h-auto" : "h-full"
      } ${className || ""}`}
    >
      <AnimatePresence mode="wait">
        {collapsed ? (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCollapsed(false)}
            className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Expand chat panel"
          >
            <MessageSquare className="w-5 h-5" />
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/70">
              <div>
                <p className="text-sm font-medium text-foreground">Ask about your data</p>
                <p className="text-xs text-muted-foreground">Compact dashboard chat</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearChat}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border bg-muted/30 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Clear chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear chat
                </button>
                <button
                  onClick={() => setCollapsed(true)}
                  className="p-2 rounded-md border border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Minimize chat"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
              {!dataset && (
                <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground text-center">
                  Upload a dataset on the Upload page to start asking questions.
                </div>
              )}

              {dataset && messages.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground text-center">
                  Ask a quick question about your dataset.
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary/20 text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        code: ({ children }) => (
                          <code className="bg-background/60 px-1.5 py-0.5 rounded text-xs font-mono">
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                    {msg.role === "assistant" && <MiniChartCard chart={msg.chart} showControls />}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                    Thinking...
                  </div>
                </div>
              )}

            </div>

            <div className="p-4 border-t border-border/70">
              <div className="flex items-stretch gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={dataset ? "Ask about your data..." : "Upload a dataset first"}
                  disabled={!dataset || isLoading}
                  className="flex-1 h-10 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!dataset || !input.trim() || isLoading}
                  className="h-10 bg-primary text-primary-foreground rounded-lg px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
