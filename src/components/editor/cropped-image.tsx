"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageCrop } from "@/stores/project-store";

/**
 * Renders an image with an optional non-destructive crop applied via CSS
 * positioning. The crop rectangle is normalized 0..1 over the source image:
 * the wrapper acts as a viewport, and the inner <img> is upscaled and
 * negatively offset so that only the cropped region is visible inside the
 * caller-defined frame.
 *
 * Why CSS instead of canvas: the scene's `photoUrl` is the original asset,
 * shared across many surfaces (film-strip thumbs, inspector preview, theater
 * preview, headline preview). Rasterizing per-surface would multiply network
 * traffic and decode work on every frame; CSS positioning is GPU-cheap and
 * stays pixel-correct at any container size. The canvas roundtrip only
 * happens once at generation time (see `renderCroppedAndUpload` in
 * project-store).
 *
 * Aspect-ratio behavior with a crop applied:
 *   - `objectFit="cover"` (default): the cropped region fills the wrapper,
 *     accepting some stretch when wrapper aspect ≠ crop aspect. Best for
 *     thumbs / cards where filling the slot matters more than fidelity.
 *   - `objectFit="contain"`: the cropped region is letterboxed inside the
 *     wrapper, preserving its true aspect ratio. The component probes the
 *     source's natural dimensions on mount and observes the wrapper size
 *     via ResizeObserver, then explicitly sizes an inner box with the
 *     correct width/height (no reliance on CSS aspect-ratio + max-*, which
 *     under-specifies the layout when the parent dimensions are
 *     flex-driven). Best for full-screen previews (Foco, headline) where
 *     distortion would be immediately visible.
 */
export function CroppedImage({
  src,
  crop,
  className,
  alt,
  imgClassName,
  draggable,
  objectFit = "cover",
  onLoad,
}: {
  src: string;
  crop?: ImageCrop | null;
  /** Class for the outer wrapper. Sets size, aspect-ratio, rounding, etc. */
  className?: string;
  alt?: string;
  /** Optional extra classes for the inner <img>. */
  imgClassName?: string;
  draggable?: boolean;
  /** How the cropped region fits inside the wrapper. See block comment. */
  objectFit?: "cover" | "contain";
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  // Natural source dimensions, captured for `contain` layout.
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  // Wrapper size, observed live so the inner letterbox tracks resizes
  // (e.g. dragging the timeline/preview divider in Foco mode).
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!crop || objectFit !== "contain" || !src) return;
    const probe = document.createElement("img");
    let cancelled = false;
    probe.onload = () => {
      if (cancelled) return;
      if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
        setNatural({ w: probe.naturalWidth, h: probe.naturalHeight });
      }
    };
    probe.src = src;
    return () => {
      cancelled = true;
      probe.onload = null;
    };
  }, [src, crop, objectFit]);

  useEffect(() => {
    if (!crop || objectFit !== "contain") return;
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ w: rect.width, h: rect.height });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [crop, objectFit]);

  if (!crop) {
    return (
      <div className={`relative overflow-hidden ${className ?? ""}`.trim()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? ""}
          draggable={draggable}
          onLoad={onLoad}
          className={`absolute inset-0 h-full w-full ${
            objectFit === "cover" ? "object-cover" : "object-contain"
          } ${imgClassName ?? ""}`.trim()}
        />
      </div>
    );
  }

  // Guard against degenerate crop (avoid Infinity scaling).
  const w = Math.max(0.01, Math.min(1, crop.width));
  const h = Math.max(0.01, Math.min(1, crop.height));
  const x = Math.max(0, Math.min(1, crop.x));
  const y = Math.max(0, Math.min(1, crop.y));

  // Inner <img> uses the CSS positioning trick: scaled by 1/w and 1/h,
  // shifted by (-x/w, -y/h) so the cropped region exactly fills its
  // direct parent. Stretching the source happens only if the parent's
  // aspect ratio differs from the crop's — the contain branch below
  // guarantees they match by sizing the parent explicitly.
  const croppedImg = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ""}
      draggable={draggable}
      onLoad={onLoad}
      className={imgClassName}
      style={{
        position: "absolute",
        width: `${100 / w}%`,
        height: `${100 / h}%`,
        left: `${(-x * 100) / w}%`,
        top: `${(-y * 100) / h}%`,
        maxWidth: "none",
      }}
    />
  );

  if (objectFit === "contain") {
    let innerW: number | null = null;
    let innerH: number | null = null;
    if (natural && containerSize) {
      const cropAspect = (w * natural.w) / (h * natural.h);
      const containerAspect = containerSize.w / containerSize.h;
      if (containerAspect > cropAspect) {
        // Container is wider than the crop → fit by height (vertical bars).
        innerH = containerSize.h;
        innerW = innerH * cropAspect;
      } else {
        innerW = containerSize.w;
        innerH = innerW / cropAspect;
      }
    }

    return (
      <div
        ref={wrapperRef}
        className={`relative flex items-center justify-center overflow-hidden ${
          className ?? ""
        }`.trim()}
      >
        <div
          className="relative overflow-hidden"
          style={
            innerW != null && innerH != null
              ? { width: `${innerW}px`, height: `${innerH}px` }
              : { width: "100%", height: "100%" }
          }
        >
          {croppedImg}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`.trim()}>
      {croppedImg}
    </div>
  );
}
