"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  RotateCw,
  Loader2,
  AlertCircle,
  ChevronDown,
  Clapperboard,
  Home,
  User,
  Gem,
  Zap,
  Images,
  Settings2,
  Wand2,
  Video,
  Clock,
  Volume2,
  VolumeX,
  RectangleHorizontal,
  CreditCard,
  Type,
  type LucideIcon,
} from "lucide-react";
import {
  useProjectStore,
  REFERENCE_FREE_PROMPT_ID,
  type Scene,
  type ReferenceAspectPref,
} from "@/stores/project-store";
import { useRecipesStore } from "@/stores/recipes-store";
import {
  useHasActiveJobForTarget,
  useLastJobErrorForTarget,
} from "@/stores/batches-store";
import { useCreditsBalance } from "@/hooks/use-credits-balance";
import {
  REFERENCE_CURATED_DURATIONS,
  REFERENCE_RESOLUTIONS_BY_TIER,
  clampResolutionForTier,
  referenceCreditCost,
} from "@/lib/adapters/seedance-reference";
import { useReferenceAssetsStore } from "@/components/editor/reference-assets-modal";
import { RecipesDrawer } from "@/components/editor/recipes-drawer";
import { ReferencePromptEditor } from "@/components/editor/reference-prompt-editor";
import { SegmentedControl } from "@/components/editor/segmented-control";

/** Lucide icons referenced by the seeded video_reference presets (by icon slug). */
const PRESET_ICONS: Record<string, LucideIcon> = {
  home: Home,
  user: User,
  gem: Gem,
  zap: Zap,
  images: Images,
  clapperboard: Clapperboard,
};

function PresetIcon({ name, size = 15 }: { name?: string | null; size?: number }) {
  const Icon = (name ? PRESET_ICONS[name] : undefined) ?? Clapperboard;
  return <Icon size={size} />;
}

/** Aspect-ratio choices shown in the output dropdown (UI preference values). */
const ASPECT_OPTIONS: { value: ReferenceAspectPref; label: string }[] = [
  { value: "project", label: "Do projeto" },
  { value: "auto", label: "Automática" },
  { value: "16:9", label: "16:9 · paisagem" },
  { value: "9:16", label: "9:16 · vertical" },
  { value: "1:1", label: "1:1 · quadrado" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "21:9", label: "21:9 · cinema" },
];

/** Short labels for the compact format pill (full names live in the dropdown). */
const ASPECT_SHORT: Record<ReferenceAspectPref, string> = {
  project: "Proj.",
  auto: "Auto",
  "16:9": "16:9",
  "9:16": "9:16",
  "1:1": "1:1",
  "4:3": "4:3",
  "3:4": "3:4",
  "21:9": "21:9",
};

/**
 * Inspector body for a `reference-group` scene. Pick a director preset, compose
 * the initial `@Image1..N` prompt, edit it inline (with reference chips), and
 * optionally run Magic prompt to polish the text.
 */
