"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Sliders,
  FolderKanban,
  UserRound,
  Crosshair,
  Ruler,
  Hand,
  Keyboard,
  ExternalLink,
  RotateCcw,
  LayoutPanelTop,
} from "lucide-react";
import {
  useEditorSettingsStore,
  type PlayheadLineColor,
  type PlayheadLineVisibility,
  type RulerDensityMode,
  type PreviewPlacement,
  type InspectorDensity,
  type LayoutPreset,
  playheadLineCssColorSolid,
} from "@/stores/editor-settings-store";

type SettingsSection = "editor" | "projeto" | "conta";

export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [section, setSection] = useState<SettingsSection>("editor");
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const sections: Array<{
    id: SettingsSection;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: "editor", label: "Editor", icon: <Sliders size={13} /> },
    { id: "projeto", label: "Projeto", icon: <FolderKanban size={13} /> },
    { id: "conta", label: "Conta", icon: <UserRound size={13} /> },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="relative flex h-[600px] w-[880px] max-w-[92vw] max-h-[92vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0F0F0E] shadow-2xl"
      >
        {/* Sidebar */}
        <aside className="flex w-[180px] flex-col border-r border-white/5 bg-[#0A0A09]">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
              Configuracoes
            </span>
          </div>
          <nav className="flex flex-col gap-px px-2">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left font-mono text-[11px] transition-colors ${
                  section === s.id
                    ? "bg-white/5 text-[var(--text)]"
                    : "text-text-secondary hover:bg-white/[0.03] hover:text-[var(--text)]"
                }`}
              >
                <span
                  className={
                    section === s.id ? "text-accent-gold" : "text-text-secondary"
                  }
                >
                  {s.icon}
                </span>
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex items-center justify-between border-b border-white/5 px-6 py-3">
            <h2 className="font-mono text-[13px] text-[var(--text)]">
              {section === "editor" && "Editor"}
              {section === "projeto" && "Projeto"}
              {section === "conta" && "Conta"}
            </h2>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
              aria-label="Fechar"
            >
              <X size={14} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto">
            {section === "editor" && <EditorSection />}
            {section === "projeto" && <ProjetoSection />}
            {section === "conta" && <ContaSection />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Section: Editor ────────────────────────────────────────────── */

function EditorSection() {
  const playheadLine = useEditorSettingsStore((s) => s.playheadLine);
  const ruler = useEditorSettingsStore((s) => s.ruler);
  const behavior = useEditorSettingsStore((s) => s.behavior);
  const setPlayheadLineVisibility = useEditorSettingsStore(
    (s) => s.setPlayheadLineVisibility,
  );
  const setPlayheadLineOpacityBaseline = useEditorSettingsStore(
    (s) => s.setPlayheadLineOpacityBaseline,
  );
  const setPlayheadLineOpacityScrub = useEditorSettingsStore(
    (s) => s.setPlayheadLineOpacityScrub,
  );
  const setPlayheadLineColor = useEditorSettingsStore(
    (s) => s.setPlayheadLineColor,
  );
  const setPlayheadLineGlowOnScrub = useEditorSettingsStore(
    (s) => s.setPlayheadLineGlowOnScrub,
  );
  const setRulerVisible = useEditorSettingsStore((s) => s.setRulerVisible);
  const setRulerDensityMode = useEditorSettingsStore(
    (s) => s.setRulerDensityMode,
  );
  const setAutoFollowDefault = useEditorSettingsStore(
    (s) => s.setAutoFollowDefault,
  );
  const setHoverPlayEnabled = useEditorSettingsStore(
    (s) => s.setHoverPlayEnabled,
  );
  const layout = useEditorSettingsStore((s) => s.layout);
  const applyPreset = useEditorSettingsStore((s) => s.applyPreset);
  const setPreviewPlacement = useEditorSettingsStore((s) => s.setPreviewPlacement);
  const setInspectorDensity = useEditorSettingsStore((s) => s.setInspectorDensity);
  const setTimelineRibbon = useEditorSettingsStore((s) => s.setTimelineRibbon);
  const setShowLayoutBar = useEditorSettingsStore((s) => s.setShowLayoutBar);
  const resetDefaults = useEditorSettingsStore((s) => s.resetDefaults);

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <Subsection icon={<LayoutPanelTop size={13} />} title="Layout">
        <RadioRow<LayoutPreset>
          label="Preset"
          value={layout.preset}
          onChange={(v) => {
            if (v === "livre") return;
            applyPreset(v);
          }}
          options={[
            { id: "edicao", label: "Edicao" },
            { id: "revisao", label: "Revisao" },
            { id: "foco", label: "Foco" },
            ...(layout.preset === "livre"
              ? [{ id: "livre" as const, label: "Livre" }]
              : []),
          ]}
        />
        <RadioRow<PreviewPlacement>
          label="Preview"
          value={layout.previewPlacement}
          onChange={setPreviewPlacement}
          options={[
            { id: "inspector", label: "No inspector" },
            { id: "headline", label: "Headline" },
            { id: "theater", label: "Theater" },
          ]}
        />
        <RadioRow<InspectorDensity>
          label="Inspector"
          value={layout.inspectorDensity}
          onChange={setInspectorDensity}
          options={[
            { id: "full", label: "Completo" },
            { id: "railed", label: "Railed" },
            { id: "hidden", label: "Oculto" },
          ]}
        />
        <ToggleRow
          label="Timeline em ribbon (compacta)"
          hint="Faz o filmstrip virar uma faixa fina"
          value={layout.timelineRibbon}
          onChange={setTimelineRibbon}
        />
        <ToggleRow
          label="Mostrar barra de layout"
          hint="Chips flutuantes para alternar presets"
          value={layout.showLayoutBar}
          onChange={setShowLayoutBar}
        />
      </Subsection>

      <Subsection icon={<Crosshair size={13} />} title="Playhead">
        <RadioRow<PlayheadLineVisibility>
          label="Linha conectora"
          value={playheadLine.visibility}
          onChange={setPlayheadLineVisibility}
          options={[
            { id: "always", label: "Sempre" },
            { id: "only_scrub", label: "So no scrub" },
            { id: "never", label: "Nunca" },
          ]}
        />
        <NumberRow
          label="Opacidade em repouso"
          value={playheadLine.opacityBaseline}
          onChange={setPlayheadLineOpacityBaseline}
          disabled={playheadLine.visibility !== "always"}
        />
        <NumberRow
          label="Opacidade durante scrub"
          value={playheadLine.opacityScrub}
          onChange={setPlayheadLineOpacityScrub}
          disabled={playheadLine.visibility === "never"}
        />
        <SwatchRow
          label="Cor"
          value={playheadLine.color}
          onChange={setPlayheadLineColor}
        />
        <ToggleRow
          label="Brilho ao fazer scrub"
          value={playheadLine.glowOnScrub}
          onChange={setPlayheadLineGlowOnScrub}
        />
      </Subsection>

      <Subsection icon={<Ruler size={13} />} title="Regua de tempo">
        <ToggleRow
          label="Mostrar regua"
          value={ruler.visible}
          onChange={setRulerVisible}
        />
        <RadioRow<RulerDensityMode>
          label="Densidade de labels"
          value={ruler.densityMode}
          onChange={setRulerDensityMode}
          options={[
            { id: "auto", label: "Automatica" },
            { id: "dense", label: "Densa" },
            { id: "sparse", label: "Esparsa" },
          ]}
        />
      </Subsection>

      <Subsection icon={<Hand size={13} />} title="Comportamento">
        <ToggleRow
          label="Auto-seguir playhead por padrao"
          hint="Aplicado a cada nova sessao"
          value={behavior.autoFollowDefault}
          onChange={setAutoFollowDefault}
        />
        <ToggleRow
          label="Hover nos cards reproduz video"
          value={behavior.hoverPlayEnabled}
          onChange={setHoverPlayEnabled}
        />
      </Subsection>

      <Subsection icon={<Keyboard size={13} />} title="Atalhos">
        <ShortcutsCheatsheet />
      </Subsection>

      <div className="flex items-center justify-end pt-2">
        <button
          onClick={resetDefaults}
          className="flex items-center gap-1.5 rounded-lg border border-white/5 px-3 py-1.5 font-mono text-[10px] text-text-secondary transition-colors hover:border-accent-gold/30 hover:text-accent-gold"
        >
          <RotateCcw size={11} />
          Restaurar padroes
        </button>
      </div>
    </div>
  );
}

/* ─── Section: Projeto (stub) ────────────────────────────────────── */

function ProjetoSection() {
  return (
    <div className="flex h-full items-center justify-center px-8">
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-8 py-10 text-center">
        <FolderKanban size={28} className="text-text-secondary" />
        <div className="font-mono text-[11px] text-[var(--text)]">Em breve</div>
        <p className="font-mono text-[10px] leading-relaxed text-text-secondary">
          Aqui voce vai poder configurar aspect ratio de export, mix de audio,
          preset padrao e mais — tudo por projeto.
        </p>
      </div>
    </div>
  );
}

/* ─── Section: Conta ─────────────────────────────────────────────── */

function ContaSection() {
  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <p className="font-mono text-[10px] leading-relaxed text-text-secondary">
        Gerencie sua conta, creditos e plano no dashboard.
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href="/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-accent-gold/30 bg-accent-gold/5 px-3 py-1.5 font-mono text-[10px] text-accent-gold transition-colors hover:bg-accent-gold/10"
        >
          <ExternalLink size={11} />
          Ir para dashboard
        </a>
        <a
          href="/#pricing"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 font-mono text-[10px] text-text-secondary transition-colors hover:border-white/20 hover:text-[var(--text)]"
        >
          Ver planos
        </a>
      </div>
    </div>
  );
}

/* ─── Building blocks ─────────────────────────────────────────────── */

function Subsection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-text-secondary">
        <span className="text-accent-gold/80">{icon}</span>
        <h3 className="font-mono text-[10px] uppercase tracking-widest">
          {title}
        </h3>
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-white/5 bg-[#141412]/50 px-4 py-3">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[11px] text-[var(--text)]">{label}</span>
        {hint && (
          <span className="font-mono text-[9px] text-text-secondary">
            {hint}
          </span>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label} hint={hint}>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          value ? "bg-accent-gold/80" : "bg-white/10"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#0A0A09] transition-transform ${
            value ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </Row>
  );
}

function RadioRow<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ id: T; label: string }>;
}) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-px rounded-lg border border-white/5 bg-[#0A0A09] p-0.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors ${
              value === opt.id
                ? "bg-white/10 text-[var(--text)]"
                : "text-text-secondary hover:text-[var(--text)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </Row>
  );
}

function NumberRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      dragging.current = true;
      startY.current = e.clientY;
      startVal.current = value;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [value, disabled],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dy = startY.current - e.clientY;
      const next = Math.max(0, Math.min(100, Math.round(startVal.current + dy * 0.5)));
      onChange(next);
    },
    [onChange],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`h-1 w-28 cursor-pointer appearance-none rounded-full bg-white/10 accent-accent-gold ${
            disabled ? "opacity-40" : ""
          }`}
        />
        <span
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={`inline-flex w-12 cursor-ns-resize select-none items-center justify-end rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums transition-colors ${
            disabled
              ? "text-white/30"
              : "text-white/70 hover:bg-white/5 hover:text-accent-gold"
          }`}
          title={disabled ? undefined : "Arrastar para ajustar"}
        >
          {value}%
        </span>
      </div>
    </Row>
  );
}

function SwatchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PlayheadLineColor;
  onChange: (v: PlayheadLineColor) => void;
}) {
  const colors: PlayheadLineColor[] = ["gold", "white", "blue", "red"];
  return (
    <Row label={label}>
      <div className="flex items-center gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            aria-label={c}
            className={`h-5 w-5 rounded-full border transition-transform ${
              value === c
                ? "scale-110 border-white/40"
                : "border-white/10 hover:border-white/25"
            }`}
            style={{ backgroundColor: playheadLineCssColorSolid(c) }}
          />
        ))}
      </div>
    </Row>
  );
}

function ShortcutsCheatsheet() {
  const shortcuts: Array<{ keys: string; description: string }> = [
    { keys: "Espaco", description: "Play / pause" },
    { keys: "0", description: "Ajustar ao viewport" },
    { keys: "+ / -", description: "Zoom in / out" },
    { keys: "1", description: "Preset Edicao" },
    { keys: "2", description: "Preset Revisao" },
    { keys: "3", description: "Preset Foco" },
    { keys: "F", description: "Alternar theater (Foco)" },
    { keys: "Cmd/Ctrl + S", description: "Salvar projeto" },
    { keys: "Esc", description: "Fechar modais / sair do theater" },
  ];
  return (
    <div className="flex flex-col gap-1 py-1">
      {shortcuts.map((s) => (
        <div
          key={s.keys}
          className="flex items-center justify-between gap-3 py-1"
        >
          <span className="font-mono text-[10px] text-text-secondary">
            {s.description}
          </span>
          <kbd className="rounded border border-white/10 bg-[#0A0A09] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text)]">
            {s.keys}
          </kbd>
        </div>
      ))}
    </div>
  );
}
