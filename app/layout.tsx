import type { Metadata, Viewport } from "next";
import "./premium.css";
import "./blood-dreams.css";

export const metadata: Metadata = {
  title: "ARTSS AI — Blood Dreams",
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
  themeColor: "#120a17",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="uk"><body>{children}</body></html>;
}
