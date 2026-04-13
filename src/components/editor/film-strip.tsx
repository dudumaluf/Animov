"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useProjectStore } from "@/stores/project-store";
import { X, GripVertical, Plus, ImagePlus, Blend, Sparkles, Clapperboard, ArrowDownToLine, Loader2, Type } from "lucide-react";
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
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { getPresetLabel } from "@/lib/presets";
import { downloadVideoBlob } from "@/lib/utils/download";

const ACCEPTED = ".jpg,.jpeg,.png,.webp";

function SortableSceneCard({
  sceneId,
  onPreviewVideo,
}: {
  sceneId: string;
  onPreviewVideo?: (url: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sceneId });

  const scene = useProjectStore((s) => s.scenes.find((sc) => sc.id === sceneId));
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const selectScene = useProjectStore((s) => s.selectScene);
  const removeScene = useProjectStore((s) => s.removeScene);
  const setActiveVersion = useProjectStore((s) => s.setActiveVersion);
  const sceneIndex = useProjectStore((s) => s.scenes.findIndex((sc) => sc.id === sceneId));

  if (!scene) return null;
  const isSelected = selectedSceneId === sceneId;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); selectScene(sceneId); }}
      onDoubleClick={() => {
        if (scene.status === "ready" && scene.videoUrl && onPreviewVideo) {
          onPreviewVideo(scene.videoUrl);
        }
      }}
      className={`group relative flex w-48 shrink-0 cursor-pointer overflow-hidden rounded-xl border transition-colors ${
        isSelected
          ? "border-accent-gold/50 ring-1 ring-accent-gold/20"
          : "border-white/5 hover:border-white/10"
      }`}
    >
      <div className="relative aspect-[16/10] w-full bg-white/5">
        {scene.status === "ready" && scene.videoUrl ? (
          <video
            src={scene.videoUrl}
            className="h-full w-full object-cover"
            muted
            loop
            playsInline
            onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
            onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
          />
        ) : (
          <Image
            src={scene.photoDataUrl ?? scene.photoUrl}
            alt={`Cena ${sceneIndex + 1}`}
            fill
            className="object-cover"
            unoptimized
          />
        )}
        {scene.status === "generating" && (
          <div className="absolute left-2 top-2 flex h-5 items-center gap-1 rounded bg-black/60 px-1.5 font-mono text-[10px]">
            <span className="animate-pulse text-accent-gold">●</span>
          </div>
        )}
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {scene.status === "ready" && scene.videoUrl && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                await downloadVideoBlob(scene.videoUrl!, `cena-${sceneIndex + 1}.mp4`);
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white/60 transition-colors hover:text-white"
            >
              <ArrowDownToLine size={10} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeScene(sceneId);
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white/60 transition-colors hover:text-white"
          >
            <X size={10} />
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-6 translate-y-full transition-transform group-hover:translate-y-0">
          <span className="truncate font-mono text-[10px] text-white/80">
            {getPresetLabel(scene.presetId)}
          </span>
          <div className="flex items-center gap-2">
            {(scene.videoVersions ?? []).length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveVersion(sceneId, scene.activeVersion - 1); }}
                  className="font-mono text-[10px] text-white/40 hover:text-white"
                >
                  ‹
                </button>
                <span className="font-mono text-[9px] text-accent-gold">
                  {(scene.activeVersion ?? 0) + 1}/{(scene.videoVersions ?? []).length}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveVersion(sceneId, scene.activeVersion + 1); }}
                  className="font-mono text-[10px] text-white/40 hover:text-white"
                >
                  ›
                </button>
              </div>
            )}
            <span className="font-mono text-[10px] text-white/60">{scene.duration}s</span>
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical size={10} className="text-white/40 hover:text-white/70" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type InsertMenuPosition = "between" | "end";
type InsertMenuAction = "photo" | "crossfade" | "ai-transition" | "edit" | "composer";

