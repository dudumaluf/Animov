"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import { useProjectStore } from "@/stores/project-store";
import { X, Maximize2, ChevronDown, RotateCw, MoveUp, MoveRight, Focus, Sun, Layers, Music, Trash2, Upload } from "lucide-react";

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

const MUSIC_PRESETS = [
  { id: "calm", label: "Calm Corporate", desc: "Piano, strings, elegant", icon: "♬", prompt: "Calm corporate instrumental, warm piano melody, soft strings, professional and elegant, 85 BPM, real estate luxury atmosphere" },
  { id: "modern", label: "Modern Luxury", desc: "Ambient electronic", icon: "◈", prompt: "Modern luxury ambient instrumental, warm synth pads, subtle electronic beats, sophisticated and inviting, 95 BPM, high-end real estate" },
  { id: "upbeat", label: "Upbeat Energy", desc: "Positive, rhythmic", icon: "△", prompt: "Upbeat positive instrumental, light acoustic guitar, gentle percussion, optimistic and welcoming, 110 BPM, bright real estate tour" },
  { id: "cinematic", label: "Cinematic Drama", desc: "Orchestral, building", icon: "◐", prompt: "Cinematic orchestral instrumental, building strings, dramatic piano, sweeping and grand, 75 BPM, luxury property reveal" },
  { id: "natural", label: "Natural Light", desc: "Acoustic, soft", icon: "○", prompt: "Natural light acoustic instrumental, fingerpicked guitar, soft ambient textures, peaceful and airy, 90 BPM, serene home atmosphere" },
];

