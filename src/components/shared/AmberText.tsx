/**
 * AmberText.tsx — Styled text component with LED glow
 *
 * This is the core text component for the dot-matrix look.
 * It renders amber-coloured text with a subtle glow effect,
 * wide letter-spacing, and optional uppercase transform.
 *
 * Usage:
 *   <AmberText>MILE END</AmberText>
 *   <AmberText variant="dim" size="sm">Platform 1</AmberText>
 */

import { cn } from "@/lib/utils";

/* ========================================
 * PROPS
 * ======================================== */
interface AmberTextProps {
  /** The text content to display */
  children: React.ReactNode;
  /**
   * Colour intensity:
   *   "primary"   = bright amber (#ff9500) — default
   *   "secondary" = dimmer amber (#cc7700)
   *   "dim"       = faint amber (#664400)
   */
  variant?: "primary" | "secondary" | "dim";
  /**
   * Text size:
   *   "xs" = 12px, "sm" = 14px, "base" = 16px,
   *   "lg" = 18px, "xl" = 20px, "2xl" = 24px
   */
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl";
  /** If true, text is rendered in UPPERCASE (like real boards) */
  uppercase?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** HTML element to render as (default: "span") */
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div";
}

/* ========================================
 * STYLE MAPS
 * These map prop values to Tailwind classes.
 * ======================================== */

/** Colour classes for each variant */
const variantStyles = {
  primary: "text-amber amber-glow",
  secondary: "text-amber-dim",
  dim: "text-amber-faint",
};

/** Font size classes */
const sizeStyles = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
};

/* ========================================
 * COMPONENT
 * ======================================== */
export default function AmberText({
  children,
  variant = "primary",
  size = "base",
  uppercase = false,
  className,
  as: Tag = "span",
}: AmberTextProps) {
  return (
    <Tag
      className={cn(
        /* Base styles: mono font, wide letter-spacing */
        "font-mono tracking-wider",
        /* Colour based on variant */
        variantStyles[variant],
        /* Font size */
        sizeStyles[size],
        /* Uppercase transform if requested */
        uppercase && "uppercase",
        /* Any extra classes passed in */
        className
      )}
    >
      {children}
    </Tag>
  );
}
