import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";

import { THEME_SCRIPT, ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

// Three roles, three faces. Space Grotesk's slightly mechanical letterforms
// carry the headings; Plex Sans is a humanist body face that is not Inter; and
// Plex Mono handles everything that sits in a column and has to line up —
// counts, dates, addresses, ids.
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jobber",
  description:
    "Draft, send and track job applications. Cover emails written from your own documents, in your own voice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT mutates this element before React
    // hydrates, so the server's markup and the live DOM legitimately differ on
    // `data-theme`. Scoped to <html> alone — nothing inside it is exempted.
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
