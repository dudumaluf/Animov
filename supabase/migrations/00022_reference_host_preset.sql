-- ─── Reference preset: host-guided walkthrough with speed-ramps ───
-- A person from the reference set acts as the on-screen host, presenting and
-- walking through each environment while the camera speed-ramps (accelerates
-- then eases) between rooms, oscillating between wide host shots and tight
-- close-up b-roll of the property's materials and details.
--
-- Follows the "base + style" architecture (see 00021): vision_system_prompt
-- holds ONLY the STYLE brief; /api/reference/compose prepends the shared
-- ref-base director rules. prompt_template is the deterministic fallback used
-- when the vision call fails (placeholders {refs_manifest} / {user_hint}).

insert into public.recipes
  (category_id, slug, display_name, short_label, description, icon, scope, processing_mode, vision_system_prompt, prompt_template, sort_order)
values
  ((select id from public.recipe_categories where slug = 'reference'),
   'ref-host', 'Anfitrião guiado', 'Anfitrião',
   'A pessoa apresenta e caminha pelos ambientes, com speed-ramps entre cômodos e b-rolls de detalhes',
   'clapperboard', 'video_reference', 'vision',
   'STYLE — Host-guided walkthrough with speed-ramps: treat the person reference as the on-screen HOST who presents the property and leads the camera from space to space. The host is present in every environment, gesturing to and showcasing one standout feature of each room (the view, the kitchen island, the natural light, a finish). Travel between environments with deliberate speed-ramps — accelerate the camera move out of one room and decelerate to a smooth settle as the next space and the host come into frame. Oscillate the shot scale: alternate wide establishing shots that include the host inhabiting the space with tight close-up b-roll inserts of materials, textures and details (use detail images for these macro cutaways). Keep it energetic yet polished, with a confident, charismatic host-led rhythm and natural, flattering light.',
   'Host-guided walkthrough of the referenced spaces: {refs_manifest}. The person hosts on camera, present in each environment and showcasing one key feature per room; speed-ramped camera travels accelerate then ease to a settle between environments, alternating wide shots of the host in the space with tight close-up b-roll of materials and details. Energetic, polished, charismatic pacing. Preserve every reference faithfully. {user_hint}',
   25)
on conflict (slug) do nothing;
