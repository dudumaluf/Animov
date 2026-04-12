-- ============================================================
-- Animov.ai — Migration 002: Credit RPCs + generation_logs columns
-- Fixes RLS issue where user JWT cannot debit credits
-- ============================================================

-- ─── Atomic credit debit (security definer bypasses RLS) ───
create or replace function public.debit_credit(
  p_user_id uuid,
  p_amount int,
  p_reason text
) returns int as $$
declare
  current_balance int;
begin
  select balance into current_balance from public.credits
    where user_id = p_user_id for update;

  if current_balance is null then
    raise exception 'User credits not found';
  end if;

  if current_balance < p_amount then
    raise exception 'Insufficient credits';
  end if;

  update public.credits set balance = current_balance - p_amount
    where user_id = p_user_id;

  insert into public.credit_transactions (user_id, delta, reason)
    values (p_user_id, -p_amount, p_reason);

  return current_balance - p_amount;
end;
$$ language plpgsql security definer;

-- ─── Add credits (admin use, also security definer) ───
create or replace function public.add_credit(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_admin_id uuid default null
) returns int as $$
declare
  current_balance int;
begin
  select balance into current_balance from public.credits
    where user_id = p_user_id for update;

  if current_balance is null then
    raise exception 'User credits not found';
  end if;

  update public.credits set balance = current_balance + p_amount
    where user_id = p_user_id;

  insert into public.credit_transactions (user_id, delta, reason, admin_id)
    values (p_user_id, p_amount, p_reason, p_admin_id);

  return current_balance + p_amount;
end;
$$ language plpgsql security definer;

-- ─── Grant execute to authenticated users ───
grant execute on function public.debit_credit(uuid, int, text) to authenticated;
grant execute on function public.add_credit(uuid, int, text, uuid) to authenticated;

-- ─── Extend generation_logs for debug data ───
alter table public.generation_logs add column if not exists vision_model text;
alter table public.generation_logs add column if not exists vision_data jsonb;
alter table public.generation_logs add column if not exists final_positive_prompt text;
alter table public.generation_logs add column if not exists final_negative_prompt text;
alter table public.generation_logs add column if not exists preset_id text;
alter table public.generation_logs add column if not exists fallback_used boolean default false;
alter table public.generation_logs add column if not exists duration_seconds numeric(6,2);
alter table public.generation_logs add column if not exists generation_type text default 'scene';

-- ─── Allow authenticated users to insert their own generation logs ───
create policy "Users can insert own logs"
  on public.generation_logs for insert
  with check (user_id = auth.uid());
