"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PlayheadLineVisibility = "always" | "only_scrub" | "never";
export type PlayheadLineColor = "gold" | "white" | "blue" | "red";
export type RulerDensityMode = "auto" | "dense" | "sparse";

export type PreviewPlacement = "inspector" | "headline" | "theater";
export type InspectorDensity = "full" | "railed" | "hidden";
export type LayoutPreset = "edicao" | "revisao" | "foco" | "livre";

export type LayoutSettings = {
  preset: LayoutPreset;
  previewPlacement: PreviewPlacement;
  inspectorDensity: InspectorDensity;
  timelineRibbon: boolean;
  showLayoutBar: boolean;
};

export type EditorSettings = {
  playheadLine: {
    visibility: PlayheadLineVisibility;
    opacityBaseline: number;
    opacityScrub: number;
    color: PlayheadLineColor;
    glowOnScrub: boolean;
  };
  ruler: {
    visible: boolean;
    densityMode: RulerDensityMode;
  };
  behavior: {
    autoFollowDefault: boolean;
    hoverPlayEnabled: boolean;
  };
  layout: LayoutSettings;
};

/**
 * Each named preset is a "shape" of the layout. Livre is special: it holds
 * whatever the user drifted to after tweaking a setting manually, so we can
 * still render the current placement faithfully without polluting the named
 * presets. Resetting to a named preset always restores its canonical shape.
 */
export const LAYOUT_PRESETS: Record<
  Exclude<LayoutPreset, "livre">,
  Omit<LayoutSettings, "preset" | "showLayoutBar">
> = {
  edicao: {
    previewPlacement: "inspector",
    inspectorDensity: "full",
    timelineRibbon: false,
  },
  revisao: {
    previewPlacement: "headline",
    inspectorDensity: "railed",
    timelineRibbon: false,
  },
  foco: {
    previewPlacement: "theater",
    inspectorDensity: "hidden",
    timelineRibbon: true,
  },
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  playheadLine: {
    visibility: "always",
    opacityBaseline: 30,
    opacityScrub: 90,
    color: "gold",
    glowOnScrub: true,
  },
  ruler: {
    visible: true,
    densityMode: "auto",
  },
  behavior: {
    autoFollowDefault: true,
    hoverPlayEnabled: true,
  },
  layout: {
    preset: "edicao",
    ...LAYOUT_PRESETS.edicao,
    showLayoutBar: true,
  },
};

type EditorSettingsStore = EditorSettings & {
  setPlayheadLineVisibility: (v: PlayheadLineVisibility) => void;
  setPlayheadLineOpacityBaseline: (v: number) => void;
  setPlayheadLineOpacityScrub: (v: number) => void;
  setPlayheadLineColor: (c: PlayheadLineColor) => void;
  setPlayheadLineGlowOnScrub: (v: boolean) => void;

  setRulerVisible: (v: boolean) => void;
  setRulerDensityMode: (m: RulerDensityMode) => void;

  setAutoFollowDefault: (v: boolean) => void;
  setHoverPlayEnabled: (v: boolean) => void;

  applyPreset: (p: LayoutPreset) => void;
  setPreviewPlacement: (p: PreviewPlacement) => void;
  setInspectorDensity: (d: InspectorDensity) => void;
  setTimelineRibbon: (v: boolean) => void;
  setShowLayoutBar: (v: boolean) => void;

  resetDefaults: () => void;
};

/**
 * Figures out which named preset the current layout matches, or returns
 * "livre" when the combination doesn't fit any of them. Used by the layout
 * mutators to auto-tag the preset without the user having to pick it.
 */
