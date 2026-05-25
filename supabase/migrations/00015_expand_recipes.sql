-- ============================================================
-- Expand recipes catalog: 4 new categories + 17 new recipes
-- ============================================================
--
-- Targets the real-estate audience (corretor / construtora / fotografo).
-- Each recipe maps to a concrete use case from user research:
--   - cleanup     : remove visual noise (clutter, cables, personal items)
--   - composition : correct angle / perspective issues from amateur shots
--   - exterior    : facade and outdoor scenes (huge gap in the catalog)
--   - render      : CGI render -> photorealistic, construction site -> finished
--
-- All seeds use ON CONFLICT (slug) DO NOTHING so re-running is safe and
-- existing records are preserved.

-- ─── New categories ────────────────────────────────────────────
-- color_token is constrained in 00007 to (time|polish|staging|material|asset).
-- Reuse the closest semantic value for each new category — visual theming
-- only; categories themselves are independent of color_token meaning.
insert into public.recipe_categories (slug, display_name, description, icon, color_token, sort_order) values
  ('cleanup',     'Limpar',        'Remover ruído visual: tralha, fios, identificadores',  'eraser',     'polish',   25),
  ('composition', 'Composição',    'Corrigir ângulo, perspectiva e enquadramento',         'crop',       'polish',   35),
  ('exterior',    'Exterior',      'Fachada, jardim, paisagismo e céu',                    'tree-pine',  'material', 45),
  ('render',      'Render para foto','CGI ou obra em andamento → fotografia realista',      'image-down', 'staging',  55)
on conflict (slug) do nothing;

-- ─── Move existing 'declutter' from staging to cleanup ─────────
-- Semantically it's removal, not staging. Safe to run multiple times.
update public.recipes
   set category_id = (select id from public.recipe_categories where slug = 'cleanup')
 where slug = 'declutter';

-- ─── New recipes ───────────────────────────────────────────────

