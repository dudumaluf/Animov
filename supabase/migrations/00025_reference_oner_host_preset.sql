-- ─── Reference preset: continuous one-shot (plano-sequência) host tour ───
-- A single unbroken take with NO hard cuts: a floating, gliding gimbal that
-- speed-ramps through doorways and hallways and eases to savor each room's hero
-- feature, bridging environments with in-camera transitions only. The person
-- reference acts as the on-screen HOST who REAPPEARS and presents in EVERY
-- environment and on every transition between ambients — never vanishing as the
-- camera flows from room to room.
--
-- Follows the "base + style" architecture (see 00021): vision_system_prompt
-- holds ONLY the STYLE brief; /api/reference/compose prepends the shared
-- ref-base director rules. prompt_template is the deterministic fallback used
-- when the vision call fails (placeholders {refs_manifest} / {user_hint}).
-- Distinct from 00022 'ref-host' (which intercuts cutaway b-roll inserts); this
-- one is strictly a cut-free oner. sort_order 60 places it after the existing
-- visible presets (max 50). Idempotent: on conflict (slug) do nothing.

insert into public.recipes
  (category_id, slug, display_name, short_label, description, icon, scope, processing_mode, vision_system_prompt, prompt_template, active, user_visible, sort_order)
values
  ((select id from public.recipe_categories where slug = 'reference'),
   'ref-host-oner', 'Plano-sequência guiado', 'Contínuo',
   'Plano-sequência sem cortes com speed-ramps; o anfitrião reaparece e apresenta cada ambiente',
   'clapperboard', 'video_reference', 'vision',
   'STYLE — Continuous one-shot host tour (plano-sequência): build the WHOLE clip as a single unbroken take with no hard cuts — one floating, gliding gimbal that flows from space to space as if in one breath. Speed-ramp the motion: accelerate through hallways, doorways and thresholds, then decelerate to savor each room''s hero feature before easing into the next. Bridge environments with in-camera transitions only — push through doorways, sweep around corners, whip-pans and match-moves that hide the seam — never a cut. CRITICAL: keep the person (the host) present and presenting in EVERY environment — reference the host''s @ImageN token again in each room and on every transition between ambients, walking just ahead of the camera, gesturing to and introducing each space''s standout feature so the host reappears the instant the camera arrives. Hold the host''s identity and the real architecture, layout and materials consistent throughout; energetic yet elegant, with natural light evolving believably from room to room.',
   'One continuous single-take (plano-sequência) host tour through the referenced spaces in order: {refs_manifest}. A floating gimbal glides from room to room with speed-ramps — accelerating through doorways and hallways, easing to savor each hero feature — using only in-camera transitions (through doorways, around corners, whip-pans, match-moves) with no hard cuts. The person hosts on camera and reappears presenting in EVERY environment and on each transition, gesturing to and introducing each space''s standout feature. Preserve every reference faithfully — identity, architecture and materials consistent throughout. {user_hint}',
   true, true, 60)
on conflict (slug) do nothing;
