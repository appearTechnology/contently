import { NextResponse } from "next/server";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { getAuthenticatedUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_STUDIO_MODEL = "openai/gpt-5-mini";
const MAX_MESSAGES = 50;
const MAX_TOTAL_CHARS = 100_000;

const STUDIO_SYSTEM = [
  "You are a concise creative copilot for paid-social and performance marketing.",
  "Help with ad concepts, hooks, headlines, body copy, creative direction, and briefs.",
  "When the user asks for factual claims about products or brands you do not know, say you cannot verify and suggest what they should confirm.",
  "Keep answers scannable unless the user asks for depth.",
].join(" ");

function estimateMessageChars(messages: UIMessage[]): number {
  let n = 0;
  for (const m of messages) {
    for (const part of m.parts) {
      if (part.type === "text") n += part.text.length;
    }
  }
  return n;
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("messages" in body) ||
    !Array.isArray((body as { messages: unknown }).messages)
  ) {
    return NextResponse.json(
      { error: "Expected { messages: UIMessage[] }" },
      { status: 400 },
    );
  }

  const messages = (body as { messages: UIMessage[] }).messages;
  if (messages.length === 0) {
    return NextResponse.json(
      { error: "messages must not be empty" },
      { status: 400 },
    );
  }
  if (messages.length > MAX_MESSAGES) {
    return NextResponse.json(
      { error: `Too many messages (max ${MAX_MESSAGES})` },
      { status: 413 },
    );
  }
  if (estimateMessageChars(messages) > MAX_TOTAL_CHARS) {
    return NextResponse.json(
      { error: "Conversation too long for this request" },
      { status: 413 },
    );
  }

  const model =
    process.env.STUDIO_CHAT_MODEL?.trim() || DEFAULT_STUDIO_MODEL;

  const result = streamText({
    model,
    system: STUDIO_SYSTEM,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
