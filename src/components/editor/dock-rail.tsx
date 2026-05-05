"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { useAdminFlags, type DockEdge } from "@/hooks/use-admin-flags";
import { PANEL_REGISTRY, type PanelId } from "@/lib/dock/panel-registry";
import {
  useDockStore,
  usePanelsForEdge,
  useRailVisible,
  type PanelState,
} from "@/stores/dock-store";
import {
  useActiveBatches,
  deriveBatchStatus,
} from "@/stores/batches-store";
import { useJobsStore } from "@/stores/jobs-store";
import { useProjectStore } from "@/stores/project-store";

import { PropertiesDrawer } from "./properties-drawer";
import { ActivityDrawer } from "./activity-drawer";

/**
 * DockRail
 * --------
 * Portal-only host for floating drawers. One instance mounts per edge in the
 * editor layout and both read the same store — so moving a panel from left to
 * right is a single flag flip.
 *
 * Toggle buttons for the panels are rendered separately via
 * {@link PanelTogglePill} so the caller can anchor them anywhere (top-left
 * of the canvas, inside the theater wrapper, etc.) and still benefit from
 * edge-tracking because the canvas container already pads itself by the
 * open-drawer width.
 */

type DockRailProps = {
  edge: DockEdge;
  /**
   * Optional edit-mode callbacks — passed down from the editor page to the
   * Properties drawer (which wraps the existing Inspector). The DockRail
   * itself doesn't care about them, it just threads them through.
   */
  inspectorProps?: React.ComponentProps<typeof PropertiesDrawer>;
};

export function DockRail({ edge, inspectorProps }: DockRailProps) {
  const railVisible = useRailVisible();
  const panels = usePanelsForEdge(edge);

  if (!railVisible) return null;
  if (panels.length === 0) return null;

  return (
    <>
      {panels.map((panel) => (
        <DrawerPortal
          key={panel.id}
          panel={panel}
          inspectorProps={inspectorProps}
        />
      ))}
    </>
  );
}

/* ── Toggle pill ───────────────────────────────────────────────── */

/**
 * Floating pill that hosts the toggle buttons for every panel assigned to
 * `edge`. Anchor it with `className` (e.g. `absolute top-3 left-3`) inside
 * a container that has padding for the open drawer — that way the pill
 * tracks the canvas edge automatically when a drawer opens/closes.
 *
 * Each button carries the same badge + tone logic that used to live in the
 * old vertical rail icon, so switching to a floating pill doesn't lose any
 * status signal.
 */
export function PanelTogglePill({
  edge,
  className = "",
}: {
  edge: DockEdge;
  className?: string;
}) {
  const railVisible = useRailVisible();
  const panels = usePanelsForEdge(edge);
  const flags = useAdminFlags();

  if (!railVisible) return null;
  if (panels.length === 0) return null;

  return (
    <div
      className={`pointer-events-auto z-40 flex items-center gap-1 rounded-lg border border-white/5 bg-[#0A0A09]/90 p-1 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200 ${className}`}
      aria-label={edge === "left" ? "Painéis à esquerda" : "Painéis à direita"}
    >
      {panels.map((panel) => (
        <PanelToggleButton
          key={panel.id}
          panel={panel}
          showShortcut={flags["dock.keyboard_shortcuts"]}
        />
      ))}
    </div>
  );
}