insert into public.recipes (category_id, slug, display_name, short_label, description, icon, scope, processing_mode, vision_system_prompt, prompt_template, sort_order) values

  -- ── TIME: overcast (gap between day and the dramatic ones) ──
  ((select id from public.recipe_categories where slug = 'time'), 'overcast', 'Dia nublado',  'Nublado', 'Luz suave difusa de dia nublado',  'cloud', 'target', 'vision',
   'You are a real-estate photo editor. The user wants overcast soft daylight: even diffuse light, no harsh shadows, gently muted colors, slightly cool color temperature. Preserve architecture, furniture and composition exactly. Output one concise edit prompt (max 60 words). Return STRICT JSON: {"prompt": "..."}.',
   'Convert to overcast soft daylight. Even diffuse natural light, no harsh shadows, gently muted color palette, slightly cool tone. Preserve architecture, furniture and composition exactly. {user_hint}',
   50),

  -- ── POLISH: window-pull ──
  ((select id from public.recipe_categories where slug = 'polish'), 'window-pull', 'Recuperar janelas', 'Janela', 'Recupera vista de janelas estouradas', 'square-arrow-down', 'target', 'vision',
   'You are a real-estate photo editor. The user has blown-out (overexposed) windows. Recover the highlights to reveal a realistic outdoor view. CRITICAL: do not invent specific architecture, signs, or recognizable buildings outside; favor neutral sky, soft clouds, distant green vegetation, or gentle blur if uncertain. Preserve interior architecture, furniture and lighting balance. Output one concise edit prompt (max 70 words). Return STRICT JSON: {"prompt": "..."}.',
   'Recover blown-out window highlights to reveal a believable outdoor view: neutral sky, soft clouds, distant vegetation. Do not invent specific buildings or signs. Keep the interior architecture, furniture and overall lighting balance unchanged. {user_hint}',
   30),

  -- ── STAGING: add-lifestyle-person ──
  ((select id from public.recipe_categories where slug = 'staging'), 'add-lifestyle-person', 'Adicionar pessoa', 'Pessoa', 'Pessoa vivendo o ambiente naturalmente', 'user', 'target', 'vision',
   'You are a real-estate stylist. Add ONE person naturally inhabiting the space, with a pose appropriate to the room (reading on the sofa, cooking at the counter, working at a desk). Face turned away or in soft profile so identity is not foregrounded. Realistic clothing, neutral palette. Preserve all furniture, decor and architecture exactly. Output one concise edit prompt (max 70 words). Return STRICT JSON: {"prompt": "..."}.',
   'Add one person naturally inhabiting the space, pose fitting the room (reading, cooking, working). Face turned away or in soft profile. Realistic neutral clothing. Preserve all furniture, decor, architecture and lighting exactly. {user_hint}',
   40),

  -- ── STAGING: transform-room-purpose (HIGH RISK, smart vision tier hint via prompt) ──
  ((select id from public.recipe_categories where slug = 'staging'), 'transform-room-purpose', 'Transformar propósito', 'Propósito', 'Vazio vira escritório/quarto/sala via hint', 'replace', 'target', 'vision',
   'You are a real-estate stylist. The user wants to transform an empty (or differently-purposed) room into a new purpose given by {user_hint} — for example: home office, kids bedroom, guest room, dining room. Add appropriate furniture, decor and accessories tastefully. CRITICAL: preserve walls, floor, ceiling, windows, doors, lighting and architectural geometry EXACTLY as photographed; only fill the empty space with new functional elements. Output one concise edit prompt (max 90 words). Return STRICT JSON: {"prompt": "..."}.',
   'Transform this room into a {user_hint} setup with appropriate furniture and styling. Preserve walls, floor, ceiling, windows, doors and architectural geometry exactly as they are; only add furniture and decor that fit the new purpose. Tasteful neutral palette, contemporary feel. {user_hint}',
   50),

  -- ── MATERIAL: wall-color (template — relies entirely on user_hint) ──
  ((select id from public.recipe_categories where slug = 'material'), 'wall-color', 'Cor de parede', 'Cor parede', 'Repintar paredes na cor escolhida', 'paint-bucket', 'target', 'template', null,
   'Repaint the wall surfaces in {user_hint} (matte finish unless user specifies otherwise). Preserve architecture, trim, baseboards, furniture, flooring and lighting exactly. Keep the same wall texture characteristics.',
   30),

  -- ── MATERIAL: kitchen-counter (template) ──
  ((select id from public.recipe_categories where slug = 'material'), 'kitchen-counter', 'Trocar bancada', 'Bancada', 'Trocar bancada de cozinha (mármore, quartzo...)', 'square-stack', 'target', 'template', null,
   'Replace the kitchen counter material with {user_hint}. Preserve the cabinetry, appliances, sink, layout and overall kitchen architecture exactly. Match natural lighting on the new surface.',
   40),

  -- ── MATERIAL: floor-style (template) ──
  ((select id from public.recipe_categories where slug = 'material'), 'floor-style', 'Trocar piso', 'Piso custom', 'Trocar tipo de piso via hint', 'layout-panel-top', 'target', 'template', null,
   'Replace the floor with {user_hint} (e.g. light oak planks, polished concrete, large-format porcelain tile). Preserve walls, baseboards, furniture, doors and perspective exactly. Match the existing lighting direction on the new floor.',
   30),

  -- ── CLEANUP: remove-clutter (loose stuff, distinct from declutter which moves here too) ──
  -- Note: legacy 'declutter' (from 00007) is now in cleanup category via the UPDATE above.
  -- This new 'remove-clutter' is intentionally redundant in name BUT scoped narrower
  -- (loose objects only, not personal items / cables which get their own recipes).
  ((select id from public.recipe_categories where slug = 'cleanup'), 'remove-loose-items', 'Tirar objetos soltos', 'Objetos soltos', 'Brinquedos, roupas, papéis, comida fora do lugar', 'trash-2', 'target', 'vision',
   'You are a real-estate stylist. Remove loose, transient objects from the scene: toys on the floor, clothes draped over chairs, papers and food on counters, dishes left out. Keep furniture, decor that belongs to the room, lighting and architecture intact. Output one concise edit prompt (max 60 words). Return STRICT JSON: {"prompt": "..."}.',
   'Remove loose transient objects: toys, clothes left on furniture, papers, food, dishes out of place. Keep all furniture, decor, lighting and architecture intact. {user_hint}',
   20),

  -- ── CLEANUP: remove-cables ──
  ((select id from public.recipe_categories where slug = 'cleanup'), 'remove-cables', 'Tirar fios', 'Fios', 'Cabos visíveis de TV, tomadas, internet', 'cable', 'target', 'vision',
   'You are a real-estate retoucher. Remove visible cables and wires from walls, surfaces and floors: TV cables, internet cables, lamp cords, charger wires. Replace with the clean wall, floor or surface that should be behind. Preserve outlets, switches, devices and the lighting on those surfaces. Output one concise edit prompt (max 50 words). Return STRICT JSON: {"prompt": "..."}.',
   'Remove all visible cables and wires from walls, floors and surfaces (TV cables, lamp cords, chargers). Reconstruct the clean wall or surface behind them. Preserve outlets, switches and devices. {user_hint}',
   30),

  -- ── CLEANUP: remove-personal (privacy / LGPD / depersonalize) ──
  ((select id from public.recipe_categories where slug = 'cleanup'), 'remove-personal', 'Despersonalizar', 'Privacidade', 'Tirar fotos pessoais e identificadores', 'shield-off', 'target', 'vision',
   'You are a real-estate retoucher. Remove personal identifiers from the scene: family photos in frames, identifiable text (names on labels, mail), personal documents, distinctive religious or political items. Replace photo frames with neutral abstract art OR leave the frame empty against the wall. Preserve all furniture, architecture and lighting. Output one concise edit prompt (max 60 words). Return STRICT JSON: {"prompt": "..."}.',
   'Remove personal identifiers: family photos, identifiable text on labels or mail, personal documents. Replace photo frames with neutral abstract art or leave the wall clean. Preserve furniture, architecture and lighting exactly. {user_hint}',
   40),

  -- ── COMPOSITION: straighten-lines (keystone correction) ──
  ((select id from public.recipe_categories where slug = 'composition'), 'straighten-lines', 'Corrigir verticais', 'Verticais', 'Corrige paredes "caindo" de lente wide', 'flip-vertical', 'target', 'vision',
   'You are a real-estate photo editor. The user has keystone distortion typical of a wide-angle lens shot from below or above eye level: vertical edges (walls, door frames, window frames) appear to converge or lean. Correct the vertical perspective so all true verticals are perfectly upright. Preserve content, furniture, materials and aspect of horizontal proportions as much as possible. Output one concise edit prompt (max 55 words). Return STRICT JSON: {"prompt": "..."}.',
   'Correct vertical perspective so all true verticals (walls, door and window frames) are perfectly upright. Remove keystone distortion typical of a wide-angle shot. Preserve content, furniture, materials and horizontal proportions. {user_hint}',
   10),

  -- ── EXTERIOR: facade-clean ──
  ((select id from public.recipe_categories where slug = 'exterior'), 'facade-clean', 'Limpar fachada', 'Fachada limpa', 'Sem fios, carros, lixo, placas extras', 'house', 'target', 'vision',
   'You are a real-estate retoucher working on a building exterior. Clean the facade by removing: visible power lines and cables, parked cars in front, pedestrians, trash and dumpsters, temporary signage, construction debris. Preserve building architecture, materials, windows, balconies and the sky exactly as photographed. Output one concise edit prompt (max 65 words). Return STRICT JSON: {"prompt": "..."}.',
   'Clean the building facade: remove power lines, parked cars in front, pedestrians, trash, temporary signage, construction debris. Preserve building architecture, materials, windows and the sky exactly. {user_hint}',
   10),

  -- ── EXTERIOR: golden-facade ──
  ((select id from public.recipe_categories where slug = 'exterior'), 'golden-facade', 'Golden hour fachada', 'Golden fachada', 'Luz dourada de fim de tarde no exterior', 'sunset', 'target', 'vision',
   'You are a real-estate photo editor. Apply warm golden-hour side-lighting to the building exterior: long soft shadows from a low sun angle, warm cast on the facade materials, warm colored sky (orange, soft pink). Preserve the building, vegetation, hardscape and composition exactly. Output one concise edit prompt (max 60 words). Return STRICT JSON: {"prompt": "..."}.',
   'Apply golden-hour warm side-lighting to the exterior: low sun, long soft shadows, warm cast on the facade, warm orange-pink sky. Preserve the building, vegetation and composition exactly. {user_hint}',
   20),

  -- ── EXTERIOR: blue-sky ──
  ((select id from public.recipe_categories where slug = 'exterior'), 'blue-sky', 'Céu azul', 'Céu azul', 'Substituir céu cinza por azul ensolarado', 'sun', 'target', 'vision',
   'You are a real-estate photo editor. Replace the sky with a clear blue daytime sky with light scattered clouds (no overcast, no storm). Add a sunlit appearance to the building consistent with the new sky. Preserve building, vegetation and foreground exactly. Output one concise edit prompt (max 55 words). Return STRICT JSON: {"prompt": "..."}.',
   'Replace the sky with a clear blue daytime sky with light scattered clouds. Make the lighting on the building consistent with sunny daylight. Preserve building, vegetation and foreground exactly. {user_hint}',
   30),

  -- ── EXTERIOR: add-greenery ──
  ((select id from public.recipe_categories where slug = 'exterior'), 'add-greenery', 'Adicionar paisagismo', 'Paisagismo', 'Vegetação e jardim ao redor', 'tree-pine', 'target', 'vision',
   'You are a real-estate stylist. Add tasteful landscaping around the base of the building: lawn, ornamental shrubs, small ornamental trees, flowerbeds appropriate to the building style. Greenery proportional to the building scale. Preserve facade, hardscape (driveway, sidewalk), windows and architecture exactly. Output one concise edit prompt (max 65 words). Return STRICT JSON: {"prompt": "..."}.',
   'Add tasteful landscaping around the base of the building: lawn, ornamental shrubs, small trees, flowerbeds. Proportional to the building scale. Preserve facade, hardscape, windows and architecture exactly. {user_hint}',
   40),

  -- ── RENDER: render-to-photo ──
  ((select id from public.recipe_categories where slug = 'render'), 'render-to-photo', 'Render para foto', 'Realismo', 'Render CGI vira fotografia realista', 'image-down', 'target', 'vision',
   'You are a photo-realism specialist. The input is a CGI architectural render that needs to look like a real photograph. Add: natural light variance and bounce, micro surface imperfections, realistic textures (slight grain, real wood grain, fabric weave), softer realistic shadows, slight chromatic aberration on edges, very subtle noise. CRITICAL: preserve geometry, materials, layout, decor and composition EXACTLY. Treat as if photographed with a professional full-frame camera at f/8. Output one concise edit prompt (max 80 words). Return STRICT JSON: {"prompt": "..."}.',
   'Convert this architectural render into a photorealistic photograph. Add natural light variance, micro surface imperfections, realistic textures, soft realistic shadows, very subtle noise and grain. Preserve geometry, materials, layout, decor and composition exactly. Treat as if shot with a professional full-frame camera at f/8. {user_hint}',
   10),

  -- ── RENDER: construction-finished (HIGH RISK) ──
  ((select id from public.recipe_categories where slug = 'render'), 'construction-finished', 'Obra → finalizado', 'Finalizado', 'Foto de obra simula imóvel pronto', 'hammer', 'target', 'vision',
   'You are a real-estate visualization specialist. The input is a photo of a property under construction (exposed walls, no finishes, scaffolding, etc.). Show the same property as if it were COMPLETED with modern professional finishing. CRITICAL constraints: preserve ALL visible structural geometry exactly — walls, openings (windows, doors), ceiling height, room dimensions, structural columns. Only fill in the SURFACES (wall paint, floor finish, ceiling finish, trim) with a tasteful contemporary completion. Remove construction artifacts (scaffolding, debris, exposed wiring, unpainted concrete). Output one concise edit prompt (max 90 words). Return STRICT JSON: {"prompt": "..."}.',
   'Show this under-construction property as if completed with modern professional finishing. Preserve all visible structural geometry exactly: walls, windows, doors, ceiling height, dimensions, structural columns. Fill in surfaces (wall paint, floor finish, ceiling, trim) with a tasteful contemporary completion. Remove all construction artifacts: scaffolding, debris, exposed wiring, unpainted concrete. {user_hint}',
   20)

on conflict (slug) do nothing;
