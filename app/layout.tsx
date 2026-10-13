import type { Metadata, Viewport } from "next";
import "./premium.css";
import "./blood-dreams.css";
import "./neon-dashboard.css";
import "./flagship.css";
import "./ios-detail.css";
import "./sidebar-code.css";
import "./blue-night.css";
import "./trash-polka.css";
import "./multi-agent-studio.css";
import "./obsidian-burgundy.css";
import "./obsidian-quality.css";
import "./unified-studio.css";
import "./gemini-inspired.css";

export const metadata: Metadata = {
  title: "ARTSS ONE — AI Assistant",
  description: "Єдиний AI-простір: мультимодельний агент, GitHub-кодинг, Vercel, Supabase, генерація зображень та веб-дослідження.",
  applicationName: "ARTSS ONE",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ARTSS ONE", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#121318",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="uk"><body>{children}</body></html>;
}
