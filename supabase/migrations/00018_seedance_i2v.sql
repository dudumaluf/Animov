-- ============================================================
-- Animov.ai — Migration 018: Seedance 2 Image-to-Video model
-- Phase 1 adapter — scenes + transitions via start/end frames
-- ============================================================

INSERT INTO public.models (provider, model_key, display_name, cost_per_second, supports_start_end_frame, active)
VALUES
  ('fal.ai', 'seedance-2-i2v', 'Seedance 2', 0.3034, true, true)
ON CONFLICT (model_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  cost_per_second = EXCLUDED.cost_per_second,
  supports_start_end_frame = EXCLUDED.supports_start_end_frame,
  active = EXCLUDED.active;
