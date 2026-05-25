-- Non-destructive image transform that places a scene's source photo inside
-- the project's global canvas (whose aspect = `exportAspectRatio`). Replaces
-- the older `crop` rectangle model: instead of describing a region of the
-- source image, the transform describes how to position+scale the source
-- inside the canvas (Instagram/Procreate-style). Letterbox margins are
-- filled by an optional background (color or blur).
--
-- The original `photo_url` is never mutated; the rasterized derivative is
-- generated client-side at generation time (canvas + uploadPhoto) and
-- uploaded as a separate object.
--
-- The legacy `crop` column is kept for backward read safety so we can roll
-- back without losing data; it is silently ignored on load (scenes default
-- to cover-centered) and never written to going forward. A future migration
-- can drop it once we're confident the new flow is stable.
ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS image_transform jsonb;

COMMENT ON COLUMN public.scenes.image_transform IS
  'Optional non-destructive image transform. Shape: { scale: number (>0), offsetX: number, offsetY: number, background?: { type: "color", color: string } | { type: "blur" } }. scale=1 + offsetX/Y=0 = cover-centered (the default when NULL). scale<1 leaves letterbox margins filled by background.';
