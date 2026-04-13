-- Add video version history to scenes
ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS video_versions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS active_version integer NOT NULL DEFAULT 0;

-- Ensure one transition per scene pair per project
CREATE UNIQUE INDEX IF NOT EXISTS uq_transitions_pair
  ON public.transitions(project_id, from_scene_id, to_scene_id);
