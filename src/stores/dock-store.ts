"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  ALL_PANEL_IDS,
  PANEL_REGISTRY,
  clampPanelWidth,
  type PanelId,
} from "@/lib/dock/panel-registry";
import type { AdminFlags, DockEdge } from "@/hooks/use-admin-flags";

/**
 * Dock store
 * ----------
 * Runtime state for the bilateral DockRail system: for every panel in the
 * registry we track whether it's open, pinned, its user-resized width, and
 * which edge it sits on. All persisted in localStorage so a power user's
 * layout survives reloads.
 *
 * The store boots from sensible defaults derived from the registry, and is
 * later "hydrated" with admin feature flags (edge / width overrides) via
 * `hydrateFromAdminFlags`. Hydration respects user customization — if the
 * user has already dragged a drawer to 340px, we don't stomp it with the
 * admin flag's 300px default.
 */

export type PanelState = {
  id: PanelId;
  open: boolean;
  pinned: boolean;
  widthPx: number;
  edge: DockEdge;
  /** Width chosen by the user explicitly (via drag). Null until they resize. */
  userWidthPx: number | null;
};

type DockStore = {
  panels: Record<PanelId, PanelState>;
  /**
   * Global visibility of BOTH rails (icons and drawers). Used by theater /
   * foco mode to hide the whole dock without destroying each panel's state.
   */
  railVisible: boolean;
  /** Marker so hydration only runs once per browser tab, not on every mount. */
  hasHydratedFromFlags: boolean;

  hydrateFromAdminFlags: (flags: AdminFlags) => void;

  togglePanel: (id: PanelId) => void;
  openPanel: (id: PanelId) => void;
  closePanel: (id: PanelId) => void;
  setPinned: (id: PanelId, pinned: boolean) => void;
  setWidth: (id: PanelId, px: number) => void;
  setPanelEdge: (id: PanelId, edge: DockEdge) => void;
  setRailVisible: (visible: boolean) => void;

  /**
   * Derived view: panels currently assigned to a given edge. Order is the
   * registry order so the visual stacking stays predictable.
   */
  getPanelsForEdge: (edge: DockEdge) => PanelState[];
};

function defaultPanelState(id: PanelId): PanelState {
  const def = PANEL_REGISTRY[id];
  return {
    id,
    open: false,
    pinned: false,
    widthPx: def.defaultWidth,
    edge: def.defaultEdge,
    userWidthPx: null,
  };
}

function initialPanels(): Record<PanelId, PanelState> {
  const out = {} as Record<PanelId, PanelState>;
  for (const id of ALL_PANEL_IDS) out[id] = defaultPanelState(id);
  return out;
}

/* ── Helpers ────────────────────────────────────────────────────── */

/** `DEFAULT_ADMIN_FLAGS` is the shape we use when migrating and when the
 * user has never loaded the admin flags yet — keeps the migration path
 * deterministic. */
const EDGE_FLAG_KEY: Record<PanelId, keyof AdminFlags> = {
  activity: "dock.panels.activity.edge",
  properties: "dock.panels.properties.edge",
};

/** One-shot migration from the legacy `editor-settings-store.inspectorDensity`
 * into a properties-panel state. Kept isomorphic so we can run it at import
 * time without reading from Zustand subscribers. */
function migrateFromInspectorDensity(): {
  propertiesOpen: boolean;
  propertiesPinned: boolean;
  railVisible: boolean;
} {
  if (typeof window === "undefined") {
    return { propertiesOpen: true, propertiesPinned: true, railVisible: true };
  }
  try {
    const raw = window.localStorage.getItem("animov-editor-settings-v1");
    if (!raw) {
      return { propertiesOpen: true, propertiesPinned: true, railVisible: true };
    }
    const parsed = JSON.parse(raw) as {
      state?: {
        layout?: {
          inspectorDensity?: "full" | "railed" | "hidden";
        };
      };
    };
    const density = parsed.state?.layout?.inspectorDensity;
    if (density === "hidden") {
      return { propertiesOpen: false, propertiesPinned: false, railVisible: false };
    }
    if (density === "railed") {
      return { propertiesOpen: false, propertiesPinned: false, railVisible: true };
    }
    return { propertiesOpen: true, propertiesPinned: true, railVisible: true };
  } catch {
    return { propertiesOpen: true, propertiesPinned: true, railVisible: true };
  }
}

/* ── Store ──────────────────────────────────────────────────────── */

