"use client";

import Image from "next/image";
import { useState, useRef, useCallback } from "react";
import { X, Loader2, ImagePlus } from "lucide-react";

const ASPECT_RATIOS = ["auto", "1:1", "16:9", "9:16", "3:2", "4:3", "4:5"];
const RESOLUTIONS = ["1K", "2K", "4K"];
const CREDIT_COST: Record<string, number> = { "1K": 1, "2K": 1, "4K": 2 };

type ReferenceImage = {
  key: string;
  label: string;
  url: string;
  dataUrl?: string;
  file?: File;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function CompareSlider({
  originalUrl,
  editedUrl,
}: {
  originalUrl: string;
  editedUrl: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(50);
  const dragging = useRef(false);

  const updateSplit = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.max(2, Math.min(98, pct)));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateSplit(e.clientX);
  }, [updateSplit]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateSplit(e.clientX);
  }, [updateSplit]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative max-h-full max-w-full select-none overflow-hidden rounded-xl"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Edited (full, behind) */}
      <Image
        src={editedUrl}
        alt="Edited"
        width={1280}
        height={960}
        className="max-h-[75vh] w-auto rounded-xl object-contain"
        draggable={false}
        unoptimized
      />
      {/* Original (clipped from left) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${split}%` }}
      >
        <Image
          src={originalUrl}
          alt="Original"
          width={1280}
          height={960}
          className="max-h-[75vh] w-auto rounded-xl object-contain"
          draggable={false}
          unoptimized
        />
      </div>
      {/* Divider */}
      <div
        className="absolute inset-y-0 z-10 w-[3px] cursor-col-resize bg-white/80 shadow-[0_0_8px_rgba(0,0,0,0.5)]"
        style={{ left: `${split}%`, transform: "translateX(-50%)" }}
        onPointerDown={onPointerDown}
      >
        <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/70 shadow-lg">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 3L1 7L4 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 3L13 7L10 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {/* Labels */}
      <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white/70">
        Original
      </span>
      <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent-gold">
        Editado
      </span>
    </div>
  );
}

