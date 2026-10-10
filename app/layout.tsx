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

export const metadata: Metadata = {
  title: "ARTSS AI — Obsidian Studio",
  description: "Приватний мультимодельний AI-агент для розробки, автоматизації, GitHub, Vercel та Supabase.",
  applicationName: "ARTSS AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ARTSS AI", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#060408",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="uk"><body>{children}</body></html>;
}
