"use client";

import type { LucideIcon } from "lucide-react";
import { Activity, SlidersHorizontal } from "lucide-react";

import type { DockEdge } from "@/hooks/use-admin-flags";

/**
 * Panel registry
 * --------------
 * Static catalog of every dockable panel the editor knows about. Adding a
 * new panel (Recipes, Assets, Clip inspector, etc.) is a single entry here
 * + one drawer component — no changes to DockRail or dock-store required.
 *
 * Components are referenced lazily (imported where the registry is consumed)
 * to keep this module side-effect free: a plain registry lookup should never
 * force the editor to pull in the Inspector or ActivityDrawer bundle.
 */

export type PanelId = "activity" | "properties";

export type PanelDefinition = {
  id: PanelId;
  icon: LucideIcon;
  /** Short, human label for tooltips / screen readers. */
  label: string;
  /** Fallback edge when no admin flag overrides it. */
  defaultEdge: DockEdge;
  /** Drawer bounds (hard clamp) — user resize lives inside this range. */
  minWidth: number;
  maxWidth: number;
  /**
   * Default width in px when there's no user-persisted value and no admin
   * flag override. Keeps each panel feeling "right-sized" out of the box
   * (the Inspector was previously 320px, so Properties keeps that).
   */
  defaultWidth: number;
  /** Optional keyboard shortcut hint shown in tooltip when enabled. */
  shortcutHint?: string;
};

export const PANEL_REGISTRY: Record<PanelId, PanelDefinition> = {
  activity: {
    id: "activity",
    icon: Activity,
    label: "Activity",
    defaultEdge: "left",
    minWidth: 260,
    maxWidth: 420,
    defaultWidth: 300,
    shortcutHint: "⌘1",
  },
  properties: {
    id: "properties",
    icon: SlidersHorizontal,
    label: "Properties",
    defaultEdge: "right",
    minWidth: 280,
    maxWidth: 420,
    defaultWidth: 320,
    shortcutHint: "⌘2",
  },
};

export const ALL_PANEL_IDS: PanelId[] = Object.keys(PANEL_REGISTRY) as PanelId[];

export function getPanelDefinition(id: PanelId): PanelDefinition {
  return PANEL_REGISTRY[id];
}

/**
 * Lazy getter so callers can clamp a persisted width into the panel's
 * allowed range without having to inline the min/max boundaries.
 */
export function clampPanelWidth(id: PanelId, px: number): number {
  const def = PANEL_REGISTRY[id];
  return Math.max(def.minWidth, Math.min(def.maxWidth, Math.round(px)));
}
