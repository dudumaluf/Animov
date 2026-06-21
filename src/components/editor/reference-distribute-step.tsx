"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Clapperboard,
  ImagePlus,
  Minus,
  Plus,
  Shuffle,
  X,
} from "lucide-react";

const MAX_PER_GROUP = 9;

type Item = { id: string; file: File; url: string };

function chunkEvenly<T>(arr: T[], n: number): T[][] {
  const groups: T[][] = Array.from({ length: n }, () => []);
  if (n <= 0) return groups;
  const base = Math.floor(arr.length / n);
  const rem = arr.length % n;
  let idx = 0;
  for (let g = 0; g < n; g++) {
    const size = base + (g < rem ? 1 : 0);
    for (let k = 0; k < size; k++) {
      const item = arr[idx++];
      if (item !== undefined) groups[g]!.push(item);
    }
  }
  return groups;
}

function containerIndexOf(groups: Item[][], id: string): number {
  if (id.startsWith("group-")) {
    const n = Number(id.slice("group-".length));
    return Number.isInteger(n) && n >= 0 && n < groups.length ? n : -1;
  }
  return groups.findIndex((g) => g.some((it) => it.id === id));
}

function Thumb({ item, dragging }: { item: Item; dragging?: boolean }) {
  return (
    <span
      className={`relative block h-14 w-14 shrink-0 overflow-hidden rounded-md border ${
        dragging ? "border-accent-gold" : "border-white/10"
      } bg-black/40`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.url} alt="" className="h-full w-full object-cover" draggable={false} />
    </span>
  );
}

function SortableThumb({
  item,
  onDelete,
}: {
  item: Item;
  onDelete: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group/thumb relative">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="block cursor-grab touch-none rounded-md active:cursor-grabbing"
        title="Arraste para reordenar ou mover de grupo"
      >
        <Thumb item={item} />
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onDelete}
        title="Remover imagem"
        aria-label="Remover imagem"
        className="absolute right-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white/70 opacity-0 transition-all hover:bg-red-500/80 hover:text-white group-hover/thumb:opacity-100"
      >
        <X size={9} />
      </button>
    </div>
  );
}

