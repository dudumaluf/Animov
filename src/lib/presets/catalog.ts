export type PresetDefinition = {
  id: string;
  displayName: string;
  description: string;
  type: "single" | "dual";
  visionTier: "fast" | "smart";
  visionSystemPrompt: string;
  promptTemplate: string;
  fallbackPresetId?: string;
};

function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = data[key];
    return val != null ? String(val) : `{${key}}`;
  });
}

export function buildPromptFromTemplate(preset: PresetDefinition, visionData: Record<string, unknown>): string {
  const depth = visionData.depth_available ?? visionData.depth_separation;
  const enriched: Record<string, unknown> = {
    ...visionData,
    depth_percent: depth === "deep" ? "20%" : depth === "medium" || depth === "moderate" ? "12%" : "6%",
    tilt_degrees: visionData.vertical_range_available === "tall" ? "18°" : visionData.vertical_range_available === "medium" ? "12°" : "8°",
  };
  return renderTemplate(preset.promptTemplate, enriched);
}

export const PRESET_CATALOG: PresetDefinition[] = [
  {
    id: "push_in_serene",
    displayName: "Avanço Suave",
    description: "Dolly lento em direção ao ponto focal principal",
    type: "single",
    visionTier: "fast",
    visionSystemPrompt: `You are a cinematographer analyzing a real estate photo. Identify the most visually compelling focal point in the frame — a window, a piece of furniture, an architectural element. Assess whether lighting is stable (consistent across the frame) or shifting (mixed sources, strong contrast). Estimate the available depth for a forward camera move.

Respond ONLY in JSON matching this schema:
{
  "focal_point": "string (short description of the focal point)",
  "light_stability": "stable | shifting",
  "depth_available": "shallow | medium | deep"
}`,
    promptTemplate: `Slow cinematic dolly-in toward {focal_point}. Camera moves forward smoothly, advancing approximately {depth_percent} of the visible depth. Subtle handheld stabilization. Lighting remains {light_stability}. Photorealistic continuation of the still image. Locked architecture. Preserve all visible furniture and surfaces exactly as photographed. Camera-only motion, no scene changes.`,
  },

  {
    id: "parallax_architectural",
    displayName: "Parallax",
    description: "Movimento lateral revelando profundidade",
    type: "single",
    visionTier: "smart",
    visionSystemPrompt: `You are a cinematographer planning a parallax shot for a real estate photo. Identify a clear foreground element and a clear background element with visible depth separation between them. Decide which lateral direction would best reveal that separation. Assess the strength of the depth separation.

If the photo has no clear depth separation (flat composition), set depth_separation to "weak".

Respond ONLY in JSON matching this schema:
{
  "foreground_element": "string",
  "background_element": "string",
  "parallax_axis": "left_to_right | right_to_left",
  "depth_separation": "weak | moderate | strong"
}`,
    promptTemplate: `Subtle lateral parallax movement, camera glides {parallax_axis} by approximately 8% of frame width. Foreground {foreground_element} shifts slightly faster than background {background_element}, revealing natural depth. Photorealistic, locked architecture, preserve all surfaces and furniture exactly. Camera-only motion, no scene changes, no new elements.`,
    fallbackPresetId: "push_in_serene",
  },

  {
    id: "golden_hour_drift",
    displayName: "Golden Hour",
    description: "Drift contemplativo, luz natural",
    type: "single",
    visionTier: "fast",
    visionSystemPrompt: `You are a cinematographer planning a contemplative drift shot. Assess the quality of light in the photo. Identify the atmospheric subject — the element that carries the mood (a patch of sunlight, a backlit curtain, light on a texture).

Respond ONLY in JSON matching this schema:
{
  "light_quality": "warm_natural | cool_natural | mixed | artificial",
  "atmospheric_subject": "string (element that carries the atmosphere)"
}`,
    promptTemplate: `Extremely slow contemplative drift forward, micro handheld breathing movement, camera advances barely 4% of depth. {light_quality} lighting preserved with focus on {atmospheric_subject}. Cinematic, meditative pace. Photorealistic, locked architecture, preserve every visible surface and furniture exactly as photographed. Camera-only motion.`,
  },

  {
    id: "tilt_vertical",
    displayName: "Tilt Vertical",
    description: "Tilt up ou down revelando altura",
    type: "single",
    visionTier: "fast",
    visionSystemPrompt: `You are a cinematographer planning a vertical tilt for a real estate photo. Decide whether tilting up (to reveal height/ceiling) or tilting down (to reveal floor/foreground) would be more impactful given the composition. Identify what is being revealed.

Respond ONLY in JSON matching this schema:
{
  "tilt_direction": "up | down",
  "tilt_subject": "string (what is being revealed)",
  "vertical_range_available": "short | medium | tall"
}`,
    promptTemplate: `Slow elegant vertical tilt {tilt_direction}, revealing {tilt_subject}. Tilt range approximately {tilt_degrees}. Smooth motorized motion, no shake. Photorealistic, locked architecture, preserve all visible elements exactly as photographed. Camera-only motion.`,
  },

  {
    id: "orbit_subtle",
    displayName: "Giro Sutil",
    description: "Micro-orbita ao redor do centro",
    type: "single",
    visionTier: "smart",
    visionSystemPrompt: `You are a cinematographer planning a subtle orbit shot. Identify a clear central subject suitable for orbiting (well-defined object, roughly centered in frame, with visible space around it). Determine the better orbit direction based on lighting and composition. If no suitable centered subject exists, set subject_centered to false.

Respond ONLY in JSON matching this schema:
{
  "orbit_subject": "string (central object)",
  "orbit_direction": "clockwise | counter_clockwise",
  "subject_centered": true | false
}`,
    promptTemplate: `Subtle {orbit_direction} orbit around {orbit_subject}, approximately 15 degrees of arc. Slow, smooth, locked focus on the subject. Background parallax follows naturally. Photorealistic, preserve all visible architecture and furniture exactly. Camera-only motion, no new elements.`,
    fallbackPresetId: "push_in_serene",
  },

  {
    id: "rack_focus",
    displayName: "Foco Viajante",
    description: "Foco viaja entre planos",
    type: "single",
    visionTier: "smart",
    visionSystemPrompt: `You are a cinematographer planning a rack focus shot. Identify a clear near-plane subject and a clear far-plane subject. Decide the more narratively interesting focus direction.

Respond ONLY in JSON matching this schema:
{
  "near_focus_subject": "string",
  "far_focus_subject": "string",
  "focus_direction": "near_to_far | far_to_near"
}`,
    promptTemplate: `Static camera, rack focus pull from {near_focus_subject} in foreground to {far_focus_subject} in background. Smooth, slow focus transition. Camera position is locked, no movement. Photorealistic, preserve all visible elements exactly.`,
  },

  {
    id: "depth_reveal",
    displayName: "Reveal",
    description: "Revelação a partir de elemento próximo",
    type: "single",
    visionTier: "smart",
    visionSystemPrompt: `You are a cinematographer planning a depth reveal shot. Identify an element in the immediate foreground of the photo that can act as a "veil" — the camera will start framed by this element and pull back/move to reveal the space behind it. The veil MUST already be visible in the photo. If no suitable foreground veil exists, set veil_element to "none".

Respond ONLY in JSON matching this schema:
{
  "veil_element": "string (foreground element or 'none')",
  "revealed_space": "string (what is revealed behind)",
  "veil_position": "left | right | top | bottom | center"
}`,
    promptTemplate: `Camera starts framed by {veil_element} in the {veil_position} of the frame, slowly pulls back to reveal {revealed_space}. The {veil_element} remains visible throughout, gradually showing more of the space behind it. Photorealistic, preserve all visible architecture and furniture exactly. Camera-only motion, no new elements appear.`,
    fallbackPresetId: "push_in_serene",
  },
];

export function getPreset(presetId: string): PresetDefinition | undefined {
  return PRESET_CATALOG.find((p) => p.id === presetId);
}
