-- Separate clip duration from generation target duration.
-- `duration` keeps reflecting the effective clip length (native minus trim).
-- `generation_target_seconds` is the target we ask the model for on the NEXT
-- generation, wiped on success so the UI never confuses past vs future intent.
ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS generation_target_seconds numeric(6,3);

COMMENT ON COLUMN public.scenes.generation_target_seconds IS
  'Target duration requested from model on next generation. NULL = fallback to scene.duration.';
