-- ============================================================
-- Animov.ai — Migration 00026: Stripe billing (ADDITIVE / reversible)
-- ------------------------------------------------------------
-- Net-new monetization plumbing. NOTHING here drops or renames an
-- in-use column, so it cannot break the existing app:
--   * users.stripe_customer_id  — link a Supabase user to its Stripe customer
--   * subscriptions             — current plan state (mirrors a Stripe sub)
--   * stripe_events             — webhook idempotency ledger (dedupe)
--   * billing_catalog           — admin-editable price→credits/label map
--   * handle_new_user()         — now reads system_settings.free_credits
--                                 (welcome credits become a one-row knob)
--   * system_settings.free_credits → 0 (zero-cost onboarding funnel)
--
-- Re-runnable: tables use IF NOT EXISTS and policies are dropped first.
-- ============================================================

-- ─── users.stripe_customer_id (nullable, unique among non-null) ───
alter table public.users
  add column if not exists stripe_customer_id text;

create unique index if not exists users_stripe_customer_id_key
  on public.users (stripe_customer_id)
  where stripe_customer_id is not null;

-- ─── subscriptions (one active row per user; mirrors a Stripe sub) ───
create table if not exists public.subscriptions (
  user_id                uuid primary key references public.users(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_price_id        text,
  plan                   text,
  status                 text not null default 'active',
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_subscriptions_status
  on public.subscriptions (status);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read own subscription" on public.subscriptions;
create policy "Users can read own subscription"
  on public.subscriptions for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admin can manage subscriptions" on public.subscriptions;
create policy "Admin can manage subscriptions"
  on public.subscriptions for all
  using (public.is_admin());

drop trigger if exists set_updated_at_subscriptions on public.subscriptions;
create trigger set_updated_at_subscriptions
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

-- ─── stripe_events (webhook idempotency — service-role only) ───
-- RLS enabled with NO policies → unreachable from anon/auth clients; only the
-- service-role key (server webhook) can read/write. Each processed event id is
-- recorded so a Stripe retry never double-grants credits.
create table if not exists public.stripe_events (
  id          text primary key,
  type        text,
  created_at  timestamptz not null default now()
);

alter table public.stripe_events enable row level security;

-- ─── billing_catalog (admin-editable price→credits/label source of truth) ───
-- The webhook reads `credits` from here to decide how many credits a purchase
-- grants, and the UI reads `label`/`display_price`. Amounts charged live in
-- Stripe (immutable per price); credits/labels stay tunable from the admin
-- panel with no deploy. Falls back to Stripe price metadata.credits if a row
-- is missing (see src/lib/billing/catalog.ts).
create table if not exists public.billing_catalog (
  stripe_price_id  text primary key,
  kind             text not null check (kind in ('subscription', 'pack')),
  plan             text,
  credits          integer not null check (credits >= 0),
  label            text,
  display_price    text,
  active           boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.billing_catalog enable row level security;

drop policy if exists "Anyone can read active catalog" on public.billing_catalog;
create policy "Anyone can read active catalog"
  on public.billing_catalog for select
  using (active = true or public.is_admin());

drop policy if exists "Admin can manage catalog" on public.billing_catalog;
create policy "Admin can manage catalog"
  on public.billing_catalog for all
  using (public.is_admin());

drop trigger if exists set_updated_at_billing_catalog on public.billing_catalog;
create trigger set_updated_at_billing_catalog
  before update on public.billing_catalog
  for each row execute function public.handle_updated_at();

-- ─── handle_new_user(): welcome credits now read from system_settings ───
-- Was a hardcoded `3`. Now reads system_settings.free_credits (default 0 if the
-- row is missing) so the welcome grant is a one-row UPDATE, no deploy. Only
-- inserts a welcome transaction when the amount is > 0 (keeps the ledger clean
-- for the zero-cost funnel). Affects FUTURE signups only — never touches
-- existing balances.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_free_credits int;
begin
  select coalesce((value #>> '{}')::int, 0)
    into v_free_credits
    from public.system_settings
    where key = 'free_credits';

  v_free_credits := coalesce(v_free_credits, 0);
  if v_free_credits < 0 then
    v_free_credits := 0;
  end if;

  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    case when new.email = 'ddmaluf@gmail.com' then 'admin' else 'user' end
  );

  insert into public.credits (user_id, balance)
  values (new.id, v_free_credits);

  if v_free_credits > 0 then
    insert into public.credit_transactions (user_id, delta, reason)
    values (new.id, v_free_credits, 'Créditos de boas-vindas');
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- ─── Zero-cost onboarding: welcome credits → 0 (tunable from admin later) ───
insert into public.system_settings (key, value)
values ('free_credits', '0'::jsonb)
on conflict (key) do update set value = '0'::jsonb, updated_at = now();
