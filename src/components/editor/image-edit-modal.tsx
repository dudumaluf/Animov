"use client";

import Image from "next/image";
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type CSSProperties,
} from "react";
import { X, Loader2, ImagePlus, Sparkles, BookOpen, RotateCcw, Palette } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { annotateTarget, formatMarkerLabel } from "@/lib/image/annotate-target";
import {
  buildComposerPrompt,
  type PositionedPlacement,
  type GlobalPlacement,
} from "@/lib/prompts/placement-system-prompt";
import { useRecipesStore } from "@/stores/recipes-store";
import type { Recipe } from "@/types/recipes";
import { RecipesDrawer } from "@/components/editor/recipes-drawer";
import { RecipeChip } from "@/components/editor/recipe-chip";
import { CompareSlider } from "@/components/editor/compare-slider";
import {
  AssetEditModal,
  type AssetEditResult,
} from "@/components/editor/asset-edit-modal";
import { AssetContextMenu } from "@/components/editor/asset-context-menu";
import { TransformedImage } from "@/components/editor/transformed-image";
import {
  DEFAULT_TRANSFORM,
  useProjectStore,
  type ImageBackground,
  type ImageTransform,
} from "@/stores/project-store";

const ASPECT_RATIOS = ["auto", "1:1", "16:9", "9:16", "3:2", "4:3", "4:5"];
const RESOLUTIONS = ["1K", "2K", "4K"];
const CREDIT_COST: Record<string, number> = { "1K": 1, "2K": 1, "4K": 2 };
const MAX_REFS = 8;
const ANALYZE_DEBOUNCE_MS = 500;

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const WHEEL_ZOOM_FACTOR = 0.0015;

/** CSS aspect-ratio strings keyed by the project's ExportAspectRatio. */
const ASPECT_CSS: Record<string, string> = {
  "16:9": "16 / 9",
  "9:16": "9 / 16",
  "1:1": "1 / 1",
  "4:5": "4 / 5",
};

/** Pre-set background colors offered in the popover. Custom = color picker. */
const COLOR_SWATCHES = [
  { id: "black", value: "#000000", label: "Preto" },
  { id: "white", value: "#FFFFFF", label: "Branco" },
  { id: "gray", value: "#1A1A19", label: "Cinza" },
] as const;

function clampScale(s: number): number {
  if (!Number.isFinite(s)) return 1;
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
}

type DropPoint = { x: number; y: number };

