"use client";

import { useCallback, useEffect, useRef } from "react";
import { Pin, PinOff, X } from "lucide-react";
import type { ReactNode } from "react";

import {
  PANEL_REGISTRY,
  clampPanelWidth,
  type PanelId,
} from "@/lib/dock/panel-registry";
import { useDockStore, type PanelState } from "@/stores/dock-store";
import type { DockEdge } from "@/hooks/use-admin-flags";

type DrawerChassisProps = {
  title: string;
  panelId: PanelId;
  children: ReactNode;
  /** Optional extra controls rendered on the right side of the header. */
  actions?: ReactNode;
  /** When `false`, hides the resize handle (admin flag off). */
  resizable?: boolean;
  /**
   * Hides the pin/unpin button. Used by selection-coupled drawers (like
   * Properties) where pinning has no behavioral meaning — the panel's
   * lifecycle is owned by selection, not by the user "keeping it open".
   */
  hidePin?: boolean;
};

/**
 * DrawerChassis
 * -------------
 * Shared shell for every dockable drawer in the editor. Reads its visual
 * state (edge, width, pinned) from `dock-store` so the Inspector, Activity
 * panel, and any future drawer render with identical framing.
 *
 * The chassis itself is positioned by the parent (via `fixed` + offsets in
 * `DockRail`) — this component only controls the vertical chrome: header,
 * body, border direction, and the inner resize handle.
 */
export function DrawerChassis({
  title,
  panelId,
  children,
  actions,
  resizable = true,
  hidePin = false,
}: DrawerChassisProps) {
  const panel = useDockStore((s) => s.panels[panelId]);
  const closePanel = useDockStore((s) => s.closePanel);
  const setPinned = useDockStore((s) => s.setPinned);
  const setWidth = useDockStore((s) => s.setWidth);

  const { edge } = panel;

  const onClose = useCallback(() => closePanel(panelId), [closePanel, panelId]);
  const onTogglePin = useCallback(
    () => setPinned(panelId, !panel.pinned),
    [panel.pinned, panelId, setPinned],
  );

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-white/5 bg-[#141412] shadow-[0_16px_48px_-12px_rgba(0,0,0,0.8)]"
    >
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/5 px-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="truncate font-mono text-[9px] uppercase tracking-widest text-accent-gold">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {!hidePin && (
            <button
              type="button"
              onClick={onTogglePin}
              className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                panel.pinned
                  ? "text-accent-gold hover:bg-white/5"
                  : "text-text-secondary hover:bg-white/5 hover:text-[var(--text)]"
              }`}
              title={panel.pinned ? "Desafixar" : "Afixar"}
              aria-label={panel.pinned ? "Desafixar painel" : "Afixar painel"}
            >
              {panel.pinned ? <Pin size={12} /> : <PinOff size={12} />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
            title="Fechar"
            aria-label="Fechar painel"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">{children}</div>

      {resizable && (
        <ResizeHandle
          panelId={panelId}
          edge={edge}
          currentWidth={panel.widthPx}
          onApply={(px) => setWidth(panelId, px)}
        />
      )}
    </div>
  );
}

/**
 * ResizeHandle
 * ------------
 * Thin column attached to the "inner" edge of the drawer (opposite of the
 * rail). Drag left/right to resize; the new width is persisted once pointer
 * is released so intermediate states don't churn through localStorage.
 */
function ResizeHandle({
  panelId,
  edge,
  currentWidth,
  onApply,
}: {
  panelId: PanelId;
  edge: DockEdge;
  currentWidth: number;
  onApply: (px: number) => void;
}) {
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragState.current = { startX: e.clientX, startWidth: currentWidth };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [currentWidth],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const state = dragState.current;
      if (!state) return;
      const delta = e.clientX - state.startX;
      // Left-edge drawers grow rightwards as the handle moves right; right-edge
      // drawers grow leftwards as the handle moves left. Sign of the delta
      // flips accordingly so a single "drag inward" always shrinks the drawer.
      const signedDelta = edge === "left" ? delta : -delta;
      const next = clampPanelWidth(panelId, state.startWidth + signedDelta);
      onApply(next);
    };
    const up = () => {
      dragState.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [edge, onApply, panelId]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Redimensionar ${PANEL_REGISTRY[panelId].label}`}
      onPointerDown={onPointerDown}
      className={`absolute top-0 bottom-0 z-10 w-1.5 cursor-col-resize select-none bg-transparent transition-colors hover:bg-white/5 ${
        edge === "left" ? "right-0" : "left-0"
      }`}
    />
  );
}

/**
 * Reads `PanelState.edge` from the store for the given panelId — useful for
 * drawer wrappers that need to adapt layout but don't want to re-derive
 * everything the chassis already knows.
 */
export function usePanelEdge(panelId: PanelId): PanelState["edge"] {
  return useDockStore((s) => s.panels[panelId].edge);
}
