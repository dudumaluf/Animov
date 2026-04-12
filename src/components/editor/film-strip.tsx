"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useProjectStore } from "@/stores/project-store";
import { X, GripVertical, Plus, ImagePlus, Blend, Sparkles } from "lucide-react";
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

type InsertMenuPosition = "between" | "end";
type InsertMenuAction = "photo" | "crossfade" | "ai-transition";

function InsertMenu({
  position,
  insertIndex,
  hasScenesOnBothSides,
}: {
  position: InsertMenuPosition;
  insertIndex: number;
  hasScenesOnBothSides: boolean;
}) {
  const [open, setOpen] = useState(false);
  const insertPhotoAt = useProjectStore((s) => s.insertPhotoAt);
  const addPhotos = useProjectStore((s) => s.addPhotos);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleAction = (action: InsertMenuAction) => {
    setOpen(false);
    if (action === "photo") {
      inputRef.current?.click();
    }
    if (action === "crossfade") {
      // TODO: implement crossfade node insertion
      console.log("[insert] crossfade at index", insertIndex);
    }
    if (action === "ai-transition") {
      // TODO: implement AI transition generation
      console.log("[insert] AI transition at index", insertIndex);
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
    { action: "ai-transition", icon: Sparkles, label: "Transição AI", desc: "Gera video conectando as cenas", ready: false },
  ];

  const endOptions: { action: InsertMenuAction; icon: typeof ImagePlus; label: string; desc: string; ready: boolean }[] = [
    { action: "photo", icon: ImagePlus, label: "Adicionar fotos", desc: "Novas cenas no final", ready: true },
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
          if (options.length === 1 && options[0]!.ready) {
            handleAction(options[0]!.action);
          } else {
            setOpen(!open);
          }
        }}
        className={`flex items-center justify-center rounded-full border transition-all ${
          position === "end"
            ? "h-10 w-10 border-dashed border-white/10 text-text-secondary hover:border-accent-gold/40 hover:text-accent-gold"
            : "h-8 w-8 border border-white/10 text-text-secondary hover:border-accent-gold/40 hover:text-accent-gold"
        }`}
        title="Inserir"
      >
        <Plus size={position === "end" ? 16 : 12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 top-full z-50 mt-2 w-52 -translate-x-1/2 overflow-hidden rounded-xl border border-white/10 bg-[#141412] shadow-xl">
            {options.map((opt) => (
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
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function FilmStrip({ onPreviewVideo }: { onPreviewVideo?: (url: string) => void }) {
  const scenes = useProjectStore((s) => s.scenes);
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
                <InsertMenu
                  position="between"
                  insertIndex={i + 1}
                  hasScenesOnBothSides={true}
                />
              )}
            </div>
          ))}
          <InsertMenu
            position="end"
            insertIndex={scenes.length}
            hasScenesOnBothSides={false}
          />
        </div>
      </SortableContext>
    </DndContext>
  );
}
