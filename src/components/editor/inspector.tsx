"use client";

import Image from "next/image";
import { useProjectStore } from "@/stores/project-store";
import { X, Maximize2 } from "lucide-react";

const PRESETS = [
  { id: "push_in_serene", label: "Avanço Suave", desc: "Dolly lento em direção ao ponto focal" },
  { id: "parallax_architectural", label: "Parallax", desc: "Movimento lateral revelando profundidade" },
  { id: "tilt_vertical", label: "Tilt Vertical", desc: "Tilt up ou down revelando altura" },
  { id: "orbit_subtle", label: "Giro Sutil", desc: "Micro-orbita ao redor do centro" },
  { id: "rack_focus", label: "Foco Viajante", desc: "Foco viaja entre planos" },
  { id: "golden_hour_drift", label: "Golden Hour", desc: "Drift contemplativo, luz natural" },
  { id: "depth_reveal", label: "Reveal", desc: "Revelação a partir de elemento próximo" },
];

const DURATIONS = [3, 5, 7, 10];

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

            <div className="mt-5">
              <label className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
                Movimento
              </label>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setScenePreset(selectedSceneId, preset.id)}
                    className={`rounded-lg border px-2.5 py-2 text-left transition-all ${
                      scene.presetId === preset.id
                        ? "border-accent-gold/40 bg-accent-gold/5"
                        : "border-white/5 hover:border-white/10"
                    }`}
                  >
                    <span className="block font-mono text-[11px] font-medium leading-tight">
                      {preset.label}
                    </span>
                    <span className="mt-0.5 block font-mono text-[9px] leading-tight text-text-secondary">
                      {preset.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <label className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
                Duração
              </label>
              <div className="mt-2 flex gap-1.5">
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

            <div className="mt-5 rounded-lg border border-white/5 p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-label-xs text-text-secondary">Custo</span>
                <span className="font-mono text-label-sm text-accent-gold">
                  {scene.costCredits} crédito{scene.costCredits !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-mono text-label-xs text-text-secondary">Status</span>
                <span className="font-mono text-label-xs text-text-secondary">
                  {scene.status === "idle" && "Aguardando"}
                  {scene.status === "generating" && "Gerando..."}
                  {scene.status === "ready" && "Pronto"}
                  {scene.status === "failed" && "Erro"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
