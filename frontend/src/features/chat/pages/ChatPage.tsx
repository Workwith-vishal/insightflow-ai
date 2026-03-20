import ChatInterface from "@/features/chat/components/ChatInterface";

export default function ChatPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">AI Chat</h1>
        <p className="text-xs text-muted-foreground">Ask natural language questions about your data</p>
      </div>
      <div className="flex-1 min-h-0">
        <ChatInterface />
      </div>
    </div>
  );
}
