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
  // Reconstruct from literals, never forward the request's raw path into an outbound URL.
  // Using a switch prevents URL taint even if a request passes an unexpected query string.
  let approved: typeof editablePaths[number] | undefined;
  switch (path) {
    case "app/page.tsx": approved = "app/page.tsx"; break;
    case "app/agent-composer.tsx": approved = "app/agent-composer.tsx"; break;
    case "app/studio-settings.tsx": approved = "app/studio-settings.tsx"; break;
    case "app/flagship.css": approved = "app/flagship.css"; break;
    case "app/ios-detail.css": approved = "app/ios-detail.css"; break;
    case "app/api/web-search/route.ts": approved = "app/api/web-search/route.ts"; break;
    case "app/api/health/route.ts": approved = "app/api/health/route.ts"; break;
    case "lib/providers.ts": approved = "lib/providers.ts"; break;
    case "lib/agent-plan.ts": approved = "lib/agent-plan.ts"; break;
    case "README.md": approved = "README.md"; break;
    default:
      return NextResponse.json({ error: "File is not in the approved workspace." }, { status: 400 });
  }
  try {
    const file = await readRepoFile(REPO, approved, "main");
    if (!file || file.type !== "file" || typeof file.content !== "string") {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
    if (file.size > 120_000) {
      return NextResponse.json({ error: "File is too large for the mobile workspace." }, { status: 413 });
    }
    const text = Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8");
    if (text.length > 120_000) return NextResponse.json({ error: "File is too large." }, { status: 413 });
    return NextResponse.json({ path: approved, ref: "main", sha: file.sha, content: text }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "GitHub source unavailable. Check connection and try again." }, { status: 503 });
  }
}
