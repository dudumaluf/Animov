"use client";

import Image from "next/image";
import { useState } from "react";
import { useProjectStore } from "@/stores/project-store";
import { X, Maximize2, ChevronDown, RotateCw, MoveUp, MoveRight, Focus, Sun, Layers } from "lucide-react";

const PRESETS = [
  { id: "push_in_serene", label: "Avanço Suave", desc: "Dolly lento em direção ao ponto focal", icon: MoveRight, arrow: "→" },
  { id: "parallax_architectural", label: "Parallax", desc: "Movimento lateral revelando profundidade", icon: MoveRight, arrow: "↔" },
  { id: "tilt_vertical", label: "Tilt Vertical", desc: "Tilt up ou down revelando altura", icon: MoveUp, arrow: "↕" },
  { id: "orbit_subtle", label: "Giro Sutil", desc: "Micro-orbita ao redor do centro", icon: RotateCw, arrow: "↻" },
  { id: "rack_focus", label: "Foco Viajante", desc: "Foco viaja entre planos", icon: Focus, arrow: "⊙" },
  { id: "golden_hour_drift", label: "Golden Hour", desc: "Drift contemplativo, luz natural", icon: Sun, arrow: "◐" },
  { id: "depth_reveal", label: "Reveal", desc: "Revelação a partir de elemento próximo", icon: Layers, arrow: "⟵" },
];

const DURATIONS = [3, 5, 7, 10];

function PresetSelector({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = PRESETS.find((p) => p.id === selectedId) ?? PRESETS[0]!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2.5 text-left transition-all hover:border-accent-gold/30"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-gold/10 font-mono text-sm text-accent-gold">
            {selected.arrow}
          </span>
          <div>
            <span className="block font-mono text-[12px] font-medium">{selected.label}</span>
            <span className="block font-mono text-[9px] text-text-secondary">{selected.desc}</span>
          </div>
        </div>
        <ChevronDown size={14} className={`text-text-secondary transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-white/10 bg-[#141412] shadow-xl">
            {PRESETS.map((preset) => {
              const isSelected = preset.id === selectedId;
              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    onSelect(preset.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isSelected ? "bg-accent-gold/5" : "hover:bg-white/5"
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-sm ${
                    isSelected ? "bg-accent-gold/20 text-accent-gold" : "bg-white/5 text-text-secondary"
                  }`}>
                    {preset.arrow}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className={`block font-mono text-[11px] font-medium ${isSelected ? "text-accent-gold" : ""}`}>
                      {preset.label}
                    </span>
                    <span className="block truncate font-mono text-[9px] text-text-secondary">
                      {preset.desc}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="text-accent-gold font-mono text-[10px]">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function Inspector({ onPreviewVideo }: { onPreviewVideo?: (url: string) => void }) {
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const scene = useProjectStore((s) =>
    s.scenes.find((sc) => sc.id === s.selectedSceneId),
  );
  const sceneIndex = useProjectStore((s) =>
    s.scenes.findIndex((sc) => sc.id === s.selectedSceneId),
  );
  const setScenePreset = useProjectStore((s) => s.setScenePreset);
  const setSceneDuration = useProjectStore((s) => s.setSceneDuration);
  const generateScene = useProjectStore((s) => s.generateScene);
  const isGenerating = useProjectStore((s) => s.isGenerating);
  const selectScene = useProjectStore((s) => s.selectScene);

  const isOpen = !!scene && !!selectedSceneId;

  return (
    <aside
      className={`shrink-0 border-l border-white/5 transition-all duration-300 ease-out overflow-hidden ${
        isOpen ? "w-80" : "w-0 border-l-0"
      }`}
    >
      {scene && selectedSceneId && (
        <div className="flex h-full w-80 flex-col">
          <div className="relative aspect-video w-full bg-white/5">
            {scene.status === "ready" && scene.videoUrl ? (
              <video
                src={scene.videoUrl}
                className="h-full w-full object-cover"
                muted
                loop
                autoPlay
                playsInline
              />
            ) : (
              <Image
                src={scene.photoDataUrl ?? scene.photoUrl}
                alt={`Cena ${sceneIndex + 1}`}
                fill
                className="object-cover"
                unoptimized
              />
            )}
            <button
              onClick={() => selectScene(null)}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/60 transition-colors hover:text-white"
            >
              <X size={12} />
            </button>
            {scene.status === "ready" && scene.videoUrl && onPreviewVideo && (
              <button
                onClick={() => onPreviewVideo(scene.videoUrl!)}
                className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/60 transition-colors hover:text-white"
              >
                <Maximize2 size={12} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <p className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
              Cena {sceneIndex + 1}
            </p>

            <div className="mt-4">
              <label className="mb-2 block font-mono text-label-xs uppercase tracking-widest text-text-secondary">
                Movimento
              </label>
              <PresetSelector
                selectedId={scene.presetId}
                onSelect={(id) => setScenePreset(selectedSceneId, id)}
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block font-mono text-label-xs uppercase tracking-widest text-text-secondary">
                Duração
              </label>
              <div className="flex gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSceneDuration(selectedSceneId, d)}
                    className={`flex-1 rounded-lg border py-1.5 font-mono text-label-sm transition-all ${
                      scene.duration === d
                        ? "border-accent-gold/40 bg-accent-gold/5 text-accent-gold"
                        : "border-white/5 text-text-secondary hover:border-white/10"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex gap-3 rounded-lg border border-white/5 px-3 py-2.5">
              <div className="flex-1">
                <span className="block font-mono text-[9px] uppercase text-text-secondary">Custo</span>
                <span className="block font-mono text-[13px] text-accent-gold">
                  {scene.costCredits} cr.
                </span>
              </div>
              <div className="h-8 w-px bg-white/5" />
              <div className="flex-1">
                <span className="block font-mono text-[9px] uppercase text-text-secondary">Status</span>
                <span className="block font-mono text-[13px]">
                  {scene.status === "idle" && <span className="text-text-secondary">Idle</span>}
                  {scene.status === "generating" && <span className="animate-pulse text-accent-gold">Gerando</span>}
                  {scene.status === "ready" && <span className="text-green-400">Pronto</span>}
                  {scene.status === "failed" && <span className="text-red-400">Erro</span>}
                </span>
              </div>
            </div>

            <button
              disabled={isGenerating}
              onClick={() => generateScene(selectedSceneId)}
              className="mt-4 w-full rounded-lg border border-accent-gold/30 py-2.5 font-mono text-label-sm text-accent-gold transition-all hover:bg-accent-gold/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {scene.status === "ready" ? "Regenerar cena" : scene.status === "generating" ? "Gerando..." : "Gerar esta cena"}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
