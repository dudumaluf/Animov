"use client";

import Image from "next/image";
import { useState, useRef, useEffect, useCallback } from "react";
import { useProjectStore } from "@/stores/project-store";
import {
  X,
  Maximize2,
  ChevronDown,
  ChevronRight,
  Trash2,
  Upload,
  Clapperboard,
  ArrowDownToLine,
  Play,
  Pause,
  Loader2,
  Volume2,
  SlidersHorizontal,
} from "lucide-react";

import { PRESET_CATALOG } from "@/lib/presets";
import { downloadVideoBlob } from "@/lib/utils/download";
import { listAdapters } from "@/lib/adapters";
import { type AudioMixSettings } from "@/lib/composition/compose";
import { InspectorPreviewVideo } from "@/components/editor/video-mirror";
import { useEditorSettingsStore } from "@/stores/editor-settings-store";

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

function DragValue({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  sensitivity = 0.005,
  suffix = "%",
  displayMultiplier = 100,
  decimals = 0,
  icon,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  sensitivity?: number;
  suffix?: string;
  displayMultiplier?: number;
  decimals?: number;
  icon?: React.ReactNode;
  label?: string;
}) {
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [value]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = (startY.current - e.clientY) * sensitivity;
    const raw = startVal.current + delta;
    const snapped = Math.round(raw / step) * step;
    onChange(Math.max(min, Math.min(max, snapped)));
  }, [onChange, min, max, step, sensitivity]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const display = (value * displayMultiplier).toFixed(decimals);

  return (
    <span
      className="inline-flex cursor-ns-resize select-none items-center gap-1 rounded px-1 py-0.5 font-mono text-[10px] text-white/60 transition-colors hover:bg-white/5 hover:text-accent-gold active:text-accent-gold"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      title={label ? `${label}: arrastar para ajustar` : "Arrastar para ajustar"}
    >
      {icon}
      <span>{display}{suffix}</span>
    </span>
  );
}

function getModelShortName(displayName: string): string {
  if (displayName.includes("V3")) return "V3 Pro";
  if (displayName.includes("O1")) return "O1 Pro";
  return displayName.split(" ").slice(0, 2).join(" ");
}

/**
 * Trim controls for video-backed scenes. Non-destructive: edits `trimStart`
 * and `trimEnd` in seconds (0..nativeDuration) and lets the store derive the
 * effective `duration`. Image-only scenes are handled by the `Duração` grid.
 */
function TrimControls({
  scene,
  onChange,
}: {
  scene: {
    trimStart?: number;
    trimEnd?: number;
    duration: number;
    activeVersion: number;
    videoVersions?: { url: string; duration: number }[];
  };
  onChange: (trim: { trimStart?: number | null; trimEnd?: number | null }) => void;
}) {
  const activeVer = scene.videoVersions?.[scene.activeVersion];
  const native =
    activeVer?.duration && activeVer.duration > 0
      ? activeVer.duration
      : scene.duration;
  const trimStart = scene.trimStart ?? 0;
  const trimEnd = scene.trimEnd ?? native;
  const hasTrim = scene.trimStart !== undefined || scene.trimEnd !== undefined;

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
          Trim
        </label>
        {hasTrim && (
          <button
            type="button"
            onClick={() => onChange({ trimStart: null, trimEnd: null })}
            className="font-mono text-[9px] uppercase tracking-wide text-text-secondary transition-colors hover:text-accent-gold"
          >
            Limpar
          </button>
        )}
      </div>
      <div className="space-y-1.5 font-mono text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Início</span>
          <DragValue
            value={trimStart}
            onChange={(v) =>
              onChange({
                trimStart: Math.max(0, Math.min(trimEnd - 0.5, v)),
              })
            }
            min={0}
            max={Math.max(0, native - 0.5)}
            step={0.1}
            sensitivity={0.05}
            suffix="s"
            displayMultiplier={1}
            decimals={1}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Fim</span>
          <DragValue
            value={trimEnd}
            onChange={(v) =>
              onChange({
                trimEnd: Math.max(trimStart + 0.5, Math.min(native, v)),
              })
            }
            min={0.5}
            max={native}
            step={0.1}
            sensitivity={0.05}
            suffix="s"
            displayMultiplier={1}
            decimals={1}
          />
        </div>
        <div className="flex items-center justify-between text-text-secondary/70">
          <span>Duração efetiva</span>
          <span className="text-white/80">
            {(Math.round((trimEnd - trimStart) * 10) / 10).toFixed(1)}s
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: "idle" | "generating" | "ready" | "failed" | "processing" }) {
  if (status === "ready") return <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />;
  if (status === "generating") return <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent-gold" />;
  if (status === "failed") return <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />;
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/20" />;
}

