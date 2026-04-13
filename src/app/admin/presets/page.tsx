import { PRESET_CATALOG } from "@/lib/presets";

export default function AdminPresetsPage() {
  return (
    <div>
      <h1 className="font-display text-display-lg">Presets</h1>
      <p className="mt-2 font-body text-sm text-text-secondary">
        {PRESET_CATALOG.length} presets configurados (source: codigo)
      </p>

      <div className="mt-8 space-y-4">
        {PRESET_CATALOG.map((preset) => (
          <div key={preset.id} className="rounded-xl border border-white/5 p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-gold/10 font-mono text-lg text-accent-gold">
                  {preset.arrow}
                </span>
                <div>
                  <h3 className="font-display text-lg">{preset.displayName}</h3>
                  <p className="font-mono text-[11px] text-text-secondary">{preset.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[9px] uppercase text-text-secondary">
                  {preset.type}
                </span>
                <span className={`rounded px-2 py-0.5 font-mono text-[9px] uppercase ${
                  preset.visionTier === "smart"
                    ? "bg-accent-gold/10 text-accent-gold"
                    : "bg-white/5 text-text-secondary"
                }`}>
                  vision: {preset.visionTier}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary">Vision System Prompt</p>
                <pre className="max-h-32 overflow-y-auto rounded-lg bg-white/[0.02] p-3 font-mono text-[10px] leading-relaxed text-text-secondary">
                  {preset.visionSystemPrompt}
                </pre>
              </div>
              <div>
                <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary">Prompt Template</p>
                <pre className="overflow-x-auto rounded-lg bg-white/[0.02] p-3 font-mono text-[10px] leading-relaxed text-text-secondary">
                  {preset.promptTemplate}
                </pre>
              </div>
              {preset.fallbackPresetId && (
                <p className="font-mono text-[10px] text-text-secondary">
                  Fallback: <span className="text-accent-gold">{preset.fallbackPresetId}</span>
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
