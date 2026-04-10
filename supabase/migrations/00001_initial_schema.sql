-- ============================================================
-- Animov.ai — Schema inicial + RLS + Seed
-- Fase 1.2
-- ============================================================

-- ─── Users ───
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- ─── Credits ───
create table public.credits (
  user_id uuid primary key references public.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- ─── Credit Transactions ───
create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  delta integer not null,
  reason text not null,
  admin_id uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- ─── Models (AI video models available) ───
create table public.models (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_key text not null unique,
  display_name text not null,
  cost_per_second numeric(10,4) not null default 0,
  supports_start_end_frame boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── Presets ───
create table public.presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  camera_hint text,
  llm_system_prompt text,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─── Projects ───
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null default 'Sem título',
  status text not null default 'draft' check (status in ('draft', 'generating', 'ready', 'failed')),
  model_id uuid references public.models(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Scenes ───
create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  order_index integer not null,
  photo_url text not null,
  preset_id uuid references public.presets(id),
  prompt_generated text,
  video_url text,
  duration numeric(6,2),
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  cost_credits integer not null default 0,
  created_at timestamptz not null default now()
);

-- ─── Transitions ───
create table public.transitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  from_scene_id uuid not null references public.scenes(id) on delete cascade,
  to_scene_id uuid not null references public.scenes(id) on delete cascade,
  order_index integer not null,
  video_url text,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  cost_credits integer not null default 0,
  created_at timestamptz not null default now()
);

-- ─── Final Renders ───
create table public.final_renders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  composed_video_url text,
  total_cost integer not null default 0,
  shared_slug text unique,
  created_at timestamptz not null default now()
);

-- ─── Generation Logs ───
create table public.generation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  model_id uuid references public.models(id),
  request_payload jsonb,
  response_payload jsonb,
  cost numeric(10,4),
  created_at timestamptz not null default now()
);

-- ─── System Settings ───
create table public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ─── Indexes ───
create index idx_projects_user on public.projects(user_id);
create index idx_scenes_project on public.scenes(project_id);
create index idx_transitions_project on public.transitions(project_id);
create index idx_credit_transactions_user on public.credit_transactions(user_id);
create index idx_generation_logs_user on public.generation_logs(user_id);
create index idx_final_renders_slug on public.final_renders(shared_slug) where shared_slug is not null;

-- ─── Updated_at trigger ───
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_credits
  before update on public.credits
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_projects
  before update on public.projects
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_system_settings
  before update on public.system_settings
  for each row execute function public.handle_updated_at();

-- ─── Auto-create user profile + credits on signup ───
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    case when new.email = 'ddmaluf@gmail.com' then 'admin' else 'user' end
  );
  insert into public.credits (user_id, balance)
  values (new.id, 3);
  insert into public.credit_transactions (user_id, delta, reason)
  values (new.id, 3, 'Créditos de boas-vindas');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS Policies
-- ============================================================

alter table public.users enable row level security;
alter table public.credits enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.projects enable row level security;
alter table public.scenes enable row level security;
alter table public.transitions enable row level security;
alter table public.final_renders enable row level security;
alter table public.generation_logs enable row level security;
alter table public.models enable row level security;
alter table public.presets enable row level security;
alter table public.system_settings enable row level security;

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- ─── users ───
create policy "Users can read own profile"
  on public.users for select
  using (id = auth.uid() or public.is_admin());

create policy "Users can update own profile"
  on public.users for update
  using (id = auth.uid());

create policy "Admin can manage all users"
  on public.users for all
  using (public.is_admin());

-- ─── credits ───
create policy "Users can read own credits"
  on public.credits for select
  using (user_id = auth.uid() or public.is_admin());

create policy "Admin can manage credits"
  on public.credits for all
  using (public.is_admin());

-- ─── credit_transactions ───
create policy "Users can read own transactions"
  on public.credit_transactions for select
  using (user_id = auth.uid() or public.is_admin());

create policy "Admin can manage transactions"
  on public.credit_transactions for all
  using (public.is_admin());

-- ─── projects ───
create policy "Users can read own projects"
  on public.projects for select
  using (user_id = auth.uid() or public.is_admin());

create policy "Users can create projects"
  on public.projects for insert
  with check (user_id = auth.uid());

create policy "Users can update own projects"
  on public.projects for update
  using (user_id = auth.uid() or public.is_admin());