type ReferenceImage = {
  key: string;
  label: string;
  url: string;
  dataUrl?: string;
  file?: File;
  dropPoint?: DropPoint | null;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function DraggableRefChip({
  item,
  index,
  positionedIndex,
  busy,
  onRemove,
  onDoubleClick,
  onContextMenu,
}: {
  item: ReferenceImage;
  index: number;
  positionedIndex: number | null;
  busy?: boolean;
  onRemove: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (pos: { x: number; y: number }) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ref:${item.key}`,
    data: { type: "ref", refKey: item.key, refIndex: index },
  });

  return (
    <div className="group relative">
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick?.();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu?.({ x: e.clientX, y: e.clientY });
        }}
        className={`relative h-9 w-9 cursor-grab touch-none overflow-hidden rounded-lg border transition-opacity active:cursor-grabbing ${
          positionedIndex != null
            ? "border-accent-gold/60 ring-1 ring-accent-gold/30"
            : "border-white/10"
        } ${isDragging ? "opacity-30" : ""}`}
        title={
          positionedIndex != null
            ? `Marker ${positionedIndex} · duplo-clique para editar, clique-direito para receitas`
            : "Arraste para a imagem · duplo-clique para editar asset"
        }
      >
        {item.url ? (
          <Image
            src={item.url}
            alt={item.label}
            fill
            className="pointer-events-none object-cover"
            unoptimized
            draggable={false}
          />
        ) : null}
        {positionedIndex != null && (
          <span className="pointer-events-none absolute left-0 top-0 flex h-4 w-4 items-center justify-center rounded-br-md bg-accent-gold font-mono text-[9px] font-bold text-[#0D0D0B]">
            {positionedIndex}
          </span>
        )}
        {busy && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 size={12} className="animate-spin text-accent-gold" />
          </div>
        )}
      </div>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full border border-white/10 bg-black/90 text-white/60 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
        title="Remover"
      >
        <X size={8} />
      </button>
    </div>
  );
}

function PlacementMarker({
  markerIndex,
  x,
  y,
  refThumbUrl,
  refName,
  onClear,
}: {
  markerIndex: number;
  x: number;
  y: number;
  refThumbUrl: string;
  refName: string;
  onClear: () => void;
}) {
  return (
    <div
      className="pointer-events-auto absolute z-20"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        className="group relative flex h-[14px] w-[14px] items-center justify-center rounded-full bg-accent-gold shadow-[0_0_0_2px_rgba(0,0,0,0.6),0_0_12px_rgba(255,200,50,0.6)] transition-transform hover:scale-125"
        title={`${refName} — clique para desvincular`}
      >
        <span className="font-mono text-[8px] font-bold text-[#0D0D0B]">{markerIndex}</span>
      </button>
      <div className="pointer-events-none absolute left-[18px] top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-md border border-accent-gold/40 bg-black/75 p-0.5 pr-2 shadow-lg">
        <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded">
          <Image src={refThumbUrl} alt={refName} fill className="object-cover" unoptimized draggable={false} />
        </div>
        <span className="max-w-[120px] truncate font-mono text-[8px] text-white/70">{refName}</span>
      </div>
    </div>
  );
}

function DroppablePromptPanel({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver, active } = useDroppable({ id: "recipe-drop" });
  const dragData = active?.data.current as { type?: string } | undefined;
  const isActiveRecipe = dragData?.type === "recipe";
  return (
    <div
      ref={setNodeRef}
      className={`relative w-full rounded-2xl border bg-[#141412] p-3 shadow-2xl transition-colors ${
        isOver && isActiveRecipe
          ? "border-accent-gold/50 ring-2 ring-accent-gold/30"
          : "border-white/10"
      }`}
    >
      {children}
      {isOver && isActiveRecipe && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-accent-gold/5 backdrop-blur-[1px]">
          <span className="rounded-full bg-accent-gold/20 px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-accent-gold">
            Solte para anexar receita
          </span>
        </div>
      )}
    </div>
  );
}

function DroppableTarget({
  children,
  markers,
  onClearMarker,
  containerRef,
}: {
  children: React.ReactNode;
  markers: Array<{ markerIndex: number; refKey: string; x: number; y: number; refThumbUrl: string; refName: string }>;
  onClearMarker: (refKey: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "target-preview",
  });

  const combinedRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      if (containerRef) {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [setNodeRef, containerRef],
  );

  return (
    <div
      ref={combinedRef}
      className={`relative max-h-full max-w-full transition-shadow ${
        isOver ? "ring-2 ring-accent-gold/60 ring-offset-2 ring-offset-black/40" : ""
      }`}
    >
      {children}
      {markers.map((m) => (
        <PlacementMarker
          key={m.refKey}
          markerIndex={m.markerIndex}
          x={m.x}
          y={m.y}
          refThumbUrl={m.refThumbUrl}
          refName={m.refName}
          onClear={() => onClearMarker(m.refKey)}
        />
      ))}
      {isOver && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-accent-gold/20 px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-accent-gold backdrop-blur-sm">
            Solte para posicionar
          </span>
        </div>
      )}
    </div>
  );
}

export function ImageEditModal({
  imageUrl,
  onClose,
  onResult,
  currentTransform = null,
  onTransformChange,
}: {
  imageUrl: string;
  onClose: () => void;
  onResult: (editedUrl: string, mode: "replace" | "new_node") => void;
  /**
   * Existing image transform (pan/zoom/background) for this scene. Drives
   * the live preview so the user starts editing from where they left off.
   * `null` = cover-centered default.
   */
  currentTransform?: ImageTransform | null;
  /**
   * Persists the transform on the underlying scene. Called on every change
   * (drag / wheel / reset / background swap) — there's no commit/cancel
   * step now, since edits are direct manipulation.
   */
  onTransformChange?: (transform: ImageTransform | null) => void;
}) {
  const exportAspectRatio = useProjectStore((s) => s.exportAspectRatio);
  const [prompt, setPrompt] = useState("");
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [aspectRatio, setAspectRatio] = useState("auto");
  const [resolution, setResolution] = useState("1K");
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maxRefsWarning, setMaxRefsWarning] = useState(false);
  const [activeDragRefKey, setActiveDragRefKey] = useState<string | null>(null);
  const [activeDragRecipe, setActiveDragRecipe] = useState<Recipe | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzerError, setAnalyzerError] = useState<string | null>(null);
  const [placementData, setPlacementData] = useState<{
    key: string;
    markers: Array<{ index: number; description: string }>;
  } | null>(null);
  const [attachedRecipe, setAttachedRecipe] = useState<Recipe | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assetEditing, setAssetEditing] = useState<{
    key: string;
    initialRecipe?: Recipe | null;
  } | null>(null);
  const [assetContextMenu, setAssetContextMenu] = useState<{
    key: string;
    x: number;
    y: number;
  } | null>(null);
  const [quickActionBusy, setQuickActionBusy] = useState<{
    refKey: string;
    recipeId: string;
  } | null>(null);
  const recipesStore = useRecipesStore();
  const { refresh: refreshRecipes } = recipesStore;
  const refInputRef = useRef<HTMLInputElement>(null);
  const pendingRefKey = useRef<string | null>(null);
  const targetContainerRef = useRef<HTMLDivElement | null>(null);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const lastAnalyzeKeyRef = useRef<string>("");

  // --- Image transform state (pan/zoom/background within global frame) ---
  // Local mirror of the persisted transform so drag gestures feel snappy
  // without bouncing through the project store on every pointermove.
  const [transform, setTransform] = useState<ImageTransform>(
    currentTransform ?? DEFAULT_TRANSFORM,
  );
  // Source image natural dimensions, used by the dimension chip overlay.
  const [sourceImgDims, setSourceImgDims] = useState<{ w: number; h: number } | null>(null);
  // Live container size (set by ResizeObserver on the preview wrapper) — pan
  // deltas are converted from pixels to normalized canvas units using this.
  const [previewSize, setPreviewSize] = useState<{ w: number; h: number } | null>(null);
  // Background popover open state. Anchored to the Palette button.
  const [bgPopoverOpen, setBgPopoverOpen] = useState(false);
  // True while the user is actively dragging the image. Used to switch the
  // cursor and short-circuit other pointer handlers (recipes drop, etc.).
  const [isPanning, setIsPanning] = useState(false);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    moved: boolean;
  } | null>(null);

  // Re-sync local transform when the parent updates `currentTransform`
  // (e.g. switching scenes while the modal is open, though in practice we
  // remount). Keeps a single source of truth without forcing the parent to
  // throttle.
  useEffect(() => {
    setTransform(currentTransform ?? DEFAULT_TRANSFORM);
  }, [currentTransform]);

  // Push transform changes upward. Treats DEFAULT == null so the scene's
  // imageTransform field stays empty when the user hasn't customized.
  const commitTransform = useCallback(
    (next: ImageTransform) => {
      setTransform(next);
      if (!onTransformChange) return;
      const isDefault =
        next.scale === DEFAULT_TRANSFORM.scale &&
        next.offsetX === DEFAULT_TRANSFORM.offsetX &&
        next.offsetY === DEFAULT_TRANSFORM.offsetY &&
        !next.background;
      onTransformChange(isDefault ? null : next);
    },
    [onTransformChange],
  );

  const resetTransform = useCallback(() => {
    commitTransform(DEFAULT_TRANSFORM);
  }, [commitTransform]);

  const setBackground = useCallback(
    (bg: ImageBackground | null) => {
      const next: ImageTransform = { ...transform };
      if (bg) {
        next.background = bg;
      } else {
        delete next.background;
      }
      commitTransform(next);
    },
    [transform, commitTransform],
  );

  // ResizeObserver on the preview wrapper so pan deltas convert correctly
  // even as the user resizes the window or as adjacent panels grow/shrink.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setPreviewSize({ w: rect.width, h: rect.height });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pan via pointer drag. We capture the pointer so the gesture survives
  // the cursor leaving the image bounds. dnd-kit markers use a separate
  // sensor (PointerSensor with activation distance), so this handler only
  // fires for direct image clicks; refs dragged from the dock land via
  // dnd's drop logic and don't trigger pan.
  const onPanPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      // Don't initiate pan when the user is dropping a marker or interacting
      // with overlay buttons (background, reset).
      const targetEl = e.target as HTMLElement;
      if (targetEl.closest("[data-pan-ignore]")) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      panStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: transform.offsetX,
        startOffsetY: transform.offsetY,
        moved: false,
      };
      setIsPanning(true);
    },
    [transform.offsetX, transform.offsetY],
  );

  const onPanPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const st = panStateRef.current;
      if (!st || st.pointerId !== e.pointerId) return;
      if (!previewSize) return;
      const dxPx = e.clientX - st.startX;
      const dyPx = e.clientY - st.startY;
      if (!st.moved && Math.hypot(dxPx, dyPx) > 2) st.moved = true;
      const dxNorm = dxPx / previewSize.w;
      const dyNorm = dyPx / previewSize.h;
      setTransform((prev) => ({
        ...prev,
        offsetX: st.startOffsetX + dxNorm,
        offsetY: st.startOffsetY + dyNorm,
      }));
    },
    [previewSize],
  );

  const onPanPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const st = panStateRef.current;
      if (!st || st.pointerId !== e.pointerId) return;
      panStateRef.current = null;
      setIsPanning(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer capture may already be released */
      }
      // Commit to parent once the gesture ends so we don't spam onChange.
      if (st.moved) {
        commitTransform({
          ...transform,
          offsetX: transform.offsetX,
          offsetY: transform.offsetY,
        });
      }
    },
    [transform, commitTransform],
  );

  // Wheel = zoom. Pinch on trackpads also surfaces here (delta with
  // `ctrlKey=true`). We anchor zoom to the image center for now (anchoring
  // to cursor would require remapping offsets, deferred to v2).
  const onPanWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * WHEEL_ZOOM_FACTOR);
      const next: ImageTransform = {
        ...transform,
        scale: clampScale(transform.scale * factor),
      };
      commitTransform(next);
    },
    [transform, commitTransform],
  );

  useEffect(() => {
    void refreshRecipes();
  }, [refreshRecipes]);

  useEffect(() => {
    // Pre-fetch source dimensions for the dimension chip overlay so it
    // appears immediately on modal open (no need to wait for the preview
    // to mount). `document.createElement` is used here because the `Image`
    // identifier in this file resolves to next/image.
    if (!imageUrl) return;
    const probe = document.createElement("img");
    probe.onload = () => {
      if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
        setSourceImgDims({ w: probe.naturalWidth, h: probe.naturalHeight });
      }
    };
    probe.src = imageUrl;
    return () => {
      probe.onload = null;
    };
  }, [imageUrl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // `C` resets the transform to cover-centered (mneumônico Cover/Center).
      // Skip when the user is typing into a field so it doesn't intercept
      // legitimate keystrokes.
      if (e.key !== "c" && e.key !== "C") return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      e.preventDefault();
      resetTransform();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resetTransform]);

  const attachedRecipeCategory = useMemo(
    () =>
      attachedRecipe
        ? recipesStore.categories.find(
            (c) => c.id === attachedRecipe.category_id,
          ) ?? undefined
        : undefined,
    [attachedRecipe, recipesStore.categories],
  );

  const positionedRefs = useMemo(
    () => references.filter((r) => r.dropPoint),
    [references],
  );

  const refKeyToMarkerIndex = useMemo(() => {
    const map = new Map<string, number>();
    positionedRefs.forEach((r, i) => map.set(r.key, i + 1));
    return map;
  }, [positionedRefs]);

  const markers = useMemo(
    () =>
      positionedRefs.map((r) => ({
        markerIndex: refKeyToMarkerIndex.get(r.key) ?? 0,
        refKey: r.key,
        x: r.dropPoint!.x,
        y: r.dropPoint!.y,
        refThumbUrl: r.url,
        refName: r.label,
      })),
    [positionedRefs, refKeyToMarkerIndex],
  );

  const cycleAspectRatio = () => {
    const idx = ASPECT_RATIOS.indexOf(aspectRatio);
    setAspectRatio(ASPECT_RATIOS[(idx + 1) % ASPECT_RATIOS.length]!);
  };

  const cycleResolution = () => {
    const idx = RESOLUTIONS.indexOf(resolution);
    setResolution(RESOLUTIONS[(idx + 1) % RESOLUTIONS.length]!);
  };

  const addReference = () => {
    if (references.length >= MAX_REFS) {
      setMaxRefsWarning(true);
      setTimeout(() => setMaxRefsWarning(false), 2500);
      return;
    }
    pendingRefKey.current = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    refInputRef.current?.click();
  };

  const handleRefFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingRefKey.current) return;
    const url = URL.createObjectURL(file);
    const dataUrl = await fileToDataUrl(file);
    const key = pendingRefKey.current;

    setReferences((prev) => {
      if (prev.length >= MAX_REFS) return prev;
      return [
        ...prev,
        {
          key,
          label: file.name.replace(/\.[^.]+$/, "").slice(0, 24) || `Ref ${prev.length + 1}`,
          url,
          dataUrl,
          file,
          dropPoint: null,
        },
      ];
    });

    e.target.value = "";
    pendingRefKey.current = null;
  };

  const removeRef = (key: string) => {
    setReferences((prev) => prev.filter((r) => r.key !== key));
  };

  const clearDropPoint = useCallback((key: string) => {
    setReferences((prev) =>
      prev.map((r) => (r.key === key ? { ...r, dropPoint: null } : r)),
    );
  }, []);

  const setDropPoint = useCallback((key: string, point: DropPoint) => {
    setReferences((prev) =>
      prev.map((r) => (r.key === key ? { ...r, dropPoint: point } : r)),
    );
  }, []);

  const replaceRefAsset = useCallback(
    (key: string, result: AssetEditResult) => {
      setReferences((prev) =>
        prev.map((r) =>
          r.key === key
            ? {
                ...r,
                url: result.url,
                dataUrl: result.dataUrl ?? undefined,
                file: undefined,
              }
            : r,
        ),
      );
    },
    [],
  );

  const applyQuickRecipeToRef = useCallback(
    async (refKey: string, recipe: Recipe) => {
      const target = references.find((r) => r.key === refKey);
      if (!target) return;

      setQuickActionBusy({ refKey, recipeId: recipe.id });
      setError(null);
      try {
        // Prefer HTTPS URL (Supabase) to avoid Vercel's 4.5MB body cap;
        // fallback to dataUrl only for pending/unsaved references.
        const sourceUrl =
          target.url && target.url.startsWith("https://")
            ? target.url
            : target.dataUrl ?? target.url;

        const composeRes = await fetch(
          "/api/edit-image/compose-from-recipe",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipeId: recipe.id,
              targetImageUrl: sourceUrl,
            }),
          },
        );
        if (!composeRes.ok) {
          const err = (await composeRes.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(err?.error ?? "Falha ao compor receita");
        }
        const composeData = (await composeRes.json()) as { prompt?: string };
        if (!composeData.prompt || !composeData.prompt.trim()) {
          throw new Error("Receita não retornou prompt");
        }

        const editRes = await fetch("/api/edit-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: composeData.prompt,
            sourceImageUrl: sourceUrl,
            referenceImageUrls: [],
            aspectRatio: "auto",
            resolution: "1K",
          }),
        });
        if (!editRes.ok) {
          const err = (await editRes.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(err?.error ?? "Falha ao editar asset");
        }
        const editData = (await editRes.json()) as { imageUrl: string };
        replaceRefAsset(refKey, { url: editData.imageUrl });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Quick action failed");
      } finally {
        setQuickActionBusy(null);
      }
    },
    [references, replaceRefAsset],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragStart = useCallback(
    (e: DragStartEvent) => {
      const data = e.active.data.current as
        | { type?: string; refKey?: string; recipeId?: string }
        | undefined;
      if (data?.type === "recipe" && data.recipeId) {
        const recipe = recipesStore.recipes.find(
          (r) => r.id === data.recipeId,
        );
        setActiveDragRecipe(recipe ?? null);
        setActiveDragRefKey(null);
        return;
      }
      if (data?.refKey) {
        setActiveDragRefKey(data.refKey);
        setActiveDragRecipe(null);
      }
    },
    [recipesStore.recipes],
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const data = e.active.data.current as
        | { type?: string; refKey?: string; recipeId?: string }
        | undefined;
      setActiveDragRefKey(null);
      setActiveDragRecipe(null);

      if (data?.type === "recipe") {
        if (e.over?.id === "recipe-drop" && data.recipeId) {
          const recipe = recipesStore.recipes.find(
            (r) => r.id === data.recipeId,
          );
          if (recipe) setAttachedRecipe(recipe);
        }
        return;
      }

      if (!data?.refKey) return;
      if (e.over?.id !== "target-preview") return;

      const rect = targetContainerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const activatorEvent = e.activatorEvent as PointerEvent | null;
      const startX = activatorEvent?.clientX ?? 0;
      const startY = activatorEvent?.clientY ?? 0;
      const clientX = startX + (e.delta?.x ?? 0);
      const clientY = startY + (e.delta?.y ?? 0);

      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;

      if (x < 0 || x > 1 || y < 0 || y > 1) return;

      setDropPoint(data.refKey, { x, y });
    },
    [setDropPoint, recipesStore.recipes],
  );

  const onDragCancel = useCallback(() => {
    setActiveDragRefKey(null);
    setActiveDragRecipe(null);
  }, []);

  useEffect(() => {
    return () => {
      references.forEach((r) => {
        if (r.url.startsWith("blob:")) URL.revokeObjectURL(r.url);
      });
    };
  }, [references]);

  // Keyed off marker geometry only — changes to the prompt textarea do NOT
  // invalidate placementData, so typing never re-triggers the analyzer.
  const analyzerKey = useMemo(() => {
    if (positionedRefs.length === 0) return "";
    return [
      imageUrl,
      ...positionedRefs.map(
        (r, i) =>
          `${i + 1}:${r.key}|${r.label}|${r.dropPoint!.x.toFixed(3)},${r.dropPoint!.y.toFixed(3)}`,
      ),
    ].join("§");
  }, [imageUrl, positionedRefs]);

  // Shared analyzer: used both by the debounced effect AND by generate()
  // as a fallback if the user clicks before the debounce fires.
  const runAnalyze = useCallback(
    async (
      positioned: ReferenceImage[],
      signal?: AbortSignal,
    ): Promise<Array<{ index: number; description: string }>> => {
      const annotationMarkers = positioned.map((r, i) => ({
        x: r.dropPoint!.x,
        y: r.dropPoint!.y,
        label: formatMarkerLabel(i + 1, r.label),
      }));
      const annotatedUrl = await annotateTarget(imageUrl, annotationMarkers);

      const payload = {
        annotatedTargetUrl: annotatedUrl,
        references: positioned.map((r, i) => ({
          index: i + 1,
          name: r.label,
          positioned: true,
        })),
      };

      const res = await fetch("/api/edit-image/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Analyze failed (${res.status})`);
      }

      const data = (await res.json()) as {
        markers: Array<{ index: number; description: string }>;
      };
      return data.markers ?? [];
    },
    [imageUrl],
  );

  useEffect(() => {
    if (resultUrl) return;
    if (!analyzerKey) {
      lastAnalyzeKeyRef.current = "";
      setAnalyzerError(null);
      setPlacementData(null);
      if (analyzeAbortRef.current) {
        analyzeAbortRef.current.abort();
        analyzeAbortRef.current = null;
        setAnalyzing(false);
      }
      return;
    }

    if (analyzerKey === lastAnalyzeKeyRef.current) return;

    const handle = window.setTimeout(async () => {
      lastAnalyzeKeyRef.current = analyzerKey;

      if (analyzeAbortRef.current) analyzeAbortRef.current.abort();
      const controller = new AbortController();
      analyzeAbortRef.current = controller;

      try {
        setAnalyzing(true);
        setAnalyzerError(null);

        const currentPositioned = references.filter((r) => r.dropPoint);
        if (currentPositioned.length === 0) return;

        const markers = await runAnalyze(currentPositioned, controller.signal);
        if (controller.signal.aborted) return;

        if (markers.length === 0) {
          throw new Error("Descrição automática vazia");
        }

        setPlacementData({ key: analyzerKey, markers });
      } catch (err) {
        if (controller.signal.aborted) return;
        if ((err as Error).name === "AbortError") return;
        setAnalyzerError(err instanceof Error ? err.message : "Analyze failed");
        setPlacementData(null);
      } finally {
        if (analyzeAbortRef.current === controller) {
          analyzeAbortRef.current = null;
        }
        setAnalyzing(false);
      }
    }, ANALYZE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
    };
  }, [analyzerKey, references, resultUrl, runAnalyze]);

  useEffect(() => {
    return () => {
      if (analyzeAbortRef.current) analyzeAbortRef.current.abort();
    };
  }, []);

  const generate = useCallback(async () => {
    if (generating) return;

    const positioned = references.filter((r) => r.dropPoint);
    const globals = references.filter((r) => !r.dropPoint);
    const hasPositioned = positioned.length > 0;
    const hasRecipe = !!attachedRecipe;

    // Need: a prompt OR a recipe OR a positioned ref (which composes a prompt).
    if (!hasPositioned && !hasRecipe && !prompt.trim()) return;

    setGenerating(true);
    setError(null);

    try {
      let finalPrompt = prompt.trim();
      let markers: Array<{ index: number; description: string }> | null = null;

      if (hasPositioned) {
        markers =
          placementData?.key === analyzerKey ? placementData.markers : null;
        if (!markers) {
          if (analyzeAbortRef.current) {
            analyzeAbortRef.current.abort();
            analyzeAbortRef.current = null;
          }
          setAnalyzing(true);
          try {
            markers = await runAnalyze(positioned);
          } finally {
            setAnalyzing(false);
          }
          if (markers.length === 0) {
            throw new Error("Não consegui descrever as posições dos markers");
          }
          lastAnalyzeKeyRef.current = analyzerKey;
          setPlacementData({ key: analyzerKey, markers });
        }
      }

      // CLEAN image order: positioned first so image[1]..image[N] match marker
      // numbers, then global refs. Classic flow keeps original ref order.
      const orderedRefs = hasPositioned
        ? [...positioned, ...globals]
        : references;
      // Prefer HTTPS URLs (Supabase / fal) over inline dataUrls to avoid
      // Vercel's 4.5MB body cap on /api/edit-image JSON payloads.
      const refUrls = orderedRefs
        .filter((r) => r.dataUrl || r.url)
        .map((r) =>
          r.url && r.url.startsWith("https://") ? r.url : r.dataUrl ?? r.url,
        );

      if (hasRecipe) {
        // Recipe flow: have the server compose the final prompt, with optional
        // marker context and user hint passed through.
        const composeRes = await fetch(
          "/api/edit-image/compose-from-recipe",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipeId: attachedRecipe.id,
              targetImageUrl: imageUrl,
              referenceUrls: refUrls,
              markers:
                markers && hasPositioned
                  ? markers.map((m) => ({
                      index: m.index,
                      name:
                        positioned[m.index - 1]?.label ?? `ref ${m.index}`,
                    }))
                  : undefined,
              userHint: prompt.trim() || undefined,
            }),
          },
        );
        if (!composeRes.ok) {
          const err = (await composeRes.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(err?.error ?? "Falha ao compor receita");
        }
        const composeData = (await composeRes.json()) as {
          prompt?: string;
          warning?: string;
        };
        if (!composeData.prompt || !composeData.prompt.trim()) {
          throw new Error("Receita não retornou prompt");
        }
        finalPrompt = composeData.prompt;
      } else if (hasPositioned) {
        const positionedPlacements: PositionedPlacement[] = positioned.map(
          (r, i) => {
            const found = markers!.find((m) => m.index === i + 1);
            return {
              index: i + 1,
              name: r.label,
              description:
                found?.description?.trim() ??
                "no local exato do marker, respeitando superfícies e objetos adjacentes",
            };
          },
        );

        const globalPlacements: GlobalPlacement[] = globals.map((r, i) => ({
          index: positioned.length + i + 1,
          name: r.label,
        }));

        finalPrompt = buildComposerPrompt({
          positioned: positionedPlacements,
          global: globalPlacements,
          userHint: prompt.trim() || undefined,
        });
      }

      const res = await fetch("/api/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
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
  }, [
    prompt,
    imageUrl,
    references,
    aspectRatio,
    resolution,
    generating,
    placementData,
    analyzerKey,
    runAnalyze,
    attachedRecipe,
  ]);

  const displayUrl = resultUrl ?? imageUrl;

  const activeDragRef = activeDragRefKey ? references.find((r) => r.key === activeDragRefKey) ?? null : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0A09]/95">
        <input
          ref={refInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleRefFile}
        />

        <div className="relative flex flex-1 items-center justify-center overflow-hidden p-8">
          {sourceImgDims && (
            // Minimal dimension indicator: source resolution and the current
            // zoom level. Top-left so it never collides with the
            // background/reset toolbar in the top-right.
            <div
              className="pointer-events-none absolute left-4 top-4 z-30 flex flex-col gap-0.5 rounded-md bg-black/40 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-white/60 backdrop-blur-sm"
              aria-hidden
            >
              <span>
                {sourceImgDims.w} × {sourceImgDims.h}
              </span>
              {transform.scale !== 1 && (
                <span className="text-accent-gold/90">
                  ↳ {transform.scale.toFixed(2)}×
                </span>
              )}
            </div>
          )}
          {resultUrl ? (
            <CompareSlider originalUrl={imageUrl} editedUrl={resultUrl} />
          ) : (
            <DroppableTarget
              containerRef={targetContainerRef}
              markers={markers}
              onClearMarker={clearDropPoint}
            >
              {/* Interactive transform preview. The wrapper takes 75vh so
                  the global frame stays consistently large; aspect of the
                  rendered canvas comes from the project's exportAspectRatio
                  via TransformedImage. Pointer events drive pan; wheel
                  drives zoom. dnd-kit markers continue to work because their
                  draggable sources live elsewhere — the drop target itself
                  doesn't initiate drags. */}
              <div
                ref={previewRef}
                onPointerDown={onPanPointerDown}
                onPointerMove={onPanPointerMove}
                onPointerUp={onPanPointerUp}
                onPointerCancel={onPanPointerUp}
                onWheel={onPanWheel}
                style={{
                  height: "75vh",
                  aspectRatio: ASPECT_CSS[exportAspectRatio],
                  cursor: isPanning ? "grabbing" : "grab",
                  touchAction: "none",
                } as CSSProperties}
                className="relative max-h-full max-w-full overflow-hidden rounded-xl select-none"
              >
                <TransformedImage
                  src={displayUrl}
                  transform={transform}
                  aspectRatio={exportAspectRatio}
                  alt="Edit preview"
                  className="h-full w-full"
                  objectFit="cover"
                  draggable={false}
                />
              </div>

              {/* Top-right toolbar: reset + background popover. */}
              <div
                data-pan-ignore
                className="absolute right-2 top-2 z-30 flex items-center gap-1 rounded-xl bg-[#0A0A09]/90 px-2 py-1.5 backdrop-blur-sm"
              >
                <button
                  type="button"
                  onClick={resetTransform}
                  className="flex h-7 items-center gap-1 rounded-md px-2 font-mono text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:text-white"
                  title="Reset (C)"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setBgPopoverOpen((v) => !v)}
                    className={`flex h-7 items-center gap-1 rounded-md px-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                      bgPopoverOpen
                        ? "bg-white/10 text-accent-gold"
                        : "text-text-secondary hover:text-white"
                    }`}
                    title="Fundo (área fora da imagem)"
                  >
                    <Palette size={12} />
                    Fundo
                  </button>
                  {bgPopoverOpen && (
                    <div className="absolute right-0 top-full z-40 mt-1 flex w-[180px] flex-col gap-2 rounded-xl border border-white/10 bg-[#0A0A09]/95 p-2 shadow-2xl backdrop-blur-sm">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-text-secondary">
                        Fundo
                      </span>
                      <div className="flex items-center gap-1.5">
                        {COLOR_SWATCHES.map((sw) => {
                          const active =
                            transform.background?.type === "color" &&
                            transform.background.color.toLowerCase() ===
                              sw.value.toLowerCase();
                          return (
                            <button
                              key={sw.id}
                              type="button"
                              onClick={() =>
                                setBackground({
                                  type: "color",
                                  color: sw.value,
                                })
                              }
                              className={`h-7 w-7 rounded-md border transition-transform ${
                                active
                                  ? "scale-110 border-accent-gold"
                                  : "border-white/15 hover:scale-105"
                              }`}
                              style={{ backgroundColor: sw.value }}
                              title={sw.label}
                            />
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setBackground({ type: "blur" })}
                          className={`flex h-7 items-center justify-center rounded-md border px-2 font-mono text-[9px] uppercase transition-colors ${
                            transform.background?.type === "blur"
                              ? "border-accent-gold text-accent-gold"
                              : "border-white/15 text-text-secondary hover:text-white"
                          }`}
                          title="Blur (extensão suave da imagem)"
                        >
                          Blur
                        </button>
                      </div>
                      <label className="flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-widest text-text-secondary">
                        <span>Custom</span>
                        <input
                          type="color"
                          value={
                            transform.background?.type === "color"
                              ? transform.background.color
                              : "#000000"
                          }
                          onChange={(e) =>
                            setBackground({
                              type: "color",
                              color: e.target.value,
                            })
                          }
                          className="h-6 w-10 cursor-pointer rounded border border-white/15 bg-transparent"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setBackground(null)}
                        className="rounded-md px-2 py-1 text-left font-mono text-[9px] uppercase tracking-widest text-text-secondary transition-colors hover:text-red-400"
                      >
                        Limpar (preto padrão)
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {generating && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                  <Loader2 size={24} className="animate-spin text-accent-gold" />
                </div>
              )}
            </DroppableTarget>
          )}
        </div>

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

        <div className="flex justify-center px-4 pb-6">
          <div className="w-full max-w-2xl">
            <DroppablePromptPanel>
              {(references.length > 0 || attachedRecipe) && (
                <div className="mb-2 flex items-center gap-2">
                  {references.map((refItem, i) => (
                    <DraggableRefChip
                      key={refItem.key}
                      item={refItem}
                      index={i}
                      positionedIndex={
                        refKeyToMarkerIndex.get(refItem.key) ?? null
                      }
                      busy={quickActionBusy?.refKey === refItem.key}
                      onRemove={() => removeRef(refItem.key)}
                      onDoubleClick={() =>
                        setAssetEditing({ key: refItem.key })
                      }
                      onContextMenu={(pos) =>
                        setAssetContextMenu({
                          key: refItem.key,
                          x: pos.x,
                          y: pos.y,
                        })
                      }
                    />
                  ))}
                  {attachedRecipe && (
                    <div className="ml-auto">
                      <RecipeChip
                        recipe={attachedRecipe}
                        category={attachedRecipeCategory}
                        onRemove={() => setAttachedRecipe(null)}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={addReference}
                  disabled={references.length >= MAX_REFS}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-text-secondary transition-colors hover:border-accent-gold/30 hover:text-accent-gold disabled:cursor-not-allowed disabled:opacity-30"
                  title={
                    references.length >= MAX_REFS
                      ? `Máximo ${MAX_REFS} referências`
                      : "Adicionar referência"
                  }
                >
                  <ImagePlus size={13} />
                </button>
                <button
                  onClick={() => setDrawerOpen((v) => !v)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                    drawerOpen
                      ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
                      : "border-white/10 text-text-secondary hover:border-accent-gold/30 hover:text-accent-gold"
                  }`}
                  title="Abrir receitas"
                >
                  <BookOpen size={13} />
                </button>
                <div className="relative flex-1">
                  <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) generate();
                    }}
                    placeholder={
                      attachedRecipe
                        ? `Hint opcional para "${attachedRecipe.short_label}"…`
                        : positionedRefs.length > 0
                          ? "Hint opcional (ex.: substitua o sofá existente)…"
                          : "Descreva a edição…"
                    }
                    className="w-full bg-transparent font-mono text-[12px] text-[var(--text)] placeholder:text-text-secondary focus:outline-none"
                  />
                  {analyzing && (
                    <Loader2
                      size={12}
                      className="absolute right-0 top-1/2 -translate-y-1/2 animate-spin text-accent-gold"
                    />
                  )}
                </div>
                <button
                  onClick={generate}
                  disabled={
                    generating ||
                    (!attachedRecipe &&
                      positionedRefs.length === 0 &&
                      !prompt.trim())
                  }
                  className="shrink-0 rounded-lg bg-accent-gold px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#0D0D0B] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {generating ? "..." : "Gerar"}
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={cycleAspectRatio}
                    className="font-mono text-[9px] uppercase text-text-secondary transition-colors hover:text-accent-gold"
                  >
                    {aspectRatio}
                  </button>
                  <span className="text-white/10">·</span>
                  <button
                    onClick={cycleResolution}
                    className="font-mono text-[9px] uppercase text-text-secondary transition-colors hover:text-accent-gold"
                  >
                    {resolution}
                  </button>
                </div>
                <span className="font-mono text-[9px] text-text-secondary">
                  {CREDIT_COST[resolution] ?? 1} cr.
                </span>
              </div>

              {placementData &&
                placementData.key === analyzerKey &&
                !error && (
                  <div className="mt-2 space-y-1 border-t border-white/5 pt-2">
                    {placementData.markers.map((m) => (
                      <div key={m.index} className="flex items-start gap-1.5">
                        <Sparkles
                          size={10}
                          className="mt-[2px] shrink-0 text-accent-gold/60"
                        />
                        <p className="font-mono text-[10px] leading-relaxed text-text-secondary">
                          <span className="text-accent-gold/80">
                            #{m.index}
                          </span>{" "}
                          {m.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              {analyzerError && !error && (
                <p className="mt-2 font-mono text-[10px] text-amber-400/80">
                  Não consegui descrever o local automaticamente — você ainda
                  pode escrever um prompt manual
                </p>
              )}
              {error && (
                <p className="mt-2 font-mono text-[10px] text-red-400">
                  {error}
                </p>
              )}
              {maxRefsWarning && (
                <p className="mt-2 font-mono text-[10px] text-accent-gold/90">
                  Máximo de {MAX_REFS} referências por edição
                </p>
              )}
            </DroppablePromptPanel>
          </div>
        </div>

        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>

        <RecipesDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          mode="target"
        />

        {assetEditing
          ? (() => {
              const refItem = references.find((r) => r.key === assetEditing.key);
              if (!refItem) return null;
              return (
                <AssetEditModal
                  sourceUrl={
                    refItem.url && refItem.url.startsWith("https://")
                      ? refItem.url
                      : refItem.dataUrl ?? refItem.url
                  }
                  sourceLabel={refItem.label}
                  initialRecipe={assetEditing.initialRecipe ?? null}
                  onClose={() => setAssetEditing(null)}
                  onApply={(result) => {
                    replaceRefAsset(assetEditing.key, result);
                    setAssetEditing(null);
                  }}
                />
              );
            })()
          : null}

        {assetContextMenu
          ? (() => {
              const assetRecipes = recipesStore.recipes
                .filter(
                  (r) =>
                    r.active &&
                    r.user_visible &&
                    (r.scope === "asset" || r.scope === "any"),
                )
                .slice(0, 6);
              const categoriesById = new Map(
                recipesStore.categories.map((c) => [c.id, c]),
              );
              return (
                <AssetContextMenu
                  x={assetContextMenu.x}
                  y={assetContextMenu.y}
                  quickRecipes={assetRecipes}
                  categoriesById={categoriesById}
                  runningRecipeId={
                    quickActionBusy?.refKey === assetContextMenu.key
                      ? quickActionBusy.recipeId
                      : null
                  }
                  onQuickAction={(recipe) => {
                    void applyQuickRecipeToRef(assetContextMenu.key, recipe);
                    setAssetContextMenu(null);
                  }}
                  onOpenEdit={() => {
                    setAssetEditing({ key: assetContextMenu.key });
                    setAssetContextMenu(null);
                  }}
                  onRemove={() => {
                    removeRef(assetContextMenu.key);
                    setAssetContextMenu(null);
                  }}
                  onClose={() => setAssetContextMenu(null)}
                />
              );
            })()
          : null}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragRef ? (
          <div className="pointer-events-none h-10 w-10 overflow-hidden rounded-lg border border-accent-gold/60 opacity-90 shadow-2xl ring-1 ring-accent-gold/30">
            <Image src={activeDragRef.url} alt={activeDragRef.label} width={40} height={40} className="h-full w-full object-cover" unoptimized draggable={false} />
          </div>
        ) : activeDragRecipe ? (
          <div
            className="pointer-events-none inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[10px] uppercase tracking-wider shadow-2xl"
            style={{
              backgroundColor: `rgba(var(--rc-${
                recipesStore.categories.find(
                  (c) => c.id === activeDragRecipe.category_id,
                )?.color_token ?? "polish"
              }) / 0.2)`,
              borderColor: `rgba(var(--rc-${
                recipesStore.categories.find(
                  (c) => c.id === activeDragRecipe.category_id,
                )?.color_token ?? "polish"
              }) / 0.6)`,
              color: `rgb(var(--rc-${
                recipesStore.categories.find(
                  (c) => c.id === activeDragRecipe.category_id,
                )?.color_token ?? "polish"
              }))`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: `rgb(var(--rc-${
                  recipesStore.categories.find(
                    (c) => c.id === activeDragRecipe.category_id,
                  )?.color_token ?? "polish"
                }))`,
              }}
            />
            {activeDragRecipe.short_label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
