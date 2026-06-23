"use client";

import { KenBurnsPreview } from "@/components/editor/ken-burns-preview";
import { getPresetLabel } from "@/lib/presets";

/**
 * ExampleGallery
 * --------------
 * "Veja a qualidade real" proof for the zero-cost funnel: a curated grid of
 * real interior photos animated with the same camera-motion presets the editor
 * offers — rendered client-side (Ken Burns), so it costs nothing in fal while
 * still showing the kind of motion a paid render produces. Reuses the bundled
 * /mock photos. Used on the landing page and the editor empty-state.
 */

type Sample = { src: string; presetId: string };

const SAMPLES: Sample[] = [
  { src: "/mock/Park_Avenue_1.png", presetId: "push_in_serene" },
  { src: "/mock/Park_Avenue_8.png", presetId: "parallax_architectural" },
  { src: "/mock/Park_Avenue_15.png", presetId: "orbit_subtle" },
  { src: "/mock/Park_Avenue_25.png", presetId: "boom_up_reveal" },
  { src: "/mock/Park_Avenue_35.png", presetId: "golden_hour_drift" },
  { src: "/mock/Park_Avenue_45.png", presetId: "drone_pull_away" },
];

export function ExampleGallery({
  count = 6,
  className = "",
  columns = "md:grid-cols-3",
}: {
  count?: number;
  className?: string;
  columns?: string;
}) {
  const samples = SAMPLES.slice(0, Math.max(1, Math.min(SAMPLES.length, count)));

  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${columns} ${className}`}>
      {samples.map((s) => (
        <figure
          key={s.src}
          className="group relative aspect-video overflow-hidden rounded-xl border border-white/5"
        >
          <KenBurnsPreview
            src={s.src}
            presetId={s.presetId}
            className="h-full w-full"
          />
          <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">
              {getPresetLabel(s.presetId)}
            </span>
            <span className="rounded-full bg-accent-gold/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#0D0D0B]">
              Movimento
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
