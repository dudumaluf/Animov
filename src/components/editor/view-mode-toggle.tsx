"use client";

import { useTimelineStore } from "@/stores/timeline-store";
import { LayoutGrid, GalleryHorizontal } from "lucide-react";

export function ViewModeToggle() {
  const viewMode = useTimelineStore((s) => s.viewMode);
  const setViewMode = useTimelineStore((s) => s.setViewMode);

  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-[#0A0A09]/90 p-1 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setViewMode("canvas")}
        className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
          viewMode === "canvas"
            ? "bg-white/10 text-accent-gold"
            : "text-text-secondary hover:bg-white/5 hover:text-[var(--text)]"
        }`}
        title="Modo Canvas"
        aria-label="Modo Canvas"
      >
        <LayoutGrid size={13} />
      </button>
      <button
        type="button"
        onClick={() => setViewMode("timeline")}
        className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
          viewMode === "timeline"
            ? "bg-white/10 text-accent-gold"
            : "text-text-secondary hover:bg-white/5 hover:text-[var(--text)]"
        }`}
        title="Modo Timeline"
        aria-label="Modo Timeline"
      >
        <GalleryHorizontal size={13} />
      </button>
    </div>
  );
}
