"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useProjectStore } from "@/stores/project-store";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { FilmStrip } from "@/components/editor/film-strip";
import { Inspector } from "@/components/editor/inspector";
import { DropZone } from "@/components/editor/drop-zone";
import { VideoPreviewModal } from "@/components/editor/video-preview-modal";
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
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initProject(params.projectId);
  }, [params.projectId, initProject]);

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
      return;
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "=" || e.key === "+") {
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
  }, []);

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
            >
              <div
                className="origin-center transition-transform duration-150"
                style={{ transform: `scale(${zoom})` }}
              >
                <FilmStrip onPreviewVideo={setPreviewVideoUrl} />
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
