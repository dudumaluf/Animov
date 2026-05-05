"use client";

import { useEffect, useRef } from "react";

import { useAdminFlags } from "@/hooks/use-admin-flags";
import {
  ALL_PANEL_IDS,
  type PanelId,
} from "@/lib/dock/panel-registry";
import { useDockStore } from "@/stores/dock-store";
import { useBatchesStore } from "@/stores/batches-store";
import { useJobsStore } from "@/stores/jobs-store";
import { useProjectStore } from "@/stores/project-store";

/**
 * useDockBehavior
 * ---------------
 * Wires admin-flag driven side-effects onto the dock store:
 *
 *  1. Properties drawer auto-opens when a scene / edit node is selected
 *     (flag `dock.properties.auto_open_on_select`).
 *  2. Activity drawer auto-opens once per browser session on the first
 *     batch dispatch (flag `dock.auto_open_activity_on_first_batch`).
 *  3. On viewports below the "min both open" threshold we keep at most one
 *     drawer open per edge — opening a second on the same side closes the
 *     other so the canvas doesn't get strangled.
 *
 * None of these behaviours mutate user preferences: they're transient
 * openPanel / closePanel calls that the user can override by clicking the
 * rail. The hook is intentionally idempotent — calling it from multiple
 * components would just re-register the same listeners.
 */
export function useDockBehavior() {
  const flags = useAdminFlags();
  const openPanel = useDockStore((s) => s.openPanel);
  const closePanel = useDockStore((s) => s.closePanel);

  /* ─ Properties drawer ↔ selection coupling ────────────────
   * The Properties panel is meaningless without a selection (it would
   * render an empty card). We bind it 1:1 to the selection state:
   *   - selection appears  → openPanel("properties")
   *   - selection clears   → closePanel("properties")
   *   - panel closes (any cause: chassis X, pill toggle, Cmd+2)
   *                        → selectScene(null) so we never end up in a
   *                          mismatched "no selection but panel open"
   *                          state on the next render.
   * The dedupe key on auto-open prevents re-opening the panel when the
   * user manually closes it while the same scene is still selected. */
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const editNodeSelected = useProjectStore((s) => s.editNodeSelected);
  const hasSelection = !!selectedSceneId || editNodeSelected;

  const lastAutoOpen = useRef<string | null>(null);

  useEffect(() => {
    if (!flags["dock.properties.auto_open_on_select"]) return;
    if (!hasSelection) {
      // Selection cleared — let the next selection re-arm the auto-open.
      lastAutoOpen.current = null;
      return;
    }
    const key = selectedSceneId ?? (editNodeSelected ? "__edit__" : null);
    if (!key || lastAutoOpen.current === key) return;
    lastAutoOpen.current = key;
    openPanel("properties");
  }, [flags, hasSelection, selectedSceneId, editNodeSelected, openPanel]);

  // Close the panel when selection drops to nothing. Using a separate
  // effect (instead of a `useDockStore.subscribe` inside the open effect)
  // keeps the open and close concerns visually parallel and avoids racing
  // store subscriptions with the auto-open dedupe key.
  useEffect(() => {
    if (hasSelection) return;
    // `closePanel` is a no-op when the panel is already closed.
    closePanel("properties");
  }, [hasSelection, closePanel]);

  // Mirror: any close path on Properties (chassis X, pill toggle,
  // Cmd+2) clears the selection. One subscription handles all sources
  // so individual close callers don't need to know about the project
  // store. The check guards against the open→open and closed→closed
  // transitions so we don't repeatedly call selectScene(null).
  useEffect(() => {
    let prevOpen = useDockStore.getState().panels.properties.open;
    const unsub = useDockStore.subscribe((state) => {
      const nextOpen = state.panels.properties.open;
      if (prevOpen && !nextOpen) {
        useProjectStore.getState().selectScene(null);
      }
      prevOpen = nextOpen;
    });
    return () => unsub();
  }, []);

  /* ─ Auto-open Activity on first dispatch ────────────────── */
  useEffect(() => {
    if (!flags["dock.auto_open_activity_on_first_batch"]) return;
    if (typeof window === "undefined") return;
    const MARKER = "animov:activity_auto_opened";
    if (window.sessionStorage.getItem(MARKER) === "1") return;

    // Watch for the first batch that moves from preview → dispatched.
    const unsub = useBatchesStore.subscribe((state, prev) => {
      const prevDispatched = prev.batches.filter((b) => !!b.dispatchedAt).length;
      const currDispatched = state.batches.filter((b) => !!b.dispatchedAt).length;
      if (currDispatched > prevDispatched) {
        openPanel("activity");
        window.sessionStorage.setItem(MARKER, "1");
        unsub();
      }
    });
    return () => unsub();
  }, [flags, openPanel]);

  /* ─ Small-screen guard ──────────────────────────────────── */
  const minBoth = flags["dock.min_screen_for_both_open"];
  useEffect(() => {
    if (typeof window === "undefined") return;
    let prevWidth = window.innerWidth;
    let prevOpen: Record<PanelId, boolean> = extractOpenMap();

    function extractOpenMap() {
      const panels = useDockStore.getState().panels;
      const out = {} as Record<PanelId, boolean>;
      for (const id of ALL_PANEL_IDS) out[id] = panels[id].open;
      return out;
    }

    // Listen for *open* transitions — if a second panel opens on the same
    // edge while we're under the threshold, close the other one.
    const unsub = useDockStore.subscribe((state) => {
      const next = {} as Record<PanelId, boolean>;
      for (const id of ALL_PANEL_IDS) next[id] = state.panels[id].open;

      if (prevWidth < minBoth) {
        for (const id of ALL_PANEL_IDS) {
          if (!prevOpen[id] && next[id]) {
            // Newly opened — close any other panel on the same edge.
            const edge = state.panels[id].edge;
            for (const other of ALL_PANEL_IDS) {
              if (other === id) continue;
              if (state.panels[other].edge !== edge) continue;
              if (!state.panels[other].open) continue;
              closePanel(other);
            }
          }
        }
      }
      prevOpen = next;
    });

    const onResize = () => {
      prevWidth = window.innerWidth;
    };
    window.addEventListener("resize", onResize);
    return () => {
      unsub();
      window.removeEventListener("resize", onResize);
    };
  }, [closePanel, minBoth]);
}

/**
 * useEditorUnmountSafety
 * ----------------------
 * Guards against losing in-flight batches when the user navigates away:
 *  - Warns with `beforeunload` if any job is queued or running.
 *  - On actual unmount (e.g. route change via client nav) aborts all
 *    running jobs so their AbortControllers don't leak fetch connections.
 */
export function useEditorUnmountSafety() {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const running = useJobsStore
        .getState()
        .jobs.filter((j) => j.status === "queued" || j.status === "running").length;
      if (running === 0) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      // On normal route changes, stop anything still running so their
      // AbortControllers don't leak fetch connections.
      useJobsStore.getState().abortAll();
    };
  }, []);
}
