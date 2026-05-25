export type PresetDefinition = {
  id: string;
  displayName: string;
  description: string;
  arrow: string;
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
    arrow: "→",    displayName: "Avanço Suave",
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
    arrow: "↔",    displayName: "Parallax",
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
    arrow: "◐",    displayName: "Golden Hour",
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
    arrow: "↕",    displayName: "Tilt Vertical",
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
    arrow: "↻",    displayName: "Giro Sutil",
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
    arrow: "⊙",    displayName: "Foco Viajante",
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
    arrow: "⟵",    displayName: "Reveal",
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

  // ── Interior, vertical translation (not rotation like tilt_vertical) ──
  // Targets lofts, lobbies, double-height living rooms — anywhere ceiling
  // height itself is a feature.
  {
    id: "boom_up_reveal",
    arrow: "⇧",    displayName: "Subir Vertical",
    description: "Câmera sobe revelando pé-direito",
    type: "single",
    visionTier: "fast",
    visionSystemPrompt: `You are a cinematographer evaluating a real estate photo for a vertical boom (camera physically rises straight up — not a tilt). Identify what is revealed as the camera rises (high ceiling, mezzanine, double-height feature, chandelier). Assess how much vertical extent the space actually has. If the ceiling is low and uninteresting, set vertical_extent to "short" (we'll fall back to a different preset).

Respond ONLY in JSON matching this schema:
{
  "vertical_subject": "string (what is being revealed above)",
  "vertical_extent": "short | medium | tall",
  "ceiling_feature": "string (specific feature: beam, chandelier, skylight, etc — or 'none')"
}`,
    promptTemplate: `Smooth vertical boom-up: camera rises straight upward without rotating, revealing {vertical_subject}. {ceiling_feature} becomes visible as the rise completes. Slow motorized motion, no shake. Photorealistic, locked architecture, preserve every visible surface and furniture exactly. Camera-only motion.`,
    fallbackPresetId: "push_in_serene",
  },

  // ── Interior, immersive walkthrough simulation ──
  // Mixes a very subtle push-in with tiny lateral drift and breathing,
  // simulating someone slowly walking into the space. Best on photos with
  // a strong leading line / corridor / depth into the frame.
  {
    id: "handheld_walk_through",
    arrow: "⤳",    displayName: "Passeio Imersivo",
    description: "Steadycam suave simulando entrar no ambiente",
    type: "single",
    visionTier: "smart",
    visionSystemPrompt: `You are a cinematographer planning an immersive steadycam walk-through of a real estate photo. Identify the leading line into the space (the path a person would naturally walk). Decide if there is a meaningful destination (a window, an open door, a focal piece of furniture). If the photo has no leading line into depth (flat composition), set leading_line to "none".

Respond ONLY in JSON matching this schema:
{
  "leading_line": "string (path into the scene, or 'none')",
  "destination": "string (where the walk leads)",
  "drift_axis": "left | right | center"
}`,
    promptTemplate: `Slow immersive steadycam walk-through: camera advances gently into the space along {leading_line} toward {destination}, with subtle {drift_axis} drift and natural micro handheld breathing. Pace of someone leisurely entering the room. Photorealistic, locked architecture, preserve every visible surface and furniture exactly. Camera-only motion, no new elements.`,
    fallbackPresetId: "push_in_serene",
  },

  // ── Interior, accelerated detail focus ──
  // Cinematic ease-in-out toward a specific photogenic detail. Different
  // from push_in_serene (linear, broad focal point) — here we identify a
  // small detail (texture, finish, decorative item) worth highlighting.
  {
    id: "whip_to_detail",
    arrow: "⇨",    displayName: "Foco no Detalhe",
    description: "Wide acelera até um detalhe (acabamento, textura)",
    type: "single",
    visionTier: "smart",
    visionSystemPrompt: `You are a cinematographer planning a "wow, look at this" detail shot. Identify the single most photogenic detail in the scene — a luxury finish, a texture (marble veining, wood grain, fabric weave), a decorative element, a hardware piece. The detail must be small enough that a quick focus-in would reveal more than the wide shot. If no such detail exists, set detail_type to "none".

Respond ONLY in JSON matching this schema:
{
  "detail_subject": "string (specific detail to highlight)",
  "detail_position": "left | right | top | bottom | center",
  "detail_type": "finish | texture | decor | hardware | none"
}`,
    promptTemplate: `Cinematic ease-in-out push toward {detail_subject} in the {detail_position} of the frame. Camera starts wide and accelerates smoothly into a tighter framing of the {detail_type}, decelerating as the detail fills more of the frame. Photorealistic, locked architecture, preserve every visible surface and furniture exactly. Camera-only motion.`,
    fallbackPresetId: "push_in_serene",
  },

  // ── Universal filler, no vision needed ──
  // Pure micro-zoom in/out cycle. Keeps a still photo "alive" without
  // analyzing the content — safe baseline when other presets would have
  // weak signals to work with. Vision call returns empty JSON to keep the
  // existing pipeline contract without making meaningful API spend.
  {
    id: "micro_zoom_breathing",
    arrow: "↺",    displayName: "Respiração",
    description: "Micro zoom lento, mantém vida sem analisar conteúdo",
    type: "single",
    visionTier: "fast",
    visionSystemPrompt: `Respond ONLY with the empty JSON object: {}`,
    promptTemplate: `Very slow micro-zoom breathing: camera zooms in approximately 3% then slowly back out, smooth ease-in-out cycle. Subtle, almost imperceptible — gives the still photo natural cinematic life. Photorealistic, locked architecture, preserve every visible surface and furniture exactly. Camera-only motion, no scene changes.`,
  },

  // ── Exterior, drone-style pull-away ──
  // For facade photos. Camera "takes off" backwards and slightly up,
  // revealing the building's surroundings. The vocabulary of property
  // launch videos.
  {
    id: "drone_pull_away",
    arrow: "⇱",    displayName: "Drone Decola",
    description: "Câmera se afasta revelando o entorno (fachadas)",
    type: "single",
    visionTier: "fast",
    visionSystemPrompt: `You are a cinematographer planning a drone pull-away shot from a building exterior. Identify the building/facade as the foreground subject. Identify what surrounds it (street, vegetation, neighboring buildings, sky, ocean — whatever is actually visible in the photo). If the photo is not actually a building exterior, set is_exterior to false.

Respond ONLY in JSON matching this schema:
{
  "building_subject": "string (the building or facade)",
  "surroundings": "string (what is visible around the building)",
  "is_exterior": true | false
}`,
    promptTemplate: `Smooth drone pull-away: camera retreats backwards and rises slightly, starting close on {building_subject} and gradually revealing {surroundings}. Slow, cinematic, no handheld shake. Photorealistic, preserve the building, its materials and the surroundings exactly as photographed. Camera-only motion, no new elements appear.`,
    fallbackPresetId: "push_in_serene",
  },

  // ── Exterior, vertical translation along a tall facade ──
  // Different from boom_up_reveal (which targets interior ceiling height)
  // and from tilt_vertical (which rotates). Here the camera physically
  // translates upward along the facade plane, useful for tall buildings,
  // showing balconies / floors in sequence.
  {
    id: "vertical_pan_over_facade",
    arrow: "⇧⇧",    displayName: "Subir Fachada",
    description: "Câmera sobe ao longo de fachada vertical (prédios)",
    type: "single",
    visionTier: "fast",
    visionSystemPrompt: `You are a cinematographer planning a vertical translation along a tall building facade. Identify the facade subject and the vertical features the camera passes (floors, balconies, windows). Assess how much vertical extent the photo actually shows. If the building is short or the photo doesn't actually show a tall facade, set facade_height to "short".

Respond ONLY in JSON matching this schema:
{
  "facade_subject": "string (the facade)",
  "vertical_features": "string (floors, balconies, windows revealed as camera rises)",
  "facade_height": "short | medium | tall"
}`,
    promptTemplate: `Smooth vertical translation upward along {facade_subject}, camera physically rises (not tilts) parallel to the facade plane. {vertical_features} pass through the frame as the camera ascends. Slow, motorized, no shake. Photorealistic, preserve facade materials, windows and architectural details exactly. Camera-only motion.`,
    fallbackPresetId: "drone_pull_away",
  },
];

export function getPreset(presetId: string): PresetDefinition | undefined {
  return PRESET_CATALOG.find((p) => p.id === presetId);
}
