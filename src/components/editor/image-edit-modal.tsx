"use client";

import Image from "next/image";
import { useState, useRef, useCallback } from "react";
import { X, Loader2, ImagePlus } from "lucide-react";
import {
  getVisibleImageEditPresets,
  IMAGE_EDIT_CATEGORIES,
  type ImageEditPreset,
} from "@/lib/presets/image-edit-catalog";

const ASPECT_RATIOS = ["auto", "1:1", "16:9", "9:16", "3:2", "4:3", "4:5"];
const RESOLUTIONS = ["1K", "2K", "4K"];

type ReferenceImage = {
  key: string;
  label: string;
  url: string;
  file?: File;
};

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
  const [selectedPreset, setSelectedPreset] = useState<ImageEditPreset | null>(null);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [aspectRatio, setAspectRatio] = useState("auto");
  const [resolution, setResolution] = useState("1K");
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [showRecipes, setShowRecipes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const pendingRefKey = useRef<string | null>(null);

  const presets = getVisibleImageEditPresets();

  const cycleAspectRatio = () => {
    const idx = ASPECT_RATIOS.indexOf(aspectRatio);
    setAspectRatio(ASPECT_RATIOS[(idx + 1) % ASPECT_RATIOS.length]!);
  };

  const cycleResolution = () => {
    const idx = RESOLUTIONS.indexOf(resolution);
    setResolution(RESOLUTIONS[(idx + 1) % RESOLUTIONS.length]!);
  };

  const selectPreset = (preset: ImageEditPreset) => {
    setSelectedPreset(preset);
    setPrompt(preset.promptTemplate);
    setShowRecipes(false);
    setReferences(
      preset.requiredReferences.map((r) => ({
        key: r.key,
        label: r.label,
        url: "",
      })),
    );
  };

  const addFreeReference = () => {
    pendingRefKey.current = `ref_${references.length}`;
    refInputRef.current?.click();
  };

  const handleRefUpload = (key: string) => {
    pendingRefKey.current = key;
    refInputRef.current?.click();
  };

  const handleRefFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingRefKey.current) return;
    const url = URL.createObjectURL(file);
    const key = pendingRefKey.current;

    setReferences((prev) => {
      const existing = prev.find((r) => r.key === key);
      if (existing) {
        return prev.map((r) => (r.key === key ? { ...r, url, file } : r));
      }
      return [...prev, { key, label: `Ref ${prev.length + 1}`, url, file }];
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
      const refUrls = references.filter((r) => r.url).map((r) => r.url);

      const res = await fetch("/api/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          sourceImageUrl: imageUrl,
          referenceImageUrls: refUrls,
          aspectRatio,
          resolution,
          presetId: selectedPreset?.id,
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
  }, [prompt, imageUrl, references, aspectRatio, resolution, selectedPreset, generating]);

  const displayUrl = resultUrl ?? imageUrl;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0A09]">
      <input
        ref={refInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleRefFile}
      />

      {/* Top bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-4">
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-white/5 hover:text-white">
          <X size={16} />
        </button>
        <div className="flex items-center gap-3">
          <button onClick={cycleAspectRatio} className="rounded px-2 py-1 font-mono text-[10px] uppercase text-text-secondary transition-colors hover:bg-white/5 hover:text-accent-gold">
            {aspectRatio}
          </button>
          <button onClick={cycleResolution} className="rounded px-2 py-1 font-mono text-[10px] uppercase text-text-secondary transition-colors hover:bg-white/5 hover:text-accent-gold">
            {resolution}
          </button>
          <span className="font-mono text-[9px] text-text-secondary">
            ~${resolution === "4K" ? "0.16" : resolution === "2K" ? "0.12" : "0.08"}
          </span>
        </div>
      </div>

      {/* Image preview */}
      <div className="flex flex-1 items-center justify-center overflow-hidden p-8">
        <div className="relative max-h-full max-w-full">
          <Image
            src={displayUrl}
            alt="Edit preview"
            width={1024}
            height={768}
            className="max-h-[60vh] w-auto rounded-xl object-contain"
            unoptimized
          />
          {generating && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
              <Loader2 size={24} className="animate-spin text-accent-gold" />
            </div>
          )}
        </div>
      </div>

      {/* Result actions */}
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
            onClick={() => { setResultUrl(null); }}
            className="rounded-full px-4 py-2 font-mono text-[10px] text-text-secondary hover:text-white"
          >
            Descartar
          </button>
        </div>
      )}

      {/* Prompt panel */}
      <div className="shrink-0 border-t border-white/5 bg-[#0D0D0B] px-4 pb-4 pt-3">
        {/* Recipes button + preset chips */}
        <div className="relative mb-2 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setShowRecipes(!showRecipes)}
            className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[10px] transition-all ${
              showRecipes ? "border-accent-gold/40 text-accent-gold" : "border-white/10 text-text-secondary hover:border-accent-gold/20"
            }`}
          >
            Recipes
          </button>
          {selectedPreset && (
            <span className="shrink-0 rounded-full bg-accent-gold/10 px-3 py-1 font-mono text-[10px] text-accent-gold">
              {selectedPreset.icon} {selectedPreset.displayName}
            </span>
          )}

          {/* Recipes dropdown */}
          {showRecipes && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowRecipes(false)} />
              <div className="absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#141412] shadow-xl">
                <div className="max-h-80 overflow-y-auto">
                  {IMAGE_EDIT_CATEGORIES.map((cat) => {
                    const catPresets = presets.filter((p) => p.category === cat.id);
                    if (catPresets.length === 0) return null;
                    return (
                      <div key={cat.id}>
                        <p className="px-3 pt-3 pb-1 font-mono text-[9px] uppercase tracking-widest text-accent-gold">
                          {cat.label}
                        </p>
                        {catPresets.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => selectPreset(preset)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5"
                          >
                            <span className="text-sm">{preset.icon}</span>
                            <div>
                              <span className="block font-mono text-[11px]">{preset.displayName}</span>
                              <span className="block font-mono text-[9px] text-text-secondary">{preset.description}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Reference image slots */}
        {references.length > 0 && (
          <div className="mb-2 flex items-center gap-2">
            {references.map((ref) => (
              <div key={ref.key} className="relative">
                {ref.url ? (
                  <div className="group relative h-10 w-10 overflow-hidden rounded-lg border border-white/10">
                    <Image src={ref.url} alt={ref.label} fill className="object-cover" unoptimized />
                    <button
                      onClick={() => removeRef(ref.key)}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleRefUpload(ref.key)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-white/10 text-text-secondary transition-colors hover:border-accent-gold/30 hover:text-accent-gold"
                    title={ref.label}
                  >
                    <ImagePlus size={12} />
                  </button>
                )}
                <span className="mt-0.5 block text-center font-mono text-[7px] text-text-secondary">{ref.label}</span>
              </div>
            ))}
            {!selectedPreset && references.length < 14 && (
              <button
                onClick={addFreeReference}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-white/10 text-text-secondary hover:border-accent-gold/30 hover:text-accent-gold"
                title="Adicionar referência"
              >
                <ImagePlus size={12} />
              </button>
            )}
          </div>
        )}

        {/* Prompt input + generate */}
        <div className="flex items-center gap-2">
          {!selectedPreset && references.length === 0 && (
            <button
              onClick={addFreeReference}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-text-secondary transition-colors hover:border-accent-gold/30 hover:text-accent-gold"
              title="Adicionar referência"
            >
              <ImagePlus size={14} />
            </button>
          )}
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) generate(); }}
            placeholder="Descreva a edição..."
            className="flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-2 font-mono text-[12px] text-[var(--text)] placeholder:text-text-secondary focus:border-accent-gold/30 focus:outline-none"
          />
          <button
            onClick={generate}
            disabled={generating || !prompt.trim()}
            className="shrink-0 rounded-lg bg-accent-gold px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-[#0D0D0B] transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {generating ? "..." : "Gerar"}
          </button>
        </div>

        {error && (
          <p className="mt-2 font-mono text-[10px] text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
