-- ─── Reference job output options (tier / resolution / aspect ratio) ───
-- The reference generator now exposes the Seedance output knobs in the UI:
--   * model_tier  — 'standard' or 'fast' (different fal endpoint + price). The
--     status route MUST poll the same tier it submitted, so we persist it.
--   * resolution  — '480p' or '720p' (affects both render and cost).
--   * aspect_ratio — the concrete value sent to fal ('auto' or an enum), already
--     resolved from any "follow the canvas" UI preference.
-- Defaults match the prior hard-coded behavior so historical rows are unchanged.

alter table public.reference_jobs
  add column if not exists model_tier   text not null default 'standard',
  add column if not exists resolution   text not null default '720p',
  add column if not exists aspect_ratio text not null default 'auto';