create policy "Users can delete own projects"
  on public.projects for delete
  using (user_id = auth.uid() or public.is_admin());

-- ─── scenes ───
create policy "Users can manage own scenes"
  on public.scenes for all
  using (
    exists (
      select 1 from public.projects
      where projects.id = scenes.project_id
      and (projects.user_id = auth.uid() or public.is_admin())
    )
  );

-- ─── transitions ───
create policy "Users can manage own transitions"
  on public.transitions for all
  using (
    exists (
      select 1 from public.projects
      where projects.id = transitions.project_id
      and (projects.user_id = auth.uid() or public.is_admin())
    )
  );

-- ─── final_renders ───
create policy "Users can read own renders"
  on public.final_renders for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = final_renders.project_id
      and (projects.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "Public can read shared renders"
  on public.final_renders for select
  using (shared_slug is not null);

create policy "Admin can manage renders"
  on public.final_renders for all
  using (public.is_admin());

-- ─── generation_logs ───
create policy "Users can read own logs"
  on public.generation_logs for select
  using (user_id = auth.uid() or public.is_admin());

create policy "Admin can manage logs"
  on public.generation_logs for all
  using (public.is_admin());

-- ─── models (public read, admin write) ───
create policy "Anyone can read active models"
  on public.models for select
  using (active = true or public.is_admin());

create policy "Admin can manage models"
  on public.models for all
  using (public.is_admin());

-- ─── presets (public read, admin write) ───
create policy "Anyone can read presets"
  on public.presets for select
  using (true);

create policy "Admin can manage presets"
  on public.presets for all
  using (public.is_admin());

-- ─── system_settings (admin only) ───
create policy "Admin can manage settings"
  on public.system_settings for all
  using (public.is_admin());

-- ============================================================
-- Seed Data
-- ============================================================

-- Initial models
insert into public.models (provider, model_key, display_name, cost_per_second, supports_start_end_frame, active) values
  ('fal.ai', 'kling-v2.5-standard', 'Kling 2.5 Standard', 0.50, true, true),
  ('fal.ai', 'kling-v3.0-standard', 'Kling 3.0 Standard', 0.75, true, false),
  ('fal.ai', 'seedance-v2.0', 'Seedance 2.0', 0.60, true, true),
  ('fal.ai', 'wan-v1', 'Wan', 0.30, false, true),
  ('fal.ai', 'ltx-video', 'LTX Video', 0.20, false, true);

-- Initial presets
insert into public.presets (name, description, camera_hint, llm_system_prompt, featured) values
  ('Dolly In', 'Câmera avança suavemente para dentro do ambiente', 'dolly_in',
   'You are a cinematography director. Describe a smooth dolly-in camera movement for this real estate interior photo. Focus on depth, luxury, and inviting atmosphere. Output only the motion prompt, no explanations.',
   true),
  ('Orbit', 'Câmera gira levemente ao redor do ponto focal', 'orbit',
   'You are a cinematography director. Describe a slow orbit camera movement around the focal point of this real estate photo. Emphasize spaciousness and architectural beauty. Output only the motion prompt.',
   true),
  ('Ken Burns', 'Zoom lento + pan lateral clássico', 'ken_burns',
   'You are a cinematography director. Describe a subtle Ken Burns effect (slow zoom with gentle pan) for this real estate photo. Keep it elegant and professional. Output only the motion prompt.',
   true),
  ('Reveal', 'Câmera descobre o ambiente de trás pra frente', 'reveal',
   'You are a cinematography director. Describe a reveal camera movement where the camera pulls back to unveil the full space in this real estate photo. Create a sense of discovery. Output only the motion prompt.',
   true),
  ('Float Up', 'Câmera sobe suavemente como um drone leve', 'float_up',
   'You are a cinematography director. Describe a gentle upward floating camera movement for this real estate photo, as if from a small indoor drone. Convey elevation and grandeur. Output only the motion prompt.',
   true),
  ('Cinematic Pan', 'Pan horizontal com sensação cinematográfica', 'cinematic_pan',
   'You are a cinematography director. Describe a horizontal cinematic pan movement for this real estate photo. Smooth, deliberate, with professional pacing. Output only the motion prompt.',
   true);

-- Default system settings
insert into public.system_settings (key, value) values
  ('default_model', '"kling-v2.5-standard"'),
  ('free_credits', '3'),
  ('max_photos_per_project', '10'),
  ('min_photos_per_project', '2');
