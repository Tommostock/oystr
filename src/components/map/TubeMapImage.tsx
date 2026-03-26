/**
 * TubeMapImage.tsx -- Zoomable TfL tube map
 *
 * Displays the Wikimedia Commons tube map SVG as a zoomable,
 * pannable image with CSS filters for dark mode.
 *
 * Source: Wikimedia Commons CC-BY-SA-4.0
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/** Zoom limits */
const MIN_SCALE = 1;
const MAX_SCALE = 6;

export default function TubeMapImage() {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  /* ---- Scroll wheel zoom ---- */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * zoomFactor));

      /* Zoom towards mouse position */
      const ratio = newScale / scale;
      setTranslate((prev) => ({
        x: mx - (mx - prev.x) * ratio,
        y: my - (my - prev.y) * ratio,
      }));
      setScale(newScale);
    },
    [scale]
  );

  /* ---- Drag to pan ---- */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      translateStart.current = { ...translate };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [translate]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    setTranslate({
      x: translateStart.current.x + (e.clientX - dragStart.current.x),
      y: translateStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  /* ---- Double-tap to reset ---- */
  const handleDoubleClick = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  /* ---- Pinch-to-zoom ---- */
  const lastPinchDist = useRef<number | null>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (lastPinchDist.current !== null) {
          const factor = dist / lastPinchDist.current;
          setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * factor)));
        }
        lastPinchDist.current = dist;
      }
    };
    const onTouchEnd = () => { lastPinchDist.current = null; };

    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);
    return () => {
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-board-bg cursor-grab active:cursor-grabbing touch-none select-none overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      {/*
        The map image fills the container width at scale=1.
        CSS transform handles zoom and pan on top of that.
        filter: invert + hue-rotate converts white BG to dark mode.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/tube-map.svg"
        alt="London Underground tube map"
        className="w-full h-auto"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: "0 0",
          filter: "invert(0.88) hue-rotate(180deg) saturate(1.5) brightness(0.85)",
          pointerEvents: "none",
        }}
        draggable={false}
      />
    </div>
  );
}
