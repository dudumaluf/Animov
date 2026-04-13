-- ============================================================
-- Animov.ai — Migration 003: Align models table with adapter IDs
-- Removes placeholder seeds and inserts the actual models used
-- ============================================================

DELETE FROM public.models
WHERE model_key NOT IN ('kling-o1-pro', 'kling-v3-pro');

INSERT INTO public.models (provider, model_key, display_name, cost_per_second, supports_start_end_frame, active)
VALUES
  ('fal.ai', 'kling-o1-pro', 'Kling O1 Pro', 0.112, true, true),
  ('fal.ai', 'kling-v3-pro', 'Kling V3 Pro', 0.112, true, true)
ON CONFLICT (model_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  cost_per_second = EXCLUDED.cost_per_second,
  supports_start_end_frame = EXCLUDED.supports_start_end_frame,
  active = EXCLUDED.active;
