/**
 * BottomNav.tsx — Bottom tab navigation bar
 *
 * The main navigation for the app. Fixed to the bottom of the screen.
 * 5 tabs: Departures, Map, Journey, Status, Saved.
 *
 * Active tab shows in bright amber with glow.
 * Inactive tabs are dim amber.
 * Uses Lucide React icons (no emojis!).
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Train, Map, Route, Activity, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_TABS } from "@/lib/constants";

/* ========================================
 * ICON MAP
 * Maps the icon name from constants to the actual
 * Lucide React icon component.
 * ======================================== */
const iconMap = {
  train: Train,
  map: Map,
  route: Route,
  activity: Activity,
  star: Star,
} as const;

/* ========================================
 * COMPONENT
 * ======================================== */
export default function BottomNav() {
  /* usePathname gives us the current URL path (e.g. "/" or "/map") */
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        /* Fixed to bottom, full width */
        "fixed bottom-0 left-0 right-0 z-50",
        /* Dark background with top border */
        "bg-board-bg border-t border-board-border",
        /* Safe area padding for phones with home indicators */
        "pb-[env(safe-area-inset-bottom)]"
      )}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-14">
        {NAV_TABS.map((tab) => {
          /*
           * Check if this tab is the active one.
           * For the home tab ("/"), we need an exact match.
           * For other tabs, we check if the path starts with the tab href.
           */
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);

          /* Look up the icon component for this tab */
          const IconComponent = iconMap[tab.icon as keyof typeof iconMap];

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                /* Base styles: centered column layout */
                "flex flex-col items-center justify-center",
                "w-full h-full",
                /* Transition for smooth colour changes */
                "transition-colors duration-200",
                /* Active = bright amber with glow, inactive = faint */
                isActive
                  ? "text-amber amber-glow"
                  : "text-amber-faint hover:text-amber-dim"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Tab icon */}
              <IconComponent size={20} strokeWidth={1.5} />
              {/* Tab label */}
              <span className="text-[10px] mt-1 tracking-wider uppercase font-mono">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
