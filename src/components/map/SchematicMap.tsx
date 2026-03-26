/**
 * SchematicMap.tsx -- SVG schematic tube map
 *
 * Renders a Harry Beck-style tube map as pure SVG.
 * No external map library needed -- all stations and lines
 * are pre-positioned in tube-map-data.ts.
 *
 * Features:
 *   - 13 tube/DLR/Elizabeth lines with official colours
 *   - Clickable station dots (tap for departures)
 *   - Interchange stations shown as larger hollow circles
 *   - Station name labels
 *   - Zoom (scroll wheel / pinch) and pan (drag)
 *   - Line toggle filtering via activeLines prop
 *   - Live train position dots
 */

"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  STATIONS,
  LINE_ROUTES,
  buildStationMap,
} from "@/lib/tube-map-data";
import { LINE_COLOURS } from "@/lib/constants";

/* ========================================
 * TYPES
 * ======================================== */

interface SchematicMapProps {
  /** Set of line IDs to display */
  activeLines: Set<string>;
  /** Called when a station marker is tapped */
  onStationSelect: (station: { naptanId: string; name: string }) => void;
}

/* ========================================
 * CONSTANTS
 * ======================================== */

/** Full canvas dimensions — larger to spread stations apart */
const CANVAS_W = 1400;
const CANVAS_H = 900;

/** Zoom limits */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

/** Line stroke width */
const LINE_WIDTH = 3;

/**
 * Gap between parallel lines at shared stations.
 * When multiple lines pass through an interchange, each line
 * gets its own "lane" offset by this many SVG units.
 * This makes lines run side-by-side (like real tube maps)
 * instead of stacking invisibly on top of each other.
 */
const LANE_GAP = 4;

/**
 * Consistent ordering for assigning lanes at interchange stations.
 * Lines earlier in this list get lower lane indices (drawn first).
 * This ensures the same line always gets the same relative position
 * at every interchange it passes through.
 */
const LINE_ORDER: string[] = [
  "metropolitan",
  "hammersmith-city",
  "circle",
  "district",
  "piccadilly",
  "central",
  "bakerloo",
  "jubilee",
  "victoria",
  "northern",
  "waterloo-city",
  "elizabeth",
  "dlr",
];

/* ========================================
 * COMPONENT
 * ======================================== */

