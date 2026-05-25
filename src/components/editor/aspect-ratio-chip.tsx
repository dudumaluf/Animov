"use client";

import {
  useProjectStore,
  type ExportAspectRatio,
} from "@/stores/project-store";

const ASPECT_OPTIONS: { value: ExportAspectRatio; label: string }[] = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
];

/**
 * Compact segmented control for the project's export aspect ratio. Reads &
 * writes `useProjectStore.exportAspectRatio` directly so callers don't have to
 * thread props through. Designed to live in the bottom-left canvas chrome
 * cluster (alongside the zoom controls and view-mode toggle), where it sits
 * close to the visual context it controls (the canvas / preview).
 */
export function AspectRatioChip({ className }: { className?: string }) {
  const value = useProjectStore((s) => s.exportAspectRatio);
  const onChange = useProjectStore((s) => s.setExportAspectRatio);

  return (
    <div
      className={`flex h-9 items-center gap-0.5 rounded-lg border border-white/5 bg-[#0A0A09]/90 p-1 backdrop-blur-sm ${className ?? ""}`.trim()}
      title="Formato do projeto"
    >
      {ASPECT_OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex h-7 items-center rounded px-2 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              active
                ? "bg-white/10 text-accent-gold"
                : "text-text-secondary hover:bg-white/5 hover:text-[var(--text)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
