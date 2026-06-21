-- ─── Reference generation jobs (async queue bookkeeping) ───
-- Seedance reference-to-video runs far longer than a serverless function may
-- stay open, so /api/generate-reference now SUBMITS to the fal queue and the
-- client polls /api/generate-reference/status. This table is the server-side
-- record needed to finalize safely once the (long) job settles:
--   * credit_cost — the exact amount debited at submit, so a failure refunds
--     precisely that (the client is never trusted for the refund amount).
--   * status      — guards against double-finalize when the client polls twice
--     (the status route only logs/refunds on the pending → terminal transition).
--   * result_url / error — cached so repeat polls are idempotent.
--
-- Only the service-role (server routes) touches this table; RLS is enabled with
-- no policies so it is inaccessible from the client.

create table if not exists public.reference_jobs (
  request_id     text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  scene_id       text,
  preset_id      text,
  prompt         text not null,
  image_urls     jsonb not null,
  duration       integer not null,
  generate_audio boolean not null default false,
  credit_cost    integer not null,
  status         text not null default 'pending'
                   check (status in ('pending', 'completed', 'failed')),
  result_url     text,
  error          text,
  created_at     timestamptz not null default now(),
  finished_at    timestamptz
);

alter table public.reference_jobs enable row level security;

create index if not exists reference_jobs_user_idx
  on public.reference_jobs (user_id, created_at desc);
