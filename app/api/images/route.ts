import { NextResponse } from "next/server";
import { isAgentAuthenticated } from "@/lib/auth";
import { imageOptions } from "@/lib/image-options";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await isAgentAuthenticated())) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "OpenAI image API key is not configured." }, { status: 503 });

  let prompt: string;
  let options = imageOptions({});
  try {
    const input: unknown = await req.json();
    options = imageOptions(input);
    prompt = typeof input === "object" && input !== null && "prompt" in input &&
      typeof input.prompt === "string" ? input.prompt.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }
  if (!prompt || prompt.length > 1600) {
    return NextResponse.json({ error: "Image prompt must be 1 to 1600 characters." }, { status: 400 });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
        prompt,
        n: 1,
        size: options.size,
        quality: options.quality,
        output_format: "png",
      }),
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(55_000)]),
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Image provider declined request (" + response.status + ")." }, { status: 502 });
    }
    const result = await response.json();
    const image = result?.data?.[0]?.b64_json;
    if (typeof image !== "string" || !image.length || image.length > 12_000_000) {
      return NextResponse.json({ error: "Image provider returned no valid image." }, { status: 502 });
    }
    return NextResponse.json({ image: "data:image/png;base64," + image, size: options.size, quality: options.quality }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Image generation timed out or is unavailable." }, { status: 504 });
  }
}
