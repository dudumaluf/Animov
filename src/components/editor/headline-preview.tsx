"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useProjectStore, type ExportAspectRatio } from "@/stores/project-store";
import { useTimelineStore } from "@/stores/timeline-store";
import {
  useEditorSettingsStore,
  HEADLINE_MIN_HEIGHT,
  HEADLINE_MAX_HEIGHT,
} from "@/stores/editor-settings-store";
import { VideoMirror } from "@/components/editor/video-mirror";
import { SpriteFrame } from "@/components/editor/sprite-frame";
import { TransformedImage } from "@/components/editor/transformed-image";
import { FrameOverlay } from "@/components/editor/frame-overlay";
import { useStableCenterX } from "@/hooks/use-stable-center";
import { spriteProgressForScene } from "@/lib/timeline/segments";
import { RotateCcw } from "lucide-react";

// Default vertical offset of the centered (un-dragged) card from the top of the
// canvas area, so it sits just under the top chrome (layout bar / pills).
const HEADLINE_TOP_OFFSET = 36;
const HEADLINE_RATIO_NUM: Record<ExportAspectRatio, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "1:1": 1,
  "4:5": 4 / 5,
};
// Keep at least this much of the card on-screen when clamping to the canvas.
const EDGE_MARGIN = 8;

type Rect = { x: number; y: number; height: number };

/**
 * Floating preview card for the "Revisao" preset. By default it's anchored to
 * the stable horizontal center of the editor (the playhead axis) so reviewers
 * keep an eye on the frame while the inspector is railed. It's now also
 * **draggable and resizable**: drag the card to pin it anywhere, drag the
 * bottom-right grip to scale it (width follows the project aspect ratio), and
 * double-click (or the reset chip) to snap back to the centered default.
 * Position/size persist globally via the editor settings store.
 *
 * Playback shares `videoRegistry` with the filmstrip — zero extra decoder.
 */
