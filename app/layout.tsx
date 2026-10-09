import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARTSS AI — Agent Control Center",
  description: "Приватний мультимодельний AI-агент для розробки, автоматизації, GitHub, Vercel та Supabase.",
  applicationName: "ARTSS AI",
  appleWebApp: { capable: true, title: "ARTSS AI", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080d11",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="uk"><body>{children}</body></html>;
}
