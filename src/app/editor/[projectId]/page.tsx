"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useProjectStore } from "@/stores/project-store";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { FilmStrip } from "@/components/editor/film-strip";
import { Inspector } from "@/components/editor/inspector";
import { DropZone } from "@/components/editor/drop-zone";
import { VideoPreviewModal } from "@/components/editor/video-preview-modal";
import { ImageEditModal } from "@/components/editor/image-edit-modal";
import { composeVideos, downloadBlob } from "@/lib/composition/compose";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;

type CanvasMode = "fit" | "free";

export default function EditorPage({
  params,
}: {
  params: { projectId: string };
}) {
  const scenes = useProjectStore((s) => s.scenes);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const editNodeSelected = useProjectStore((s) => s.editNodeSelected);
  const isDirty = useProjectStore((s) => s.isDirty);
  const initProject = useProjectStore((s) => s.initProject);
  const saveToSupabase = useProjectStore((s) => s.saveToSupabase);

  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [composing, setComposing] = useState(false);

  const [canvasMode, setCanvasMode] = useState<CanvasMode>("fit");
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const inspectorOpen = !!(selectedSceneId || editNodeSelected);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted) initProject(params.projectId);
  }, [params.projectId, initProject, mounted]);

  useEffect(() => {
    if (!isDirty) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveToSupabase(); }, 3000);
    return () => clearTimeout(saveTimer.current);
  }, [isDirty, scenes, saveToSupabase]);

  // Auto-fit calculation
  const fitToView = useCallback(() => {
    if (!viewportRef.current || !contentRef.current) return;

    const vw = viewportRef.current.clientWidth;
    const vh = viewportRef.current.clientHeight;
    const cw = contentRef.current.scrollWidth;
    const ch = contentRef.current.scrollHeight;

    if (cw === 0 || ch === 0) return;

    const padding = 80;
    const fitZoom = Math.min(
      (vw - padding) / cw,
      (vh - padding) / ch,
      1.2,
    );
    const clampedZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fitZoom));

    setZoom(clampedZoom);
    setPanX(0);
    setPanY(0);
    setCanvasMode("fit");
  }, []);

  // Refit when inspector toggles, scenes change, or window resizes
  useEffect(() => {
    if (canvasMode === "fit") {
      const timer = setTimeout(fitToView, 50);
      return () => clearTimeout(timer);
    }
  }, [inspectorOpen, scenes.length, canvasMode, fitToView]);

  useEffect(() => {
    const onResize = () => { if (canvasMode === "fit") fitToView(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [canvasMode, fitToView]);

  // Initial fit
  useEffect(() => {
    if (mounted && scenes.length > 0) {
      const timer = setTimeout(fitToView, 200);
      return () => clearTimeout(timer);
    }
  }, [mounted, fitToView, scenes.length]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target !== viewportRef.current && !target.hasAttribute("data-canvas-bg")) return;
    e.preventDefault();
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX, panY };
  }, [panX, panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPanX(panStart.current.panX + dx);
    setPanY(panStart.current.panY + dy);
    setCanvasMode("free");
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Scroll zoom → free mode
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.003;
      setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z + delta)));
      setCanvasMode("free");
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveToSupabase();
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
        setCanvasMode("free");
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
        setCanvasMode("free");
      } else if (e.key === "0") {
        fitToView();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveToSupabase, fitToView]);

  const handleExport = useCallback(async () => {
    const state = useProjectStore.getState();
    const readyScenes = state.scenes.filter((s) => s.status === "ready" && s.videoUrl);
    if (readyScenes.length < 1 || composing) return;
    setComposing(true);
    try {
      const clipUrls = readyScenes.map((s) => s.videoUrl!);
      const blob = await composeVideos({ clipUrls, audioUrl: state.musicUrl ?? undefined });
      const safeName = state.projectName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "animov";
      downloadBlob(blob, `${safeName}.mp4`);
    } catch (err) {
      console.error("[export]", err);
    } finally {
      setComposing(false);
    }
  }, [composing]);

  if (!mounted) {
    return (
      <div className="flex h-screen flex-col bg-[#0A0A09]">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 px-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-white/5" />
            <div className="h-5 w-32 rounded bg-white/5 animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-24 rounded bg-white/5" />
            <div className="h-9 w-28 rounded-full bg-white/5" />
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center gap-4 p-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex w-48 flex-col gap-2">
              <div className="aspect-[16/10] rounded-xl bg-white/[0.03] animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
              <div className="h-3 w-20 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isEmpty = scenes.length === 0;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0A0A09]">
      <EditorToolbar />

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <DropZone />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas area */}
          <div className="relative flex-1 overflow-hidden">
            <div
              ref={viewportRef}
              data-canvas-bg="true"
              className="flex h-full w-full items-center justify-center overflow-hidden"
              style={isPanning ? { cursor: "grabbing" } : undefined}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={(e) => {
                if (e.target === e.currentTarget || (e.target as HTMLElement).hasAttribute("data-canvas-bg")) {
                  useProjectStore.getState().selectScene(null);
                }
              }}
            >
              <div
                ref={contentRef}
                className=""
                style={{
                  transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                  transformOrigin: "center center",
                }}
              >
                <FilmStrip onPreviewVideo={setPreviewVideoUrl} onExport={handleExport} />
              </div>
            </div>

            {/* Zoom controls */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 rounded-lg border border-white/5 bg-[#0A0A09]/90 p-1 backdrop-blur-sm">
              <button
                onClick={() => { setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP)); setCanvasMode("free"); }}
                className="flex h-7 w-7 items-center justify-center rounded text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
                title="Zoom out (-)"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={fitToView}
                className="flex h-7 items-center justify-center rounded px-1.5 font-mono text-[10px] text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
                title="Fit to view (0)"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => { setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP)); setCanvasMode("free"); }}
                className="flex h-7 w-7 items-center justify-center rounded text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
                title="Zoom in (+)"
              >
                <ZoomIn size={14} />
              </button>
              <div className="mx-0.5 h-4 w-px bg-white/5" />
              <button
                onClick={fitToView}
                className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                  canvasMode === "fit"
                    ? "text-accent-gold"
                    : "text-text-secondary hover:bg-white/5 hover:text-[var(--text)]"
                }`}
                title="Fit all (0)"
              >
                <Maximize size={14} />
              </button>
            </div>

            {/* Mode indicator */}
            {canvasMode === "free" && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                <button
                  onClick={fitToView}
                  className="rounded-full border border-white/5 bg-[#0A0A09]/90 px-3 py-1 font-mono text-[9px] text-text-secondary backdrop-blur-sm transition-colors hover:text-accent-gold"
                >
                  Press 0 or click to refit
                </button>
              </div>
            )}
          </div>

          {/* Inspector (flex, not overlay) */}
          <Inspector onPreviewVideo={setPreviewVideoUrl} onExport={handleExport} onEditImage={setEditingSceneId} />
        </div>
      )}

      {previewVideoUrl && (
        <VideoPreviewModal
          videoUrl={previewVideoUrl}
          onClose={() => setPreviewVideoUrl(null)}
        />
      )}

      {editingSceneId && (() => {
        const editScene = useProjectStore.getState().scenes.find((s) => s.id === editingSceneId);
        if (!editScene) return null;
        const imgUrl = editScene.photoDataUrl ?? editScene.photoUrl;
        return (
          <ImageEditModal
            imageUrl={imgUrl}
            onClose={() => setEditingSceneId(null)}
            onResult={(editedUrl, mode) => {
              if (mode === "replace") {
                useProjectStore.getState().updateSceneImage(editingSceneId, editedUrl);
              } else {
                const idx = useProjectStore.getState().scenes.findIndex((s) => s.id === editingSceneId);
                if (idx >= 0) {
                  fetch(editedUrl)
                    .then((r) => r.blob())
                    .then((blob) => {
                      const file = new File([blob], "edited.png", { type: "image/png" });
                      useProjectStore.getState().insertPhotoAt(idx + 1, file);
                    });
                }
              }
              setEditingSceneId(null);
            }}
          />
        );
      })()}
    </div>
  );
}
