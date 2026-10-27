import type { Metadata } from "next";
import { Caveat, Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
});

const script = Caveat({
  subsets: ["latin"],
  weight: "500",
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: {
    default: "Decision Court",
    template: "%s · Decision Court",
  },
  description:
    "A multi-agent decision-analysis system for examining difficult decisions from multiple perspectives.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${script.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-parchment"
        >
          Skip to content
        </a>
        <div
          aria-hidden="true"
          className="grain pointer-events-none fixed inset-0 z-40 opacity-[0.045] mix-blend-multiply"
        />
        {children}
      </body>
    </html>
  );
}
