"use client";

import { useCallback, useRef, useState } from "react";
import {
  THEATER_STRIP_MAX,
  THEATER_STRIP_MIN,
  useEditorSettingsStore,
} from "@/stores/editor-settings-store";

/**
 * Horizontal drag handle that sits between the theater preview and the film
 * strip, letting the user retune the strip height in real time. The stored
 * value is persisted via editor-settings-store so the choice survives reloads.
 *
 * The visible bar is 2px tall; the hit target extends 6px in each direction
 * (total 12px) so the cursor-flip and drag feel generous without visually
 * crowding either side. A 1-frame debounce on the store write keeps the
 * persisted value cheap without sacrificing the live feel.
 */
export function TheaterDivider() {
  const stripHeight = useEditorSettingsStore((s) => s.layout.theaterStripHeight);
  const setTheaterStripHeight = useEditorSettingsStore(
    (s) => s.setTheaterStripHeight,
  );

  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const rafRef = useRef<number | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const nextHeight = window.innerHeight - e.clientY;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setTheaterStripHeight(
          Math.max(THEATER_STRIP_MIN, Math.min(THEATER_STRIP_MAX, nextHeight)),
        );
        rafRef.current = null;
      });
    },
    [dragging, setTheaterStripHeight],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      setDragging(false);
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },
    [dragging],
  );

  const active = hovering || dragging;

  return (
    <div
      className="relative z-20 -mt-[6px] mb-0 h-[12px] cursor-row-resize select-none"
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="separator"
      aria-orientation="horizontal"
      aria-label={`Redimensionar tira de tempo (${stripHeight}px)`}
      style={{ touchAction: "none" }}
    >
      <div
        className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 transition-colors"
        style={{
          backgroundColor: active
            ? "rgba(200, 169, 110, 0.55)"
            : "rgba(255, 255, 255, 0.05)",
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-[4px] w-[32px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-all"
        style={{
          backgroundColor: active
            ? "rgba(200, 169, 110, 0.9)"
            : "rgba(255, 255, 255, 0.14)",
          transform: `translate(-50%, -50%) scaleY(${active ? 1.2 : 1})`,
        }}
      />
    </div>
  );
}
