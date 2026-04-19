"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SceneSprite } from "@/stores/project-store";
import { spritePreloader } from "@/lib/timeline/sprite-preloader";

/**
 * Renders a single tile from a pre-extracted thumbnail sprite sheet with
 * `object-fit: cover` semantics, so the tile matches the aspect ratio of its
 * container (card in timeline mode, 16:9 preview in inspector, etc.) without
 * stretching.
 *
 * How it works:
 * 1. Measure container dimensions via ResizeObserver.
 * 2. Scale the full sprite so that ONE tile covers the container
 *    (scale = max(W / tileW, H / tileH) — same formula as cover).
 * 3. Translate the scaled sprite so the correct tile is centered & cropped.
 *
 * The whole sprite is loaded once, and we only CSS-transform to change frames
 * — so scrubbing is effectively free after the initial image decode.
 *
 * Transparency note: the wrapper is intentionally transparent. While the JPEG
 * is being fetched/decoded (first visit to a card during scrub), the element
 * behind it (the filmstrip `<video>` or the inspector `VideoMirror`) stays
 * visible — no black flash. Once the image is ready we fade it in quickly for
 * an even smoother handoff.
 *
 * @param progress Normalized position [0, 1] within the scene duration.
 */
export function SpriteFrame({
  sprite,
  progress,
  className,
  style,
  objectFit = "cover",
}: {
  sprite: SceneSprite;
  progress: number;
  className?: string;
  style?: React.CSSProperties;
  objectFit?: "cover" | "contain";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [imageReady, setImageReady] = useState(() =>
    spritePreloader.isReady(sprite.url),
  );

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (spritePreloader.isReady(sprite.url)) {
      setImageReady(true);
      return;
    }
    setImageReady(false);
    spritePreloader.preload(sprite.url).then(() => {
      if (!cancelled) setImageReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [sprite.url]);

  const clamped = Math.max(0, Math.min(0.9999, progress));
  const index = Math.min(sprite.frames - 1, Math.floor(clamped * sprite.frames));
  const col = index % sprite.columns;
  const row = Math.floor(index / sprite.columns);

  const { w, h } = dims;
  const canRender = w > 0 && h > 0;
  // Cover: fill container + crop excess. Contain: fit within + letterbox bars.
  const scale = canRender
    ? objectFit === "contain"
      ? Math.min(w / sprite.thumbWidth, h / sprite.thumbHeight)
      : Math.max(w / sprite.thumbWidth, h / sprite.thumbHeight)
    : 1;
  const tileW = sprite.thumbWidth * scale;
  const tileH = sprite.thumbHeight * scale;
  const spriteW = sprite.columns * tileW;
  const spriteH = sprite.rows * tileH;
  const offsetX = -(col * tileW + (tileW - w) / 2);
  const offsetY = -(row * tileH + (tileH - h) / 2);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ overflow: "hidden", ...style }}
    >
      {canRender && (
        <div
          style={{
            width: spriteW,
            height: spriteH,
            transform: `translate(${offsetX}px, ${offsetY}px)`,
            backgroundImage: `url("${sprite.url}")`,
            backgroundSize: `${spriteW}px ${spriteH}px`,
            backgroundRepeat: "no-repeat",
            opacity: imageReady ? 1 : 0,
            transition: "opacity 80ms ease-out",
            willChange: "transform, opacity",
          }}
        />
      )}
    </div>
  );
}
