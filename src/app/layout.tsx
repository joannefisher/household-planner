import type { Metadata, Viewport } from "next";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource-variable/bricolage-grotesque/index.css";
import "./globals.css";
import "./features.css";
import { ReloadOnNewVersion } from "@/components/ReloadOnNewVersion";

export const metadata: Metadata = {
  title: "Fisher-Oakley",
  description: "Household planner: week, dinners and shopping",
  applicationName: "Fisher-Oakley",
  appleWebApp: { capable: true, title: "Planner", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#141a18" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <ReloadOnNewVersion />
        {children}
      </body>
    </html>
  );
}
