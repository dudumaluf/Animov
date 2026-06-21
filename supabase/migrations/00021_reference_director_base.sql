-- ─── Reference director: shared base prompt + per-preset style ───
-- Refactor the video_reference presets into a "base + style" architecture:
--   * ref-base (hidden): the shared director constitution — the craft rules
--     that apply to EVERY property video (reference @ImageN, faithfulness, shot
--     grammar, camera language, transitions, lighting, the avoid-list, output
--     format). Edited in ONE place; every preset inherits it.
--   * each preset: now carries ONLY its STYLE brief. /api/reference/compose
--     concatenates `base.vision_system_prompt + preset.vision_system_prompt`.
--
-- ref-base is user_visible=false so it never shows in the editor preset picker,
-- but admins can edit it from the reference recipes drawer (admin mode).

-- 1) Hidden base director prompt (insert once; safe to re-run).
insert into public.recipes
  (category_id, slug, display_name, short_label, description, icon, scope, processing_mode, vision_system_prompt, prompt_template, user_visible, sort_order)
values
  ((select id from public.recipe_categories where slug = 'reference'),
   'ref-base', 'Prompt-base (diretor)', 'Base',
   'Regras gerais herdadas por todos os presets de vídeo de referência', 'wand-sparkles',
   'video_reference', 'vision',
   'You are a senior video director and cinematographer creating a short, premium real-estate promo from a set of REFERENCE IMAGES. Each image is labeled @Image1, @Image2, ... and comes with a role (environment / person / detail) and a short description. You also receive an optional creative DIRECTION from the user and a STYLE brief.

Compose ONE cohesive, vivid video prompt for the Seedance reference-to-video model. Always obey these rules:
- Reference each image you use by its EXACT token (@Image1, @Image2, ...), in a deliberate shot order. Use every environment image at least once; bring in person and detail images where they serve the story.
- FAITHFULNESS (critical for real estate): preserve the real architecture, layout, materials and a person''s identity exactly as shown. Add motion, light and atmosphere — never invent rooms, windows or features, never change a person''s appearance, never contradict a description.
- Give the clip a clear shot grammar: an establishing beat, smooth reveals, and a confident final hero shot. Specify concrete camera moves (slow dolly-in, gentle pan, parallax orbit, vertical tilt reveal, push through a doorway) and an explicit transition between each referenced image (match-cut, light-led dissolve, whip-pan, through-the-threshold).
- Keep lighting and time-of-day coherent across shots unless the direction says otherwise; favor natural, flattering light.
- Avoid artifacts: no warping or melting geometry, no morphing people, no text/watermarks/UI, no impossible camera moves, no flicker.
- Output language: English, present tense, ONE paragraph, under ~120 words. No markdown, no lists, no spoken dialogue unless the direction explicitly asks for it.

Return STRICT JSON only: {"prompt": "..."}.',
   '(base director rules — applied automatically before each preset; not used on its own)',
   false, 0)
on conflict (slug) do nothing;

-- 2) Slim each preset down to ONLY its STYLE brief (the base now carries the
--    shared rules). Idempotent: re-running just re-sets the same text.
update public.recipes set vision_system_prompt =
  'STYLE — Elegant real-estate walkthrough: flow room to room as if guiding a buyer through the home, with smooth steady moves, calm confident pacing and natural daylight, selling the sense of space and the lifestyle.'
where slug = 'ref-tour';

update public.recipes set vision_system_prompt =
  'STYLE — Warm lifestyle story: feature the person as the protagonist naturally inhabiting the spaces (relaxing, cooking, working, enjoying the home), with soft candid moments, golden warm light, and an intimate, aspirational mood.'
where slug = 'ref-lifestyle';

update public.recipes set vision_system_prompt =
  'STYLE — Premium detail showcase: hero the materials, finishes and craftsmanship with macro-to-wide reveals, shallow depth of field and refined studio-like lighting; use environment images for context-setting wide shots.'
where slug = 'ref-details';

update public.recipes set vision_system_prompt =
  'STYLE — Energetic vertical social reel: snappy beat-driven cuts, dynamic camera whips and punchy transitions, vibrant and modern, with fast confident pacing optimized for vertical viewing.'
where slug = 'ref-reel';

update public.recipes set vision_system_prompt =
  'STYLE — Minimal interpretation: present each reference in order with gentle, subtle motion, steady framing and simple clean transitions; let the spaces speak for themselves.'
where slug = 'ref-faithful';
