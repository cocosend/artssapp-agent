import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { POST as generateImage } from "@/app/api/images/route";
import { isAgentServiceAuthorized } from "@/lib/service-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

const BUCKET = "agent-generated";
const EXPIRY_SECONDS = 3600;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  if (!isAgentServiceAuthorized(req)) {
    return NextResponse.json({ error: "Service authentication required" }, { status: 401 });
  }
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    return NextResponse.json({ error: "Media storage is not configured" }, { status: 503 });
  }

  // Reuse existing image validation, provider, timeout and safety settings.
  const generated = await generateImage(req);
  if (!generated.ok) return generated;
  const data = await generated.json() as { image?: string; size?: string; quality?: string };
  const prefix = "data:image/png;base64,";
  if (typeof data.image !== "string" || !data.image.startsWith(prefix)) {
    return NextResponse.json({ error: "Image provider returned an invalid result" }, { status: 502 });
  }
  const bytes = Buffer.from(data.image.slice(prefix.length), "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Generated image exceeds media storage limits" }, { status: 413 });
  }

  const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.png`;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    const uploaded = await fetch(`${base}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "image/png", "x-upsert": "false" },
      body: bytes,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!uploaded.ok) {
      return NextResponse.json({ error: `Media upload failed (HTTP ${uploaded.status})` }, { status: 502 });
    }
    const signed = await fetch(`${base}/storage/v1/object/sign/${BUCKET}/${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: EXPIRY_SECONDS }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!signed.ok) return NextResponse.json({ error: "Media signing failed" }, { status: 502 });
    const signedData = await signed.json() as { signedURL?: string; signedUrl?: string };
    const raw = signedData.signedURL || signedData.signedUrl;
    if (!raw || !raw.startsWith("/")) {
      return NextResponse.json({ error: "Media signing returned an invalid URL" }, { status: 502 });
    }
    const url = raw.startsWith("/storage/v1") ? base + raw : base + "/storage/v1" + raw;
    return NextResponse.json({
      url,
      expiresIn: EXPIRY_SECONDS,
      size: data.size,
      quality: data.quality,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Media storage request timed out" }, { status: 504 });
  }
}
