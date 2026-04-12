"use client";

import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/stores/project-store";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { FilmStrip } from "@/components/editor/film-strip";
import { Inspector } from "@/components/editor/inspector";
import { DropZone } from "@/components/editor/drop-zone";
import { VideoPreviewModal } from "@/components/editor/video-preview-modal";

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
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

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
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 items-center justify-center overflow-x-auto overflow-y-hidden p-6">
              <FilmStrip onPreviewVideo={setPreviewVideoUrl} />
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
