"use client";

import { DrawerChassis } from "./drawer-chassis";
import { Inspector } from "./inspector";

/**
 * PropertiesDrawer
 * ----------------
 * Thin wrapper that mounts the existing `Inspector` inside the shared
 * `DrawerChassis`. The Inspector remains the single source of truth for
 * per-scene / edit-node editing; this component only contributes the
 * chassis (header, pin/close, resize handle) so it blends into the new
 * DockRail system.
 *
 * Inspector's internal layout is preserved; we only switch it into
 * "embedded" mode so its outer `<aside>` stops fighting with the chassis
 * for border, background, and width.
 */
export type PropertiesDrawerProps = {
  onPreviewVideo?: (url: string) => void;
  onExport?: () => void;
  onDownloadLast?: () => void;
  onEditImage?: (sceneId: string) => void;
  onOpenProjectSettings?: () => void;
  /** Controlled by the DockRail from `dock.resize_enabled`. */
  resizable?: boolean;
};

export function PropertiesDrawer({
  resizable = true,
  ...inspectorProps
}: PropertiesDrawerProps) {
  // Properties is bound to selection (see useDockBehavior) — pin would
  // contradict that lifecycle, so it's hidden here. Activity keeps pin.
  return (
    <DrawerChassis
      title="Properties"
      panelId="properties"
      resizable={resizable}
      hidePin
    >
      <Inspector embedded {...inspectorProps} />
    </DrawerChassis>
  );
}
