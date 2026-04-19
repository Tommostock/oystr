/**
 * BottomNav.tsx — Bottom tab navigation bar
 *
 * The main navigation for the app. Fixed to the bottom of the screen.
 * 6 tabs: Depart, Nearby, Plan, Rail, Status, Saved.
 *
 * Active tab shows in bright amber with glow.
 * Inactive tabs are dim amber.
 * Uses Lucide React icons (no emojis!).
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Train,
  TrainFront,
  List,
  MapPin,
  Route,
  Activity,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_TABS } from "@/lib/constants";

/* ========================================
 * ICON MAP
 * Maps the icon name from constants to the actual
 * Lucide React icon component.
 * ======================================== */
const iconMap = {
  train: Train,
  "train-front": TrainFront,
  list: List,
  "map-pin": MapPin,
  route: Route,
  activity: Activity,
  star: Star,
} as const;

/* ========================================
 * COMPONENT
 * ======================================== */
export default function BottomNav() {
  /* usePathname gives us the current URL path (e.g. "/" or "/journey") */
  const pathname = usePathname();

  /*
   * Hide the bottom nav on /widget routes. Those routes are designed
   * for embedding in iOS widgets / home-screen bookmarks where the
   * viewport is tiny and any navigation chrome would dominate. The
   * root layout is always applied in Next.js App Router so this is
   * the cleanest way to opt a route out of app shell UI.
   */
  if (pathname.startsWith("/widget")) return null;

  return (
    <nav
      className={cn(
        /* Fixed to bottom, full width, above everything including map */
        "fixed bottom-0 left-0 right-0 z-[9000]",
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
                "relative flex flex-col items-center justify-center",
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
              {/* Active indicator line at top of tab */}
              {isActive && (
                <span
                  className="absolute top-0 left-2 right-2 h-[2px] bg-amber"
                  style={{
                    boxShadow: "0 0 8px rgba(255, 149, 0, 0.5), 0 2px 4px rgba(255, 149, 0, 0.3)",
                  }}
                />
              )}
              {/* Tab icon — slightly smaller so 6 tabs fit on 390px iPhone */}
              <IconComponent size={18} strokeWidth={1.5} />
              {/*
               * Tab label — block + w-full + text-center guarantees the
               * text is visually centred within the full tab width,
               * regardless of the label length or font bearing quirks.
               * Letter-spacing is dropped at this tiny 9px size because
               * it adds a trailing gap after the last character which
               * shifts the visible text off-centre relative to the icon,
               * most noticeably on short labels like RAIL and PLAN.
               */}
              <span className="block w-full mt-1 text-[9px] text-center uppercase font-mono">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