function inferPreset(layout: Omit<LayoutSettings, "preset" | "showLayoutBar">): LayoutPreset {
  for (const [name, shape] of Object.entries(LAYOUT_PRESETS)) {
    if (
      shape.previewPlacement === layout.previewPlacement &&
      shape.inspectorDensity === layout.inspectorDensity &&
      shape.timelineRibbon === layout.timelineRibbon
    ) {
      return name as LayoutPreset;
    }
  }
  return "livre";
}

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export const useEditorSettingsStore = create<EditorSettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_EDITOR_SETTINGS,

      setPlayheadLineVisibility: (v) =>
        set((s) => ({ playheadLine: { ...s.playheadLine, visibility: v } })),
      setPlayheadLineOpacityBaseline: (v) =>
        set((s) => ({
          playheadLine: { ...s.playheadLine, opacityBaseline: clampPct(v) },
        })),
      setPlayheadLineOpacityScrub: (v) =>
        set((s) => ({
          playheadLine: { ...s.playheadLine, opacityScrub: clampPct(v) },
        })),
      setPlayheadLineColor: (c) =>
        set((s) => ({ playheadLine: { ...s.playheadLine, color: c } })),
      setPlayheadLineGlowOnScrub: (v) =>
        set((s) => ({ playheadLine: { ...s.playheadLine, glowOnScrub: v } })),

      setRulerVisible: (v) =>
        set((s) => ({ ruler: { ...s.ruler, visible: v } })),
      setRulerDensityMode: (m) =>
        set((s) => ({ ruler: { ...s.ruler, densityMode: m } })),

      setAutoFollowDefault: (v) =>
        set((s) => ({ behavior: { ...s.behavior, autoFollowDefault: v } })),
      setHoverPlayEnabled: (v) =>
        set((s) => ({ behavior: { ...s.behavior, hoverPlayEnabled: v } })),

      applyPreset: (p) =>
        set((s) => {
          if (p === "livre") return { layout: { ...s.layout, preset: "livre" } };
          const shape = LAYOUT_PRESETS[p];
          return {
            layout: {
              ...s.layout,
              preset: p,
              previewPlacement: shape.previewPlacement,
              inspectorDensity: shape.inspectorDensity,
              timelineRibbon: shape.timelineRibbon,
            },
          };
        }),
      setPreviewPlacement: (p) =>
        set((s) => {
          const next = { ...s.layout, previewPlacement: p };
          return { layout: { ...next, preset: inferPreset(next) } };
        }),
      setInspectorDensity: (d) =>
        set((s) => {
          const next = { ...s.layout, inspectorDensity: d };
          return { layout: { ...next, preset: inferPreset(next) } };
        }),
      setTimelineRibbon: (v) =>
        set((s) => {
          const next = { ...s.layout, timelineRibbon: v };
          return { layout: { ...next, preset: inferPreset(next) } };
        }),
      setShowLayoutBar: (v) =>
        set((s) => ({ layout: { ...s.layout, showLayoutBar: v } })),

      resetDefaults: () =>
        set(() => ({ ...DEFAULT_EDITOR_SETTINGS })),
    }),
    {
      name: "animov-editor-settings-v1",
      version: 2,
      migrate: (persisted: unknown, version) => {
        // v1 had no `layout`; synthesize the default so existing users open
        // exactly where they were (`edicao`) with the layout bar visible.
        if (version < 2 && persisted && typeof persisted === "object") {
          return {
            ...(persisted as EditorSettings),
            layout: DEFAULT_EDITOR_SETTINGS.layout,
          };
        }
        return persisted as EditorSettings;
      },
      partialize: (s) => ({
        playheadLine: s.playheadLine,
        ruler: s.ruler,
        behavior: s.behavior,
        layout: s.layout,
      }),
    },
  ),
);

const PLAYHEAD_COLOR_RGB: Record<PlayheadLineColor, [number, number, number]> = {
  gold: [200, 169, 110],
  white: [255, 255, 255],
  blue: [96, 165, 250],
  red: [248, 113, 113],
};

/**
 * Maps a semantic color token + 0-100 alpha to an `rgba(...)` string. The gold
 * triplet mirrors the `--accent-gold` hex in globals.css; keeping them in sync
 * is cheap and avoids having to redefine the CSS var as RGB components.
 */
export function playheadLineCssColor(
  color: PlayheadLineColor,
  alphaPct: number,
): string {
  const [r, g, b] = PLAYHEAD_COLOR_RGB[color];
  const a = Math.max(0, Math.min(1, alphaPct / 100));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function playheadLineCssColorSolid(color: PlayheadLineColor): string {
  const [r, g, b] = PLAYHEAD_COLOR_RGB[color];
  return `rgb(${r}, ${g}, ${b})`;
}
