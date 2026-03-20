import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useDataset } from "@/shared/data/DataContext";
import { chatApi } from "@/shared/services/api";
import type { DatasetChart } from "@/shared/types/dataset";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  chart?: DatasetChart | null;
}

export default function ChatInterface() {
  const { dataset } = useDataset();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Welcome to **InsightFlow AI**. Upload a dataset and ask a question about it.\n\nTry: *\"What are the top 5 products by revenue?\"*",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!dataset || !input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await chatApi.send(userMsg.content);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: resp.answer,
          sql: resp.sql,
          chart: resp.chart,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat request failed.";
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: message },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card card-elevated text-card-foreground"
                }`}
              >
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    code: ({ children }) => (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                    ),
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="text-muted-foreground italic">{children}</em>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
                {msg.sql && (
                  <div className="mt-3 bg-muted rounded-md p-3">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Generated SQL</p>
                    <pre className="text-xs font-mono text-primary overflow-x-auto">{msg.sql}</pre>
                  </div>
                )}
                {msg.chart && (
                  <div className="mt-3 rounded-md border border-border p-3">
                    <p className="text-xs font-medium text-foreground">{msg.chart.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Suggested {msg.chart.type} chart with {msg.chart.data.length} data points.
                    </p>
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-secondary-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse-glow" />
            </div>
            <div className="bg-card card-elevated rounded-lg px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleSend()}
            placeholder={dataset ? "Ask about your data..." : "Upload a dataset before asking questions"}
            disabled={!dataset}
            className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => { void handleSend(); }}
            disabled={!dataset || !input.trim() || isLoading}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
