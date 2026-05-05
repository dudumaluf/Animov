-- Non-destructive crop applied to a scene's source photo. Coordinates are
-- normalized (0..1) so the rectangle stays valid if the underlying image is
-- later replaced at a different resolution. The original `photo_url` is
-- never mutated; the rasterized derivative is generated client-side at
-- generation time (canvas + uploadPhoto) and uploaded as a separate object.
ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS crop jsonb;

COMMENT ON COLUMN public.scenes.crop IS
  'Optional non-destructive crop. Shape: { aspect: "free"|"16:9"|"9:16"|"1:1"|"4:5", x: number, y: number, width: number, height: number } with all numeric fields normalized 0..1. NULL = no crop (use full image).';
