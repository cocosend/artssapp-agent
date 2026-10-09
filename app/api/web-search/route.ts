import { NextResponse } from "next/server";
import { isAgentAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: Request) {
  if (!(await isAgentAuthenticated())) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "OpenAI search key is not configured." }, { status: 503 });
  let question = "";
  try {
    const body: unknown = await req.json();
    if (typeof body === "object" && body && "question" in body && typeof body.question === "string") {
      question = body.question.trim();
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!question || question.length > 3000) {
    return NextResponse.json({ error: "Question must be 1 to 3000 characters." }, { status: 400 });
  }
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_SEARCH_MODEL || "gpt-4.1-mini",
        input: question,
        tools: [{ type: "web_search_preview" }],
        max_output_tokens: 1400,
      }),
      signal: AbortSignal.timeout(40_000),
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Web search provider unavailable (" + response.status + ")." }, { status: 502 });
    }
    const result = await response.json();
    const answer = typeof result?.output_text === "string" ? result.output_text :
      (Array.isArray(result?.output) ? result.output.flatMap((o: {
        content?: { type?: string; text?: string }[]
      }) => (o.content || []).filter(p => p.type === "output_text").map(p => p.text || "")).join("\n") : "");
    if (!answer.trim()) return NextResponse.json({ error: "Search returned no text." }, { status: 502 });
    return NextResponse.json({ text: answer, provider: "openai-web-search" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Web search timed out." }, { status: 504 });
  }
}
