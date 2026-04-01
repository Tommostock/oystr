/**
 * opengraph-image.tsx — Dynamic OG image for social sharing
 *
 * Next.js automatically generates an Open Graph image from this file.
 * When someone shares the Oystr link on social media, WhatsApp, etc.,
 * this image shows as the preview card.
 *
 * Uses Next.js ImageResponse API — no external image needed.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Oystr - London Transport";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0a0a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
        }}
      >
        {/* Amber glow background effect */}
        <div
          style={{
            position: "absolute",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,149,0,0.08) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* App name */}
        <div
          style={{
            fontSize: "96px",
            fontWeight: "bold",
            color: "#ff9500",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            textShadow: "0 0 40px rgba(255, 149, 0, 0.5)",
            display: "flex",
          }}
        >
          OYSTR
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "28px",
            color: "#cc7700",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginTop: "16px",
            display: "flex",
          }}
        >
          LONDON TRANSPORT
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: "20px",
            color: "#664400",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginTop: "32px",
            display: "flex",
          }}
        >
          LIVE DEPARTURES -- JOURNEY PLANNER -- NEARBY MAP
        </div>

        {/* Bottom border accent */}
        <div
          style={{
            position: "absolute",
            bottom: "0",
            left: "0",
            right: "0",
            height: "4px",
            background: "#ff9500",
            display: "flex",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
