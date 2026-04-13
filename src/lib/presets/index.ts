export { PRESET_CATALOG, getPreset, buildPromptFromTemplate } from "./catalog";
export type { PresetDefinition } from "./catalog";
import { PRESET_CATALOG } from "./catalog";

export const TRANSITION_LABELS: Record<string, string> = {
  soft_dissolve_drift: "Dissolve",
  continuous_camera: "Contínua",
  match_cut: "Match Cut",
  whip_pan: "Whip Pan",
};

export function getPresetLabel(presetId: string): string {
  const preset = PRESET_CATALOG.find((p) => p.id === presetId);
  if (preset) return preset.displayName;
  return TRANSITION_LABELS[presetId] ?? presetId;
}

export function getPresetArrow(presetId: string): string {
  const preset = PRESET_CATALOG.find((p) => p.id === presetId);
  return preset?.arrow ?? "·";
}
