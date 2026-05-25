-- ============================================================
-- Save Safety: project snapshots + concurrency-friendly defaults
-- ============================================================
--
-- Adds a per-project history table so we can restore previous states when
-- a multi-tab / multi-device save accident happens, and ensures the
-- updated_at trigger on `projects` is live (required for optimistic
-- concurrency in the API layer).
--
-- Does NOT add any column to `projects`, `scenes` or `transitions`. The
-- optimistic concurrency check is implemented purely against the existing
-- `projects.updated_at` column (already populated by trigger).

-- ─── Snapshots table ──────────────────────────────────────────
create table if not exists public.project_snapshots (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  snapshot    jsonb not null,
  reason      text not null check (reason in ('auto', 'manual', 'pre-restore', 'pre-overwrite')),
  created_at  timestamptz not null default now()
);

comment on table public.project_snapshots is
  'History of project state at meaningful save points. Used by the editor "version history" UI and as a safety net before destructive operations (overwrite, restore).';

comment on column public.project_snapshots.reason is
  'auto: periodic backup; manual: user-triggered; pre-restore: saved before user restored an older snapshot; pre-overwrite: saved before user forced overwrite of a conflicting remote state.';

comment on column public.project_snapshots.snapshot is
  'Full project state at the moment of capture. Shape: { project: { name, metadata, updated_at }, scenes: [...], transitions: [...] }.';

create index if not exists idx_project_snapshots_project_created
  on public.project_snapshots (project_id, created_at desc);

-- ─── RLS ───
alter table public.project_snapshots enable row level security;

drop policy if exists "Users can read own project snapshots" on public.project_snapshots;
create policy "Users can read own project snapshots"
  on public.project_snapshots for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_snapshots.project_id
        and (projects.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Users can create snapshots for own projects" on public.project_snapshots;
create policy "Users can create snapshots for own projects"
  on public.project_snapshots for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects
      where projects.id = project_snapshots.project_id
        and projects.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own project snapshots" on public.project_snapshots;
create policy "Users can delete own project snapshots"
  on public.project_snapshots for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_snapshots.project_id
        and (projects.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Admin can manage all project snapshots" on public.project_snapshots;
create policy "Admin can manage all project snapshots"
  on public.project_snapshots for all
  using (public.is_admin());

-- ─── Cleanup function ─────────────────────────────────────────
-- Called opportunistically by the API after a new snapshot is created.
-- Retention rules:
--   * Keep at most 30 'auto' snapshots per project (newest first).
--   * Drop any non-'auto' snapshot older than 30 days.
-- Safe to call repeatedly.
create or replace function public.cleanup_old_snapshots(p_project_id uuid)
returns void as $$
begin
  -- Trim oldest auto snapshots beyond the most recent 30.
  delete from public.project_snapshots
   where id in (
     select id
       from public.project_snapshots
      where project_id = p_project_id
        and reason = 'auto'
      order by created_at desc
      offset 30
   );

  -- Trim non-auto snapshots older than 30 days.
  delete from public.project_snapshots
   where project_id = p_project_id
     and reason <> 'auto'
     and created_at < now() - interval '30 days';
end;
$$ language plpgsql security definer;

comment on function public.cleanup_old_snapshots(uuid) is
  'Trim old project snapshots: keep last 30 auto, drop non-auto older than 30 days.';

-- ─── Defensive: ensure updated_at trigger on projects still exists ──
-- The optimistic concurrency check depends on `projects.updated_at` being
-- bumped on every UPDATE. The trigger was created in 00001_initial_schema.sql
-- but we recreate it here defensively in case it was ever dropped manually.
do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'set_updated_at_projects'
       and tgrelid = 'public.projects'::regclass
  ) then
    create trigger set_updated_at_projects
      before update on public.projects
      for each row execute function public.handle_updated_at();
  end if;
end
$$;
