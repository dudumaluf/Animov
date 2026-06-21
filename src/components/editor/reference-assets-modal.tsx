"use client";

import { create } from "zustand";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  CopyPlus,
  Gem,
  GripVertical,
  Home,
  ImagePlus,
  Layers,
  Loader2,
  Package,
  Pencil,
  RefreshCw,
  Trash2,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useProjectStore,
  type ReferenceImage,
  type ReferenceRole,
} from "@/stores/project-store";
import { REFERENCE_MAX_IMAGES } from "@/lib/adapters/seedance-reference";
import { AssetEditModal } from "@/components/editor/asset-edit-modal";

/**
 * Backs the reference "Assets" panel. Opened from the reference-group node's
 * Assets button. Mounted once globally so the node doesn't need prop drilling.
 */
type ReferenceAssetsState = {
  sceneId: string | null;
  open: (sceneId: string) => void;
  close: () => void;
};

export const useReferenceAssetsStore = create<ReferenceAssetsState>((set) => ({
  sceneId: null,
  open: (sceneId) => set({ sceneId }),
  close: () => set({ sceneId: null }),
}));

const ROLE_LABELS: Record<ReferenceRole, string> = {
  environment: "Ambiente",
  person: "Pessoa",
  detail: "Detalhe",
  product: "Produto",
};

const ROLE_ICONS: Record<ReferenceRole, LucideIcon> = {
  environment: Home,
  person: User,
  detail: Gem,
  product: Package,
};

const ROLE_ORDER: ReferenceRole[] = ["environment", "person", "detail", "product"];

type ContextMenuState = { x: number; y: number; imageId: string };

