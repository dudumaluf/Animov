"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useProjectStore } from "@/stores/project-store";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { FilmStrip } from "@/components/editor/film-strip";
import { Inspector } from "@/components/editor/inspector";
import { DropZone } from "@/components/editor/drop-zone";
import { VideoPreviewModal } from "@/components/editor/video-preview-modal";
import { composeVideos, downloadBlob } from "@/lib/composition/compose";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.15;

export default function EditorPage({
  params,
}: {
  params: { projectId: string };
}) {
  const scenes = useProjectStore((s) => s.scenes);
  const isDirty = useProjectStore((s) => s.isDirty);
  const initProject = useProjectStore((s) => s.initProject);
  const saveToSupabase = useProjectStore((s) => s.saveToSupabase);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [composing, setComposing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) initProject(params.projectId);
  }, [params.projectId, initProject, mounted]);

  useEffect(() => {
    if (!isDirty) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveToSupabase();
    }, 3000);
    return () => clearTimeout(saveTimer.current);
  }, [isDirty, scenes, saveToSupabase]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveToSupabase();
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
      } else if (e.key === "0") {
        setZoom(1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveToSupabase]);

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
    <div className="flex h-screen flex-col bg-[#0A0A09]">
      <EditorToolbar />

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <DropZone />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="relative flex flex-1 flex-col">
            <div
              ref={canvasRef}
              className="flex flex-1 items-center justify-center overflow-auto p-6"
              onWheel={handleWheel}
              onClick={() => useProjectStore.getState().selectScene(null)}
            >
              <div
                className="origin-center transition-transform duration-150"
                style={{ transform: `scale(${zoom})` }}
              >
                <FilmStrip onPreviewVideo={setPreviewVideoUrl} onExport={handleExport} />
              </div>
            </div>

            <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-lg border border-white/5 bg-[#0A0A09]/90 p-1 backdrop-blur-sm">
              <button
                onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
                className="flex h-7 w-7 items-center justify-center rounded text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
                title="Zoom out"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="flex h-7 items-center justify-center rounded px-1.5 font-mono text-[10px] text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
                className="flex h-7 w-7 items-center justify-center rounded text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
                title="Zoom in"
              >
                <ZoomIn size={14} />
              </button>
              <div className="mx-0.5 h-4 w-px bg-white/5" />
              <button
                onClick={() => setZoom(1)}
                className="flex h-7 w-7 items-center justify-center rounded text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
                title="Fit to screen"
              >
                <Maximize size={14} />
              </button>
            </div>
          </div>
          <Inspector onPreviewVideo={setPreviewVideoUrl} />
        </div>
      )}

      {previewVideoUrl && (
        <VideoPreviewModal
          videoUrl={previewVideoUrl}
          onClose={() => setPreviewVideoUrl(null)}
        />
      )}
    </div>
  );
}
