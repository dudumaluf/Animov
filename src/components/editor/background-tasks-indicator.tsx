"use client";

import { useMemo, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useProjectStore } from "@/stores/project-store";

/**
 * Subtle floating indicator showing background processing state:
 *  - Sprite staging (thumbnail extraction for instant scrub).
 *  - Future: AI transitions, transcoding, uploads.
 *
 * Sits absolutely positioned over the canvas (top-right). Fades in when there's
 * activity and auto-hides a few seconds after everything is done. Hoverable to
 * see per-task breakdown — useful for debugging what's happening behind the
 * scenes without having to open the devtools.
 */
export function BackgroundTasksIndicator() {
  const scenes = useProjectStore((s) => s.scenes);
  const [expanded, setExpanded] = useState(false);

  const { pending, ready, failed } = useMemo(() => {
    let p = 0;
    let r = 0;
    let f = 0;
    scenes.forEach((s) => {
      if (s.stagingStatus === "pending") p++;
      else if (s.stagingStatus === "ready") r++;
      else if (s.stagingStatus === "failed") f++;
    });
    return { pending: p, ready: r, failed: f };
  }, [scenes]);

  const hasActivity = pending > 0;
  const hasAnyStaging = pending + ready + failed > 0;

  if (!hasAnyStaging) return null;

  return (
    <div
      className="pointer-events-auto absolute right-4 top-[60px] z-20"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div
        className={`flex items-center gap-2 rounded-full border border-white/5 bg-[#0A0A09]/90 px-3 py-1.5 backdrop-blur-sm transition-opacity ${
          hasActivity ? "opacity-100" : "opacity-60 hover:opacity-100"
        }`}
      >
        {hasActivity ? (
          <>
            <Loader2 size={12} className="animate-spin text-accent-gold" />
            <span className="font-mono text-[10px] text-[var(--text)]">
              Processando {pending} {pending === 1 ? "visualizacao" : "visualizacoes"}
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 size={12} className="text-emerald-400" />
            <span className="font-mono text-[10px] text-text-secondary">
              {ready} {ready === 1 ? "visualizacao pronta" : "visualizacoes prontas"}
              {failed > 0 ? ` • ${failed} falhou` : ""}
            </span>
          </>
        )}
      </div>

      {expanded && (
        <div className="absolute right-0 top-10 w-64 rounded-xl border border-white/5 bg-[#141412] p-3 shadow-xl">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
            Tarefas de fundo
          </div>
          <div className="space-y-1.5">
            {scenes
              .filter((s) => s.stagingStatus)
              .map((s, idx) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 font-mono text-[10px]"
                >
                  <span className="truncate text-[var(--text)]">
                    Cena {idx + 1}
                  </span>
                  <span
                    className={
                      s.stagingStatus === "pending"
                        ? "text-accent-gold"
                        : s.stagingStatus === "ready"
                        ? "text-emerald-400"
                        : "text-red-400"
                    }
                  >
                    {s.stagingStatus === "pending" && "extraindo..."}
                    {s.stagingStatus === "ready" && "ok"}
                    {s.stagingStatus === "failed" && "falhou"}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
