-- Per-scene audio volume (0..1+) so uploaded clip audio can be attenuated
-- independently of the project music bus. Default 1 keeps legacy rows behaving
-- identically (unity gain). NULL is treated as 1 by the client.
ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS audio_volume real DEFAULT 1;

COMMENT ON COLUMN public.scenes.audio_volume IS
  'Scene-level gain applied to the uploaded clip audio (linear, 0 = mute). Default 1 = unity.';
