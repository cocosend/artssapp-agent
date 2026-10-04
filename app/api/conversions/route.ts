import { NextResponse } from "next/server";
import { sendOpenAIConversion } from "@/lib/openai-conversions";

export const runtime = "nodejs";

const STANDARD_EVENTS = new Set([
  "order_created",
  "lead_created",
  "registration_completed",
  "page_viewed",
]);

export async function POST(request: Request) {
  try {
    const expectedSecret = process.env.OPENAI_CONVERSIONS_INGEST_SECRET;
    const providedSecret = request.headers.get("x-openai-conversions-secret");
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as {
      id?: string;
      type?: string;
      amount?: number;
      currency?: string;
      sourceUrl?: string;
      oppref?: string;
      customEventName?: string;
    };

    const type = body.type === "custom" ? "custom" : body.type;
    if (!body.id || !type) {
      return NextResponse.json({ ok: false, error: "id and type are required" }, { status: 400 });
    }

    if (type !== "custom" && !STANDARD_EVENTS.has(type)) {
      return NextResponse.json({ ok: false, error: "unsupported event type" }, { status: 400 });
    }

    if (type === "custom" && !body.customEventName) {
      return NextResponse.json({ ok: false, error: "customEventName is required" }, { status: 400 });
    }

    const event = {
      id: body.id,
      type,
      ...(type === "custom" ? { custom_event_name: body.customEventName } : {}),
      action_source: "web" as const,
      source_url: body.sourceUrl,
      ...(body.oppref ? { oppref: body.oppref } : {}),
      data:
        typeof body.amount === "number"
          ? { type: "contents" as const, amount: body.amount, currency: body.currency || "USD" }
          : { type: "contents" as const },
    };

    const result = await sendOpenAIConversion(event);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "conversion failed" },
      { status: 502 },
    );
  }
}