export default function SchematicMap({
  activeLines,
  onStationSelect,
}: SchematicMapProps) {
  /* ---- Zoom and pan state ---- */
  const [viewBox, setViewBox] = useState({
    x: 0,
    y: 0,
    w: CANVAS_W,
    h: CANVAS_H,
  });

  /* For drag/pan tracking */
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  /* ---- Station lookup ---- */
  const stationMap = useMemo(() => buildStationMap(), []);

  /**
   * For each station served by multiple lines, compute the lane
   * offset for each line. This makes lines run parallel at
   * interchanges instead of stacking on top of each other.
   *
   * Returns a Map: "stationId:lineId" -> offset in SVG units
   *
   * Example: If Baker Street is served by [metropolitan, circle,
   * hammersmith-city, jubilee, bakerloo], each gets an offset:
   *   metropolitan: -8, hammersmith-city: -4, circle: 0,
   *   jubilee: +4, bakerloo: +8
   */
  const laneOffsets = useMemo(() => {
    const offsets = new Map<string, number>();

    for (const station of STATIONS) {
      /* Only compute lanes for interchange stations (2+ lines) */
      if (station.lines.length < 2) continue;

      /* Sort this station's lines by the global LINE_ORDER */
      const sortedLines = [...station.lines].sort(
        (a, b) => LINE_ORDER.indexOf(a) - LINE_ORDER.indexOf(b)
      );

      /* Centre the lanes around 0 */
      const count = sortedLines.length;
      const totalWidth = (count - 1) * LANE_GAP;
      const startOffset = -totalWidth / 2;

      for (let i = 0; i < count; i++) {
        const key = `${station.naptanId}:${sortedLines[i]}`;
        offsets.set(key, startOffset + i * LANE_GAP);
      }
    }

    return offsets;
  }, []);

  /* ---- Filter stations and routes by active lines ---- */
  const visibleStations = useMemo(() => {
    return STATIONS.filter((s) =>
      s.lines.some((lineId) => activeLines.has(lineId))
    );
  }, [activeLines]);

  const visibleRoutes = useMemo(() => {
    return LINE_ROUTES.filter((r) => activeLines.has(r.lineId));
  }, [activeLines]);

  /* ========================================
   * ZOOM HANDLER (scroll wheel)
   * ======================================== */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

      setViewBox((prev) => {
        const newW = Math.min(
          CANVAS_W / MIN_ZOOM,
          Math.max(CANVAS_W / MAX_ZOOM, prev.w * zoomFactor)
        );
        const newH = Math.min(
          CANVAS_H / MIN_ZOOM,
          Math.max(CANVAS_H / MAX_ZOOM, prev.h * zoomFactor)
        );

        /* Zoom towards the center of the current view */
        const cx = prev.x + prev.w / 2;
        const cy = prev.y + prev.h / 2;

        return {
          x: cx - newW / 2,
          y: cy - newH / 2,
          w: newW,
          h: newH,
        };
      });
    },
    []
  );

  /* ========================================
   * PAN HANDLERS (mouse/touch drag)
   * ======================================== */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      /* Convert pixel movement to viewBox units */
      const scaleX = viewBox.w / rect.width;
      const scaleY = viewBox.h / rect.height;

      const dx = (e.clientX - dragStart.current.x) * scaleX;
      const dy = (e.clientY - dragStart.current.y) * scaleY;

      setViewBox((prev) => ({
        ...prev,
        x: prev.x - dx,
        y: prev.y - dy,
      }));

      dragStart.current = { x: e.clientX, y: e.clientY };
    },
    [viewBox.w, viewBox.h]
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  /* ========================================
   * DOUBLE-TAP TO RESET ZOOM
   * ======================================== */
  const handleDoubleClick = useCallback(() => {
    setViewBox({ x: 0, y: 0, w: CANVAS_W, h: CANVAS_H });
  }, []);

  /* ========================================
   * PINCH-TO-ZOOM (touch)
   * ======================================== */
  const lastPinchDist = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (lastPinchDist.current !== null) {
          const zoomFactor = lastPinchDist.current / dist;
          setViewBox((prev) => {
            const newW = Math.min(
              CANVAS_W / MIN_ZOOM,
              Math.max(CANVAS_W / MAX_ZOOM, prev.w * zoomFactor)
            );
            const newH = Math.min(
              CANVAS_H / MIN_ZOOM,
              Math.max(CANVAS_H / MAX_ZOOM, prev.h * zoomFactor)
            );
            const cx = prev.x + prev.w / 2;
            const cy = prev.y + prev.h / 2;
            return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
          });
        }
        lastPinchDist.current = dist;
      }
    };

    const handleTouchEnd = () => {
      lastPinchDist.current = null;
    };

    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  /* ========================================
   * BUILD LINE POLYLINE POINTS (right-angle routing with lane offsets)
   *
   * For each pair of consecutive stations, if they don't share
   * the same X or Y coordinate, we insert a corner waypoint
   * to create a clean 90-degree turn.
   *
   * At interchange stations (where multiple lines share a stop),
   * each line is offset perpendicular to its travel direction so
   * lines run side-by-side instead of stacking on top of each other.
   * This is how real tube maps show shared segments — like at
   * Earl's Court where District and Piccadilly run parallel.
   *
   * The offset direction depends on the segment:
   *   - Horizontal segments → offset vertically (shift Y)
   *   - Vertical segments → offset horizontally (shift X)
   * ======================================== */
  const buildPolylinePoints = useCallback(
    (stationIds: string[], lineId: string): string => {
      /*
       * Step 1: Build raw station coordinates with lane offsets.
       * For each station, determine if this line needs an offset
       * and which direction to apply it based on neighbours.
       */
      const coords: { x: number; y: number }[] = [];

      for (let i = 0; i < stationIds.length; i++) {
        const sid = stationIds[i];
        const s = stationMap.get(sid);
        if (!s) continue;

        /* Get lane offset for this line at this station (0 if not an interchange) */
        const offset = laneOffsets.get(`${sid}:${lineId}`) || 0;

        if (offset === 0) {
          coords.push({ x: s.x, y: s.y });
          continue;
        }

        /*
         * Determine segment direction to know which axis to offset.
         * Look at the previous and next stations to figure out if
         * this line is running horizontally or vertically here.
         */
        const prevStation = i > 0 ? stationMap.get(stationIds[i - 1]) : null;
        const nextStation =
          i < stationIds.length - 1
            ? stationMap.get(stationIds[i + 1])
            : null;

        /* Default: check if the line is more horizontal or vertical at this point */
        let isHorizontal = true;
        if (prevStation && nextStation) {
          const dx = Math.abs(nextStation.x - prevStation.x);
          const dy = Math.abs(nextStation.y - prevStation.y);
          isHorizontal = dx >= dy;
        } else if (prevStation) {
          isHorizontal = Math.abs(s.x - prevStation.x) >= Math.abs(s.y - prevStation.y);
        } else if (nextStation) {
          isHorizontal = Math.abs(nextStation.x - s.x) >= Math.abs(nextStation.y - s.y);
        }

        if (isHorizontal) {
          /* Horizontal segment — offset vertically */
          coords.push({ x: s.x, y: s.y + offset });
        } else {
          /* Vertical segment — offset horizontally */
          coords.push({ x: s.x + offset, y: s.y });
        }
      }

      /*
       * Step 2: Insert corner waypoints for right-angle routing.
       * Between any two points that don't share X or Y, add a
       * corner to create an L-shaped 90-degree path.
       */
      const points: string[] = [];

      for (let i = 0; i < coords.length; i++) {
        const c = coords[i];

        if (i === 0) {
          points.push(`${c.x},${c.y}`);
          continue;
        }

        const prev = coords[i - 1];

        if (prev.x !== c.x && prev.y !== c.y) {
          /* Insert corner: horizontal first, then vertical */
          points.push(`${c.x},${prev.y}`);
        }

        points.push(`${c.x},${c.y}`);
      }

      return points.join(" ");
    },
    [stationMap, laneOffsets]
  );

  /* ========================================
   * RENDER
   * ======================================== */

  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;
  /*
   * Only show labels when zoomed in enough to avoid overlap.
   * At full zoom-out (viewBox.w = 1200), labels would overlap badly.
   * At 50% zoom (viewBox.w = 600), there's enough space.
   */
  const showLabels = viewBox.w < CANVAS_W * 0.55;
  /* Station dot size — fixed for clarity */
  const dotRadius = 3;
  const interchangeRadius = 5;

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-board-bg cursor-grab active:cursor-grabbing touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      <svg
        viewBox={vb}
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ---- Background ---- */}
        <rect
          x={viewBox.x - 100}
          y={viewBox.y - 100}
          width={viewBox.w + 200}
          height={viewBox.h + 200}
          fill="#0a0a0a"
        />

        {/* ---- Line paths ---- */}
        {visibleRoutes.map((route) =>
          route.branches.map((branch, branchIdx) => {
            const points = buildPolylinePoints(
              branch.filter((id): id is string => id !== null),
              route.lineId
            );
            if (!points) return null;
            return (
              <polyline
                key={`${route.lineId}-${branchIdx}`}
                points={points}
                fill="none"
                stroke={LINE_COLOURS[route.lineId] || "#FF9500"}
                strokeWidth={LINE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
              />
            );
          })
        )}

        {/* ---- Station dots ---- */}
        {visibleStations.map((station) => {
          const isInterchange = station.lines.length > 1;

          return (
            <g
              key={station.naptanId}
              onClick={(e) => {
                e.stopPropagation();
                onStationSelect({
                  naptanId: station.naptanId,
                  name: station.name,
                });
              }}
              className="cursor-pointer"
            >
              {/* Interchange: larger hollow circle with white border */}
              {isInterchange ? (
                <circle
                  cx={station.x}
                  cy={station.y}
                  r={interchangeRadius}
                  fill="#0a0a0a"
                  stroke="#ffffff"
                  strokeWidth={1.2}
                />
              ) : (
                /* Regular: small filled circle */
                <circle
                  cx={station.x}
                  cy={station.y}
                  r={dotRadius}
                  fill="#ff9500"
                  stroke="#0a0a0a"
                  strokeWidth={0.5}
                />
              )}

              {/* Hover target (invisible larger circle for easier tapping) */}
              <circle
                cx={station.x}
                cy={station.y}
                r={Math.max(8, interchangeRadius * 2)}
                fill="transparent"
              />
            </g>
          );
        })}

        {/* ---- Station labels (only when zoomed in) ---- */}
        {showLabels &&
          visibleStations.map((station) => {
            const lp = station.labelPosition || "right";
            let tx = station.x;
            let ty = station.y;
            let anchor: "start" | "middle" | "end" = "start";

            switch (lp) {
              case "left":
                tx -= 8;
                ty -= 3;
                anchor = "end";
                break;
              case "right":
                tx += 8;
                ty -= 3;
                anchor = "start";
                break;
              case "above":
                ty -= 8;
                anchor = "middle";
                break;
              case "below":
                ty += 10;
                anchor = "middle";
                break;
            }

            return (
              <text
                key={`label-${station.naptanId}`}
                x={tx}
                y={ty}
                textAnchor={anchor}
                className="schematic-label"
                fill="#ff9500"
                stroke="#0a0a0a"
                strokeWidth={2}
                paintOrder="stroke fill"
                fontSize={5}
                opacity={0.85}
                pointerEvents="none"
              >
                {station.name}
              </text>
            );
          })}

        {/* Live train tracking removed for now — will re-implement properly */}
      </svg>
    </div>
  );
}
