/**
 * PageHeader.tsx — Standardised tab / page header
 *
 * Every tab in the app opens with the same dot-matrix header shape:
 * a centred uppercase title with a smaller amber-faint subtitle
 * line underneath. Before this primitive each page re-rolled that
 * markup by hand, and the spacing / tracking drifted over time —
 * e.g. some tabs had no subtitle, some had different letter-spacing
 * on the subtitle, some used a base title size instead of lg.
 *
 * This component centralises the pattern so every tab reads as
 * part of the same app. Optional slots:
 *   - `back`      : renders on the top-left as a RESET-style link
 *                   (used on the focused station / airport pages)
 *   - `action`    : renders on the top-right (e.g. Terminal's About
 *                   button)
 *
 * For the Terminal brand hero, pass size="2xl" + glow="strong".
 */

"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import AmberText from "./AmberText";

type HeaderSize = "base" | "lg" | "2xl";
type HeaderGlow = "default" | "strong";

interface PageHeaderProps {
  /** Main title (e.g. "Rail", "Oystr"). Uppercased + dot-matrix styled. */
  title: string;
  /** Optional line below the title — small amber-faint uppercase. */
  subtitle?: string;
  /** Visual size of the title — default "lg" is consistent across tabs. */
  size?: HeaderSize;
  /** Glow treatment — default is amber text-shadow, "strong" is Terminal's brand hero. */
  glow?: HeaderGlow;
  /**
   * Optional back affordance on the top-left. Supply either an
   * `href` (rendered as a Link — used on focused detail pages) OR
   * an `onClick` (rendered as a button — used on Terminal's RESET
   * which clears in-page state rather than navigating).
   */
  back?: {
    label: string;
    ariaLabel?: string;
    href?: string;
    onClick?: () => void;
  };
  /** Optional right-side slot (e.g. About button). */
  action?: React.ReactNode;
  /** Additional top/bottom padding override */
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  size = "lg",
  glow = "default",
  back,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center pt-4 pb-2",
        className
      )}
    >
      {/* Back affordance — Link when href given, button when onClick given. */}
      {back && back.href && (
        <Link
          href={back.href}
          aria-label={back.ariaLabel ?? `Back to ${back.label.toLowerCase()}`}
          className="absolute left-0 flex items-center gap-1.5 text-amber-faint hover:text-amber transition-colors font-mono text-xs tracking-wider"
        >
          <RotateCcw size={14} strokeWidth={1.5} />
          <span>{back.label}</span>
        </Link>
      )}
      {back && !back.href && back.onClick && (
        <button
          onClick={back.onClick}
          aria-label={back.ariaLabel ?? `Back to ${back.label.toLowerCase()}`}
          className="absolute left-0 flex items-center gap-1.5 text-amber-faint hover:text-amber transition-colors font-mono text-xs tracking-wider"
        >
          <RotateCcw size={14} strokeWidth={1.5} />
          <span>{back.label}</span>
        </button>
      )}

      <div className="flex flex-col items-center">
        <AmberText
          as="h1"
          size={size}
          uppercase
          className={cn(
            "dot-matrix",
            glow === "strong" ? "amber-glow-strong" : "amber-glow"
          )}
        >
          {title}
        </AmberText>
        {subtitle && (
          <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase mt-1">
            {subtitle}
          </span>
        )}
      </div>

      {action && <div className="absolute right-0">{action}</div>}
    </div>
  );
}
