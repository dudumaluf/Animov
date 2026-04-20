-- AI Transitions: store real model duration + sprite sheet metadata + staging
-- lifecycle, so the timeline segment length matches the actual file and scrub
-- can show an instant sprite overlay (same UX as scenes).
ALTER TABLE public.transitions
  ADD COLUMN IF NOT EXISTS duration_seconds numeric(6,3),
  ADD COLUMN IF NOT EXISTS sprite_json jsonb,
  ADD COLUMN IF NOT EXISTS staging_status text;

COMMENT ON COLUMN public.transitions.duration_seconds IS
  'Real duration returned by the video model (seconds). NULL = fallback to cost_credits.';
COMMENT ON COLUMN public.transitions.sprite_json IS
  'Sprite sheet metadata: { url, frames, columns, rows, thumbWidth, thumbHeight }.';
COMMENT ON COLUMN public.transitions.staging_status IS
  'Sprite staging lifecycle: pending | ready | failed. NULL = not staged yet.';
