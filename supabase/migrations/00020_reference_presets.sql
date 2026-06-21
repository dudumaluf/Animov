-- ─── Reference video presets (Seedance reference-to-video) ───
-- Creative "director" presets for the Reference Studio are stored as recipes
-- with a new scope `video_reference`. Unlike image-edit recipes (which emit an
-- edit instruction for ONE image), these compose a single @Image1..N video
-- prompt from a whole reference group:
--   * vision_system_prompt = the director brief (style + rules)
--   * prompt_template       = deterministic fallback used when the vision call
--                             fails / returns empty. Placeholders:
--                               {refs_manifest} -> enumerated @ImageN list
--                               {user_hint}     -> optional creative guidance
--
-- Seedance references images in the prompt as @Image1, @Image2, ... (verified
-- against fal docs), which matches the app's ReferenceImage.label convention.

-- 1) Widen the scope check to allow 'video_reference'. The 00007 inline check
--    is auto-named `recipes_scope_check`; drop + re-add as a named constraint.
alter table public.recipes drop constraint if exists recipes_scope_check;
alter table public.recipes
  add constraint recipes_scope_check
  check (scope in ('target', 'asset', 'any', 'video_reference'));

-- 2) Category for reference presets. color_token is constrained to the original
--    set (time|polish|staging|material|asset) — reuse 'staging' for theming only.
insert into public.recipe_categories (slug, display_name, description, icon, color_token, sort_order) values
  ('reference', 'Vídeo de referência', 'Estilos de direção para vídeo a partir de um grupo de imagens de referência', 'clapperboard', 'staging', 60)
on conflict (slug) do nothing;

