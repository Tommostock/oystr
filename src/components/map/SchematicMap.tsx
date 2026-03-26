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

/** Full canvas dimensions */
const CANVAS_W = 1200;
const CANVAS_H = 800;

/** Zoom limits */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

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
   * BUILD LINE POLYLINE POINTS
   * ======================================== */
  const buildPolylinePoints = useCallback(
    (stationIds: string[]): string => {
      return stationIds
        .map((id) => {
          const s = stationMap.get(id);
          return s ? `${s.x},${s.y}` : null;
        })
        .filter(Boolean)
        .join(" ");
    },
    [stationMap]
  );

  /* ========================================
   * RENDER
   * ======================================== */

  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;
  /* Show labels only when zoomed in enough */
  const showLabels = viewBox.w < CANVAS_W * 0.8;
  /* Station dot size scales with zoom */
  const dotRadius = Math.max(2, Math.min(4, viewBox.w / 300));
  const interchangeRadius = dotRadius * 1.6;

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
              branch.filter((id): id is string => id !== null)
            );
            if (!points) return null;
            return (
              <polyline
                key={`${route.lineId}-${branchIdx}`}
                points={points}
                fill="none"
                stroke={LINE_COLOURS[route.lineId] || "#FF9500"}
                strokeWidth={Math.max(3, 5 * (CANVAS_W / viewBox.w) * 0.3)}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
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
                  strokeWidth={Math.max(0.8, 1.2 * (CANVAS_W / viewBox.w) * 0.3)}
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
                tx -= 5;
                ty += 1;
                anchor = "end";
                break;
              case "right":
                tx += 5;
                ty += 1;
                anchor = "start";
                break;
              case "above":
                ty -= 5;
                anchor = "middle";
                break;
              case "below":
                ty += 8;
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
                fontSize={Math.max(3, 5 * (CANVAS_W / viewBox.w) * 0.3)}
                opacity={0.7}
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
