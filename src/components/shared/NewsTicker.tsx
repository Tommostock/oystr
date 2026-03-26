/**
 * NewsTicker.tsx — Scrolling London news headlines
 *
 * Fetches BBC London news from our /api/news endpoint and
 * displays them as a continuously scrolling horizontal ticker,
 * styled like the dot-matrix message boards above platforms.
 *
 * The ticker duplicates the headline list so the scroll loops
 * seamlessly — when the first copy scrolls out of view, the
 * second copy is right behind it in the same position.
 *
 * Headlines are clickable and open the BBC article in a new tab.
 * Falls back gracefully if the API fails (renders nothing).
 *
 * Usage:
 *   <NewsTicker />
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Newspaper } from "lucide-react";

/** Shape of a news headline from our API */
interface Headline {
  title: string;
  link: string;
  pubDate: string;
}

export default function NewsTicker() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const tickerRef = useRef<HTMLDivElement>(null);

  /*
   * Fetch news headlines on mount.
   * The API caches for 15 minutes, so rapid page navigations
   * won't make extra requests to BBC.
   */
  useEffect(() => {
    async function fetchNews() {
      try {
        const resp = await fetch("/api/news");
        if (!resp.ok) return;

        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          setHeadlines(data);
        }
      } catch {
        /* Silently fail — news is not critical */
      } finally {
        setIsLoading(false);
      }
    }

    fetchNews();
  }, []);

  /* Don't render anything while loading or if no headlines */
  if (isLoading || headlines.length === 0) return null;

  /*
   * Build the ticker text as a single string of headlines
   * separated by dividers. We duplicate it so the scroll
   * loops seamlessly (the CSS animation scrolls by -50%,
   * meaning it scrolls through the first copy exactly,
   * then the second copy is in the starting position).
   */
  const divider = " \u2014\u2014\u2014 "; /* em dashes as separator */

  /*
   * Calculate animation duration based on number of headlines.
   * More headlines = longer string = needs more time to scroll.
   * ~3 seconds per headline gives a comfortable reading speed.
   */
  const duration = headlines.length * 4;

  return (
    <div className="border border-board-border bg-surface overflow-hidden">
      {/* ---- Header label ---- */}
      <div className="flex items-center gap-2 px-2.5 pt-2 pb-1">
        <Newspaper
          size={12}
          strokeWidth={1.5}
          className="text-amber shrink-0"
        />
        <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
          London News
        </span>
      </div>

      {/* ---- Scrolling ticker ---- */}
      <div className="relative overflow-hidden px-2.5 pb-2.5">
        <div
          ref={tickerRef}
          className="ticker-scroll whitespace-nowrap"
          style={{
            /* Pass duration as CSS variable for the animation */
            "--ticker-duration": `${duration}s`,
          } as React.CSSProperties}
        >
          {/*
           * Render headlines twice for seamless looping.
           * The animation scrolls -50% (the width of one full set),
           * so when it resets to 0%, the second set is in the exact
           * same starting position — creating an infinite loop.
           */}
          {[...headlines, ...headlines].map((headline, i) => (
            <span key={i} className="inline">
              <a
                href={headline.link}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs tracking-wider text-amber amber-glow hover:text-amber-bright transition-colors uppercase"
              >
                {headline.title}
              </a>
              {/* Divider between headlines */}
              <span className="font-mono text-xs tracking-wider text-amber-faint">
                {divider}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
