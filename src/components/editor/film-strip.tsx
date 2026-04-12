"use client";

import Image from "next/image";
import { useRef } from "react";
import { useProjectStore } from "@/stores/project-store";
import { X, GripVertical, ArrowRightLeft, Plus } from "lucide-react";
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

const ACCEPTED = ".jpg,.jpeg,.png,.webp";

const PRESET_LABELS: Record<string, string> = {
  push_in_serene: "Avanço Suave",
  parallax_architectural: "Parallax",
  tilt_vertical: "Tilt Vertical",
  orbit_subtle: "Giro Sutil",
  rack_focus: "Foco Viajante",
  golden_hour_drift: "Golden Hour",
  depth_reveal: "Reveal",
  soft_dissolve_drift: "Dissolve",
  continuous_camera: "Contínua",
  match_cut: "Match Cut",
  whip_pan: "Whip Pan",
};

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
      onClick={() => selectScene(sceneId)}
      onDoubleClick={() => {
        if (scene.status === "ready" && scene.videoUrl && onPreviewVideo) {
          onPreviewVideo(scene.videoUrl);
        }
      }}
      className={`group relative flex w-48 shrink-0 cursor-pointer flex-col overflow-hidden rounded-xl border transition-colors ${
        isSelected
          ? "border-accent-gold/50 ring-1 ring-accent-gold/20"
          : "border-white/5 hover:border-white/10"
      }`}
    >
      <div className="relative aspect-[16/10] bg-white/5">
        {scene.status === "ready" && scene.videoUrl ? (
          <video
            src={scene.videoUrl}
            className="h-full w-full object-cover"
            muted
            loop
            autoPlay
            playsInline
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
        <div className="absolute left-2 top-2 flex h-5 items-center gap-1 rounded bg-black/60 px-1.5 font-mono text-[10px] text-white">
          <span>{sceneIndex + 1}</span>
          {scene.status === "generating" && (
            <span className="animate-pulse text-accent-gold">●</span>
          )}
          {scene.status === "ready" && (
            <span className="text-green-400">✓</span>
          )}
          {scene.status === "failed" && (
            <span className="text-red-400">✗</span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeScene(sceneId);
          }}
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white/60 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
        >
          <X size={10} />
        </button>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical size={12} className="text-white/40 hover:text-white/70" />
          </div>
          <span className="font-mono text-[10px] text-white/70">{scene.duration}s</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <span className="truncate font-mono text-[11px] text-text-secondary">
          {PRESET_LABELS[scene.presetId] ?? scene.presetId}
        </span>
      </div>
    </div>
  );
}

function TransitionCard({ transitionId, insertIndex }: { transitionId: string; insertIndex: number }) {
  const transition = useProjectStore((s) =>
    s.transitions.find((t) => t.id === transitionId),
  );
  const toggleTransition = useProjectStore((s) => s.toggleTransition);
  const insertPhotoAt = useProjectStore((s) => s.insertPhotoAt);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!transition) return null;

  const handleFile = (files: FileList | null) => {
    const file = files?.[0];
    if (file?.type.startsWith("image/")) {
      insertPhotoAt(insertIndex, file);
    }
  };

  return (
    <div className="group/transition flex shrink-0 flex-col items-center justify-center gap-1 self-center">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => toggleTransition(transitionId)}
        className={`flex h-12 w-8 items-center justify-center rounded-lg border transition-all ${
          transition.enabled
            ? "border-white/10 bg-white/5 text-text-secondary hover:border-accent-gold/30"
            : "border-transparent bg-transparent text-white/10 hover:text-white/20"
        }`}
        title={transition.enabled ? "Transição ativa" : "Transição desativada"}
      >
        <ArrowRightLeft size={10} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        className="flex h-5 w-5 items-center justify-center rounded-full text-white/0 transition-all group-hover/transition:text-accent-gold/50 hover:!text-accent-gold"
        title="Inserir foto aqui"
      >
        <Plus size={10} />
      </button>
    </div>
  );
}

function AddSceneButton() {
  const addPhotos = useProjectStore((s) => s.addPhotos);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            const images = Array.from(e.target.files).filter((f) => f.type.startsWith("image/"));
            if (images.length > 0) addPhotos(images);
          }
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full border border-dashed border-white/10 text-text-secondary transition-all hover:border-accent-gold/40 hover:text-accent-gold"
        title="Adicionar fotos"
      >
        <Plus size={16} />
      </button>
    </>
  );
}

export function FilmStrip({ onPreviewVideo }: { onPreviewVideo?: (url: string) => void }) {
  const scenes = useProjectStore((s) => s.scenes);
  const transitions = useProjectStore((s) => s.transitions);
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
        <div className="flex items-start gap-2 py-4">
          {scenes.map((scene, i) => (
            <div key={scene.id} className="flex items-start gap-1">
              <SortableSceneCard sceneId={scene.id} onPreviewVideo={onPreviewVideo} />
              {i < scenes.length - 1 && transitions[i] && (
                <TransitionCard transitionId={transitions[i]!.id} insertIndex={i + 1} />
              )}
            </div>
          ))}
          <AddSceneButton />
        </div>
      </SortableContext>
    </DndContext>
  );
}
