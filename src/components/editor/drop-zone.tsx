"use client";

import { useCallback, useRef } from "react";
import { useProjectStore } from "@/stores/project-store";
import { ImagePlus, Upload } from "lucide-react";

const ACCEPTED = ".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov";

export function DropZone({ compact = false }: { compact?: boolean }) {
  const addPhotos = useProjectStore((s) => s.addPhotos);
  const addVideoUploads = useProjectStore((s) => s.addVideoUploads);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const all = Array.from(files);
      const images = all.filter((f) => f.type.startsWith("image/"));
      const videos = all.filter((f) => f.type.startsWith("video/"));
      if (images.length > 0) addPhotos(images);
      if (videos.length > 0) addVideoUploads(videos);
    },
    [addPhotos, addVideoUploads],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  if (compact) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 rounded-full border border-dashed border-white/10 px-4 py-2 font-mono text-label-sm text-text-secondary transition-colors hover:border-accent-gold/40 hover:text-accent-gold"
        >
          <ImagePlus size={14} />
          Adicionar fotos
        </button>
      </>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="flex w-full max-w-xl cursor-pointer flex-col items-center gap-6 rounded-2xl border-2 border-dashed border-white/10 p-16 transition-colors hover:border-accent-gold/30"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
          <Upload size={24} className="text-text-secondary" />
        </div>
        <div className="text-center">
          <p className="font-display text-xl">
            Arraste fotos ou vídeos
          </p>
          <p className="mt-2 font-body text-sm text-text-secondary">
            JPG, PNG, WEBP, MP4, WEBM · A ordem define as cenas
          </p>
        </div>
        <button className="rounded-full bg-white/5 px-6 py-2.5 font-mono text-label-sm uppercase tracking-widest text-text-secondary transition-colors hover:bg-white/10 hover:text-[var(--text)]">
          Escolher arquivos
        </button>
      </div>
    </>
  );
}
