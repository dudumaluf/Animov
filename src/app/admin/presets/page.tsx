"use client";

import { useState } from "react";
import { PRESET_CATALOG } from "@/lib/presets";
import { IMAGE_EDIT_PRESETS, IMAGE_EDIT_CATEGORIES } from "@/lib/presets/image-edit-catalog";

type Tab = "video" | "image";

export default function AdminPresetsPage() {
  const [tab, setTab] = useState<Tab>("video");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-display-lg">Presets</h1>
      </div>

      <div className="mt-6 flex rounded-lg border border-white/10 p-0.5 w-fit">
        <button
          onClick={() => setTab("video")}
          className={`rounded-md px-4 py-1.5 font-mono text-label-sm transition-all ${
            tab === "video" ? "bg-white/5 text-accent-gold" : "text-text-secondary hover:text-[var(--text)]"
          }`}
        >
          Video ({PRESET_CATALOG.length})
        </button>
        <button
          onClick={() => setTab("image")}
          className={`rounded-md px-4 py-1.5 font-mono text-label-sm transition-all ${
            tab === "image" ? "bg-white/5 text-accent-gold" : "text-text-secondary hover:text-[var(--text)]"
          }`}
        >
          Image Edit ({IMAGE_EDIT_PRESETS.length})
        </button>
      </div>

      {tab === "video" ? <VideoPresets /> : <ImagePresets />}
    </div>
  );
}

function VideoPresets() {
  return (
    <div className="mt-6 space-y-3">
      {PRESET_CATALOG.map((preset) => (
        <details key={preset.id} className="group rounded-xl border border-white/5 transition-colors hover:border-white/10">
          <summary className="flex cursor-pointer items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-gold/10 font-mono text-sm text-accent-gold">
                {preset.arrow}
              </span>
              <div>
                <span className="block font-mono text-label-sm font-medium">{preset.displayName}</span>
                <span className="block font-mono text-[10px] text-text-secondary">{preset.description}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[9px] uppercase text-text-secondary">
                {preset.type}
              </span>
              <span className={`rounded px-2 py-0.5 font-mono text-[9px] uppercase ${
                preset.visionTier === "smart" ? "bg-accent-gold/10 text-accent-gold" : "bg-white/5 text-text-secondary"
              }`}>
                {preset.visionTier}
              </span>
            </div>
          </summary>
          <div className="border-t border-white/5 p-4 space-y-3">
            <Field label="ID" value={preset.id} />
            <Field label="Vision System Prompt" value={preset.visionSystemPrompt} pre />
            <Field label="Prompt Template" value={preset.promptTemplate} pre />
            {preset.fallbackPresetId && <Field label="Fallback" value={preset.fallbackPresetId} />}
          </div>
        </details>
      ))}
    </div>
  );
}

function ImagePresets() {
  return (
    <div className="mt-6 space-y-6">
      {IMAGE_EDIT_CATEGORIES.map((cat) => {
        const presets = IMAGE_EDIT_PRESETS.filter((p) => p.category === cat.id);
        if (presets.length === 0) return null;
        return (
          <div key={cat.id}>
            <h3 className="font-mono text-label-xs uppercase tracking-widest text-accent-gold">{cat.label}</h3>
            <div className="mt-2 space-y-2">
              {presets.map((preset) => (
                <details key={preset.id} className="group rounded-xl border border-white/5 transition-colors hover:border-white/10">
                  <summary className="flex cursor-pointer items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{preset.icon}</span>
                      <div>
                        <span className="block font-mono text-label-sm font-medium">{preset.displayName}</span>
                        <span className="block font-mono text-[10px] text-text-secondary">{preset.description}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${
                        preset.active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                      }`}>
                        {preset.active ? "Ativo" : "Inativo"}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${
                        preset.userVisible ? "bg-white/5 text-text-secondary" : "bg-white/5 text-text-secondary/50"
                      }`}>
                        {preset.userVisible ? "Visível" : "Oculto"}
                      </span>
                      {preset.requiredReferences.length > 0 && (
                        <span className="rounded bg-accent-gold/10 px-2 py-0.5 font-mono text-[9px] text-accent-gold">
                          {preset.requiredReferences.length} ref
                        </span>
                      )}
                    </div>
                  </summary>
                  <div className="border-t border-white/5 p-4 space-y-3">
                    <Field label="ID" value={preset.id} />
                    <Field label="Prompt Template" value={preset.promptTemplate} pre />
                    {preset.requiredReferences.length > 0 && (
                      <div>
                        <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary">Required References</p>
                        <div className="flex gap-2">
                          {preset.requiredReferences.map((ref) => (
                            <span key={ref.key} className="rounded bg-white/5 px-2 py-1 font-mono text-[10px] text-text-secondary">
                              {ref.label} ({ref.key})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value, pre = false }: { label: string; value: string; pre?: boolean }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary">{label}</p>
      {pre ? (
        <pre className="max-h-40 overflow-y-auto rounded-lg bg-white/[0.02] p-3 font-mono text-[10px] leading-relaxed text-text-secondary whitespace-pre-wrap">
          {value}
        </pre>
      ) : (
        <p className="font-mono text-[11px] text-text-secondary">{value}</p>
      )}
    </div>
  );
}