function ReferenceImageContextMenu({
  x,
  y,
  image,
  reanalyzing,
  atLimit,
  onReanalyze,
  onDuplicate,
  onEdit,
  onSetRole,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  image: ReferenceImage;
  reanalyzing: boolean;
  atLimit: boolean;
  onReanalyze: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onSetRole: (role: ReferenceRole) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;
  const isBlob = image.url.startsWith("blob:");

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10000]"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-[10001] min-w-[200px] overflow-hidden rounded-lg border border-white/10 bg-[#141412] py-1 shadow-2xl"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onReanalyze}
          disabled={isBlob || reanalyzing}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[10.5px] text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {reanalyzing ? (
            <Loader2 size={11} className="animate-spin text-accent-gold" />
          ) : (
            <RefreshCw size={11} className="text-text-secondary" />
          )}
          Reanalisar imagem
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          disabled={atLimit}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[10.5px] text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CopyPlus size={11} className="text-text-secondary" />
          Duplicar
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={isBlob}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[10.5px] text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Pencil size={11} className="text-text-secondary" />
          Editar imagem…
        </button>

        <div className="my-1 border-t border-white/5" />
        <p className="px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary">
          Papel
        </p>
        {ROLE_ORDER.map((role) => {
          const Icon = ROLE_ICONS[role];
          const active = role === image.role;
          return (
            <button
              key={role}
              type="button"
              onClick={() => onSetRole(role)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[10.5px] transition-colors hover:bg-white/5 ${
                active ? "text-accent-gold" : "text-white"
              }`}
            >
              <Icon size={12} className={active ? "text-accent-gold" : "text-text-secondary"} />
              <span className="flex-1">{ROLE_LABELS[role]}</span>
              {active && <Check size={11} className="text-accent-gold" />}
            </button>
          );
        })}

        <div className="my-1 border-t border-white/5" />
        <button
          type="button"
          onClick={onDelete}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[10.5px] text-red-400 transition-colors hover:bg-red-500/10"
        >
          <Trash2 size={11} />
          Apagar
        </button>
      </div>
    </>,
    document.body,
  );
}

function SortableImageRow({
  image,
  isAnalyzing,
  reanalyzing,
  atLimit,
  onReanalyze,
  onDuplicate,
  onEdit,
  onDelete,
  onSetRole,
  onSetDescription,
  onContextMenu,
}: {
  image: ReferenceImage;
  isAnalyzing: boolean;
  reanalyzing: boolean;
  atLimit: boolean;
  onReanalyze: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetRole: (role: ReferenceRole) => void;
  onSetDescription: (description: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: image.id });
  const [roleMenu, setRoleMenu] = useState<{ x: number; y: number } | null>(null);
  const roleBtnRef = useRef<HTMLButtonElement>(null);

  const RoleIcon = ROLE_ICONS[image.role];
  const isBlob = image.url.startsWith("blob:");

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const actionBtn =
    "flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div
      ref={setNodeRef}
      style={style}
      onContextMenu={onContextMenu}
      className="group/row flex gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        title="Arraste para reordenar"
        aria-label="Reordenar imagem"
        className="flex w-5 shrink-0 cursor-grab touch-none items-center justify-center self-stretch text-white/25 transition-colors hover:text-white/60 active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </button>

      <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-lg bg-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.label}
          className="h-full w-full object-cover"
          draggable={false}
        />
        <span className="absolute left-1 top-1 rounded bg-black/60 px-1 font-mono text-[8px] text-white/80">
          {image.label}
        </span>
        <span
          title={ROLE_LABELS[image.role]}
          className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-accent-gold"
        >
          <RoleIcon size={11} />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <button
            ref={roleBtnRef}
            type="button"
            onClick={() => {
              const rect = roleBtnRef.current?.getBoundingClientRect();
              if (rect) setRoleMenu({ x: rect.left, y: rect.bottom + 4 });
            }}
            title="Alterar papel"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0A0A09] px-2 py-1 font-mono text-[11px] text-white/80 transition-colors hover:border-accent-gold/40"
          >
            <RoleIcon size={12} className="text-accent-gold" />
            {ROLE_LABELS[image.role]}
          </button>

          <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
            <button
              type="button"
              onClick={onReanalyze}
              disabled={isBlob || reanalyzing}
              title="Reanalisar esta imagem"
              aria-label="Reanalisar esta imagem"
              className={actionBtn}
            >
              {reanalyzing ? (
                <Loader2 size={13} className="animate-spin text-accent-gold" />
              ) : (
                <RefreshCw size={13} />
              )}
            </button>
            <button
              type="button"
              onClick={onDuplicate}
              disabled={atLimit}
              title={
                atLimit
                  ? `Limite de ${REFERENCE_MAX_IMAGES} imagens atingido`
                  : "Duplicar imagem"
              }
              aria-label="Duplicar imagem"
              className={actionBtn}
            >
              <CopyPlus size={13} />
            </button>
            <button
              type="button"
              onClick={onEdit}
              disabled={isBlob}
              title="Editar imagem"
              aria-label="Editar imagem"
              className={actionBtn}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Apagar imagem"
              aria-label="Apagar imagem"
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <textarea
          value={image.description}
          onChange={(e) => onSetDescription(e.target.value)}
          placeholder={isAnalyzing ? "Analisando…" : "Descrição da imagem"}
          rows={2}
          className="w-full flex-1 resize-none rounded-lg border border-white/10 bg-[#0A0A09] px-2 py-1.5 text-xs leading-snug text-white/80 outline-none focus:border-accent-gold/40"
        />
      </div>

      {roleMenu &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[10000]"
              onClick={() => setRoleMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setRoleMenu(null);
              }}
            />
            <div
              className="fixed z-[10001] min-w-[150px] overflow-hidden rounded-lg border border-white/10 bg-[#141412] py-1 shadow-2xl"
              style={{ left: roleMenu.x, top: roleMenu.y }}
            >
              {ROLE_ORDER.map((role) => {
                const Icon = ROLE_ICONS[role];
                const active = role === image.role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      onSetRole(role);
                      setRoleMenu(null);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[10.5px] transition-colors hover:bg-white/5 ${
                      active ? "text-accent-gold" : "text-white"
                    }`}
                  >
                    <Icon
                      size={12}
                      className={active ? "text-accent-gold" : "text-text-secondary"}
                    />
                    <span className="flex-1">{ROLE_LABELS[role]}</span>
                    {active && <Check size={11} className="text-accent-gold" />}
                  </button>
                );
              })}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