function GroupCard({
  index,
  items,
  canRemove,
  onRemove,
  onDeleteItem,
}: {
  index: number;
  items: Item[];
  canRemove: boolean;
  onRemove: () => void;
  onDeleteItem: (itemId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-${index}` });
  const count = items.length;
  const over = count > MAX_PER_GROUP;
  const full = count === MAX_PER_GROUP;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 rounded-xl border bg-white/[0.02] p-3 transition-colors ${
        isOver
          ? "border-accent-gold/60 bg-accent-gold/[0.06]"
          : over
            ? "border-red-500/50"
            : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clapperboard size={12} className="text-accent-gold" />
          <span className="font-mono text-[11px] text-[var(--text)]">
            Grupo {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] ${
              over
                ? "border-red-500/50 text-red-400"
                : full
                  ? "border-accent-gold/40 text-accent-gold"
                  : "border-white/10 text-text-secondary"
            }`}
          >
            {count}/{MAX_PER_GROUP}
          </span>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="Remover grupo (as imagens voltam pro grupo anterior)"
              className="flex h-5 w-5 items-center justify-center rounded text-text-secondary transition-colors hover:text-red-400"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      <SortableContext items={items.map((it) => it.id)} strategy={rectSortingStrategy}>
        <div className="flex min-h-[3.5rem] flex-wrap gap-1.5">
          {items.length === 0 ? (
            <div className="flex h-14 w-full items-center justify-center rounded-md border border-dashed border-white/10 font-mono text-[9px] text-text-secondary/50">
              Arraste imagens aqui
            </div>
          ) : (
            items.map((item) => (
              <SortableThumb
                key={item.id}
                item={item}
                onDelete={() => onDeleteItem(item.id)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

type Props = {
  files: File[];
  onBack: () => void;
  onConfirm: (chunks: File[][]) => void;
};

/**
 * Step 2 of the import wizard: distribute the imported photos across N
 * reference-group nodes (each ≤9 images — the Seedance limit). Set the group
 * count for an instant even split, drag thumbnails to reorder within a group or
 * move them between groups (sequence matters), delete individual thumbs, or add
 * more images. Each group becomes its own reference video.
 */
export function ReferenceDistributeStep({ files, onBack, onConfirm }: Props) {
  const createdUrls = useRef<string[]>([]);
  const addInputRef = useRef<HTMLInputElement>(null);

  const makeItem = useCallback((file: File): Item => {
    const url = URL.createObjectURL(file);
    createdUrls.current.push(url);
    return {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${file.name}-${file.size}-${Math.random()}`,
      file,
      url,
    };
  }, []);

  const [groups, setGroups] = useState<Item[][]>(() => {
    const initial = files.map((f) => makeItem(f));
    return chunkEvenly(initial, Math.max(1, Math.ceil(initial.length / MAX_PER_GROUP)));
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  // Revoke every object URL we ever created (initial + added) on unmount.
  useEffect(() => {
    return () => {
      createdUrls.current.forEach((u) => URL.revokeObjectURL(u));
      createdUrls.current = [];
    };
  }, []);

  const total = useMemo(() => groups.reduce((sum, g) => sum + g.length, 0), [groups]);
  const groupCount = groups.length;
  const minGroups = Math.max(1, Math.ceil(total / MAX_PER_GROUP));

  const activeItem = useMemo(
    () => (activeId ? groups.flat().find((it) => it.id === activeId) ?? null : null),
    [activeId, groups],
  );

  const applyEven = useCallback((n: number) => {
    setGroups((prev) => chunkEvenly(prev.flat(), Math.max(1, n)));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);

    setGroups((prev) => {
      const fromIdx = containerIndexOf(prev, activeKey);
      const toIdx = containerIndexOf(prev, overKey);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;

      const next = prev.map((g) => [...g]);
      const fromGroup = next[fromIdx]!;
      const toGroup = next[toIdx]!;
      const activeIndex = fromGroup.findIndex((it) => it.id === activeKey);
      if (activeIndex === -1) return prev;
      const [moved] = fromGroup.splice(activeIndex, 1);
      if (!moved) return prev;

      let insertAt: number;
      if (overKey.startsWith("group-")) {
        insertAt = toGroup.length;
      } else {
        const overIndex = toGroup.findIndex((it) => it.id === overKey);
        insertAt = overIndex === -1 ? toGroup.length : overIndex;
      }
      toGroup.splice(insertAt, 0, moved);
      return next;
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);

    setGroups((prev) => {
      const fromIdx = containerIndexOf(prev, activeKey);
      const toIdx = containerIndexOf(prev, overKey);
      // Cross-container moves were already applied in handleDragOver.
      if (fromIdx === -1 || toIdx === -1 || fromIdx !== toIdx) return prev;

      const group = prev[fromIdx]!;
      const oldIndex = group.findIndex((it) => it.id === activeKey);
      const newIndex = overKey.startsWith("group-")
        ? group.length - 1
        : group.findIndex((it) => it.id === overKey);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
      return prev.map((g, i) => (i === fromIdx ? arrayMove(g, oldIndex, newIndex) : g));
    });
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  function deleteItem(itemId: string) {
    setGroups((prev) => prev.map((g) => g.filter((it) => it.id !== itemId)));
  }

  function addGroup() {
    setGroups((prev) => [...prev, []]);
  }

  function removeGroup(index: number) {
    setGroups((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.map((g) => [...g]);
      const removed = next[index] ?? [];
      next.splice(index, 1);
      const fallback = index === 0 ? 0 : index - 1;
      if (removed.length && next[fallback]) {
        next[fallback] = [...next[fallback]!, ...removed];
      }
      return next;
    });
  }

  function onAddFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    e.target.value = "";
    if (picked.length === 0) return;
    const newItems = picked.map((f) => makeItem(f));
    setGroups((prev) => {
      const next = prev.map((g) => [...g]);
      // Drop into the last group that still has room, else group 0.
      let target = -1;
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i]!.length < MAX_PER_GROUP) {
          target = i;
          break;
        }
      }
      if (target === -1) target = 0;
      next[target] = [...next[target]!, ...newItems];
      return next;
    });
  }

  const hasEmpty = groups.some((g) => g.length === 0);
  const hasOverflow = groups.some((g) => g.length > MAX_PER_GROUP);
  const canConfirm = !hasEmpty && !hasOverflow && total > 0;

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm(groups.map((g) => g.map((it) => it.file)));
  }

  return (
    <div className="flex max-h-[88vh] w-[min(94vw,52rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141413] shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/5 hover:text-white"
            title="Voltar"
          >
            <ArrowLeft size={14} />
          </button>
          <div>
            <p className="font-mono text-label-sm uppercase tracking-widest text-white/80">
              Organizar grupos de referência
            </p>
            <p className="mt-1 text-xs text-white/45">
              Cada grupo vira um vídeo · arraste para ordenar · até {MAX_PER_GROUP} imagens por grupo
            </p>
          </div>
        </div>
        <span className="font-mono text-[10px] text-text-secondary">
          {total} imagens
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-6 py-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
          Grupos
        </span>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 p-0.5">
          <button
            type="button"
            onClick={() => applyEven(Math.max(minGroups, groupCount - 1))}
            disabled={groupCount <= minGroups}
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30"
            title="Menos grupos"
          >
            <Minus size={12} />
          </button>
          <span className="min-w-[1.5rem] text-center font-mono text-[12px] text-white">
            {groupCount}
          </span>
          <button
            type="button"
            onClick={() => applyEven(Math.min(total, groupCount + 1))}
            disabled={groupCount >= total}
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30"
            title="Mais grupos (divide igualmente)"
          >
            <Plus size={12} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => applyEven(groupCount)}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:border-accent-gold/30 hover:text-accent-gold"
          title="Redistribuir igualmente na ordem atual"
        >
          <Shuffle size={11} /> Distribuir igualmente
        </button>
        <input
          ref={addInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onAddFiles}
        />
        <button
          type="button"
          onClick={() => addInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:border-accent-gold/30 hover:text-accent-gold"
          title="Adicionar mais imagens"
        >
          <ImagePlus size={11} /> Adicionar imagens
        </button>
        {minGroups > 1 && (
          <span className="ml-auto font-mono text-[9px] text-text-secondary/60">
            mín. {minGroups} grupos p/ {total} imagens
          </span>
        )}
      </div>

      {/* Group board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((g, i) => (
              <GroupCard
                key={i}
                index={i}
                items={g}
                canRemove={groupCount > 1}
                onRemove={() => removeGroup(i)}
                onDeleteItem={deleteItem}
              />
            ))}
            <button
              type="button"
              onClick={addGroup}
              disabled={groupCount >= total}
              className="flex min-h-[6rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 text-text-secondary transition-colors hover:border-accent-gold/30 hover:text-accent-gold disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Plus size={16} />
              <span className="font-mono text-[10px] uppercase tracking-widest">
                Adicionar grupo
              </span>
            </button>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem ? <Thumb item={activeItem} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-white/5 px-6 py-4">
        <p className="font-mono text-[10px] text-text-secondary/60">
          {hasOverflow
            ? `Algum grupo passou de ${MAX_PER_GROUP} imagens.`
            : hasEmpty
              ? "Há um grupo vazio — preencha ou remova."
              : `${groupCount} ${groupCount === 1 ? "vídeo" : "vídeos"} serão criados.`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="rounded-lg px-3 py-2 font-mono text-label-sm text-text-secondary transition-colors hover:text-white"
          >
            Voltar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`rounded-lg px-4 py-2 font-mono text-label-sm transition-all ${
              canConfirm
                ? "bg-accent-gold text-[#0D0D0B] hover:opacity-90"
                : "cursor-not-allowed border border-white/10 bg-white/[0.03] text-text-secondary/40"
            }`}
          >
            Criar {groupCount} {groupCount === 1 ? "grupo" : "grupos"}
          </button>
        </div>
      </div>
    </div>
  );
}
