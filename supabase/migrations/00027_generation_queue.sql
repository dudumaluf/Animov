-- ============================================================
-- Animov.ai — Migration 00027: Global generation queue (ADDITIVE)
-- ------------------------------------------------------------
-- A generic server-side job table + a tunable concurrency cap so we respect
-- fal's per-account limit (new accounts ~2 concurrent). This is purely additive:
--   * generation_jobs          — one row per scene/transition/reference render
--   * system_settings.fal_max_concurrent → 2 (global in-flight gate)
--
-- It does NOT touch or drop `reference_jobs` (00023) — the reference path keeps
-- using it until the generic queue is verified end-to-end. Synchronous
-- generate-scene/transition routes also stay as a fallback. Re-runnable.
--
-- RLS is enabled with NO policies, so the table is unreachable from anon/auth
-- clients; only the service-role key (server routes + cron) reads/writes it.
-- ============================================================

create table if not exists public.generation_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null check (type in ('scene', 'transition', 'reference')),
  status        text not null default 'queued'
                  check (status in ('queued', 'submitting', 'submitted', 'completed', 'failed')),
  model_id      text,
  request_id    text,
  payload       jsonb not null,
  credit_cost   integer not null default 0,
  duration      integer,
  result_url    text,
  error         text,
  target_id     text,
  project_id    text,
  created_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  finished_at   timestamptz
);

-- FIFO dispatch scans (status, created_at); per-user history; request lookups.
create index if not exists generation_jobs_status_created_idx
  on public.generation_jobs (status, created_at);
create index if not exists generation_jobs_user_idx
  on public.generation_jobs (user_id, created_at desc);
create index if not exists generation_jobs_request_idx
  on public.generation_jobs (request_id);

alter table public.generation_jobs enable row level security;

-- ─── Global concurrency cap (tunable from the admin settings editor) ───
-- on conflict do nothing so an admin-set value (or a re-run) is never clobbered.
insert into public.system_settings (key, value)
values ('fal_max_concurrent', '2'::jsonb)
on conflict (key) do nothing;
