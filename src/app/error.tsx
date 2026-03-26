/**
 * error.tsx — Global error boundary
 *
 * Catches rendering errors and shows a recovery UI instead
 * of a white screen crash. Users can tap to retry.
 */

"use client";

import AmberText from "@/components/shared/AmberText";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-4 pt-12 text-center space-y-4">
      <AmberText size="lg" uppercase className="dot-matrix">
        SYSTEM ERROR
      </AmberText>
      <p className="font-mono text-sm tracking-wider text-amber-faint">
        SOMETHING WENT WRONG -- TAP BELOW TO RETRY
      </p>
      <button
        onClick={reset}
        className="font-mono text-sm tracking-wider text-amber border border-amber px-4 py-2 hover:bg-amber/10 transition-colors"
      >
        RETRY
      </button>
    </div>
  );
}