export function ImageEditModal({
  imageUrl,
  onClose,
  onResult,
}: {
  imageUrl: string;
  onClose: () => void;
  onResult: (editedUrl: string, mode: "replace" | "new_node") => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [aspectRatio, setAspectRatio] = useState("auto");
  const [resolution, setResolution] = useState("1K");
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const pendingRefKey = useRef<string | null>(null);

  const cycleAspectRatio = () => {
    const idx = ASPECT_RATIOS.indexOf(aspectRatio);
    setAspectRatio(ASPECT_RATIOS[(idx + 1) % ASPECT_RATIOS.length]!);
  };

  const cycleResolution = () => {
    const idx = RESOLUTIONS.indexOf(resolution);
    setResolution(RESOLUTIONS[(idx + 1) % RESOLUTIONS.length]!);
  };

  const addReference = () => {
    pendingRefKey.current = `ref_${references.length}`;
    refInputRef.current?.click();
  };

  const handleRefFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingRefKey.current) return;
    const url = URL.createObjectURL(file);
    const dataUrl = await fileToDataUrl(file);
    const key = pendingRefKey.current;

    setReferences((prev) => {
      const existing = prev.find((r) => r.key === key);
      if (existing) {
        return prev.map((r) => (r.key === key ? { ...r, url, dataUrl, file } : r));
      }
      return [...prev, { key, label: `Ref ${prev.length + 1}`, url, dataUrl, file }];
    });

    e.target.value = "";
    pendingRefKey.current = null;
  };

  const removeRef = (key: string) => {
    setReferences((prev) => prev.filter((r) => r.key !== key));
  };

  const generate = useCallback(async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);

    try {
      const refUrls = references
        .filter((r) => r.dataUrl || r.url)
        .map((r) => r.dataUrl ?? r.url);

      const res = await fetch("/api/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          sourceImageUrl: imageUrl,
          referenceImageUrls: refUrls,
          aspectRatio,
          resolution,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Edit failed");
      }

      const data = await res.json();
      setResultUrl(data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Edit failed");
    } finally {
      setGenerating(false);
    }
  }, [prompt, imageUrl, references, aspectRatio, resolution, generating]);

  const displayUrl = resultUrl ?? imageUrl;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0A09]/95">
      <input
        ref={refInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleRefFile}
      />

      {/* Image preview — fills most of the screen */}
      <div className="flex flex-1 items-center justify-center overflow-hidden p-8">
        {resultUrl ? (
          <CompareSlider originalUrl={imageUrl} editedUrl={resultUrl} />
        ) : (
          <div className="relative max-h-full max-w-full">
            <Image
              src={displayUrl}
              alt="Edit preview"
              width={1280}
              height={960}
              className="max-h-[75vh] w-auto rounded-xl object-contain"
              unoptimized
            />
            {generating && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                <Loader2 size={24} className="animate-spin text-accent-gold" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result actions — centered above prompt */}
      {resultUrl && (
        <div className="flex items-center justify-center gap-3 pb-3">
          <button
            onClick={() => onResult(resultUrl, "replace")}
            className="rounded-full bg-accent-gold px-5 py-2 font-mono text-label-sm uppercase tracking-widest text-[#0D0D0B] transition-opacity hover:opacity-80"
          >
            Substituir original
          </button>
          <button
            onClick={() => onResult(resultUrl, "new_node")}
            className="rounded-full border border-white/10 px-5 py-2 font-mono text-label-sm uppercase tracking-widest text-text-secondary transition-colors hover:border-accent-gold/30 hover:text-accent-gold"
          >
            Adicionar como novo
          </button>
          <button
            onClick={() => setResultUrl(null)}
            className="rounded-full px-4 py-2 font-mono text-[10px] text-text-secondary hover:text-white"
          >
            Descartar
          </button>
        </div>
      )}

      {/* Floating prompt panel — centered, compact */}
      <div className="flex justify-center px-4 pb-6">
        <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#141412] p-3 shadow-2xl">
          {/* References row */}
          {references.length > 0 && (
            <div className="mb-2 flex items-center gap-2">
              {references.map((ref) => (
                <div key={ref.key} className="relative">
                  {ref.url ? (
                    <div className="group relative h-9 w-9 overflow-hidden rounded-lg border border-white/10">
                      <Image src={ref.url} alt={ref.label} fill className="object-cover" unoptimized />
                      <button
                        onClick={() => removeRef(ref.key)}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X size={8} className="text-white" />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {/* Prompt input row */}
          <div className="flex items-center gap-2">
            <button
              onClick={addReference}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-text-secondary transition-colors hover:border-accent-gold/30 hover:text-accent-gold"
              title="Adicionar referência"
            >
              <ImagePlus size={13} />
            </button>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) generate(); }}
              placeholder="Descreva a edição..."
              className="flex-1 bg-transparent font-mono text-[12px] text-[var(--text)] placeholder:text-text-secondary focus:outline-none"
            />
            <button
              onClick={generate}
              disabled={generating || !prompt.trim()}
              className="shrink-0 rounded-lg bg-accent-gold px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#0D0D0B] transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {generating ? "..." : "Gerar"}
            </button>
          </div>

          {/* Bottom row: settings left, credits right */}
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={cycleAspectRatio} className="font-mono text-[9px] uppercase text-text-secondary transition-colors hover:text-accent-gold">
                {aspectRatio}
              </button>
              <span className="text-white/10">·</span>
              <button onClick={cycleResolution} className="font-mono text-[9px] uppercase text-text-secondary transition-colors hover:text-accent-gold">
                {resolution}
              </button>
            </div>
            <span className="font-mono text-[9px] text-text-secondary">
              {CREDIT_COST[resolution] ?? 1} cr.
            </span>
          </div>

          {error && (
            <p className="mt-2 font-mono text-[10px] text-red-400">{error}</p>
          )}
        </div>
      </div>

      {/* Close button — top right */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
      >
        <X size={16} />
      </button>
    </div>
  );
}
