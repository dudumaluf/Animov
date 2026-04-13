"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import { useProjectStore } from "@/stores/project-store";
import { X, Maximize2, ChevronDown, Trash2, Upload, Clapperboard } from "lucide-react";

import { PRESET_CATALOG } from "@/lib/presets";
import { downloadVideoBlob } from "@/lib/utils/download";
import { listAdapters } from "@/lib/adapters";

const MUSIC_PRESETS = [
  { id: "calm", label: "Calm Corporate", desc: "Piano, strings, elegant", icon: "♬", prompt: "Calm corporate instrumental, warm piano melody, soft strings, professional and elegant, 85 BPM, real estate luxury atmosphere" },
  { id: "modern", label: "Modern Luxury", desc: "Ambient electronic", icon: "◈", prompt: "Modern luxury ambient instrumental, warm synth pads, subtle electronic beats, sophisticated and inviting, 95 BPM, high-end real estate" },
  { id: "upbeat", label: "Upbeat Energy", desc: "Positive, rhythmic", icon: "△", prompt: "Upbeat positive instrumental, light acoustic guitar, gentle percussion, optimistic and welcoming, 110 BPM, bright real estate tour" },
  { id: "cinematic", label: "Cinematic Drama", desc: "Orchestral, building", icon: "◐", prompt: "Cinematic orchestral instrumental, building strings, dramatic piano, sweeping and grand, 75 BPM, luxury property reveal" },
  { id: "natural", label: "Natural Light", desc: "Acoustic, soft", icon: "○", prompt: "Natural light acoustic instrumental, fingerpicked guitar, soft ambient textures, peaceful and airy, 90 BPM, serene home atmosphere" },
];

const CURATED_DURATIONS: Record<string, number[]> = {
  "kling-v3-pro": [3, 5, 7, 10, 12, 15],
  "kling-o1-pro": [5, 10],
};

function getDurations(modelId: string): number[] {
  return CURATED_DURATIONS[modelId] ?? [5, 10];
}

function getModelShortName(displayName: string): string {
  if (displayName.includes("V3")) return "V3 Pro";
  if (displayName.includes("O1")) return "O1 Pro";
  return displayName.split(" ").slice(0, 2).join(" ");
}

function StatusDot({ status }: { status: "idle" | "generating" | "ready" | "failed" }) {
  if (status === "ready") return <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />;
  if (status === "generating") return <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent-gold" />;
  if (status === "failed") return <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />;
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/20" />;
}

function StatusLabel({ status }: { status: "idle" | "generating" | "ready" | "failed" }) {
  if (status === "ready") return <span className="text-green-400">Pronto</span>;
  if (status === "generating") return <span className="animate-pulse text-accent-gold">Gerando</span>;
  if (status === "failed") return <span className="text-red-400">Erro</span>;
  return <span className="text-white/30">—</span>;
}

