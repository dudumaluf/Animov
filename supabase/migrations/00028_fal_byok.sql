-- ============================================================
-- Animov.ai — Migration 00028: Fal BYOK secret store (ADDITIVE)
-- ------------------------------------------------------------
-- A tiny, service-role-only key→value store for sensitive runtime secrets the
-- app must be able to swap WITHOUT a redeploy. The first (and only) consumer is
-- the custom Fal API key (key = 'fal_api_key') behind the admin BYOK feature:
-- an admin can point ALL generations at a different Fal account (e.g. the
-- company's, which holds the credits) and revert to the env FAL_KEY anytime.
--
-- Security (critical): RLS is ENABLED with NO policies — exactly like
-- `stripe_events` (00026) and `generation_jobs` (00027). That makes the table
-- unreachable from anon/auth (client) Supabase keys; ONLY the service-role key
-- (the server-side resolver in src/lib/fal-key.ts + the admin API) can read or
-- write it. The secret is therefore NEVER exposed to the browser. We DELIBERATELY
-- do NOT store this in `system_settings`, because that table is client-readable.
--
-- Re-runnable / additive: IF NOT EXISTS throughout; enabling RLS is idempotent
-- and drops nothing.
-- ============================================================

create table if not exists public.app_secrets (
  key        text primary key,
  value      text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Unreachable from client keys (no policies) → service-role only.
alter table public.app_secrets enable row level security;
