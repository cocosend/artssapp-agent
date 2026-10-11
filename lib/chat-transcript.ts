export type ExportChatMessage = {
  role: "user" | "assistant";
  content: string;
  meta?: string;
  imageUrl?: string;
  sources?: { title: string; url: string }[];
};

/** Generate an offline, explicit, text-only transcript. Never embed base64 images or API tokens. */
export function makeChatTranscript(messages: readonly ExportChatMessage[]): string {
  const lines = ["# ARTSS AI — розмова", "", "Експорт створено користувачем. Зображення у файл не включаються.", ""];
  for (const entry of messages.slice(-50)) {
    lines.push(entry.role === "user" ? "## Користувач" : "## ARTSS AI", "");
    if (entry.meta) lines.push("_" + entry.meta.slice(0, 160).replaceAll("\n", " ") + "_", "");
    lines.push(entry.content.slice(0, 12000), "");
    if (entry.imageUrl) lines.push("_Зображення не включено в текстовий експорт._", "");
    const sources = (entry.sources || []).filter(s => typeof s.url === "string" &&
      s.url.startsWith("https://")).slice(0, 10);
    if (sources.length) {
      lines.push("Джерела:");
      for (let i = 0; i < sources.length; i++) {
        lines.push((i + 1) + ". " + sources[i].url);
      }
      lines.push("");
    }
  }
  return lines.join("\n").slice(0, 650_000);
}