function ModelChip({ modelId, onChange }: { modelId: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const adapters = listAdapters();
  if (adapters.length <= 1) return null;

  const current = adapters.find((a) => a.id === modelId) ?? adapters[0]!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md border border-accent-gold/20 bg-accent-gold/5 px-2 py-0.5 font-mono text-[10px] text-accent-gold transition-colors hover:border-accent-gold/40"
      >
        {getModelShortName(current.displayName)}
        <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-white/10 bg-[#141412] shadow-xl">
            {adapters.map((a) => (
              <button
                key={a.id}
                onClick={() => { onChange(a.id); setOpen(false); }}
                className={`flex w-full items-center justify-between px-3 py-2 font-mono text-[11px] transition-colors ${
                  a.id === modelId ? "text-accent-gold" : "text-text-secondary hover:bg-white/5 hover:text-[var(--text)]"
                }`}
              >
                {getModelShortName(a.displayName)}
                {a.id === modelId && <span className="text-accent-gold">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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
                  onClick={() => { onSelect(preset.prompt); setOpen(false); }}
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
                  {isSelected && <span className="text-accent-gold font-mono text-[10px]">✓</span>}
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
  const selected = PRESET_CATALOG.find((p) => p.id === selectedId) ?? PRESET_CATALOG[0]!;

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
            <span className="block font-mono text-[12px] font-medium">{selected.displayName}</span>
            <span className="block font-mono text-[9px] text-text-secondary">{selected.description}</span>
          </div>
        </div>
        <ChevronDown size={14} className={`text-text-secondary transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-white/10 bg-[#141412] shadow-xl">
            {PRESET_CATALOG.map((preset) => {
              const isSelected = preset.id === selectedId;
              return (
                <button
                  key={preset.id}
                  onClick={() => { onSelect(preset.id); setOpen(false); }}
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
                      {preset.displayName}
                    </span>
                    <span className="block truncate font-mono text-[9px] text-text-secondary">
                      {preset.description}
                    </span>
                  </div>
                  {isSelected && <span className="text-accent-gold font-mono text-[10px]">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ExportButton({ onExport }: { onExport: () => Promise<void> | void }) {
  const [exporting, setExporting] = useState(false);
  const readyCount = useProjectStore((s) => s.scenes.filter((sc) => sc.status === "ready").length);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try { await onExport(); } finally { setExporting(false); }
  };

  return (
    <button
      onClick={handleExport}
      disabled={readyCount < 1 || exporting}
      className="mt-3 w-full rounded-lg bg-accent-gold py-2.5 font-mono text-label-sm uppercase tracking-widest text-[#0D0D0B] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {exporting ? "Exportando..." : "Baixar Edit Final"}
    </button>
  );
}

function EditPreview({ musicUrl, onClose }: { musicUrl: string | null; onClose: () => void }) {
  const preview = useProjectStore((s) => s.scenes.find((sc) => sc.status === "ready" && sc.videoUrl));
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const syncPlay = () => {
    videoRef.current?.play();
    if (audioRef.current && musicUrl) { audioRef.current.currentTime = 0; audioRef.current.play(); }
  };
  const syncPause = () => { videoRef.current?.pause(); audioRef.current?.pause(); };

  return (
    <div className="relative aspect-video w-full bg-white/5">
      {preview?.videoUrl ? (
        <video
          ref={videoRef}
          src={preview.videoUrl}
          className="h-full w-full cursor-pointer object-cover"
          loop playsInline muted={!musicUrl}
          onClick={() => videoRef.current?.paused ? syncPlay() : syncPause()}
        />
      ) : preview ? (
        <Image src={preview.photoDataUrl ?? preview.photoUrl} alt="edit" fill className="object-cover" unoptimized />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Clapperboard size={24} className="text-text-secondary" />
        </div>
      )}
      {musicUrl && <audio ref={audioRef} src={musicUrl} loop />}
      <button
        onClick={onClose}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/60 transition-colors hover:text-white"
      >
        <X size={12} />
      </button>
    </div>
  );
}

function MusicSection({
  musicUrl, musicPrompt, isMusicGenerating, setMusicPrompt, generateMusic, clearMusic, setMusicUrl,
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
          <audio src={musicUrl} controls className="h-8 w-full opacity-80" />
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
          <MusicPresetSelector selectedPrompt={musicPrompt} onSelect={setMusicPrompt} />
          <button
            onClick={generateMusic}
            disabled={isMusicGenerating || !musicPrompt.trim()}
            className="w-full rounded-lg border border-accent-gold/30 py-2 font-mono text-label-sm text-accent-gold transition-all hover:bg-accent-gold/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isMusicGenerating ? "Gerando trilha..." : "Gerar trilha"}
          </button>
          <p className="font-mono text-[9px] text-text-secondary">$0.15 · Instrumental · ~30s</p>
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
              if (file) setMusicUrl(URL.createObjectURL(file));
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-white/10 py-6 transition-colors hover:border-accent-gold/30"
          >
            <Upload size={16} className="text-text-secondary" />
            <span className="font-mono text-[10px] text-text-secondary">Arraste ou clique pra enviar</span>
            <span className="font-mono text-[8px] text-text-secondary">MP3, WAV, OGG, M4A</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function Inspector({ onPreviewVideo, onExport, onEditImage }: { onPreviewVideo?: (url: string) => void; onExport?: () => void; onEditImage?: (sceneId: string) => void }) {
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const editNodeSelected = useProjectStore((s) => s.editNodeSelected);
  const scene = useProjectStore((s) => s.scenes.find((sc) => sc.id === s.selectedSceneId));
  const sceneIndex = useProjectStore((s) => s.scenes.findIndex((sc) => sc.id === s.selectedSceneId));
  const setScenePreset = useProjectStore((s) => s.setScenePreset);
  const setSceneDuration = useProjectStore((s) => s.setSceneDuration);
  const generateScene = useProjectStore((s) => s.generateScene);
  const isGenerating = useProjectStore((s) => s.isGenerating);
  const selectScene = useProjectStore((s) => s.selectScene);
  const modelId = useProjectStore((s) => s.modelId);
  const setModelId = useProjectStore((s) => s.setModelId);
  const durations = getDurations(modelId);

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
      className={`shrink-0 border-l border-white/5 bg-[#0A0A09] transition-all duration-300 ease-out overflow-hidden overflow-y-auto ${
        isOpen ? "w-64" : "w-0 border-l-0"
      }`}
    >
      {scene && selectedSceneId && showScene && (
        <div className="flex h-full w-64 flex-col">
          <div className="relative aspect-video w-full bg-white/5">
            {scene.status === "ready" && scene.videoUrl ? (
              <video src={scene.videoUrl} className="h-full w-full object-cover" muted loop autoPlay playsInline />
            ) : (
              <Image
                src={scene.photoDataUrl ?? scene.photoUrl}
                alt={`Cena ${sceneIndex + 1}`}
                fill className="object-cover" unoptimized
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

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {/* Header: cena + model chip */}
            <div className="flex items-center justify-between">
              <p className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
                Cena {sceneIndex + 1}
              </p>
              <ModelChip modelId={modelId} onChange={setModelId} />
            </div>

            {/* Movimento */}
            <div className="mt-3">
              <label className="mb-1.5 block font-mono text-label-xs uppercase tracking-widest text-text-secondary">
                Movimento
              </label>
              <PresetSelector
                selectedId={scene.presetId}
                onSelect={(id) => setScenePreset(selectedSceneId, id)}
              />
            </div>

            {/* Duracao + custo/status inline */}
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
                  Duração
                </label>
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-text-secondary">
                  <span className="text-accent-gold/80">{scene.costCredits} cr.</span>
                  <span className="opacity-40">·</span>
                  <StatusDot status={scene.status} />
                  <StatusLabel status={scene.status} />
                </span>
              </div>
              <div className={`grid gap-1 ${durations.length > 4 ? "grid-cols-6" : durations.length > 2 ? "grid-cols-4" : "grid-cols-2"}`}>
                {durations.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSceneDuration(selectedSceneId, d)}
                    className={`rounded-md border py-1 font-mono text-[10px] transition-all ${
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

            {/* Actions */}
            <button
              disabled={isGenerating}
              onClick={() => generateScene(selectedSceneId)}
              className="mt-3 w-full rounded-lg border border-accent-gold/30 py-2 font-mono text-label-sm text-accent-gold transition-all hover:bg-accent-gold/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {scene.status === "ready" ? "Regenerar cena" : scene.status === "generating" ? "Gerando..." : "Gerar esta cena"}
            </button>

            {onEditImage && (
              <button
                onClick={() => onEditImage(selectedSceneId)}
                className="mt-1.5 w-full rounded-lg border border-white/10 py-2 font-mono text-label-sm text-text-secondary transition-all hover:border-accent-gold/20 hover:text-accent-gold"
              >
                Editar imagem
              </button>
            )}

            {scene.status === "ready" && scene.videoUrl && (
              <button
                onClick={() => downloadVideoBlob(scene.videoUrl!, "cena.mp4")}
                className="mt-1.5 w-full rounded-lg border border-white/10 py-2 font-mono text-label-sm text-text-secondary transition-all hover:border-white/20 hover:text-[var(--text)]"
              >
                Baixar cena
              </button>
            )}
          </div>
        </div>
      )}

      {showEdit && (
        <div className="flex h-full w-64 flex-col">
          <EditPreview musicUrl={musicUrl} onClose={() => useProjectStore.setState({ editNodeSelected: false })} />

          <div className="flex-1 overflow-y-auto px-3 py-3">
            <p className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
              Edit Final
            </p>

            <div className="mt-3">
              <MusicSection
                musicUrl={musicUrl}
                musicPrompt={musicPrompt}
                isMusicGenerating={isMusicGenerating}
                setMusicPrompt={setMusicPrompt}
                generateMusic={generateMusicAction}
                clearMusic={clearMusic}
                setMusicUrl={(url: string) => useProjectStore.setState({ musicUrl: url, isDirty: true })}
              />
            </div>

            <div className="mt-3 rounded-lg border border-white/5 p-3">
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

            {onExport && <ExportButton onExport={onExport} />}
          </div>
        </div>
      )}
    </aside>
  );
}