function PanelToggleButton({
  panel,
  showShortcut,
}: {
  panel: PanelState;
  showShortcut: boolean;
}) {
  const toggle = useDockStore((s) => s.togglePanel);
  const def = PANEL_REGISTRY[panel.id];
  const Icon = def.icon;

  const status = usePanelStatus(panel.id);

  // Properties is bound to selection — when nothing is selected it has
  // nothing to render, so the pill becomes inert (visible for spatial
  // consistency with Activity, but ignores clicks). Once the panel is
  // open, the close path is always allowed so the user can toggle off.
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const editNodeSelected = useProjectStore((s) => s.editNodeSelected);
  const hasSelection = !!selectedSceneId || editNodeSelected;
  const inertNoSelection =
    panel.id === "properties" && !panel.open && !hasSelection;

  const baseTooltip = showShortcut && def.shortcutHint
    ? `${def.label} · ${def.shortcutHint}`
    : def.label;
  const tooltip = inertNoSelection
    ? "Selecione uma cena ou o nó de edição"
    : baseTooltip;

  const colorClass = inertNoSelection
    ? "text-text-secondary"
    : status.tone === "running"
      ? "text-accent-gold"
      : status.tone === "attention"
        ? "text-accent-gold"
        : status.tone === "error"
          ? "text-red-400"
          : panel.open
            ? "text-[var(--text)]"
            : "text-text-secondary hover:text-[var(--text)]";

  const bgClass = inertNoSelection
    ? ""
    : panel.open
      ? "bg-white/10"
      : "hover:bg-white/5";

  const interactionClass = inertNoSelection
    ? "opacity-40 cursor-not-allowed"
    : "";

  return (
    <button
      type="button"
      onClick={inertNoSelection ? undefined : () => toggle(panel.id)}
      className={`relative flex h-7 w-7 items-center justify-center rounded transition-colors ${bgClass} ${colorClass} ${interactionClass}`}
      title={tooltip}
      aria-label={tooltip}
      aria-pressed={panel.open}
      aria-disabled={inertNoSelection || undefined}
    >
      <Icon
        size={14}
        className={status.tone === "running" ? "animate-pulse" : undefined}
      />
      {status.badgeCount > 0 && (
        <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent-gold px-1 font-mono text-[8px] font-semibold text-[#0A0A09]">
          {status.badgeCount > 99 ? "99+" : status.badgeCount}
        </span>
      )}
    </button>
  );
}

/* ── Panel status computation (badges, pulses) ─────────────────── */

type PanelStatus = {
  badgeCount: number;
  /** Visual severity: controls colour + animate-pulse on the icon. */
  tone: "idle" | "running" | "attention" | "error";
};

/**
 * Derives the rail icon's badge and tint from the app state. Kept as a
 * hook so each icon subscribes only to the slices it cares about.
 */
function usePanelStatus(id: PanelId): PanelStatus {
  // Subscribing to the jobs list drives activity badges — the selector is
  // cheap because zustand diffs by reference and we only take counts.
  const activeBatches = useActiveBatches();
  const runningJobs = useJobsStore((s) =>
    s.jobs.filter((j) => j.status === "queued" || j.status === "running").length,
  );
  const failedJobs = useJobsStore((s) => s.jobs.filter((j) => j.status === "failed").length);
  const pendingStaging = useProjectStore((s) =>
    s.scenes.filter((sc) => sc.stagingStatus === "pending").length,
  );

  if (id === "activity") {
    const batchCount = activeBatches.length;
    const totalBadge = batchCount + pendingStaging;
    const hasRunning = runningJobs > 0 || pendingStaging > 0;
    const hasFailure = activeBatches.some((b) =>
      deriveBatchStatus(b, useJobsStore.getState().jobs) === "failed-partial",
    );
    return {
      badgeCount: totalBadge,
      tone: hasFailure
        ? "error"
        : hasRunning
          ? "running"
          : batchCount > 0
            ? "attention"
            : "idle",
    };
  }

  if (id === "properties") {
    void failedJobs;
    const hasFailed = useProjectStore.getState().scenes.some(
      (sc) => sc.status === "failed",
    );
    return {
      badgeCount: 0,
      tone: hasFailed ? "attention" : "idle",
    };
  }

  return { badgeCount: 0, tone: "idle" };
}

/* ── Drawer portal ─────────────────────────────────────────────── */

function DrawerPortal({
  panel,
  inspectorProps,
}: {
  panel: PanelState;
  inspectorProps?: React.ComponentProps<typeof PropertiesDrawer>;
}) {
  const flags = useAdminFlags();
  if (!panel.open) return null;
  if (typeof document === "undefined") return null;

  // Floating card: 8px gap from screen left/right and bottom, top-offset
  // accounts for the 44px editor toolbar + an 8px breathing gap. No rail
  // column to dodge anymore so the drawer sits flush against the gap.
  const positionClass =
    panel.edge === "left"
      ? "left-2 top-[52px] bottom-2"
      : "right-2 top-[52px] bottom-2";

  const animationClass =
    panel.edge === "left"
      ? "animate-in fade-in slide-in-from-left-2 duration-150"
      : "animate-in fade-in slide-in-from-right-2 duration-150";

  return createPortal(
    <div
      className={`pointer-events-auto fixed z-40 ${positionClass} ${animationClass}`}
      style={{ width: `${panel.widthPx}px` }}
    >
      <PanelContent
        panel={panel}
        inspectorProps={inspectorProps}
        resizable={flags["dock.resize_enabled"]}
      />
    </div>,
    document.body,
  );
}

function PanelContent({
  panel,
  inspectorProps,
  resizable,
}: {
  panel: PanelState;
  inspectorProps?: React.ComponentProps<typeof PropertiesDrawer>;
  resizable: boolean;
}) {
  if (panel.id === "activity") {
    return <ActivityDrawer resizable={resizable} />;
  }
  if (panel.id === "properties") {
    return <PropertiesDrawer {...inspectorProps} resizable={resizable} />;
  }
  return null;
}

/* ── Keyboard shortcuts ────────────────────────────────────────── */

/**
 * Hook mounted once at the editor root — binds Cmd+1 / Cmd+2 to toggle
 * Activity / Properties when the admin flag is on. Skipped while the user
 * is typing so we never steal focus from an input.
 */
export function useDockShortcuts() {
  const flags = useAdminFlags();
  const enabled = flags["dock.keyboard_shortcuts"];
  const toggle = useDockStore((s) => s.togglePanel);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.key === "1") {
        e.preventDefault();
        toggle("activity");
      } else if (e.key === "2") {
        e.preventDefault();
        toggle("properties");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, toggle]);
}

/* ── Hydration hook ────────────────────────────────────────────── */

/**
 * Wires admin-flag values into the dock-store on first mount. Safe to
 * call from multiple components — the store guards against re-running.
 */
export function useDockHydration() {
  const flags = useAdminFlags();
  const hydrate = useDockStore((s) => s.hydrateFromAdminFlags);
  useEffect(() => {
    hydrate(flags);
  }, [flags, hydrate]);
}
