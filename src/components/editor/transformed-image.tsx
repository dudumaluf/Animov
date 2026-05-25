"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type ExportAspectRatio,
  type ImageBackground,
  type ImageTransform,
  DEFAULT_TRANSFORM,
} from "@/stores/project-store";
import { aspectRatioClass } from "@/components/editor/frame-overlay";

/**
 * Renders a scene's source image positioned inside the project's global
 * canvas (whose aspect = `aspectRatio`). Replaces the older `CroppedImage`:
 * instead of describing a rectangle inside the source, the transform
 * describes how to place the source inside the canvas (scale + translate +
 * background fill). The same model is used by `renderTransformedAndUpload`
 * server-side at generation time, so the preview here is pixel-faithful to
 * what the model receives.
 *
 * Layout strategy:
 *   - The outer wrapper is sized by the caller via `className` (e.g. by
 *     filling a flex slot, or being constrained by `aspectRatioClass(...)`).
 *   - An inner "canvas" element is sized to match the project aspect ratio
 *     and centered inside the wrapper. In `cover` mode the canvas fills the
 *     wrapper; in `contain` mode it letterboxes (like `<video object-fit="contain">`).
 *   - Inside the canvas, an absolutely-positioned `<img>` is sized and offset
 *     according to `transform` to mirror the canvas-rendering math.
 *   - When `scale<1` (or large offsets) leave area visible outside the image,
 *     the canvas background is painted: solid color, blur-of-the-image, or
 *     the default black. Same fill the export pipeline produces.
 *
 * The component intentionally does NOT capture pointer events — interaction
 * (pan/zoom) lives in `image-edit-modal.tsx` which wraps this and handles
 * its own gesture state.
 */
export function TransformedImage({
  src,
  transform,
  aspectRatio,
  className,
  alt,
  imgClassName,
  draggable,
  objectFit = "cover",
  onLoad,
}: {
  src: string;
  transform?: ImageTransform | null;
  aspectRatio: ExportAspectRatio;
  /** Class for the outer wrapper. Sets size, rounding, etc. */
  className?: string;
  alt?: string;
  /** Optional extra classes for the inner <img>. */
  imgClassName?: string;
  draggable?: boolean;
  /**
   * - `cover`: the project canvas fills the wrapper (matches behavior of
   *   image cards / thumbnails where the slot defines the visible area).
   * - `contain`: the project canvas is letterboxed inside the wrapper,
   *   preserving the project aspect (used by Foco / preview surfaces where
   *   distortion would be immediately visible).
   */
  objectFit?: "cover" | "contain";
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  const t = transform ?? DEFAULT_TRANSFORM;
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  // Probe the source's natural dimensions so we can compute the cover-base
  // rect (needed for both background blur sizing and letterbox detection).
  useEffect(() => {
    if (!src) return;
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
  }, [src]);

  // Geometry: compute the inner image rect relative to the canvas as
  // percentages, so the rendered HTML scales fluidly with the canvas size.
  const rectPct = useMemo(() => {
    if (!natural) return null;
    const projectAspect = ASPECT_NUM[aspectRatio];
    const imgAspect = natural.w / natural.h;
    // Cover-fit base, expressed as (widthPct, heightPct) of the canvas.
    let baseWPct: number;
    let baseHPct: number;
    if (imgAspect > projectAspect) {
      baseHPct = 100;
      baseWPct = (imgAspect / projectAspect) * 100;
    } else {
      baseWPct = 100;
      baseHPct = (projectAspect / imgAspect) * 100;
    }
    const wPct = baseWPct * t.scale;
    const hPct = baseHPct * t.scale;
    const leftPct = (100 - wPct) / 2 + t.offsetX * 100;
    const topPct = (100 - hPct) / 2 + t.offsetY * 100;
    return { leftPct, topPct, wPct, hPct };
  }, [natural, aspectRatio, t.scale, t.offsetX, t.offsetY]);

  const showBackground = useMemo(() => {
    if (!rectPct) return false;
    const margin = 0.5; // ignore sub-pixel slop
    return (
      rectPct.leftPct > margin ||
      rectPct.topPct > margin ||
      rectPct.leftPct + rectPct.wPct < 100 - margin ||
      rectPct.topPct + rectPct.hPct < 100 - margin
    );
  }, [rectPct]);

  const innerImg = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ""}
      draggable={draggable}
      onLoad={onLoad}
      className={imgClassName}
      style={
        rectPct
          ? {
              position: "absolute",
              left: `${rectPct.leftPct}%`,
              top: `${rectPct.topPct}%`,
              width: `${rectPct.wPct}%`,
              height: `${rectPct.hPct}%`,
              maxWidth: "none",
              userSelect: "none",
              pointerEvents: "none",
            }
          : {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }
      }
    />
  );

  const canvas = (
    <div
      className="relative overflow-hidden"
      style={{
        width: "100%",
        height: "100%",
        ...backgroundStyle(t.background, showBackground),
      }}
    >
      {showBackground && t.background?.type === "blur" ? (
        // Render a blurred copy of the same image as the background fill.
        // CSS `filter: blur(...)` works fine on <img>; the inner image sits
        // on top with no filter so the focused content stays sharp.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          draggable={false}
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{
            objectFit: "cover",
            filter: "blur(40px) saturate(1.1)",
            transform: "scale(1.15)",
          }}
        />
      ) : null}
      {innerImg}
    </div>
  );

  if (objectFit === "contain") {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden ${
          className ?? ""
        }`.trim()}
      >
        <ContainCanvas aspectRatio={aspectRatio}>{canvas}</ContainCanvas>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`.trim()}>
      {canvas}
    </div>
  );
}

const ASPECT_NUM: Record<ExportAspectRatio, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "1:1": 1,
  "4:5": 4 / 5,
};

function backgroundStyle(
  bg: ImageBackground | undefined,
  visible: boolean,
): React.CSSProperties {
  if (!visible) return { backgroundColor: "transparent" };
  if (!bg) return { backgroundColor: "#000000" };
  if (bg.type === "color") return { backgroundColor: bg.color };
  // Blur background is rendered as an image layer above; the bg color is
  // the fallback if the blurred image fails to load.
  return { backgroundColor: "#000000" };
}

/**
 * Sizes its child to the largest rectangle of the requested aspect that
 * fits inside the parent (which is assumed to have a known size, e.g. a
 * flex/absolute container). Mirrors the math used by FrameOverlay so the
 * canvas edge sits flush with the export-frame border the user sees on the
 * outer surfaces.
 */
function ContainCanvas({
  aspectRatio,
  children,
}: {
  aspectRatio: ExportAspectRatio;
  children: React.ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
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
  }, []);

  const target = ASPECT_NUM[aspectRatio];
  let innerW: number | null = null;
  let innerH: number | null = null;
  if (size) {
    const containerAspect = size.w / size.h;
    if (containerAspect > target) {
      innerH = size.h;
      innerW = innerH * target;
    } else {
      innerW = size.w;
      innerH = innerW / target;
    }
  }

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${aspectRatioClass(
          aspectRatio,
        )}`}
        style={
          innerW != null && innerH != null
            ? { width: `${innerW}px`, height: `${innerH}px` }
            : { width: "100%", height: "100%" }
        }
      >
        {children}
      </div>
    </div>
  );
}
