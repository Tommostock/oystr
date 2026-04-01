/**
 * not-found.tsx — Custom 404 page
 *
 * Shown when a user navigates to a URL that doesn't exist.
 * Styled to match the dot-matrix board aesthetic.
 */

import Link from "next/link";
import AmberText from "@/components/shared/AmberText";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center space-y-6">
      {/* Large 404 display */}
      <div
        className="font-board text-6xl tracking-[0.2em] text-amber"
        style={{ textShadow: "0 0 20px rgba(255, 149, 0, 0.5)" }}
      >
        404
      </div>

      {/* Error message */}
      <div className="space-y-2">
        <AmberText size="sm" uppercase className="dot-matrix">
          DESTINATION NOT FOUND
        </AmberText>
        <p className="font-mono text-xs tracking-wider text-amber-faint">
          THIS SERVICE IS NOT STOPPING HERE
        </p>
      </div>

      {/* Navigation back */}
      <Link
        href="/"
        className="font-mono text-xs tracking-wider text-amber border border-amber px-6 py-2.5 uppercase hover:bg-amber/10 transition-colors"
      >
        RETURN TO DEPARTURES
      </Link>
    </div>
  );
}
