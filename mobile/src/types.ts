export type ProviderId = "openai" | "deepseek" | "gemini";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type Health = {
  ok: boolean;
  providers: ProviderId[];
  executionEnabled: boolean;
  githubWriteConfigured: boolean;
};

export type AgentResponse = {
  text?: string;
  provider?: ProviderId;
  action?: "answer" | "preview" | "executed";
  branch?: string;
  commitSha?: string;
  prUrl?: string;
  error?: string;
};