export function HeadlinePreview({
  viewportRef,
  mainFlexRef,
}: {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  mainFlexRef: React.RefObject<HTMLDivElement | null>;
}) {
  const viewMode = useTimelineStore((s) => s.viewMode);
  const activeSegmentId = useTimelineStore((s) => s.activeSegmentId);
  const segmentLocalOffset = useTimelineStore((s) => s.segmentLocalOffset);
  const isScrubbing = useTimelineStore((s) => s.isScrubbing);
  const scenes = useProjectStore((s) => s.scenes);
  const transitions = useProjectStore((s) => s.transitions);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const exportAspectRatio = useProjectStore((s) => s.exportAspectRatio);
  const frameOverlay = useEditorSettingsStore((s) => s.frameOverlay);
  const headlinePreview = useEditorSettingsStore((s) => s.layout.headlinePreview);
  const setHeadlinePreviewRect = useEditorSettingsStore(
    (s) => s.setHeadlinePreviewRect,
  );
  const resetHeadlinePreview = useEditorSettingsStore(
    (s) => s.resetHeadlinePreview,
  );

  const stableCenterX = useStableCenterX(viewportRef, mainFlexRef);
  const rootRef = useRef<HTMLDivElement>(null);
  // Live rect during a drag/resize gesture (overrides the persisted value for
  // smooth, transition-free updates). Committed to the store on pointer up.
  const [live, setLive] = useState<Rect | null>(null);

  const ratio = HEADLINE_RATIO_NUM[exportAspectRatio];

  const resolved = useMemo(() => {
    const candidateId =
      viewMode === "timeline" ? activeSegmentId ?? selectedSceneId : selectedSceneId;
    if (!candidateId) return null;
    const scene = scenes.find((s) => s.id === candidateId);
    if (scene) {
      return {
        id: scene.id,
        videoUrl: scene.videoUrl ?? null,
        poster: scene.photoDataUrl ?? scene.photoUrl ?? null,
        imageTransform: scene.imageTransform ?? null,
        sprite: scene.sprite ?? null,
        duration: scene.duration,
        trimStart: scene.trimStart,
        nativeDuration: scene.videoVersions?.[scene.activeVersion]?.duration,
      };
    }
    const transition = transitions.find((t) => t.id === candidateId);
    if (transition) {
      return {
        id: transition.id,
        videoUrl: transition.videoUrl ?? null,
        poster: null,
        imageTransform: null,
        sprite: transition.sprite ?? null,
        duration: transition.duration ?? transition.costCredits ?? 1,
        trimStart: undefined,
        nativeDuration: transition.duration ?? transition.costCredits,
      };
    }
    return null;
  }, [viewMode, activeSegmentId, selectedSceneId, scenes, transitions]);

  const hasContent = !!(resolved && (resolved.videoUrl || resolved.poster));
  const showSprite =
    viewMode === "timeline" &&
    isScrubbing &&
    resolved?.sprite &&
    activeSegmentId === resolved.id &&
    (resolved.duration ?? 0) > 0;

  // Render geometry: live gesture > pinned (persisted x/y) > centered default.
  const height = live?.height ?? headlinePreview.height;
  const width = Math.round(height * ratio);
  const left = live?.x ?? headlinePreview.x ?? stableCenterX - width / 2;
  const top = live?.y ?? headlinePreview.y ?? HEADLINE_TOP_OFFSET;

  const parentSize = useCallback(() => {
    const parent =
      (rootRef.current?.offsetParent as HTMLElement | null) ??
      rootRef.current?.parentElement ??
      null;
    return {
      w: parent?.clientWidth ?? window.innerWidth,
      h: parent?.clientHeight ?? window.innerHeight,
    };
  }, []);

  const resolveRect = useCallback((): Rect => {
    const h = headlinePreview.height;
    const w = Math.round(h * ratio);
    if (headlinePreview.x != null && headlinePreview.y != null) {
      return { x: headlinePreview.x, y: headlinePreview.y, height: h };
    }
    return { x: stableCenterX - w / 2, y: HEADLINE_TOP_OFFSET, height: h };
  }, [headlinePreview.x, headlinePreview.y, headlinePreview.height, ratio, stableCenterX]);

  const beginDrag = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const start = resolveRect();
      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      let latest = start;
      setLive(start);
      const onMove = (me: PointerEvent) => {
        const { w, h } = parentSize();
        const cw = Math.round(start.height * ratio);
        const maxX = Math.max(EDGE_MARGIN, w - cw - EDGE_MARGIN);
        const maxY = Math.max(EDGE_MARGIN, h - start.height - EDGE_MARGIN);
        const x = Math.max(EDGE_MARGIN, Math.min(maxX, start.x + (me.clientX - startMouseX)));
        const y = Math.max(EDGE_MARGIN, Math.min(maxY, start.y + (me.clientY - startMouseY)));
        latest = { x, y, height: start.height };
        setLive(latest);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setHeadlinePreviewRect(latest);
        setLive(null);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [resolveRect, parentSize, ratio, setHeadlinePreviewRect],
  );

  const beginResize = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const start = resolveRect();
      const startMouseY = e.clientY;
      let latest = start;
      setLive(start);
      const onMove = (me: PointerEvent) => {
        const { w, h } = parentSize();
        let next = start.height + (me.clientY - startMouseY);
        next = Math.max(HEADLINE_MIN_HEIGHT, Math.min(HEADLINE_MAX_HEIGHT, next));
        // Stay inside the canvas both vertically and (via the derived width)
        // horizontally.
        next = Math.min(next, h - start.y - EDGE_MARGIN);
        next = Math.min(next, (w - start.x - EDGE_MARGIN) / ratio);
        next = Math.max(HEADLINE_MIN_HEIGHT, Math.round(next));
        latest = { x: start.x, y: start.y, height: next };
        setLive(latest);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setHeadlinePreviewRect(latest);
        setLive(null);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [resolveRect, parentSize, ratio, setHeadlinePreviewRect],
  );

  const isCustomized = headlinePreview.x != null || headlinePreview.y != null;
  const isInteracting = live != null;

  return (
    <div
      ref={rootRef}
      className="group/headline absolute z-30 select-none"
      style={{
        top,
        left,
        width,
        height,
        opacity: hasContent ? 1 : 0,
        pointerEvents: hasContent ? "auto" : "none",
        cursor: isInteracting ? "grabbing" : "grab",
        touchAction: "none",
        transition: isInteracting ? "none" : "opacity 150ms ease-out",
      }}
      aria-hidden={!hasContent}
      onPointerDown={beginDrag}
      onDoubleClick={(e) => {
        e.stopPropagation();
        resetHeadlinePreview();
      }}
    >
      <FrameOverlay
        aspectRatio={exportAspectRatio}
        mode={frameOverlay.mode}
        overflowOpacity={frameOverlay.overflowOpacity}
        enabled={frameOverlay.enabled && hasContent}
        className={`h-full w-full overflow-hidden rounded-xl border bg-black shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)] transition-colors ${
          isInteracting
            ? "border-accent-gold/50"
            : "border-white/10 group-hover/headline:border-white/25"
        }`}
      >
        {resolved && resolved.videoUrl ? (
          <div className="relative h-full w-full">
            <VideoMirror
              sourceId={resolved.id}
              poster={null}
              className="h-full w-full"
              style={{ backgroundColor: "transparent" }}
              objectFit="contain"
            />
            {showSprite && resolved.sprite && (
              <SpriteFrame
                sprite={resolved.sprite}
                progress={spriteProgressForScene(
                  segmentLocalOffset,
                  resolved.trimStart,
                  resolved.nativeDuration,
                  resolved.duration,
                )}
                className="absolute inset-0 h-full w-full"
                objectFit="contain"
              />
            )}
          </div>
        ) : resolved && resolved.poster ? (
          <TransformedImage
            src={resolved.poster}
            transform={resolved.imageTransform}
            aspectRatio={exportAspectRatio}
            alt=""
            className="h-full w-full"
            objectFit="contain"
            draggable={false}
          />
        ) : null}
      </FrameOverlay>

      {/* Reset chip — only when the user has moved/resized it. */}
      {isCustomized && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            resetHeadlinePreview();
          }}
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-[#141412] text-text-secondary opacity-0 shadow-md transition-all hover:text-accent-gold group-hover/headline:opacity-100"
          title="Recentralizar e redimensionar ao padrão (duplo-clique)"
          aria-label="Reset preview"
        >
          <RotateCcw size={12} />
        </button>
      )}

      {/* Resize grip — bottom-right corner; width follows the aspect ratio. */}
      <div
        onPointerDown={beginResize}
        className="absolute -bottom-1 -right-1 z-10 flex h-5 w-5 cursor-nwse-resize items-end justify-end p-1 opacity-0 transition-opacity group-hover/headline:opacity-100"
        title="Redimensionar"
        style={{ touchAction: "none" }}
      >
        <div className="h-2.5 w-2.5 rounded-br-md border-b-2 border-r-2 border-accent-gold/70" />
      </div>
    </div>
  );
}