export function ReferenceGroupInspectorPanel({ scene }: { scene: Scene }) {
  const config = scene.referenceConfig;

  const setReferencePreset = useProjectStore((s) => s.setReferencePreset);
  const setReferenceComposedPrompt = useProjectStore((s) => s.setReferenceComposedPrompt);
  const composeReferencePrompt = useProjectStore((s) => s.composeReferencePrompt);
  const enhanceReferencePrompt = useProjectStore((s) => s.enhanceReferencePrompt);
  const generateReferenceVideo = useProjectStore((s) => s.generateReferenceVideo);
  const setSceneGenerationTarget = useProjectStore((s) => s.setSceneGenerationTarget);
  const setReferenceModelTier = useProjectStore((s) => s.setReferenceModelTier);
  const setReferenceResolution = useProjectStore((s) => s.setReferenceResolution);
  const setReferenceAspectRatio = useProjectStore((s) => s.setReferenceAspectRatio);
  const setReferenceGenerateAudio = useProjectStore((s) => s.setReferenceGenerateAudio);
  const openAssets = useReferenceAssetsStore((s) => s.open);

  const isGenerating = useHasActiveJobForTarget(scene.id, "video.reference");
  const jobError = useLastJobErrorForTarget(scene.id, "video.reference");
  const { balance, available } = useCreditsBalance();

  const recipes = useRecipesStore((s) => s.recipes);
  const recipesLoading = useRecipesStore((s) => s.loading);
  const isAdmin = useRecipesStore((s) => s.isAdmin);

  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  const [aspectOpen, setAspectOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    void useRecipesStore.getState().refresh();
  }, []);

  const presets = useMemo(
    () =>
      recipes
        .filter((r) => r.scope === "video_reference" && r.active && r.user_visible)
        .sort((a, b) => a.sort_order - b.sort_order),
    [recipes],
  );

  const images = config?.images ?? [];
  const uploadedCount = images.filter((im) => im.url.startsWith("http")).length;
  const hasPendingUploads = uploadedCount < images.length;
  const presetId = config?.presetId ?? "";
  // "Free prompt" = user explicitly chose to write their own prompt (no preset).
  // Distinct from `presetId === ""` which means nothing has been chosen yet.
  const isFreePrompt = presetId === REFERENCE_FREE_PROMPT_ID;
  const selectedPreset = presets.find((p) => p.id === presetId) ?? null;
  const composedPrompt = config?.composedPrompt ?? "";
  const presetPrompts = config?.presetPrompts ?? {};
  const analysisStatus = config?.analysisStatus ?? "idle";
  const analyzing = analysisStatus === "analyzing";

  // Compose/regenerate need a real recipe — only available with a preset.
  const canCompose =
    !composing && !enhancing && !analyzing && !!presetId && !isFreePrompt && uploadedCount > 0;
  const canEnhance =
    !enhancing && !composing && !analyzing && !hasPendingUploads && composedPrompt.trim().length > 0;

  const tier = config?.modelTier ?? "standard";
  // Effective resolution honors the tier (fast can't do 1080p) so the chip and
  // estimate stay consistent even if the stored value predates a tier switch.
  const resolution = clampResolutionForTier(tier, config?.resolution ?? "720p");
  const resolutionOptions = REFERENCE_RESOLUTIONS_BY_TIER[tier].map((r) => ({
    value: r,
    label: r,
  }));
  const aspectPref: ReferenceAspectPref = config?.aspectRatio ?? "auto";
  const generateAudio = config?.generateAudio ?? false;
  const aspectLabel =
    ASPECT_OPTIONS.find((o) => o.value === aspectPref)?.label ?? "Automática";
  const aspectShort = ASPECT_SHORT[aspectPref] ?? "Auto";

  const targetDuration = scene.generationTargetSeconds ?? scene.duration;
  const estimate = referenceCreditCost(targetDuration, tier, resolution);
  const isReady = scene.status === "ready";
  // Pre-flight credit check: `available` already nets out other in-flight jobs.
  // Only block once we actually have a balance (null = still loading).
  const insufficientCredits = balance !== null && estimate > available;
  const canGenerate =
    !isGenerating &&
    !analyzing &&
    !hasPendingUploads &&
    uploadedCount > 0 &&
    composedPrompt.trim().length > 0 &&
    !insufficientCredits;

  function handleGenerate() {
    setGenerateError(null);
    if (insufficientCredits) {
      setGenerateError(
        `Créditos insuficientes — precisa de ${estimate}, você tem ${available}.`,
      );
      return;
    }
    const result = generateReferenceVideo(scene.id);
    if (!result.ok) setGenerateError(result.error ?? "Falha ao iniciar a geração");
  }

  async function handleCompose() {
    setComposing(true);
    setComposeError(null);
    const result = await composeReferencePrompt(scene.id);
    setComposing(false);
    if (!result.ok) setComposeError(result.error ?? "Falha ao compor o prompt");
  }

  async function handleEnhance() {
    setEnhancing(true);
    setEnhanceError(null);
    const result = await enhanceReferencePrompt(scene.id);
    setEnhancing(false);
    if (!result.ok) setEnhanceError(result.error ?? "Falha ao melhorar o prompt");
  }

  // Seamless fallback: prompts are normally seeded during analysis, so picking
  // a preset is instant. If a preset has no cached prompt (e.g. added after
  // analysis, or seeding failed), compose it once automatically — no waiting on
  // a manual click. Tracked per preset so a failure doesn't loop.
  const autoComposed = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!presetId || isFreePrompt || analyzing || hasPendingUploads || uploadedCount === 0) return;
    if (composing) return;
    if (composedPrompt.trim() || presetPrompts[presetId]) return;
    if (autoComposed.current.has(presetId)) return;
    autoComposed.current.add(presetId);
    void handleCompose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, analyzing, hasPendingUploads, uploadedCount, composedPrompt, presetPrompts]);

  return (
    <>
      {/* Header — compact single line: image count + inline analysis status +
          Assets. The panel identity ("Referência") now lives in the drawer
          chassis title, so we don't repeat it here. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 font-mono text-[11px]">
          <Images size={12} className="shrink-0 text-text-secondary" />
          <span className="text-white">{images.length}</span>
          <span className="text-text-secondary">imagens</span>
          {analyzing ? (
            <span className="ml-1 flex min-w-0 items-center gap-1 text-accent-gold">
              <Loader2 size={10} className="shrink-0 animate-spin" />
              <span className="truncate">analisando</span>
            </span>
          ) : analysisStatus === "failed" ? (
            <span className="ml-1 truncate text-red-400">análise falhou</span>
          ) : analysisStatus === "idle" ? (
            <span className="ml-1 truncate text-text-secondary/50">aguardando</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => openAssets(scene.id)}
          title="Abrir Assets — ver e editar as imagens de referência"
          className="flex shrink-0 items-center gap-1 rounded-md border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary transition-colors hover:border-accent-gold/30 hover:text-accent-gold"
        >
          <Images size={11} /> Assets
        </button>
      </div>

      {/* Preset selector — mirrors the camera/motion PresetSelector look */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <label className="block font-mono text-label-xs uppercase tracking-widest text-text-secondary">
            Estilo
          </label>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setManageOpen(true)}
              title="Gerenciar presets (inspecionar / editar / adicionar)"
              className="flex h-5 items-center gap-1 rounded-md px-1.5 font-mono text-[9px] uppercase tracking-widest text-text-secondary transition-colors hover:text-accent-gold"
            >
              <Settings2 size={11} /> Gerenciar
            </button>
          )}
        </div>
        <div className="flex items-stretch gap-2">
          <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => {
              setDurationOpen(false);
              setAspectOpen(false);
              setPresetOpen((v) => !v);
            }}
            className="flex h-full w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2.5 text-left transition-all hover:border-accent-gold/30"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-gold/10 text-accent-gold">
                {isFreePrompt ? <Type size={15} /> : <PresetIcon name={selectedPreset?.icon} />}
              </span>
              <div className="min-w-0">
                <span className="block truncate font-mono text-[12px] font-medium">
                  {isFreePrompt
                    ? "Sem estilo (prompt livre)"
                    : (selectedPreset?.display_name ??
                      (recipesLoading
                        ? "Carregando presets…"
                        : "Escolher estilo"))}
                </span>
                <span className="block truncate font-mono text-[9px] text-text-secondary">
                  {isFreePrompt
                    ? "Escreva seu próprio prompt"
                    : (selectedPreset?.description ?? "Selecione um preset de vídeo")}
                </span>
              </div>
            </div>
            <ChevronDown
              size={14}
              className={`shrink-0 text-text-secondary transition-transform ${presetOpen ? "rotate-180" : ""}`}
            />
          </button>

          {presetOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPresetOpen(false)} />
              <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-white/10 bg-[#141412] shadow-xl">
                {/* Free-prompt option — always first, always available, even
                    while recipes load or when there are no presets. */}
                <button
                  type="button"
                  onClick={() => {
                    setReferencePreset(scene.id, REFERENCE_FREE_PROMPT_ID);
                    setPresetOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 border-b border-white/5 px-3 py-2.5 text-left transition-colors ${
                    isFreePrompt ? "bg-accent-gold/5" : "hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                      isFreePrompt
                        ? "bg-accent-gold/20 text-accent-gold"
                        : "bg-white/5 text-text-secondary"
                    }`}
                  >
                    <Type size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`block font-mono text-[11px] font-medium ${
                        isFreePrompt ? "text-accent-gold" : ""
                      }`}
                    >
                      Sem estilo (prompt livre)
                    </span>
                    <span className="block truncate font-mono text-[9px] text-text-secondary">
                      Escreva seu próprio prompt do zero
                    </span>
                  </div>
                  {isFreePrompt && (
                    <span className="font-mono text-[10px] text-accent-gold">✓</span>
                  )}
                </button>
                {presets.map((preset) => {
                  const isSelected = preset.id === presetId;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setReferencePreset(scene.id, preset.id);
                        setPresetOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        isSelected ? "bg-accent-gold/5" : "hover:bg-white/5"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                          isSelected
                            ? "bg-accent-gold/20 text-accent-gold"
                            : "bg-white/5 text-text-secondary"
                        }`}
                      >
                        <PresetIcon name={preset.icon} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span
                          className={`block font-mono text-[11px] font-medium ${
                            isSelected ? "text-accent-gold" : ""
                          }`}
                        >
                          {preset.display_name}
                        </span>
                        <span className="block truncate font-mono text-[9px] text-text-secondary">
                          {preset.description}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="font-mono text-[10px] text-accent-gold">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          </div>

          {/* Duração — dropdown compacto ao lado do estilo. Clipes de referência
              Seedance rodam 4–15s @ 720p (3 cr/s). */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setPresetOpen(false);
                setAspectOpen(false);
                setDurationOpen((v) => !v);
              }}
              title="Duração do vídeo"
              className="flex h-full items-center gap-1.5 rounded-lg border border-white/10 px-2.5 font-mono text-[11px] transition-all hover:border-accent-gold/30"
            >
              <Clock size={12} className="shrink-0 text-text-secondary" />
              <span className="text-white">{targetDuration}s</span>
              <ChevronDown
                size={12}
                className={`shrink-0 text-text-secondary transition-transform ${durationOpen ? "rotate-180" : ""}`}
              />
            </button>

            {durationOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDurationOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 grid w-[120px] grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#141412] p-1.5 shadow-xl">
                  {REFERENCE_CURATED_DURATIONS.map((d) => {
                    const isActive = targetDuration === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setSceneGenerationTarget(scene.id, d);
                          setDurationOpen(false);
                        }}
                        className={`rounded-md border py-1 font-mono text-[10px] transition-all ${
                          isActive
                            ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
                            : "border-transparent text-text-secondary hover:bg-white/5"
                        }`}
                      >
                        {d}s
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Editable prompt with reference chips. Regenerate + magic-prompt live as
          compact icons on the label row to save vertical space. */}
      <div className="mt-3">
        <ReferencePromptEditor
          images={images}
          value={composedPrompt}
          onChange={(prompt) => setReferenceComposedPrompt(scene.id, prompt)}
          placeholder={
            isFreePrompt
              ? "Escreva o prompt do vídeo. Use @ para citar imagens (ex: @Image1 caminha pela sala)…"
              : undefined
          }
          actions={
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCompose}
                disabled={!canCompose}
                title="Regerar o prompt deste estilo com as imagens atuais"
                aria-label="Regerar prompt"
                className={`flex h-7 w-7 items-center justify-center rounded-md border transition-all ${
                  canCompose
                    ? "border-accent-gold/40 text-accent-gold hover:bg-accent-gold/10"
                    : "cursor-not-allowed border-white/10 text-text-secondary/30"
                }`}
              >
                {composing ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RotateCw size={13} />
                )}
              </button>
              <button
                type="button"
                onClick={handleEnhance}
                disabled={!canEnhance}
                title="Magic prompt — melhora o texto mantendo @Image1…N e a fidelidade às fotos"
                aria-label="Magic prompt"
                className={`flex h-7 w-7 items-center justify-center rounded-md border transition-all ${
                  canEnhance
                    ? "border-accent-gold/40 text-accent-gold hover:bg-accent-gold/10"
                    : "cursor-not-allowed border-white/10 text-text-secondary/30"
                }`}
              >
                {enhancing ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Wand2 size={13} />
                )}
              </button>
            </div>
          }
        />
      </div>

      {/* Status hints / errors */}
      {!presetId && (
        <p className="mt-1.5 font-mono text-[10px] text-text-secondary/60">
          Escolha um estilo (prompt pronto) ou “Sem estilo” para escrever o seu.
        </p>
      )}
      {isFreePrompt && (
        <p className="mt-1.5 font-mono text-[10px] text-text-secondary/60">
          Modo livre — escreva seu prompt e use @ para citar as imagens.
        </p>
      )}
      {presetId && hasPendingUploads && (
        <p className="mt-1.5 font-mono text-[10px] text-text-secondary/60">
          Aguardando upload das imagens…
        </p>
      )}
      {presetId && !hasPendingUploads && analyzing && (
        <p className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-accent-gold/80">
          <Loader2 size={11} className="animate-spin" /> Gerando os prompts de todos os
          estilos…
        </p>
      )}
      {presetId && !hasPendingUploads && !analyzing && composing && !composedPrompt && (
        <p className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-accent-gold/80">
          <Loader2 size={11} className="animate-spin" /> Compondo o prompt deste estilo…
        </p>
      )}
      {composeError && (
        <p className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-red-400">
          <AlertCircle size={11} /> {composeError}
        </p>
      )}
      {enhanceError && (
        <p className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-red-400">
          <AlertCircle size={11} /> {enhanceError}
        </p>
      )}

      {/* Output settings — compact. Audio toggles from the label row; tier on
          its own row; resolution + format share the next row. */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <label className="block font-mono text-label-xs uppercase tracking-widest text-text-secondary">
            Saída
          </label>
          <button
            type="button"
            onClick={() => setReferenceGenerateAudio(scene.id, !generateAudio)}
            disabled={isGenerating}
            title={
              generateAudio
                ? "Áudio ativado — efeitos, ambiente e fala sincronizada"
                : "Áudio desativado — vídeo mudo"
            }
            aria-label={generateAudio ? "Desativar áudio" : "Ativar áudio"}
            className={`flex h-6 items-center gap-1 rounded-md border px-2 font-mono text-[9px] uppercase tracking-widest transition-all ${
              generateAudio
                ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
                : "border-white/10 text-text-secondary hover:text-white"
            } ${isGenerating ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {generateAudio ? <Volume2 size={11} /> : <VolumeX size={11} />}
            Áudio
          </button>
        </div>
        <SegmentedControl
          value={tier}
          onChange={(v) => setReferenceModelTier(scene.id, v)}
          disabled={isGenerating}
          options={[
            { value: "standard", label: "Padrão", title: "Maior qualidade · até 1080p" },
            { value: "fast", label: "Rápido", title: "Menor latência e custo · até 720p" },
          ]}
        />
        <div className="mt-1.5 flex items-stretch gap-1.5">
          <div className="min-w-0 flex-1">
            <SegmentedControl
              value={resolution}
              onChange={(v) => setReferenceResolution(scene.id, v)}
              disabled={isGenerating}
              options={resolutionOptions}
            />
          </div>

          {/* Format (aspect ratio) — compact pill, short label, full names in
              the dropdown. */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setPresetOpen(false);
                setDurationOpen(false);
                setAspectOpen((v) => !v);
              }}
              title={`Proporção do vídeo · ${aspectLabel}`}
              className="flex h-full items-center gap-1 rounded-lg border border-white/10 px-2 transition-all hover:border-accent-gold/30"
            >
              <RectangleHorizontal size={11} className="shrink-0 text-text-secondary" />
              <span className="font-mono text-[10px] text-white">{aspectShort}</span>
              <ChevronDown
                size={11}
                className={`shrink-0 text-text-secondary transition-transform ${aspectOpen ? "rotate-180" : ""}`}
              />
            </button>

            {aspectOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAspectOpen(false)} />
                <div className="absolute bottom-full right-0 z-50 mb-1 w-[150px] overflow-hidden rounded-xl border border-white/10 bg-[#141412] py-1 shadow-xl">
                  {ASPECT_OPTIONS.map((opt) => {
                    const isActive = opt.value === aspectPref;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setReferenceAspectRatio(scene.id, opt.value);
                          setAspectOpen(false);
                        }}
                        className={`flex w-full items-center justify-between px-3 py-1.5 text-left font-mono text-[11px] transition-colors ${
                          isActive
                            ? "bg-accent-gold/5 text-accent-gold"
                            : "text-text-secondary hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {opt.label}
                        {isActive && <span className="text-[10px]">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Spacer pushes the generate footer to the bottom when content is short. */}
      <div className="min-h-3 flex-1" aria-hidden />

      {/* Generate video — pinned to the bottom of the inspector (always visible).
          Sticky keeps it in view while the content above scrolls. */}
      <div className="sticky bottom-0 z-10 -mx-3 -mb-3 mt-3 border-t border-white/5 bg-[#0A0A09] px-3 pb-3 pt-2.5">
        {generateError ? (
          <p className="mb-1.5 flex items-center gap-1 font-mono text-[10px] text-red-400">
            <AlertCircle size={11} /> {generateError}
          </p>
        ) : insufficientCredits && !isGenerating ? (
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-mono text-[10px] text-amber-400">
              <AlertCircle size={11} className="shrink-0" /> Créditos insuficientes —
              precisa de {estimate}, você tem {available}.
            </p>
            <Link
              href="/conta"
              className="flex shrink-0 items-center gap-1 rounded-full bg-accent-gold px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#0D0D0B] transition-opacity hover:opacity-90"
            >
              <CreditCard size={10} /> Comprar
            </Link>
          </div>
        ) : jobError && scene.status === "failed" && !isGenerating ? (
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] text-red-400">
            <AlertCircle size={11} className="shrink-0" /> {jobError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          title={
            insufficientCredits
              ? `Créditos insuficientes — precisa de ${estimate}, você tem ${available}`
              : canGenerate
                ? `Gerar vídeo de referência (${estimate} créditos)`
                : "Escolha um estilo e aguarde o prompt + upload das imagens"
          }
          className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-mono text-label-sm transition-all ${
            canGenerate
              ? "bg-accent-gold text-[#0D0D0B] hover:opacity-90"
              : "cursor-not-allowed border border-white/10 bg-white/[0.03] text-text-secondary/40"
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Gerando…
            </>
          ) : (
            <>
              <Video size={14} /> {isReady ? "Regerar vídeo" : "Gerar vídeo"}
              <span className="ml-0.5 opacity-70">· {estimate} cr.</span>
            </>
          )}
        </button>
      </div>

      {/* Manage presets drawer (admin): inspect / edit / add / save the
          video_reference recipes — including the hidden base director prompt. */}
      <RecipesDrawer
        mode="reference"
        open={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </>
  );
}
