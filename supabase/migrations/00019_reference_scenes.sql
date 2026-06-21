-- ─── Reference-group scenes (Seedance reference-to-video) ───
-- A reference group is a single scene/node that bundles several reference
-- images (each with a role + AI-written description), an optional preset, and
-- a composed prompt. All of that lives in a single JSONB blob so the existing
-- scene save/load pipeline carries it without extra tables.
--
-- `source_type` already exists (00006_scene_source_type.sql) as free-text with
-- default 'image' and NO check constraint, so the new 'reference-group' value
-- needs no migration here.

alter table public.scenes
  add column if not exists reference_config jsonb;

comment on column public.scenes.reference_config is
  'Reference-group payload: { analysisStatus, images:[{id,url,role,label,description}], presetId?, guidance?, generateAudio?, composedPrompt? }. Null for normal image/video scenes.';
