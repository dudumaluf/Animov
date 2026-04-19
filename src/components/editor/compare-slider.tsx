"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";

type Props = {
  originalUrl: string;
  editedUrl: string;
  maxHeight?: string;
  className?: string;
};

export function CompareSlider({
  originalUrl,
  editedUrl,
  maxHeight = "75vh",
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(50);
  const dragging = useRef(false);

  const updateSplit = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.max(2, Math.min(98, pct)));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updateSplit(e.clientX);
    },
    [updateSplit],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      updateSplit(e.clientX);
    },
    [updateSplit],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative max-h-full max-w-full select-none overflow-hidden rounded-xl ${className}`}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <Image
        src={editedUrl}
        alt="Edited"
        width={1280}
        height={960}
        className="w-auto rounded-xl object-contain"
        style={{ maxHeight }}
        draggable={false}
        unoptimized
      />
      <Image
        src={originalUrl}
        alt="Original"
        width={1280}
        height={960}
        className="pointer-events-none absolute inset-0 h-full w-full rounded-xl object-contain"
        draggable={false}
        unoptimized
        style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
      />
      <div
        className="absolute inset-y-0 z-10 w-[3px] cursor-col-resize bg-white/80 shadow-[0_0_8px_rgba(0,0,0,0.5)]"
        style={{ left: `${split}%`, transform: "translateX(-50%)" }}
        onPointerDown={onPointerDown}
      >
        <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/70 shadow-lg">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M4 3L1 7L4 11"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 3L13 7L10 11"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white/70">
        Original
      </span>
      <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent-gold">
        Editado
      </span>
    </div>
  );
}
