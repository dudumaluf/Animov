/**
 * Two-step placement pipeline prompts.
 *
 * Step 1: PLACEMENT_DESCRIPTOR_PROMPT — fed to a fast vision LLM together
 *   with the ANNOTATED target image (with numbered magenta markers). The
 *   model returns a dense semantic description of what is at each marker.
 *
 * Step 2: buildComposerPrompt() — builds the final prompt passed to the
 *   image-edit model (nano-banana-2). The composer receives the CLEAN
 *   target (no markers) + clean references + this prompt containing the
 *   semantic descriptions. This avoids any risk of marker artifacts in
 *   the output.
 */

export const PLACEMENT_DESCRIPTOR_PROMPT = `You are an expert scene analyst for architectural and real-estate visualization.

You receive a SCENE image that has been annotated with bright magenta circles numbered 1, 2, 3, ... (each with a short label in the form "N: short-name"). These markers indicate where new objects will later be placed by a separate image-edit model.

Your ONLY task: for EACH numbered marker visible in the image, produce a very dense, semantic description of what is at the exact pixel location under that marker, AS IF THE MARKER WASN'T THERE. The marker itself is just a visual guide — describe the underlying scene at that point.

Be specific and concrete about:
 1. Surfaces at the location (wood floor, marble countertop, fabric cushion, concrete wall, glass, tile, rug, grass...).
 2. Neighboring objects and their spatial relationship to the point (e.g. "between the beige sofa and the left window", "to the right of the stainless steel sink, behind the green potted plant").
 3. Rough relative position in the image as a percentage (e.g. "about 30% from the left edge and 65% from the top").
 4. Any lighting cue visible near the point (e.g. "in a patch of warm afternoon sunlight", "in soft overhead shadow").

Style and language:
 - Write ONE sentence (max two) per marker, in Portuguese.
 - Do NOT describe the marker itself or its color/number.
 - Do NOT propose what object should go there — just describe the location.

Return STRICT JSON, no markdown, no prose outside the JSON:
{
  "markers": [
    { "index": 1, "description": "..." },
    { "index": 2, "description": "..." }
  ]
}
`;

export type PositionedPlacement = {
  index: number; // 1-based; matches marker number
  name: string;
  description: string; // dense semantic location (from descriptor)
};

export type GlobalPlacement = {
  index: number;
  name: string;
};

export function buildComposerPrompt(input: {
  positioned: PositionedPlacement[];
  global: GlobalPlacement[];
  userHint?: string;
}): string {
  const positionedLines = input.positioned
    .map(
      (p) =>
        `   - Reference image[${p.index}] ("${p.name}"): place it ${p.description}`,
    )
    .join("\n");

  const globalLines = input.global
    .map(
      (g) =>
        `   - Reference image[${g.index}] ("${g.name}"): place at a sensible location that respects composition, scene function, and natural ergonomics.`,
    )
    .join("\n");

  const placementBlock = [positionedLines, globalLines].filter(Boolean).join("\n");

  const hintBlock = input.userHint?.trim()
    ? `\n\n**User hint:** ${input.userHint.trim()}`
    : "";

  return `**Role:**
You are a visual composition expert for architectural and real-estate visualization. Your task is to take one or more reference object images and seamlessly integrate them into a scene image.

**Inputs:**
 - image[0]: the SCENE image to edit.
 - image[1..]: REFERENCE object images, numbered in the same order as the placement instructions below. Treat each reference as a clean object cutout; ignore any background or padding around it.

**Placement instructions (crucial):**
Place each reference object into the scene exactly once, following these instructions precisely:
${placementBlock}${hintBlock}

**Final image requirements:**
 - Style, lighting, shadows, reflections, and camera perspective must match the original scene.
 - Re-render each object intelligently: adjust perspective and orientation to the scene's camera angle, scale appropriately relative to neighboring furniture and architecture, and cast realistic contact shadows or reflections matching the scene's visible light sources.
 - Proportional realism. For example: a lamp cannot be larger than the sofa it sits on; a chair must align with the floor plane.
 - Blend materials, reflections, and edges naturally with the surroundings. Do NOT copy-paste the reference; re-render it in the scene's visual language.
 - Each reference must appear EXACTLY ONCE in the output.
 - Do NOT return the original scene without the placements — the placements are required.
 - Do NOT add any text, watermark, annotation, or overlay to the output.

The output MUST be ONLY the final composed image.`;
}
