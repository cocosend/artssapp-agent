type ConversionData = {
  type: "contents" | "custom";
  amount?: number;
  currency?: string;
  [key: string]: unknown;
};

export type OpenAIConversionEvent = {
  id: string;
  type: string;
  timestamp_ms?: number;
  action_source?: "web" | "app" | "offline";
  source_url?: string;
  oppref?: string;
  data: ConversionData;
};

export async function sendOpenAIConversion(event: OpenAIConversionEvent) {
  const apiKey = process.env.OPENAI_CONVERSIONS_API_KEY;
  const pixelId = process.env.OPENAI_CONVERSIONS_PIXEL_ID;

  if (!apiKey || !pixelId) {
    return { sent: false, configured: false as const };
  }

  const response = await fetch(
    `https://bzr.openai.com/v1/events?pid=${encodeURIComponent(pixelId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events: [
          {
            ...event,
            timestamp_ms: event.timestamp_ms ?? Date.now(),
          },
        ],
      }),
      cache: "no-store",
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI Conversions API ${response.status}: ${text.slice(0, 500)}`);
  }

  return {
    sent: true,
    configured: true as const,
    response: text ? JSON.parse(text) : null,
  };
}
