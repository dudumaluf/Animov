"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExportAspectRatio } from "@/stores/project-store";
import type { FrameOverlayMode } from "@/stores/editor-settings-store";

/**
 * Wraps a preview surface with a visualization of the project's export
 * aspect ratio. The wrapper measures its own size via ResizeObserver, computes
 * the largest rectangle that fits inside while honoring the target aspect, and
 * either:
 *
 * - `letterbox`: hides everything outside the frame (matches what the final
 *   exported video will actually contain). The children are clipped via a
 *   centered overflow-hidden box.
 * - `guideframe`: keeps the children visible at full size (so the user still
 *   sees source-image overflow) and dims the four "outside the frame" regions
 *   with a configurable opacity, plus a subtle gold border around the export
 *   rectangle.
 *
 * When `mode === "guideframe"` and `overflowOpacity === 100`, the overlay is
 * effectively a labeled border. When 0, the overlay matches `letterbox`'s
 * visual outcome (but uses 4 absolutely-positioned tiles instead of clip-path,
 * so children can still receive pointer events outside the frame if needed).
 *
 * `aspectRatio` accepts either a literal `ExportAspectRatio` token (most
 * callers pass `useProjectStore` state directly) or a numeric width/height
 * ratio for ad-hoc surfaces.
 */
export type FrameOverlayProps = {
  aspectRatio: ExportAspectRatio | number;
  mode: FrameOverlayMode;
  /** 0..100, only used when `mode === "guideframe"`. */
  overflowOpacity?: number;
  /** When false the wrapper is a transparent pass-through (no overlay). */
  enabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

const RATIO_NUM: Record<ExportAspectRatio, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "1:1": 1,
  "4:5": 4 / 5,
};

/**
 * Tailwind class that pins an element's aspect ratio to the project's
 * `ExportAspectRatio`. Useful for preview surfaces (inspector preview block,
 * EditPreview) that want to size themselves to the export shape so the
 * FrameOverlay sits flush with the container border.
 */
export function aspectRatioClass(ratio: ExportAspectRatio): string {
  switch (ratio) {
    case "16:9":
      return "aspect-video";
    case "9:16":
      return "aspect-[9/16]";
    case "1:1":
      return "aspect-square";
    case "4:5":
      return "aspect-[4/5]";
  }
}

function resolveAspect(input: ExportAspectRatio | number): number {
  if (typeof input === "number") return input > 0 ? input : 1;
  return RATIO_NUM[input];
}

export function FrameOverlay({
  aspectRatio,
  mode,
  overflowOpacity = 25,
  enabled = true,
  className,
  children,
}: FrameOverlayProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ w: rect.width, h: rect.height });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [enabled]);

  const targetAspect = resolveAspect(aspectRatio);

  // Compute the centered frame rectangle that fits in the wrapper.
  const frame = useMemo(() => {
    if (!size) return null;
    const { w, h } = size;
    const containerAspect = w / h;
    let fw = w;
    let fh = h;
    if (containerAspect > targetAspect) {
      // Container is wider → frame is height-bound.
      fh = h;
      fw = fh * targetAspect;
    } else {
      fw = w;
      fh = fw / targetAspect;
    }
    const left = (w - fw) / 2;
    const top = (h - fh) / 2;
    return { left, top, width: fw, height: fh };
  }, [size, targetAspect]);

  // Pass-through when disabled — caller surface stays exactly as it was.
  if (!enabled) {
    return (
      <div className={`relative ${className ?? ""}`.trim()}>{children}</div>
    );
  }

  // Letterbox: clip children to the frame rectangle. We do this by stretching
  // children across the full wrapper and overlaying a black mask everywhere
  // except inside the frame, which is the visual equivalent of clipping.
  if (mode === "letterbox") {
    return (
      <div
        ref={wrapperRef}
        className={`relative overflow-hidden bg-black ${className ?? ""}`.trim()}
      >
        {children}
        {frame ? (
          <>
            {/* Top mask */}
            <div
              className="pointer-events-none absolute left-0 right-0 top-0 bg-black"
              style={{ height: `${frame.top}px` }}
            />
            {/* Bottom mask */}
            <div
              className="pointer-events-none absolute left-0 right-0 bottom-0 bg-black"
              style={{ height: `${frame.top}px` }}
            />
            {/* Left mask */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 left-0 bg-black"
              style={{ width: `${frame.left}px` }}
            />
            {/* Right mask */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 right-0 bg-black"
              style={{ width: `${frame.left}px` }}
            />
          </>
        ) : null}
      </div>
    );
  }

  // Guideframe: dim everything outside the frame (so the user still sees
  // source overflow) and outline the frame with a thin gold border.
  // The overflow opacity is applied as the *inverse alpha* of the dim
  // overlay — overflowOpacity=100 => transparent dim (overflow fully visible);
  // overflowOpacity=0 => fully opaque dim (matches letterbox).
  const dimAlpha = Math.max(0, Math.min(1, 1 - overflowOpacity / 100));

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden ${className ?? ""}`.trim()}
    >
      {children}
      {frame ? (
        <>
          {/* Top dim */}
          <div
            className="pointer-events-none absolute left-0 right-0 top-0"
            style={{
              height: `${frame.top}px`,
              backgroundColor: `rgba(0, 0, 0, ${dimAlpha})`,
            }}
          />
          {/* Bottom dim */}
          <div
            className="pointer-events-none absolute left-0 right-0 bottom-0"
            style={{
              height: `${frame.top}px`,
              backgroundColor: `rgba(0, 0, 0, ${dimAlpha})`,
            }}
          />
          {/* Left dim */}
          <div
            className="pointer-events-none absolute left-0"
            style={{
              top: `${frame.top}px`,
              height: `${frame.height}px`,
              width: `${frame.left}px`,
              backgroundColor: `rgba(0, 0, 0, ${dimAlpha})`,
            }}
          />
          {/* Right dim */}
          <div
            className="pointer-events-none absolute right-0"
            style={{
              top: `${frame.top}px`,
              height: `${frame.height}px`,
              width: `${frame.left}px`,
              backgroundColor: `rgba(0, 0, 0, ${dimAlpha})`,
            }}
          />
          {/* Frame border — sits exactly on the export boundary. */}
          <div
            className="pointer-events-none absolute border border-accent-gold/40"
            style={{
              left: `${frame.left}px`,
              top: `${frame.top}px`,
              width: `${frame.width}px`,
              height: `${frame.height}px`,
            }}
          />
        </>
      ) : null}
    </div>
  );
}
