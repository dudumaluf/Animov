"use client";

import {
  useEditorSettingsStore,
  type LayoutPreset,
} from "@/stores/editor-settings-store";

type Chip = { id: LayoutPreset; label: string; hint: string };

const PRESET_CHIPS: readonly Chip[] = [
  { id: "edicao", label: "Edição", hint: "1 · Preview no inspector" },
  { id: "revisao", label: "Revisão", hint: "2 · Preview em cima, inspector compacto" },
  { id: "foco", label: "Foco", hint: "3 · Cinema + faixa de tempo" },
] as const;

/**
 * Floating chip bar for switching between layout presets. The wrapper in
 * page.tsx decides where to anchor it (canvas area top-right vs theater
 * top-right) — here we only render it absolutely into the parent, so it never
 * overlaps the inspector (which sits outside the parent we're anchored to).
 * The `Livre` chip only appears when the user has drifted from a named preset.
 */
export function LayoutBar({ className = "" }: { className?: string }) {
  const preset = useEditorSettingsStore((s) => s.layout.preset);
  const showLayoutBar = useEditorSettingsStore((s) => s.layout.showLayoutBar);
  const applyPreset = useEditorSettingsStore((s) => s.applyPreset);

  if (!showLayoutBar) return null;

  return (
    <div
      className={`pointer-events-auto absolute right-3 top-3 z-40 flex items-center gap-1 rounded-lg border border-white/5 bg-[#0A0A09]/90 p-1 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200 ${className}`}
      aria-label="Layout presets"
    >
      {PRESET_CHIPS.map((chip) => {
        const active = preset === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => applyPreset(chip.id)}
            className={`rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              active
                ? "bg-white/10 text-accent-gold"
                : "text-text-secondary hover:bg-white/5 hover:text-[var(--text)]"
            }`}
            title={chip.hint}
            aria-pressed={active}
          >
            {chip.label}
          </button>
        );
      })}

      {preset === "livre" && (
        <span
          className="rounded bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-accent-gold"
          title="Configuração manual — clique em um preset acima para restaurar"
        >
          Livre
        </span>
      )}
    </div>
  );
}
