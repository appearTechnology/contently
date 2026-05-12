"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2Icon, SendIcon, SquareIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function StudioChat() {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    transport,
  });

  const [draft, setDraft] = useState("");
  const busy = status === "submitted" || status === "streaming";

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setDraft("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 min-h-[min(70vh,640px)]">
      <div className="border-border bg-card flex flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
        <div className="border-border shrink-0 border-b px-4 py-3">
          <h1 className="font-heading text-base font-semibold tracking-tight">
            Studio
          </h1>
          <p className="text-muted-foreground text-sm">
            Ask for hooks, headlines, creative direction, or help refining a brief.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-sm leading-relaxed">
                Start a conversation. Your messages are sent to the model through
                Vercel AI Gateway (same credentials as the rest of the app).
              </p>
            ) : null}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[min(100%,28rem)] rounded-lg px-3 py-2 text-sm leading-relaxed break-words",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <span key={`${message.id}-${i}`} className="whitespace-pre-wrap">
                          {part.text}
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}
          </div>

          {error ? (
            <div className="text-destructive border-border shrink-0 border-t px-4 py-2 text-xs">
              {error.message}
            </div>
          ) : null}

          <form
            onSubmit={onSubmit}
            className="border-border flex shrink-0 flex-col gap-2 border-t p-3 sm:flex-row sm:items-end"
          >
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message…"
              rows={2}
              disabled={busy}
              className="min-h-[4.5rem] flex-1 resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <div className="flex shrink-0 gap-2 sm:flex-col">
              {busy ? (
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  className="gap-1.5"
                  onClick={() => stop()}
                >
                  <SquareIcon className="size-3.5" aria-hidden />
                  Stop
                </Button>
              ) : null}
              <Button type="submit" disabled={busy || !draft.trim()} className="gap-1.5">
                {busy ? (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                ) : (
                  <SendIcon className="size-4" aria-hidden />
                )}
                Send
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
