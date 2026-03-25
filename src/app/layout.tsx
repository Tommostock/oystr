/**
 * layout.tsx — Root layout for Oystr
 *
 * This is the top-level layout that wraps every page.
 * It loads:
 *   - Google Fonts (Share Tech Mono + IBM Plex Mono)
 *   - PWA meta tags for mobile install
 *   - The BottomNav navigation bar
 *   - The OfflineBanner for connectivity status
 *
 * Every page in the app inherits this layout automatically.
 */

import type { Metadata, Viewport } from "next";
import { Share_Tech_Mono, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/shared/BottomNav";
import OfflineBanner from "@/components/shared/OfflineBanner";

/* ========================================
 * FONT LOADING
 * next/font/google automatically self-hosts these fonts,
 * so no requests are sent to Google from the user's browser.
 * The 'variable' option creates a CSS custom property we
 * can reference in our Tailwind theme.
 * ======================================== */

/** Share Tech Mono — primary dot-matrix display font */
const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-share-tech-mono",
  display: "swap",
});

/** IBM Plex Mono — secondary font for readable body text */
const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

/* ========================================
 * METADATA
 * Used by Next.js to generate <head> tags.
 * Includes PWA-related tags for mobile install.
 * ======================================== */
export const metadata: Metadata = {
  title: "Oystr - London Transport",
  description:
    "Live London transport departures, journey planning, and offline timetables",
  /* PWA manifest link */
  manifest: "/manifest.json",
  /* Apple-specific PWA settings */
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Oystr",
  },
  /* Open Graph for social sharing */
  openGraph: {
    title: "Oystr - London Transport",
    description: "Live departures and journey planning for London transport",
    type: "website",
  },
};

/** Viewport configuration — separate from metadata in Next.js 15 */
export const viewport: Viewport = {
  /* Dark theme colour for the browser chrome */
  themeColor: "#0a0a0a",
  /* Standard mobile viewport settings */
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  /* Ensure content respects the safe area on notched phones */
  viewportFit: "cover",
};

/* ========================================
 * ROOT LAYOUT COMPONENT
 * ======================================== */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${shareTechMono.variable} ${ibmPlexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-board-bg text-amber antialiased">
        {/* Offline banner — only shows when there's no internet */}
        <OfflineBanner />

        {/*
         * Main content area.
         * flex-1 makes it fill available space between banner and nav.
         * pb-16 adds padding at the bottom so content isn't hidden
         * behind the fixed BottomNav.
         */}
        <main className="flex-1 pb-16">{children}</main>

        {/* Bottom tab navigation — always visible */}
        <BottomNav />
      </body>
    </html>
  );
}
