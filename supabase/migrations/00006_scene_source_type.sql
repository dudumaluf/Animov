ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'image';