function StatusLabel({ status }: { status: "idle" | "generating" | "ready" | "failed" | "processing" }) {
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

function formatAudioTime(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function MusicTrackPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    const onEnded = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    const bar = barRef.current;
    if (!a || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    a.currentTime = pct * duration;
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="pt-1">
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
          aria-label={playing ? "Pausar" : "Reproduzir"}
        >
          {playing ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white" />}
        </button>
        <div className="min-w-0 flex-1">
          <div
            ref={barRef}
            role="slider"
            tabIndex={0}
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            onClick={seek}
            onKeyDown={(e) => {
              const a = audioRef.current;
              if (!a || !duration) return;
              if (e.key === "ArrowLeft") {
                a.currentTime = Math.max(0, a.currentTime - 5);
              } else if (e.key === "ArrowRight") {
                a.currentTime = Math.min(duration, a.currentTime + 5);
              }
            }}
            className="relative h-1 w-full cursor-pointer rounded-full bg-white/20 outline-none focus:ring-1 focus:ring-white/30"
          >
            <span
              className="absolute left-0 top-0 h-full rounded-full bg-white/70"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-0.5 flex justify-between font-mono text-[9px] text-white/45">
            <span>{formatAudioTime(current)}</span>
            <span>{formatAudioTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditPreview({
  musicUrl,
  onClose,
  onExport,
  aspectRatio = "16:9",
}: {
  musicUrl: string | null;
  onClose: () => void;
  onExport?: () => void | Promise<void>;
  aspectRatio?: "16:9" | "9:16";
}) {
  const preview = useProjectStore((s) => s.scenes.find((sc) => sc.status === "ready" && sc.videoUrl));
  const readyForExport = useProjectStore((s) => s.scenes.some((sc) => sc.status === "ready" && sc.videoUrl));
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [exporting, setExporting] = useState(false);

  const syncPlay = () => {
    videoRef.current?.play();
    if (audioRef.current && musicUrl) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play();
    }
  };
  const syncPause = () => {
    videoRef.current?.pause();
    audioRef.current?.pause();
  };

  const handleExportClick = async () => {
    if (!onExport || exporting || !readyForExport) return;
    setExporting(true);
    try {
      await onExport();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={`relative w-full bg-white/5 ${aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-video"}`}>
      {preview?.videoUrl ? (
        <video
          ref={videoRef}
          src={preview.videoUrl}
          crossOrigin="anonymous"
          className="h-full w-full cursor-pointer object-cover"
          loop
          playsInline
          muted={!musicUrl}
          onClick={() => (videoRef.current?.paused ? syncPlay() : syncPause())}
        />
      ) : preview ? (
        <Image src={preview.photoDataUrl ?? preview.photoUrl} alt="edit" fill className="object-cover" unoptimized />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Clapperboard size={24} className="text-text-secondary" />
        </div>
      )}
      {musicUrl && <audio ref={audioRef} src={musicUrl} loop />}
      <div className="absolute right-2 top-2 flex items-center gap-1">
        {onExport && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleExportClick();
            }}
            disabled={!readyForExport || exporting}
            className={`flex h-7 w-7 items-center justify-center rounded-full bg-black/70 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
              readyForExport && !exporting
                ? "text-accent-gold hover:bg-black/90 hover:text-accent-gold"
                : "text-white/50 hover:text-white/80"
            }`}
            title="Exportar vídeo final (MP4)"
            aria-label="Exportar vídeo final"
          >
            {exporting ? (
              <Loader2 size={14} className="animate-spin text-accent-gold" />
            ) : (
              <ArrowDownToLine size={14} />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/60 transition-colors hover:text-white"
          aria-label="Fechar painel"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

function MusicSection({
  musicUrl, musicPrompt, isMusicGenerating, setMusicPrompt, generateMusic, clearMusic, setMusicUrl, musicVolume, setMusicVolume,
}: {
  musicUrl: string | null;
  musicPrompt: string;
  isMusicGenerating: boolean;
  setMusicPrompt: (p: string) => void;
  generateMusic: () => void;
  clearMusic: () => void;
  setMusicUrl: (url: string) => void;
  musicVolume: number;
  setMusicVolume: (vol: number) => void;
}) {
  const [tab, setTab] = useState<"ai" | "upload">("ai");
  const fileRef = useRef<HTMLInputElement>(null);

  if (musicUrl) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
            Trilha sonora
          </span>
          <div className="flex items-center gap-1">
            <DragValue
              value={musicVolume}
              onChange={setMusicVolume}
              min={0}
              max={1}
              step={0.01}
              icon={<Volume2 size={12} />}
              label="Volume da música"
            />
            <button
              type="button"
              onClick={clearMusic}
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/5 hover:text-red-400"
              title="Remover trilha"
              aria-label="Remover trilha"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <MusicTrackPlayer src={musicUrl} />
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

function MixagemSection({ audioMix, onUpdate }: {
  audioMix: AudioMixSettings;
  onUpdate: <K extends keyof AudioMixSettings>(key: K, val: AudioMixSettings[K]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 rounded-lg border border-white/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-text-secondary transition-colors hover:text-white/70"
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <SlidersHorizontal size={10} />
        Mixagem
      </button>
      {open && (
        <div className="space-y-2 border-t border-white/5 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] text-text-secondary">Música vol.</span>
            <DragValue value={audioMix.musicVolume} onChange={(v) => onUpdate("musicVolume", v)} min={0} max={1} label="Volume da música" icon={<Volume2 size={10} />} />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] text-text-secondary">Música fade</span>
            <div className="flex items-center gap-1">
              <DragValue value={audioMix.musicFadeIn} onChange={(v) => onUpdate("musicFadeIn", v)} min={0} max={5} step={0.1} sensitivity={0.02} suffix="s" displayMultiplier={1} decimals={1} label="Fade in" />
              <span className="font-mono text-[8px] text-white/20">/</span>
              <DragValue value={audioMix.musicFadeOut} onChange={(v) => onUpdate("musicFadeOut", v)} min={0} max={10} step={0.1} sensitivity={0.02} suffix="s" displayMultiplier={1} decimals={1} label="Fade out" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] text-text-secondary">Clipe fade</span>
            <div className="flex items-center gap-1">
              <DragValue value={audioMix.clipFadeIn} onChange={(v) => onUpdate("clipFadeIn", v)} min={0} max={3} step={0.1} sensitivity={0.02} suffix="s" displayMultiplier={1} decimals={1} label="Fade in" />
              <span className="font-mono text-[8px] text-white/20">/</span>
              <DragValue value={audioMix.clipFadeOut} onChange={(v) => onUpdate("clipFadeOut", v)} min={0} max={3} step={0.1} sensitivity={0.02} suffix="s" displayMultiplier={1} decimals={1} label="Fade out" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] text-text-secondary">Ducking</span>
            <DragValue value={audioMix.duckingIntensity} onChange={(v) => onUpdate("duckingIntensity", v)} min={0} max={1} label="Intensidade ducking" />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] text-text-secondary">Duck atk/rel</span>
            <div className="flex items-center gap-1">
              <DragValue value={audioMix.duckingAttack} onChange={(v) => onUpdate("duckingAttack", v)} min={0.01} max={2} step={0.01} sensitivity={0.005} suffix="s" displayMultiplier={1} decimals={2} label="Duck attack" />
              <span className="font-mono text-[8px] text-white/20">/</span>
              <DragValue value={audioMix.duckingRelease} onChange={(v) => onUpdate("duckingRelease", v)} min={0.01} max={2} step={0.01} sensitivity={0.005} suffix="s" displayMultiplier={1} decimals={2} label="Duck release" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Inspector({
  onPreviewVideo,
  onExport,
  onDownloadLast,
  onEditImage,
}: {
  onPreviewVideo?: (url: string) => void;
  onExport?: () => void;
  onDownloadLast?: () => void;
  onEditImage?: (sceneId: string) => void;
}) {
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const editNodeSelected = useProjectStore((s) => s.editNodeSelected);
  const scene = useProjectStore((s) => s.scenes.find((sc) => sc.id === s.selectedSceneId));
  const setScenePreset = useProjectStore((s) => s.setScenePreset);
  const setSceneGenerationTarget = useProjectStore(
    (s) => s.setSceneGenerationTarget,
  );
  const setSceneTrim = useProjectStore((s) => s.setSceneTrim);
  const generateScene = useProjectStore((s) => s.generateScene);
  const isGenerating = useProjectStore((s) => s.isGenerating);
  const selectScene = useProjectStore((s) => s.selectScene);
  const modelId = useProjectStore((s) => s.modelId);
  const setModelId = useProjectStore((s) => s.setModelId);
  const durations = getDurations(modelId);
  const showModelPicker = listAdapters().length > 1;

  const musicPrompt = useProjectStore((s) => s.musicPrompt);
  const musicUrl = useProjectStore((s) => s.musicUrl);
  const isMusicGenerating = useProjectStore((s) => s.isMusicGenerating);
  const setMusicPrompt = useProjectStore((s) => s.setMusicPrompt);
  const generateMusicAction = useProjectStore((s) => s.generateMusic);
  const clearMusic = useProjectStore((s) => s.clearMusic);
  const exportAspectRatio = useProjectStore((s) => s.exportAspectRatio);
  const setExportAspectRatio = useProjectStore((s) => s.setExportAspectRatio);
  const audioMix = useProjectStore((s) => s.audioMix);
  const setAudioMixSetting = useProjectStore((s) => s.setAudioMixSetting);
  const setSceneAudioVolume = useProjectStore((s) => s.setSceneAudioVolume);

  const showScene = !!scene && !!selectedSceneId;
  const showEdit = editNodeSelected && !selectedSceneId;
  const isOpen = showScene || showEdit;
  const previewPlacement = useEditorSettingsStore((s) => s.layout.previewPlacement);
  const showInspectorPreview = previewPlacement === "inspector";

  return (
    <aside
      className={`shrink-0 border-l border-white/5 bg-[#0A0A09] transition-all duration-300 ease-out overflow-hidden overflow-y-auto ${
        isOpen ? "w-64" : "w-0 border-l-0"
      }`}
    >
      {scene && selectedSceneId && showScene && (
        <div className="flex h-full min-h-0 w-64 flex-col">
          {showInspectorPreview ? (
            <div className="relative aspect-video w-full shrink-0 bg-white/5">
              {scene.status === "ready" && scene.videoUrl ? (
                <InspectorPreviewVideo
                  sceneId={scene.id}
                  videoUrl={scene.videoUrl}
                  poster={scene.photoDataUrl ?? scene.photoUrl}
                  sprite={scene.sprite}
                  duration={scene.duration}
                />
              ) : (
                <Image
                  src={scene.photoDataUrl ?? scene.photoUrl}
                  alt="Pré-visualização da cena"
                  fill
                  className="object-cover"
                  unoptimized
                />
              )}
              <div className="absolute right-2 top-2 flex items-center gap-1">
                {scene.status === "ready" && scene.videoUrl && (
                  <button
                    type="button"
                    onClick={() => downloadVideoBlob(scene.videoUrl!, "cena.mp4")}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/60 transition-colors hover:text-white"
                    title="Baixar cena"
                    aria-label="Baixar cena"
                  >
                    <ArrowDownToLine size={12} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => selectScene(null)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/60 transition-colors hover:text-white"
                  aria-label="Fechar painel"
                >
                  <X size={12} />
                </button>
              </div>
              {scene.status === "ready" && scene.videoUrl && onPreviewVideo && (
                <button
                  type="button"
                  onClick={() => onPreviewVideo(scene.videoUrl!)}
                  className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/60 transition-colors hover:text-white"
                  aria-label="Tela cheia"
                >
                  <Maximize2 size={12} />
                </button>
              )}
            </div>
          ) : (
            // Preview lives elsewhere (headline/theater) — show only a compact
            // chrome row so the close button + download stay reachable.
            <div className="flex shrink-0 items-center justify-between gap-1 border-b border-white/5 px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                Cena
              </span>
              <div className="flex items-center gap-1">
                {scene.status === "ready" && scene.videoUrl && (
                  <button
                    type="button"
                    onClick={() => downloadVideoBlob(scene.videoUrl!, "cena.mp4")}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    title="Baixar cena"
                    aria-label="Baixar cena"
                  >
                    <ArrowDownToLine size={12} />
                  </button>
                )}
                {scene.status === "ready" && scene.videoUrl && onPreviewVideo && (
                  <button
                    type="button"
                    onClick={() => onPreviewVideo(scene.videoUrl!)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Tela cheia"
                  >
                    <Maximize2 size={12} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => selectScene(null)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Fechar painel"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3">
            {scene.sourceType === "video-upload" ? (
              <>
                <div>
                  <span className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
                    Vídeo importado
                  </span>
                  <div className="mt-2 flex items-center justify-between font-mono text-[11px]">
                    <span className="text-text-secondary">Duração</span>
                    <span className="text-white">{Math.round(scene.duration * 10) / 10}s</span>
                  </div>
                  {scene.status === "ready" && (
                    <div className="mt-1.5 flex items-center justify-between font-mono text-[11px]">
                      <span className="text-text-secondary">Volume</span>
                      <DragValue
                        value={scene.audioVolume ?? 1}
                        onChange={(v) => setSceneAudioVolume(selectedSceneId, v)}
                        min={0}
                        max={2}
                        step={0.01}
                        icon={<Volume2 size={10} />}
                        label="Volume do clipe"
                      />
                    </div>
                  )}
                </div>
                {scene.status === "ready" && scene.videoUrl && (
                  <TrimControls
                    scene={scene}
                    onChange={(trim) => setSceneTrim(selectedSceneId, trim)}
                  />
                )}
                <div className="min-h-4 flex-1" aria-hidden />
                <div className="mt-auto shrink-0 pt-2">
                  <div className="flex items-center justify-between font-mono text-[10px] text-text-secondary">
                    <span className="text-blue-400/80">Upload</span>
                    <span className="flex items-center gap-1.5">
                      <StatusDot status={scene.status} />
                      <StatusLabel status={scene.status} />
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
                      Movimento
                    </label>
                    {showModelPicker && <ModelChip modelId={modelId} onChange={setModelId} />}
                  </div>
                  <PresetSelector
                    selectedId={scene.presetId}
                    onSelect={(id) => setScenePreset(selectedSceneId, id)}
                  />
                </div>

                {/* "Alvo de geração": how long we ask the model for on the NEXT
                    generation. After a successful generate this clears and
                    scene.duration reflects the effective clip length (adjusted
                    by trim). Picking a value here does NOT change the existing
                    clip duration — only the next attempt. */}
                <div className="mt-3">
                  <label className="mb-1.5 flex items-center justify-between font-mono text-label-xs uppercase tracking-widest text-text-secondary">
                    <span>Alvo (gerar)</span>
                    {scene.status === "ready" && scene.videoUrl && (
                      <span className="font-mono text-[9px] normal-case text-text-secondary/60">
                        Clip: {Math.round(scene.duration * 10) / 10}s
                      </span>
                    )}
                  </label>
                  <div
                    className={`grid gap-1 ${durations.length > 4 ? "grid-cols-6" : durations.length > 2 ? "grid-cols-4" : "grid-cols-2"}`}
                  >
                    {durations.map((d) => {
                      const effective =
                        scene.generationTargetSeconds ?? scene.duration;
                      const isActive = effective === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSceneGenerationTarget(selectedSceneId, d)}
                          className={`rounded-md border py-1 font-mono text-[10px] transition-all ${
                            isActive
                              ? "border-accent-gold/40 bg-accent-gold/5 text-accent-gold"
                              : "border-white/5 text-text-secondary hover:border-white/10"
                          }`}
                        >
                          {d}s
                        </button>
                      );
                    })}
                  </div>
                </div>

                {scene.status === "ready" && scene.videoUrl && (
                  <TrimControls
                    scene={scene}
                    onChange={(trim) => setSceneTrim(selectedSceneId, trim)}
                  />
                )}

                <div className="min-h-4 flex-1" aria-hidden />

                <div className="mt-auto shrink-0 space-y-2 pt-2">
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => generateScene(selectedSceneId)}
                    className="w-full rounded-lg border border-accent-gold/30 py-2 font-mono text-label-sm text-accent-gold transition-all hover:bg-accent-gold/10 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {scene.status === "ready"
                      ? "Regenerar cena"
                      : scene.status === "generating"
                        ? "Gerando..."
                        : "Gerar esta cena"}
                  </button>

                  {onEditImage && (
                    <button
                      type="button"
                      onClick={() => onEditImage(selectedSceneId)}
                      className="w-full rounded-lg border border-white/10 py-2 font-mono text-label-sm text-text-secondary transition-all hover:border-accent-gold/20 hover:text-accent-gold"
                    >
                      Editar imagem
                    </button>
                  )}

                  <div className="flex items-center justify-between border-t border-white/5 pt-2 font-mono text-[10px] text-text-secondary">
                    <span className="text-accent-gold/80">{scene.costCredits} cr.</span>
                    <span className="flex items-center gap-1.5">
                      <StatusDot status={scene.status} />
                      <StatusLabel status={scene.status} />
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showEdit && (
        <div className="flex h-full min-h-0 w-64 flex-col">
          <EditPreview
            musicUrl={musicUrl}
            onClose={() => useProjectStore.setState({ editNodeSelected: false })}
            onExport={onExport}
            aspectRatio={exportAspectRatio}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3">
            <MusicSection
              musicUrl={musicUrl}
              musicPrompt={musicPrompt}
              isMusicGenerating={isMusicGenerating}
              setMusicPrompt={setMusicPrompt}
              generateMusic={generateMusicAction}
              clearMusic={clearMusic}
              setMusicUrl={(url: string) => useProjectStore.setState({ musicUrl: url, isDirty: true })}
              musicVolume={audioMix.musicVolume}
              setMusicVolume={(vol: number) => setAudioMixSetting("musicVolume", vol)}
            />

            <div className="mt-3 rounded-lg border border-white/5 px-3 py-2">
              <span className="block font-mono text-[9px] uppercase tracking-wider text-text-secondary">
                Composição
              </span>
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-text-secondary">Cenas prontas</span>
                  <span className="font-mono text-[11px] text-accent-gold">
                    {useProjectStore.getState().scenes.filter((s) => s.status === "ready").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-text-secondary">Trilha</span>
                  <span className="font-mono text-[11px]">
                    {musicUrl ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-text-secondary">—</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <MixagemSection audioMix={audioMix} onUpdate={setAudioMixSetting} />

            <div className="mt-3">
              <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-wider text-text-secondary">
                Formato
              </label>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setExportAspectRatio("16:9")}
                  className={`flex items-center justify-center gap-1.5 rounded-md border py-1.5 font-mono text-[10px] transition-all ${
                    exportAspectRatio === "16:9"
                      ? "border-accent-gold/40 bg-accent-gold/5 text-accent-gold"
                      : "border-white/5 text-text-secondary hover:border-white/10"
                  }`}
                >
                  <span className="inline-block h-2.5 w-4 rounded-[2px] border border-current" />
                  16:9
                </button>
                <button
                  type="button"
                  onClick={() => setExportAspectRatio("9:16")}
                  className={`flex items-center justify-center gap-1.5 rounded-md border py-1.5 font-mono text-[10px] transition-all ${
                    exportAspectRatio === "9:16"
                      ? "border-accent-gold/40 bg-accent-gold/5 text-accent-gold"
                      : "border-white/5 text-text-secondary hover:border-white/10"
                  }`}
                >
                  <span className="inline-block h-4 w-2.5 rounded-[2px] border border-current" />
                  9:16
                </button>
              </div>
            </div>

            <div className="min-h-4 flex-1" aria-hidden />

            <div className="mt-auto shrink-0 space-y-2 pt-2">
              {onExport && (
                <button
                  type="button"
                  onClick={onExport}
                  className="w-full rounded-lg bg-accent-gold py-2.5 font-mono text-label-sm uppercase tracking-widest text-[#0D0D0B] transition-opacity hover:opacity-80"
                >
                  Renderizar
                </button>
              )}
              {onDownloadLast && (
                <button
                  type="button"
                  onClick={onDownloadLast}
                  className="w-full rounded-lg border border-white/10 py-2 font-mono text-label-sm text-text-secondary transition-all hover:border-white/20 hover:text-[var(--text)]"
                >
                  Baixar último
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
