import { NextResponse } from "next/server";
import { isAgentAuthenticated } from "@/lib/auth";
import { readRepoFile } from "@/lib/github";

export const runtime = "nodejs";
const REPO = "cocosend/artssapp-agent";

// A deliberately curated collection: no .env, credentials, hidden files or arbitrary URLs.
export const editablePaths = [
  "app/page.tsx",
  "app/agent-composer.tsx",
  "app/studio-settings.tsx",
  "app/flagship.css",
  "app/ios-detail.css",
  "app/api/web-search/route.ts",
  "app/api/health/route.ts",
  "lib/providers.ts",
  "lib/agent-plan.ts",
  "README.md",
] as const;

export async function GET(req: Request) {
  if (!(await isAgentAuthenticated())) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const path = new URL(req.url).searchParams.get("path");
  if (!path) {
    return NextResponse.json({ repository: REPO, ref: "main", files: editablePaths }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (!editablePaths.some(p => p === path)) {
    return NextResponse.json({ error: "File is not in the approved workspace." }, { status: 400 });
  }
  try {
    const file = await readRepoFile(REPO, path, "main");
    if (!file || file.type !== "file" || typeof file.content !== "string") {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
    if (file.size > 120_000) {
      return NextResponse.json({ error: "File is too large for the mobile workspace." }, { status: 413 });
    }
    const text = Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8");
    if (text.length > 120_000) return NextResponse.json({ error: "File is too large." }, { status: 413 });
    return NextResponse.json({ path, ref: "main", sha: file.sha, content: text }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "GitHub source unavailable. Check connection and try again." }, { status: 503 });
  }
}
