-- Add a metadata JSONB column to projects for editor state (hasEditNode, etc.)
alter table public.projects
  add column if not exists metadata jsonb not null default '{}'::jsonb;