export function ReferenceAssetsModal() {
  const sceneId = useReferenceAssetsStore((s) => s.sceneId);
  const close = useReferenceAssetsStore((s) => s.close);
  const scene = useProjectStore((s) =>
    sceneId ? s.scenes.find((sc) => sc.id === sceneId) : undefined,
  );
  const setReferenceImageRole = useProjectStore((s) => s.setReferenceImageRole);
  const setReferenceImageDescription = useProjectStore(
    (s) => s.setReferenceImageDescription,
  );
  const analyzeReferenceGroup = useProjectStore((s) => s.analyzeReferenceGroup);
  const addReferenceImages = useProjectStore((s) => s.addReferenceImages);
  const removeReferenceImage = useProjectStore((s) => s.removeReferenceImage);
  const reorderReferenceImages = useProjectStore((s) => s.reorderReferenceImages);
  const duplicateReferenceImage = useProjectStore((s) => s.duplicateReferenceImage);
  const reanalyzeReferenceImage = useProjectStore((s) => s.reanalyzeReferenceImage);
  const replaceReferenceImageUrl = useProjectStore((s) => s.replaceReferenceImageUrl);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    if (!sceneId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (contextMenu) {
        setContextMenu(null);
        return;
      }
      if (editingImageId) {
        setEditingImageId(null);
        return;
      }
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sceneId, close, contextMenu, editingImageId]);

  // Reset transient state whenever the panel target changes / closes.
  useEffect(() => {
    setReanalyzingId(null);
    setEditingImageId(null);
    setContextMenu(null);
  }, [sceneId]);

  if (!sceneId || typeof document === "undefined") return null;

  const config = scene?.referenceConfig;
  if (!scene || !config) {
    // Scene vanished (deleted) while the panel was open — close gracefully.
    return null;
  }

  const images = config.images;
  const isUploading = images.some((im) => im.url.startsWith("blob:"));
  const isAnalyzing = config.analysisStatus === "analyzing";
  const atLimit = images.length >= REFERENCE_MAX_IMAGES;
  const busy = isUploading || isAnalyzing;

  // Edit flow: reuse the full-screen AssetEditModal (z-[60], its own layer) in
  // place of the grid — sidesteps the z-index clash with this modal (z-[9998]).
  const editingImage = editingImageId
    ? images.find((im) => im.id === editingImageId)
    : undefined;
  if (editingImage) {
    return (
      <AssetEditModal
        sourceUrl={editingImage.url}
        sourceLabel={editingImage.label}
        onClose={() => setEditingImageId(null)}
        onApply={({ url }) => {
          replaceReferenceImageUrl(sceneId, editingImage.id, url, {
            reanalyze: true,
          });
          setEditingImageId(null);
        }}
      />
    );
  }

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (picked.length > 0) addReferenceImages(sceneId, picked);
    e.target.value = "";
  };

  const handleReanalyze = async (imageId: string) => {
    if (reanalyzingId) return;
    setReanalyzingId(imageId);
    try {
      await reanalyzeReferenceImage(sceneId, imageId);
    } finally {
      setReanalyzingId(null);
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex((im) => im.id === active.id);
    const newIndex = images.findIndex((im) => im.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const orderedIds = arrayMove(images, oldIndex, newIndex).map((im) => im.id);
    reorderReferenceImages(sceneId, orderedIds);
  };

  const statusLabel = isUploading
    ? "Enviando imagens…"
    : isAnalyzing
      ? "Analisando…"
      : config.analysisStatus === "failed"
        ? "Falha na análise"
        : config.analysisStatus === "ready"
          ? "Análise pronta"
          : "Aguardando análise";

  const contextImage = contextMenu
    ? images.find((im) => im.id === contextMenu.imageId)
    : undefined;

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="flex max-h-[88vh] w-[min(96vw,52rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141413] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-gold/15 text-accent-gold">
                  <Layers size={16} />
                </div>
                <div>
                  <p className="font-mono text-label-sm uppercase tracking-widest text-white/80">
                    Assets · {images.length} imagens
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/45">
                    {(isUploading || isAnalyzing) && (
                      <Loader2 size={11} className="animate-spin text-accent-gold" />
                    )}
                    {statusLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onPickFiles}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy || atLimit}
                  title={
                    atLimit
                      ? `Limite de ${REFERENCE_MAX_IMAGES} imagens atingido`
                      : "Adicionar imagens (ambiente, pessoa, detalhe, produto)"
                  }
                  className="flex items-center gap-1.5 rounded-full border border-accent-gold/30 bg-accent-gold/10 px-3 py-1.5 font-mono text-[10px] text-accent-gold transition-colors hover:bg-accent-gold/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-white/30"
                >
                  <ImagePlus size={11} />
                  Adicionar
                </button>
                <button
                  onClick={() => void analyzeReferenceGroup(sceneId)}
                  disabled={busy}
                  title="Reanalisar todas as imagens"
                  className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 font-mono text-[10px] text-white/70 transition-colors hover:border-accent-gold/40 hover:text-accent-gold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RefreshCw size={11} />
                  Reanalisar
                </button>
                <button
                  onClick={close}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {images.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
                  <p className="font-mono text-xs text-white/40">
                    Nenhuma imagem neste grupo.
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-full border border-accent-gold/30 bg-accent-gold/10 px-3 py-1.5 font-mono text-[10px] text-accent-gold transition-colors hover:bg-accent-gold/20"
                  >
                    <ImagePlus size={11} />
                    Adicionar imagens
                  </button>
                </div>
              ) : (
                <>
                  <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-white/35">
                    A ordem define a sequência @Image1…{images.length} · arraste para reordenar
                  </p>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={images.map((im) => im.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="flex flex-col gap-3">
                        {images.map((im) => (
                          <SortableImageRow
                            key={im.id}
                            image={im}
                            isAnalyzing={isAnalyzing}
                            reanalyzing={reanalyzingId === im.id}
                            atLimit={atLimit}
                            onReanalyze={() => void handleReanalyze(im.id)}
                            onDuplicate={() => duplicateReferenceImage(sceneId, im.id)}
                            onEdit={() => {
                              setContextMenu(null);
                              setEditingImageId(im.id);
                            }}
                            onDelete={() => removeReferenceImage(sceneId, im.id)}
                            onSetRole={(role) =>
                              setReferenceImageRole(sceneId, im.id, role)
                            }
                            onSetDescription={(description) =>
                              setReferenceImageDescription(sceneId, im.id, description)
                            }
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                imageId: im.id,
                              });
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {contextMenu && contextImage && (
        <ReferenceImageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          image={contextImage}
          reanalyzing={reanalyzingId === contextImage.id}
          atLimit={atLimit}
          onReanalyze={() => {
            const id = contextImage.id;
            setContextMenu(null);
            void handleReanalyze(id);
          }}
          onDuplicate={() => {
            duplicateReferenceImage(sceneId, contextImage.id);
            setContextMenu(null);
          }}
          onEdit={() => {
            const id = contextImage.id;
            setContextMenu(null);
            setEditingImageId(id);
          }}
          onSetRole={(role) => {
            setReferenceImageRole(sceneId, contextImage.id, role);
            setContextMenu(null);
          }}
          onDelete={() => {
            removeReferenceImage(sceneId, contextImage.id);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
