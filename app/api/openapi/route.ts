import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Arts Agent API",
      version: "1.0.0",
      description: "Private API for the Arts Agent coding/deployment orchestrator.",
    },
    servers: [{ url: "/api/v1" }],
    paths: {
      "/health": {
        get: {
          summary: "Health and capability status",
          responses: { "200": { description: "OK" } },
        },
      },
      "/agent": {
        post: {
          summary: "Run an agent task",
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["messages"],
                  properties: {
                    provider: { type: "string", enum: ["deepseek", "gemini", "openai"] },
                    messages: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Agent result" },
            "401": { description: "Authentication required" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "arts_agent_session" },
      },
    },
  });
}