function MusicPresetSelector({
  selectedPrompt,
  onSelect,
}: {
  selectedPrompt: string;
  onSelect: (prompt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = MUSIC_PRESETS.find((p) => p.prompt === selectedPrompt) ?? MUSIC_PRESETS[0]!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2.5 text-left transition-all hover:border-accent-gold/30"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-gold/10 font-mono text-sm text-accent-gold">
            {selected.icon}
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
            {MUSIC_PRESETS.map((preset) => {
              const isSelected = preset.prompt === selectedPrompt;
              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    onSelect(preset.prompt);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isSelected ? "bg-accent-gold/5" : "hover:bg-white/5"
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-sm ${
                    isSelected ? "bg-accent-gold/20 text-accent-gold" : "bg-white/5 text-text-secondary"
                  }`}>
                    {preset.icon}
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

function MusicSection({
  musicUrl,
  musicPrompt,
  isMusicGenerating,
  setMusicPrompt,
  generateMusic,
  clearMusic,
  setMusicUrl,
}: {
  musicUrl: string | null;
  musicPrompt: string;
  isMusicGenerating: boolean;
  setMusicPrompt: (p: string) => void;
  generateMusic: () => void;
  clearMusic: () => void;
  setMusicUrl: (url: string) => void;
}) {
  const [tab, setTab] = useState<"ai" | "upload">("ai");
  const fileRef = useRef<HTMLInputElement>(null);

  if (musicUrl) {
    return (
      <div>
        <label className="mb-2 block font-mono text-label-xs uppercase tracking-widest text-text-secondary">
          Trilha Sonora
        </label>
        <div className="space-y-2">
          <audio src={musicUrl} controls className="w-full h-8 opacity-80" />
          <button
            onClick={clearMusic}
            className="flex items-center gap-1.5 font-mono text-[10px] text-text-secondary transition-colors hover:text-red-400"
          >
            <Trash2 size={10} />
            Remover trilha
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-2 block font-mono text-label-xs uppercase tracking-widest text-text-secondary">
        Trilha Sonora
      </label>
      <div className="mb-3 flex rounded-lg border border-white/10 p-0.5">
        <button
          onClick={() => setTab("ai")}
          className={`flex-1 rounded-md py-1.5 font-mono text-[10px] transition-all ${
            tab === "ai" ? "bg-white/5 text-accent-gold" : "text-text-secondary hover:text-[var(--text)]"
          }`}
        >
          Gerar com AI
        </button>
        <button
          onClick={() => setTab("upload")}
          className={`flex-1 rounded-md py-1.5 font-mono text-[10px] transition-all ${
            tab === "upload" ? "bg-white/5 text-accent-gold" : "text-text-secondary hover:text-[var(--text)]"
          }`}
        >
          Upload MP3
        </button>
      </div>

      {tab === "ai" ? (
        <div className="space-y-3">
          <MusicPresetSelector
            selectedPrompt={musicPrompt}
            onSelect={setMusicPrompt}
          />
          <button
            onClick={generateMusic}
            disabled={isMusicGenerating || !musicPrompt.trim()}
            className="w-full rounded-lg border border-accent-gold/30 py-2 font-mono text-label-sm text-accent-gold transition-all hover:bg-accent-gold/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isMusicGenerating ? "Gerando trilha..." : "Gerar trilha"}
          </button>
          <p className="font-mono text-[9px] text-text-secondary">
            $0.15 · Instrumental · ~30s
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".mp3,.wav,.ogg,.m4a"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const url = URL.createObjectURL(file);
                setMusicUrl(url);
              }
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-white/10 py-6 transition-colors hover:border-accent-gold/30"
          >
            <Upload size={16} className="text-text-secondary" />
            <span className="font-mono text-[10px] text-text-secondary">
              Arraste ou clique pra enviar
            </span>
            <span className="font-mono text-[8px] text-text-secondary">
              MP3, WAV, OGG, M4A
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export function Inspector({ onPreviewVideo }: { onPreviewVideo?: (url: string) => void }) {
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const editNodeSelected = useProjectStore((s) => s.editNodeSelected);
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

  const musicPrompt = useProjectStore((s) => s.musicPrompt);
  const musicUrl = useProjectStore((s) => s.musicUrl);
  const isMusicGenerating = useProjectStore((s) => s.isMusicGenerating);
  const setMusicPrompt = useProjectStore((s) => s.setMusicPrompt);
  const generateMusicAction = useProjectStore((s) => s.generateMusic);
  const clearMusic = useProjectStore((s) => s.clearMusic);

  const showScene = !!scene && !!selectedSceneId;
  const showEdit = editNodeSelected && !selectedSceneId;
  const isOpen = showScene || showEdit;

  return (
    <aside
      className={`shrink-0 border-l border-white/5 transition-all duration-300 ease-out overflow-hidden ${
        isOpen ? "w-80" : "w-0 border-l-0"
      }`}
    >
      {scene && selectedSceneId && showScene && (
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
      {showEdit && (
        <div className="flex h-full w-80 flex-col">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Music size={14} className="text-accent-gold" />
              <span className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
                Edit Final
              </span>
            </div>
            <button
              onClick={() => useProjectStore.setState({ editNodeSelected: false })}
              className="flex h-6 w-6 items-center justify-center rounded-full text-text-secondary transition-colors hover:text-white"
            >
              <X size={12} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <MusicSection
              musicUrl={musicUrl}
              musicPrompt={musicPrompt}
              isMusicGenerating={isMusicGenerating}
              setMusicPrompt={setMusicPrompt}
              generateMusic={generateMusicAction}
              clearMusic={clearMusic}
              setMusicUrl={(url: string) => useProjectStore.setState({ musicUrl: url, isDirty: true })}
            />

            <div className="mt-6 rounded-lg border border-white/5 p-3">
              <span className="block font-mono text-[9px] uppercase text-text-secondary">Composição</span>
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-text-secondary">Cenas prontas</span>
                  <span className="font-mono text-[11px] text-accent-gold">
                    {useProjectStore.getState().scenes.filter((s) => s.status === "ready").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-text-secondary">Trilha sonora</span>
                  <span className="font-mono text-[11px]">
                    {musicUrl ? <span className="text-green-400">✓</span> : <span className="text-text-secondary">—</span>}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
