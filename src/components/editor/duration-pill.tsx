"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useProjectStore, type Scene } from "@/stores/project-store";

const IMAGE_MIN = 1;
const IMAGE_MAX = 30;
const VIDEO_MIN_WINDOW = 0.5;

/**
 * Clickable pill that shows the scene's effective CLIP duration and opens an
 * inline editor on click. Works in both canvas and timeline view modes.
 *
 * For image-only scenes the editor directly sets `scene.duration` (clamped to
 * [1, 30]). For video-backed scenes (generated or uploaded) the editor lets
 * the user tweak the trim window by pulling the right edge, so `duration` is
 * always derived from `trimEnd - trimStart` and never exceeds the native
 * source length.
 *
 * This is the click-to-edit twin of the timeline's `TrimHandle` edge-drag
 * interaction — both write to the same store fields.
 */
export function DurationPill({
  scene,
  size = "sm",
  onOpen,
}: {
  scene: Scene;
  size?: "xs" | "sm";
  onOpen?: () => void;
}) {
  const setSceneDuration = useProjectStore((s) => s.setSceneDuration);
  const setSceneTrim = useProjectStore((s) => s.setSceneTrim);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const isVideo = scene.status === "ready" && !!scene.videoUrl;
  const activeVer = scene.videoVersions?.[scene.activeVersion];
  const native =
    activeVer?.duration && activeVer.duration > 0
      ? activeVer.duration
      : scene.duration;

  const openEditor = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) {
        setPos({
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      }
      setOpen(true);
      onOpen?.();
    },
    [onOpen],
  );

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const commit = useCallback(
    (rawSeconds: number) => {
      if (isVideo) {
        const start = scene.trimStart ?? 0;
        const maxEnd = native;
        const minEnd = start + VIDEO_MIN_WINDOW;
        const clamped = Math.max(minEnd, Math.min(maxEnd, start + rawSeconds));
        setSceneTrim(scene.id, { trimEnd: clamped });
      } else {
        const clamped = Math.max(IMAGE_MIN, Math.min(IMAGE_MAX, rawSeconds));
        setSceneDuration(scene.id, clamped);
      }
    },
    [isVideo, scene.id, scene.trimStart, native, setSceneDuration, setSceneTrim],
  );

  const resetTrim = useCallback(() => {
    setSceneTrim(scene.id, { trimStart: null, trimEnd: null });
  }, [scene.id, setSceneTrim]);

  const displayValue = Math.round(scene.duration * 10) / 10;
  const textSizeClass = size === "xs" ? "text-[9px]" : "text-[10px]";
  const padClass = size === "xs" ? "px-1 py-[1px]" : "px-1.5 py-0.5";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openEditor}
        onPointerDown={(e) => e.stopPropagation()}
        className={`pointer-events-auto inline-flex shrink-0 cursor-pointer select-none items-center rounded font-mono ${padClass} ${textSizeClass} text-white/60 transition-colors hover:bg-white/10 hover:text-accent-gold ${
          open ? "bg-white/10 text-accent-gold" : ""
        }`}
        aria-label="Editar duração"
      >
        {displayValue.toFixed(displayValue >= 10 ? 0 : 1)}s
      </button>

      {open && pos &&
        createPortal(
          <div className="pointer-events-auto fixed inset-0 z-[60]">
            <div
              ref={popRef}
              className="absolute flex min-w-[220px] flex-col gap-2 rounded-xl border border-white/10 bg-[#141412] p-3 shadow-xl"
              style={{
                left: pos.x,
                top: pos.y,
                transform: "translate(-50%, calc(-100% - 8px))",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                  Duração do clip
                </span>
                {isVideo && (
                  <span className="font-mono text-[9px] text-text-secondary/60">
                    Fonte: {(Math.round(native * 10) / 10).toFixed(1)}s
                  </span>
                )}
              </div>

              <DurationSlider
                value={scene.duration}
                min={isVideo ? VIDEO_MIN_WINDOW : IMAGE_MIN}
                max={isVideo ? native : IMAGE_MAX}
                step={0.1}
                onChange={commit}
              />

              <div className="flex items-center justify-between font-mono text-[11px]">
                <input
                  type="number"
                  value={displayValue.toFixed(1)}
                  min={isVideo ? VIDEO_MIN_WINDOW : IMAGE_MIN}
                  max={isVideo ? native : IMAGE_MAX}
                  step={0.1}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    if (Number.isFinite(n)) commit(n);
                  }}
                  className="h-6 w-20 rounded border border-white/10 bg-black/40 px-2 font-mono text-[11px] text-white tabular-nums focus:border-accent-gold/60 focus:outline-none"
                />
                <span className="text-text-secondary">segundos</span>
              </div>

              {isVideo && (
                <div className="flex items-center justify-between border-t border-white/5 pt-2 font-mono text-[10px]">
                  <span className="text-text-secondary">
                    Trim: {(scene.trimStart ?? 0).toFixed(1)}–
                    {(scene.trimEnd ?? native).toFixed(1)}s
                  </span>
                  {(scene.trimStart !== undefined || scene.trimEnd !== undefined) && (
                    <button
                      type="button"
                      onClick={resetTrim}
                      className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-secondary transition-colors hover:bg-white/5 hover:text-accent-gold"
                    >
                      Resetar
                    </button>
                  )}
                </div>
              )}

              {!isVideo && (
                <div className="font-mono text-[9px] text-text-secondary/70">
                  Esta cena ainda é uma imagem. Ajusta por quanto tempo ela
                  aparece na timeline antes de virar vídeo.
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Horizontal slider with gold fill and accent knob. Committed on every change
 * — we trust the consumer to debounce/clamp (DurationPill does clamping).
 */
function DurationSlider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const pct = Math.max(
    0,
    Math.min(1, (value - min) / Math.max(0.0001, max - min)),
  );

  const applyFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)),
      );
      const raw = min + ratio * (max - min);
      const snapped = Math.round(raw / step) * step;
      onChange(Math.max(min, Math.min(max, snapped)));
    },
    [min, max, step, onChange],
  );

  return (
    <div
      ref={trackRef}
      className="relative h-4 cursor-pointer select-none"
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        applyFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        applyFromClientX(e.clientX);
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }}
    >
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent-gold/70"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <div
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-gold shadow-[0_0_8px_rgba(255,200,80,0.4)]"
        style={{ left: `${pct * 100}%` }}
      />
    </div>
  );
}