function InsertMenu({
  position,
  insertIndex,
  hasScenesOnBothSides,
  fromSceneId,
  toSceneId,
  variant = "plus",
}: {
  position: InsertMenuPosition;
  insertIndex: number;
  hasScenesOnBothSides: boolean;
  fromSceneId?: string;
  toSceneId?: string;
  variant?: "plus" | "equals";
}) {
  const [open, setOpen] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const insertPhotoAt = useProjectStore((s) => s.insertPhotoAt);
  const addPhotos = useProjectStore((s) => s.addPhotos);
  const setHasEditNode = useProjectStore((s) => s.setHasEditNode);
  const hasEditNode = useProjectStore((s) => s.hasEditNode);
  const generateTransition = useProjectStore((s) => s.generateTransition);
  const transitions = useProjectStore((s) => s.transitions);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasTransition = fromSceneId && toSceneId
    ? transitions.some((t) => t.id === `t-${fromSceneId}-${toSceneId}` && t.status !== "idle")
    : false;

  const handleAction = (action: InsertMenuAction) => {
    if (action === "ai-transition") {
      setShowDurationPicker(true);
      return;
    }
    setOpen(false);
    setShowDurationPicker(false);
    if (action === "photo") {
      inputRef.current?.click();
    }
    if (action === "crossfade") {
      // TODO: implement crossfade
    }
    if (action === "edit") {
      setHasEditNode(true);
    }
  };

  const handleGenerateTransition = (duration: number) => {
    setOpen(false);
    setShowDurationPicker(false);
    if (fromSceneId && toSceneId) {
      generateTransition(fromSceneId, toSceneId, duration);
    }
  };

  const handleFile = (files: FileList | null) => {
    if (!files) return;
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;

    if (position === "end") {
      addPhotos(images);
    } else {
      images.forEach((file, i) => {
        insertPhotoAt(insertIndex + i, file);
      });
    }
  };

  const betweenOptions: { action: InsertMenuAction; icon: typeof ImagePlus; label: string; desc: string; ready: boolean }[] = [
    { action: "photo", icon: ImagePlus, label: "Inserir foto", desc: "Nova cena nesta posição", ready: true },
    { action: "crossfade", icon: Blend, label: "Crossfade", desc: "Dissolve suave entre cenas", ready: false },
    ...(!hasTransition ? [{ action: "ai-transition" as const, icon: Sparkles, label: "Transição AI", desc: "Gera video conectando as cenas", ready: true }] : []),
  ];

  const endOptions: { action: InsertMenuAction; icon: typeof ImagePlus; label: string; desc: string; ready: boolean }[] = [
    { action: "photo", icon: ImagePlus, label: "Adicionar fotos", desc: "Novas cenas no final", ready: true },
    ...(!hasEditNode ? [{ action: "edit" as const, icon: Clapperboard, label: "Criar Edit", desc: "Junta todas as cenas num vídeo final", ready: true }] : []),
    { action: "composer", icon: Type, label: "Composer", desc: "Logo, texto, gráficos", ready: false },
  ];

  const options = position === "between" && hasScenesOnBothSides
    ? betweenOptions
    : endOptions;

  return (
    <div className="relative flex shrink-0 items-center self-center" ref={menuRef}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple={position === "end"}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files);
          e.target.value = "";
        }}
      />

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (variant === "plus" && options.length === 1 && options[0]!.ready) {
            handleAction(options[0]!.action);
          } else {
            setOpen(!open);
          }
        }}
        className="group/btn flex h-8 w-8 items-center justify-center rounded-full border border-white/10 transition-all hover:border-accent-gold/40"
        title="Inserir"
      >
        {variant === "equals" ? (
          <div className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute h-[1.5px] w-3 -translate-y-[2.5px] rounded-full bg-white/20 transition-all duration-300 group-hover/btn:translate-y-0 group-hover/btn:rotate-90 group-hover/btn:bg-accent-gold" />
            <span className="absolute h-[1.5px] w-3 translate-y-[2.5px] rounded-full bg-white/20 transition-all duration-300 group-hover/btn:translate-y-0 group-hover/btn:bg-accent-gold" />
          </div>
        ) : (
          <Plus size={14} className="text-text-secondary transition-colors group-hover/btn:text-accent-gold" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setShowDurationPicker(false); }} />
          <div className="absolute left-1/2 top-full z-50 mt-2 w-52 -translate-x-1/2 overflow-hidden rounded-xl border border-white/10 bg-[#141412] shadow-xl">
            {showDurationPicker ? (
              <div>
                <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
                  <button onClick={() => setShowDurationPicker(false)} className="font-mono text-[10px] text-text-secondary hover:text-[var(--text)]">←</button>
                  <span className="font-mono text-[10px] text-accent-gold">Duração da transição</span>
                </div>
                {[3, 5, 7].map((d) => (
                  <button
                    key={d}
                    onClick={() => handleGenerateTransition(d)}
                    className="flex w-full items-center justify-between px-3 py-2.5 font-mono text-[11px] text-[var(--text)] transition-colors hover:bg-white/5"
                  >
                    <span>{d} segundos</span>
                    <span className="text-[9px] text-text-secondary">~${(d * 0.112).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.action}
                  onClick={() => opt.ready && handleAction(opt.action)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    opt.ready
                      ? "hover:bg-white/5"
                      : "opacity-30 cursor-not-allowed"
                  }`}
                >
                  <opt.icon size={14} className={opt.ready ? "text-accent-gold" : "text-text-secondary"} />
                  <div>
                    <span className="block font-mono text-[11px] font-medium text-[var(--text)]">
                      {opt.label}
                    </span>
                    <span className="block font-mono text-[9px] text-text-secondary">
                      {opt.ready ? opt.desc : "Em breve"}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TransitionNode({
  fromSceneId,
  toSceneId,
  onPreviewVideo,
}: {
  fromSceneId: string;
  toSceneId: string;
  onPreviewVideo?: (url: string) => void;
}) {
  const transitionId = `t-${fromSceneId}-${toSceneId}`;
  const transition = useProjectStore((s) => s.transitions.find((t) => t.id === transitionId));
  const fromScene = useProjectStore((s) => s.scenes.find((sc) => sc.id === fromSceneId));
  const removeTransition = useProjectStore((s) => s.removeTransition);

  if (!transition || transition.status === "idle") return null;

  const isGenerating = transition.status === "generating";
  const isFailed = transition.status === "failed";
  const isReady = transition.status === "ready" && transition.videoUrl;

  return (
    <div
      className="group relative flex w-48 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-accent-gold/20 self-start"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={() => {
        if (isReady && transition.videoUrl && onPreviewVideo) {
          onPreviewVideo(transition.videoUrl);
        }
      }}
    >
      <div className="relative aspect-[16/10] w-full bg-white/5">
        {isReady && transition.videoUrl ? (
          <video
            src={transition.videoUrl}
            className="h-full w-full object-cover"
            muted
            loop
            playsInline
            onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
            onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
          />
        ) : fromScene ? (
          <Image
            src={fromScene.photoDataUrl ?? fromScene.photoUrl}
            alt="transition"
            fill
            className="object-cover opacity-40"
            unoptimized
          />
        ) : null}
        {isGenerating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50">
            <Loader2 size={16} className="animate-spin text-accent-gold" />
            <span className="font-mono text-[9px] text-accent-gold">Gerando transição</span>
          </div>
        )}
        {isFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50">
            <span className="font-mono text-[10px] text-red-400">Erro</span>
          </div>
        )}
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {isReady && transition.videoUrl && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                await downloadVideoBlob(transition.videoUrl!, "transicao.mp4");
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white/60 hover:text-white"
            >
              <ArrowDownToLine size={10} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); removeTransition(transitionId); }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white/60 hover:text-white"
          >
            <X size={10} />
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-6 translate-y-full transition-transform group-hover:translate-y-0">
          <span className="font-mono text-[10px] text-accent-gold">Transição AI</span>
        </div>
      </div>
    </div>
  );
}

function EditNode({ onExport }: { onExport: () => void }) {
  const scenes = useProjectStore((s) => s.scenes);
  const setHasEditNode = useProjectStore((s) => s.setHasEditNode);
  const selectEditNode = useProjectStore((s) => s.selectEditNode);
  const editNodeSelected = useProjectStore((s) => s.editNodeSelected);
  const musicUrl = useProjectStore((s) => s.musicUrl);
  const readyScenes = scenes.filter((s) => s.status === "ready" && s.videoUrl);
  const readyCount = readyScenes.length;
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  const previewScene = readyScenes[0];

  return (
    <div
      className={`group relative flex w-48 shrink-0 cursor-pointer overflow-hidden rounded-xl border transition-colors ${
        editNodeSelected
          ? "border-accent-gold/50 ring-1 ring-accent-gold/20"
          : "border-white/5 hover:border-white/10"
      }`}
      onClick={(e) => { e.stopPropagation(); selectEditNode(); }}
    >
      <div className="relative aspect-[16/10] w-full bg-white/5">
        {previewScene?.videoUrl ? (
          <video
            src={previewScene.videoUrl}
            className="h-full w-full object-cover"
            muted
            loop
            playsInline
            onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
            onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
          />
        ) : previewScene ? (
          <Image
            src={previewScene.photoDataUrl ?? previewScene.photoUrl}
            alt="edit"
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Clapperboard size={20} className="text-text-secondary" />
          </div>
        )}
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {readyCount >= 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onExport(); }}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white/60 hover:text-white"
            >
              <ArrowDownToLine size={10} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setHasEditNode(false); }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white/60 hover:text-white"
          >
            <X size={10} />
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-6 translate-y-full transition-transform group-hover:translate-y-0">
          <span className="font-mono text-[10px] text-accent-gold">Edit Final</span>
          <span className="font-mono text-[10px] text-white/60">
            {readyCount}/{scenes.length} · {totalDuration}s{musicUrl ? " · ♫" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

export function FilmStrip({ onPreviewVideo, onExport }: { onPreviewVideo?: (url: string) => void; onExport?: () => void }) {
  const scenes = useProjectStore((s) => s.scenes);
  const hasEditNode = useProjectStore((s) => s.hasEditNode);
  const reorderScenes = useProjectStore((s) => s.reorderScenes);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = scenes.findIndex((s) => s.id === active.id);
    const toIndex = scenes.findIndex((s) => s.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderScenes(fromIndex, toIndex);
    }
  };

  const sceneIds = scenes.map((s) => s.id);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sceneIds} strategy={horizontalListSortingStrategy}>
        <div className="flex items-start gap-1.5 py-4">
          {scenes.map((scene, i) => (
            <div key={scene.id} className="flex items-start gap-1.5">
              <SortableSceneCard sceneId={scene.id} onPreviewVideo={onPreviewVideo} />
              {i < scenes.length - 1 && (
                <>
                  <TransitionNode
                    fromSceneId={scene.id}
                    toSceneId={scenes[i + 1]!.id}
                    onPreviewVideo={onPreviewVideo}
                  />
                  <InsertMenu
                    position="between"
                    insertIndex={i + 1}
                    hasScenesOnBothSides={true}
                    fromSceneId={scene.id}
                    toSceneId={scenes[i + 1]?.id}
                  />
                </>
              )}
            </div>
          ))}
          {!hasEditNode && (
            <InsertMenu
              position="end"
              insertIndex={scenes.length}
              hasScenesOnBothSides={false}
            />
          )}
          {hasEditNode && onExport && (
            <>
              <InsertMenu
                position="end"
                insertIndex={scenes.length}
                hasScenesOnBothSides={false}
                variant="equals"
              />
              <EditNode onExport={onExport} />
            </>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}