export const useDockStore = create<DockStore>()(
  persist(
    (set, get) => ({
      panels: initialPanels(),
      railVisible: true,
      hasHydratedFromFlags: false,

      hydrateFromAdminFlags: (flags) => {
        const state = get();
        if (state.hasHydratedFromFlags) return;

        // First boot: apply admin-flag edges + widths + migrate legacy layout.
        const migration = migrateFromInspectorDensity();
        const nextPanels = { ...state.panels };

        for (const id of ALL_PANEL_IDS) {
          const current = nextPanels[id];
          const flagKey = EDGE_FLAG_KEY[id];
          const adminEdge = flags[flagKey] as DockEdge | undefined;
          const fallbackEdge = PANEL_REGISTRY[id].defaultEdge;
          const nextEdge: DockEdge = adminEdge ?? fallbackEdge;

          // User resize (userWidthPx) always wins over admin default width —
          // admin flag only provides a sensible starting point, not a hard
          // reset for someone who has already customized their layout.
          const widthFromFlags =
            typeof flags["dock.default_width"] === "number"
              ? flags["dock.default_width"]
              : PANEL_REGISTRY[id].defaultWidth;
          const nextWidth = current.userWidthPx ?? clampPanelWidth(id, widthFromFlags);

          nextPanels[id] = {
            ...current,
            edge: nextEdge,
            widthPx: nextWidth,
          };
        }

        // The legacy `inspectorDensity` migration only contributes
        // `railVisible` now — Properties is bound to selection (see
        // `useDockBehavior`), so force-opening it on first boot would
        // immediately produce an empty drawer card before the user has
        // selected anything.

        set({
          panels: nextPanels,
          railVisible: migration.railVisible,
          hasHydratedFromFlags: true,
        });
      },

      togglePanel: (id) => {
        const cur = get().panels[id];
        if (cur.open) {
          get().closePanel(id);
        } else {
          get().openPanel(id);
        }
      },

      openPanel: (id) => {
        const { panels } = get();
        const target = panels[id];
        if (target.open) return;
        set({
          panels: { ...panels, [id]: { ...target, open: true } },
          railVisible: true,
        });
      },

      closePanel: (id) => {
        const { panels } = get();
        const target = panels[id];
        if (!target.open) return;
        // Closing also unpins so the next selection doesn't surprise-reopen.
        // Pin survives only while it's actually serving as "don't auto-close me".
        set({
          panels: {
            ...panels,
            [id]: { ...target, open: false, pinned: false },
          },
        });
      },

      setPinned: (id, pinned) => {
        const { panels } = get();
        const target = panels[id];
        if (target.pinned === pinned) return;
        set({
          panels: { ...panels, [id]: { ...target, pinned } },
        });
      },

      setWidth: (id, px) => {
        const { panels } = get();
        const clamped = clampPanelWidth(id, px);
        set({
          panels: {
            ...panels,
            [id]: { ...panels[id], widthPx: clamped, userWidthPx: clamped },
          },
        });
      },

      setPanelEdge: (id, edge) => {
        const { panels } = get();
        const target = panels[id];
        if (target.edge === edge) return;
        set({
          panels: { ...panels, [id]: { ...target, edge } },
        });
      },

      setRailVisible: (visible) => {
        set({ railVisible: visible });
      },

      getPanelsForEdge: (edge) => {
        const { panels } = get();
        return ALL_PANEL_IDS.map((id) => panels[id]).filter((p) => p.edge === edge);
      },
    }),
    {
      name: "animov-dock-v1",
      version: 1,
      // Persist everything except the one-shot hydration marker — we want
      // new admin-flag updates to re-apply on next mount if needed.
      partialize: (s) => ({
        panels: s.panels,
        railVisible: s.railVisible,
      }),
      migrate: (persisted, version) => {
        void version;
        const fallback = {
          panels: initialPanels(),
          railVisible: true,
        };
        if (!persisted || typeof persisted !== "object") return fallback;
        const p = persisted as Partial<{
          panels: Record<PanelId, PanelState>;
          railVisible: boolean;
        }>;
        return {
          panels: p.panels ?? fallback.panels,
          railVisible: p.railVisible ?? fallback.railVisible,
        };
      },
    },
  ),
);

/* ── Selectors ──────────────────────────────────────────────────── */

/**
 * Returns the list of panels on a given edge. We subscribe to the stable
 * `panels` map (zustand only hands back a new reference when a panel actually
 * changes) and project-and-filter it through `useMemo`, so the component
 * gets a cached array. Returning a fresh `.map().filter()` directly from the
 * zustand selector would break `useSyncExternalStore`'s cache check and
 * trigger the "getSnapshot should be cached" infinite-loop warning.
 */
export function usePanelsForEdge(edge: DockEdge): PanelState[] {
  const panels = useDockStore((s) => s.panels);
  return useMemo(
    () => ALL_PANEL_IDS.map((id) => panels[id]).filter((p) => p.edge === edge),
    [panels, edge],
  );
}

export function useIsPanelOpen(id: PanelId): boolean {
  return useDockStore((s) => s.panels[id].open);
}

export function usePanelState(id: PanelId): PanelState {
  return useDockStore((s) => s.panels[id]);
}

export function useRailVisible(): boolean {
  return useDockStore((s) => s.railVisible);
}

/**
 * Sum of open-drawer widths on a given edge — the canvas uses this to pad
 * itself so content never slips under a drawer.
 */
export function useOpenDrawerWidth(edge: DockEdge): number {
  return useDockStore((s) => {
    let total = 0;
    for (const id of ALL_PANEL_IDS) {
      const p = s.panels[id];
      if (p.edge === edge && p.open) total += p.widthPx;
    }
    return total;
  });
}

/**
 * Gap between the screen edge and the floating drawer card, mirrored between
 * the drawer-to-canvas side. Kept here so {@link useOpenEdgeInset} and the
 * drawer-portal CSS stay in sync; if the card ever moves to e.g. 12px, this
 * is the single source of truth.
 */
export const FLOATING_GAP_PX = 8;

/**
 * Canvas padding on a given edge that accounts for any open floating drawers.
 * Returns `0` when the edge has no open drawer so the canvas can claim the
 * full width; otherwise returns `drawerWidth + 2 * FLOATING_GAP_PX` (one gap
 * between the screen edge and the drawer, another between the drawer and the
 * canvas content).
 */
export function useOpenEdgeInset(edge: DockEdge): number {
  const width = useOpenDrawerWidth(edge);
  return width === 0 ? 0 : width + FLOATING_GAP_PX * 2;
}

/**
 * True when at least one panel is assigned to this edge — drives rail
 * visibility. A rail with zero panels assigned is invisible so the canvas
 * can claim that space.
 */
export function useEdgeHasPanels(edge: DockEdge): boolean {
  return useDockStore((s) =>
    ALL_PANEL_IDS.some((id) => s.panels[id].edge === edge),
  );
}
