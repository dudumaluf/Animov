"use client";

import { useTimelineStore } from "@/stores/timeline-store";
import { totalDuration, type Segment } from "@/lib/timeline/segments";
import { Play, Pause, Navigation, NavigationOff } from "lucide-react";
import { useStableCenterX } from "@/hooks/use-stable-center";

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function TransportBar({
  segments,
  viewportRef,
  mainFlexRef,
}: {
  segments: Segment[];
  viewportRef: React.RefObject<HTMLDivElement | null>;
  mainFlexRef: React.RefObject<HTMLDivElement | null>;
}) {
  const viewMode = useTimelineStore((s) => s.viewMode);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const currentTime = useTimelineStore((s) => s.currentTime);
  const autoFollow = useTimelineStore((s) => s.autoFollow);
  const togglePlay = useTimelineStore((s) => s.togglePlay);
  const setAutoFollow = useTimelineStore((s) => s.setAutoFollow);
  const seek = useTimelineStore((s) => s.seek);
  const stableCenterX = useStableCenterX(viewportRef, mainFlexRef);

  if (viewMode !== "timeline") return null;

  const total = totalDuration(segments);
  const disabled = total === 0;

  return (
    <div
      className="pointer-events-auto absolute bottom-4 z-30 flex items-center gap-2 rounded-full border border-white/5 bg-[#0A0A09]/90 px-3 py-1.5 backdrop-blur-sm"
      style={{ left: `${stableCenterX}px`, transform: "translateX(-50%)" }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (currentTime >= total - 0.01) seek(0);
          togglePlay();
        }}
        className="flex h-6 w-6 items-center justify-center rounded-full text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label={isPlaying ? "Pausar" : "Reproduzir"}
      >
        {isPlaying ? <Pause size={12} /> : <Play size={12} className="translate-x-[1px]" />}
      </button>
      <div className="font-mono text-[10px] tabular-nums text-white/70">
        <span className="text-white/90">{formatTime(currentTime)}</span>
        <span className="mx-1 text-white/25">/</span>
        <span className="text-white/40">{formatTime(total)}</span>
      </div>
      <div className="mx-0.5 h-4 w-px bg-white/5" />
      <button
        type="button"
        onClick={() => setAutoFollow(!autoFollow)}
        className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-white/5 ${
          autoFollow ? "text-accent-gold" : "text-text-secondary hover:text-white"
        }`}
        title={autoFollow ? "Auto-seguir: ligado" : "Auto-seguir: desligado"}
        aria-label="Alternar auto-seguir"
      >
        {autoFollow ? <Navigation size={12} /> : <NavigationOff size={12} />}
      </button>
    </div>
  );
}