-- 3) Seed director presets (scope=video_reference, processing_mode=vision).
insert into public.recipes (category_id, slug, display_name, short_label, description, icon, scope, processing_mode, vision_system_prompt, prompt_template, sort_order) values

  ((select id from public.recipe_categories where slug = 'reference'), 'ref-tour', 'Tour imobiliário', 'Tour', 'Passeio cinematográfico e elegante pelos ambientes', 'home', 'video_reference', 'vision',
   'You are a senior video director composing ONE prompt for the Seedance reference-to-video model. You receive a set of REFERENCE IMAGES, each labeled @Image1, @Image2, ... with a role (environment / person / detail) and a short description, plus optional creative guidance from the user.

Write ONE cohesive, vivid video prompt (English, present tense). CRITICAL RULES:
- Reference each image you use by its EXACT token (@Image1, @Image2, ...). Use every environment image at least once; weave in person and detail images where they fit naturally.
- Preserve the real content and identity of each reference. Do NOT invent new rooms, change a person''s appearance, or contradict the descriptions.
- Describe a clear shot sequence with camera movement (dolly, pan, tilt, orbit, push-in, crane), transitions between shots, pacing, lighting and mood.
- Keep it under ~120 words. No markdown, no lists.
- Style: an elegant, calm real-estate walkthrough that flows room to room with smooth steady moves and natural daylight, selling the lifestyle and the sense of space.
Return STRICT JSON only: {"prompt": "..."}.',
   'Cinematic real-estate walkthrough moving smoothly through the referenced spaces in order: {refs_manifest}. Slow dolly moves and gentle pans, natural daylight, elegant transitions between rooms, calm confident pacing. Preserve every reference faithfully. {user_hint}',
   10),

  ((select id from public.recipe_categories where slug = 'reference'), 'ref-lifestyle', 'Lifestyle', 'Lifestyle', 'Pessoa vivendo os ambientes de forma natural e calorosa', 'user', 'video_reference', 'vision',
   'You are a senior video director composing ONE prompt for the Seedance reference-to-video model. You receive a set of REFERENCE IMAGES, each labeled @Image1, @Image2, ... with a role (environment / person / detail) and a short description, plus optional creative guidance from the user.

Write ONE cohesive, vivid video prompt (English, present tense). CRITICAL RULES:
- Reference each image you use by its EXACT token (@Image1, @Image2, ...). Use every environment image at least once; feature the person image(s) as the protagonist inhabiting the spaces.
- Preserve the real content and identity of each reference. Do NOT invent new rooms, change the person''s appearance, or contradict the descriptions.
- Describe a clear shot sequence with camera movement, transitions, pacing, lighting and mood.
- Keep it under ~120 words. No markdown, no lists.
- Style: a warm lifestyle story where the person naturally inhabits the spaces (relaxing, cooking, working, enjoying the home); soft candid moments, golden warm light, intimate and aspirational.
Return STRICT JSON only: {"prompt": "..."}.',
   'Warm lifestyle sequence in the referenced spaces: {refs_manifest}. The person moves naturally through the rooms in candid everyday moments, soft golden light, intimate handheld feel, smooth transitions. Preserve every reference faithfully. {user_hint}',
   20),

  ((select id from public.recipe_categories where slug = 'reference'), 'ref-details', 'Showcase de detalhes', 'Detalhes', 'Destaque de materiais, acabamentos e detalhes', 'gem', 'video_reference', 'vision',
   'You are a senior video director composing ONE prompt for the Seedance reference-to-video model. You receive a set of REFERENCE IMAGES, each labeled @Image1, @Image2, ... with a role (environment / person / detail) and a short description, plus optional creative guidance from the user.

Write ONE cohesive, vivid video prompt (English, present tense). CRITICAL RULES:
- Reference each image you use by its EXACT token (@Image1, @Image2, ...). Prioritize detail images; use environment images for context-setting wide shots.
- Preserve the real content and identity of each reference. Do NOT invent new materials or contradict the descriptions.
- Describe a clear shot sequence with camera movement, transitions, pacing, lighting and mood.
- Keep it under ~120 words. No markdown, no lists.
- Style: a premium product-style showcase that highlights materials, finishes and details with macro-to-wide reveals, shallow depth of field and refined studio-like lighting.
Return STRICT JSON only: {"prompt": "..."}.',
   'Premium showcase of the referenced subjects: {refs_manifest}. Macro-to-wide reveals on materials and finishes, shallow depth of field, refined lighting, slow graceful camera moves and clean transitions. Preserve every reference faithfully. {user_hint}',
   30),

  ((select id from public.recipe_categories where slug = 'reference'), 'ref-reel', 'Reel dinâmico', 'Reel', 'Reel vertical energético para redes sociais', 'zap', 'video_reference', 'vision',
   'You are a senior video director composing ONE prompt for the Seedance reference-to-video model. You receive a set of REFERENCE IMAGES, each labeled @Image1, @Image2, ... with a role (environment / person / detail) and a short description, plus optional creative guidance from the user.

Write ONE cohesive, vivid video prompt (English, present tense). CRITICAL RULES:
- Reference each image you use by its EXACT token (@Image1, @Image2, ...). Use every image as a quick beat in the montage.
- Preserve the real content and identity of each reference. Do NOT invent new rooms, change a person''s appearance, or contradict the descriptions.
- Describe a clear shot sequence with camera movement, transitions, pacing, lighting and mood.
- Keep it under ~120 words. No markdown, no lists.
- Style: a fast, energetic social-media reel with snappy beat-driven cuts, dynamic camera whips and punchy transitions, vibrant and modern, optimized for vertical viewing.
Return STRICT JSON only: {"prompt": "..."}.',
   'Energetic vertical reel of the referenced spaces: {refs_manifest}. Snappy beat-driven cuts, dynamic camera whips and punchy transitions, vibrant modern look, fast confident pacing. Preserve every reference faithfully. {user_hint}',
   40),

  ((select id from public.recipe_categories where slug = 'reference'), 'ref-faithful', 'Fiel às referências', 'Fiel', 'Interpretação mínima, movimento sutil', 'images', 'video_reference', 'vision',
   'You are a senior video director composing ONE prompt for the Seedance reference-to-video model. You receive a set of REFERENCE IMAGES, each labeled @Image1, @Image2, ... with a role (environment / person / detail) and a short description, plus optional creative guidance from the user.

Write ONE cohesive, vivid video prompt (English, present tense). CRITICAL RULES:
- Reference each image you use by its EXACT token (@Image1, @Image2, ...). Present each reference in order with minimal interpretation.
- Preserve the real content and identity of each reference exactly. Do NOT invent new content or contradict the descriptions.
- Describe gentle, subtle motion and simple clean transitions; keep framing steady and lighting natural to each reference.
- Keep it under ~120 words. No markdown, no lists.
- Style: minimal interpretation — let the spaces speak for themselves with restrained, tasteful motion.
Return STRICT JSON only: {"prompt": "..."}.',
   'Simple cinematic sequence of the referenced subjects: {refs_manifest}. Gentle subtle motion, steady framing, clean minimal transitions, natural lighting that matches each reference. Preserve every reference faithfully. {user_hint}',
   50)

on conflict (slug) do nothing;
