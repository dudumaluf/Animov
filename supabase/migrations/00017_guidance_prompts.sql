-- Optional free-text guidance the user can attach to a scene's motion preset
-- and to an AI transition. Appended to the auto-built prompt at generation
-- time so users can steer results without replacing the curated templates.
ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS guidance_prompt text;

ALTER TABLE public.transitions
  ADD COLUMN IF NOT EXISTS guidance_prompt text;

COMMENT ON COLUMN public.scenes.guidance_prompt IS
  'Optional user text appended to the preset-built prompt on the next scene generation. NULL = preset only.';
COMMENT ON COLUMN public.transitions.guidance_prompt IS
  'Optional user text appended to the base transition prompt. NULL = default cinematic transition prompt.';
