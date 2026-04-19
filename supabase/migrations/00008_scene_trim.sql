-- Non-destructive trim points for scenes.
-- Videos can be trimmed via source-offset playback (never re-encoded).
-- Image-only scenes use scene.duration directly; trim fields stay null.
ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS trim_start numeric(6,3),
  ADD COLUMN IF NOT EXISTS trim_end   numeric(6,3);

COMMENT ON COLUMN public.scenes.trim_start IS
  'Seconds offset from source start (video only). NULL = no trim (use from 0).';
COMMENT ON COLUMN public.scenes.trim_end IS
  'Seconds offset from source start (video only). NULL = no trim (use native end).';
