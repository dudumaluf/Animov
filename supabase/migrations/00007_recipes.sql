-- ============================================================
-- Recipes: reusable prompt templates for image editing
-- ============================================================

create table if not exists public.recipe_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  description text,
  icon text,
  color_token text not null check (color_token in ('time','polish','staging','material','asset')),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.recipe_categories(id) on delete cascade,
  slug text unique not null,
  display_name text not null,
  short_label text not null,
  description text,
  icon text,
  scope text not null check (scope in ('target','asset','any')) default 'target',
  processing_mode text not null check (processing_mode in ('vision','template')) default 'vision',
  vision_system_prompt text,
  prompt_template text not null,
  active boolean not null default true,
  user_visible boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recipes_category on public.recipes(category_id);
create index if not exists idx_recipes_scope on public.recipes(scope) where active = true;

-- Touch updated_at on any update
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_recipe_categories on public.recipe_categories;
create trigger trg_touch_recipe_categories before update on public.recipe_categories
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_recipes on public.recipes;
create trigger trg_touch_recipes before update on public.recipes
  for each row execute function public.touch_updated_at();

-- ─── RLS ───
alter table public.recipe_categories enable row level security;
alter table public.recipes enable row level security;

drop policy if exists "Anyone can read active recipe categories" on public.recipe_categories;
create policy "Anyone can read active recipe categories"
  on public.recipe_categories for select
  using (active = true or public.is_admin());

drop policy if exists "Admin can manage recipe categories" on public.recipe_categories;
create policy "Admin can manage recipe categories"
  on public.recipe_categories for all
  using (public.is_admin());

drop policy if exists "Anyone can read visible recipes" on public.recipes;
create policy "Anyone can read visible recipes"
  on public.recipes for select
  using ((active = true and user_visible = true) or public.is_admin());

drop policy if exists "Admin can manage recipes" on public.recipes;
create policy "Admin can manage recipes"
  on public.recipes for all
  using (public.is_admin());

-- ============================================================
-- Seed: 5 categories + 14 recipes
-- ============================================================

insert into public.recipe_categories (slug, display_name, description, icon, color_token, sort_order) values
  ('time',     'Tempo e Luz',       'Transformar hora do dia e iluminação',        'sun',        'time',     10),
  ('polish',   'Qualidade',         'Melhorias de cor, contraste e acabamento',    'sparkles',   'polish',   20),
  ('staging',  'Staging',           'Remover ou adicionar mobília e clutter',      'sofa',       'staging',  30),
  ('material', 'Materiais',         'Trocar materiais, pisos e acabamentos',       'layers',     'material', 40),
  ('asset',    'Preparar asset',    'Editar referências antes de usar',            'scissors',   'asset',    50)
on conflict (slug) do nothing;

-- Helper: fetch category id by slug (inlined in inserts via subquery)

insert into public.recipes (category_id, slug, display_name, short_label, description, icon, scope, processing_mode, vision_system_prompt, prompt_template, sort_order) values
  -- Tempo / Luz
  ((select id from public.recipe_categories where slug = 'time'), 'day',  'Transformar para dia',   'Dia',      'Cena em luz natural de dia claro',      'sun',         'target', 'vision',
   'You are a real-estate photo editor. The user wants to transform the scene into a bright daytime look. Generate a single concise edit prompt (max 60 words) describing: warm-to-neutral daylight coming through windows, soft natural shadows, clear sky visible outdoors, vibrant but realistic colors, gently lifted shadows. Preserve all architecture, furniture and composition. Return STRICT JSON: {"prompt": "..."}.',
   'Transform the scene into bright natural daytime. Soft warm daylight through windows, visible clear sky outside, gentle shadows, vibrant realistic colors. Preserve architecture and composition exactly. {user_hint}',
   10),
  ((select id from public.recipe_categories where slug = 'time'), 'night','Transformar para noite', 'Noite',    'Cena em iluminação noturna aconchegante','moon',        'target', 'vision',
   'You are a real-estate photo editor. The user wants to transform the scene into a cozy nighttime look. Generate a concise edit prompt (max 60 words) describing: warm interior lights turned on, dark sky or subtle twilight outside windows, warm pools of light on surfaces, cozy ambience, preserved architecture and all furniture. Return STRICT JSON: {"prompt": "..."}.',
   'Transform the scene into cozy nighttime. Interior warm lights on, dark sky outside, warm light pools on surfaces, cozy ambience. Preserve architecture, furniture and composition exactly. {user_hint}',
   20),
  ((select id from public.recipe_categories where slug = 'time'), 'sunset','Pôr do sol',            'Entardecer','Luz dourada de fim de tarde',            'sunset',      'target', 'vision',
   'You are a real-estate photo editor. The user wants to transform the scene into a golden-hour sunset look. Generate a concise edit prompt (max 60 words) describing: warm golden light coming through windows, long soft shadows, warm colour cast on walls and fabrics, saturated orange-pink sky outside windows. Preserve architecture and composition exactly. Return STRICT JSON: {"prompt": "..."}.',
   'Transform the scene into warm golden-hour sunset. Golden light through windows, long soft shadows, warm cast on surfaces, orange-pink sky outside. Preserve architecture, furniture and composition exactly. {user_hint}',
   30),
  ((select id from public.recipe_categories where slug = 'time'), 'morning','Manhã ensolarada',     'Manhã',    'Luz clara matinal suave',                'sunrise',     'target', 'vision',
   'You are a real-estate photo editor. The user wants to transform the scene into a fresh morning look. Generate a concise edit prompt (max 60 words) describing: cool-warm morning sunlight streaming through windows, soft diffused shadows, fresh airy feel, slightly cooler whites. Preserve architecture and composition exactly. Return STRICT JSON: {"prompt": "..."}.',
   'Transform the scene into a fresh sunny morning. Soft morning sunlight through windows, diffused shadows, airy and clean feel, slightly cool whites. Preserve architecture, furniture and composition exactly. {user_hint}',
   40),

  -- Qualidade / Pós
  ((select id from public.recipe_categories where slug = 'polish'), 'pro-retouch', 'Tratamento profissional', 'Pro',      'Melhora cor, contraste, nitidez',        'wand-sparkles', 'target', 'vision',
   'You are a real-estate photo editor performing a professional retouch pass. Keep the scene identical in composition, lighting direction, architecture and furniture. Improve: color accuracy (natural neutral whites), balanced contrast, gentle local sharpening, removal of sensor noise and chromatic aberrations. Output a single concise edit prompt (max 50 words). Return STRICT JSON: {"prompt": "..."}.',
   'Apply a professional real-estate retouch. Accurate neutral whites, balanced contrast, gentle local sharpening, remove noise and haze. Keep composition, lighting direction, architecture and furniture identical. {user_hint}',
   10),
  ((select id from public.recipe_categories where slug = 'polish'), 'fix-exposure','Corrigir exposição',     'Exposição','Balancear áreas claras e escuras',       'contrast',      'target', 'vision',
   'You are a real-estate photo editor. Balance the exposure: recover blown highlights (especially windows), lift shadows to reveal detail, maintain realistic dynamic range. Do not change composition, furniture or architecture. Output one concise edit prompt (max 45 words). Return STRICT JSON: {"prompt": "..."}.',
   'Balance exposure: recover highlight detail in windows, lift shadows for detail, keep dynamic range realistic. Preserve composition, architecture and furniture. {user_hint}',
   20),

  -- Staging
  ((select id from public.recipe_categories where slug = 'staging'), 'declutter',     'Remover clutter',       'Limpar',     'Tirar objetos bagunçando a cena',       'eraser',  'target', 'vision',
   'You are a real-estate stylist. Identify small visual clutter (loose wires, personal items, trash, clothes, magazines, mess on counters) and remove them. Keep all large furniture, architecture and composition identical. Output one concise edit prompt (max 60 words). Return STRICT JSON: {"prompt": "..."}.',
   'Remove visual clutter: loose wires, personal items, magazines, papers, cables, trash, mess on counters. Keep all furniture, architecture and composition intact. {user_hint}',
   10),
  ((select id from public.recipe_categories where slug = 'staging'), 'remove-furniture','Remover mobília',    'Esvaziar',   'Ambiente vazio pronto pra restaging',   'sofa-off','target', 'vision',
   'You are a real-estate stylist preparing a space for re-staging. Remove all furniture and movable decor. Preserve architecture, walls, floors, windows, built-ins and natural lighting exactly. Output one concise edit prompt (max 45 words). Return STRICT JSON: {"prompt": "..."}.',
   'Remove all furniture and movable decor from the scene. Keep architecture, walls, floor, ceiling, windows and built-ins exactly as they are. Leave the space empty and ready for re-staging. {user_hint}',
   20),
  ((select id from public.recipe_categories where slug = 'staging'), 'modern-staging','Staging moderno',     'Moderno',    'Popular com móveis contemporâneos',     'armchair','target', 'vision',
   'You are a real-estate stylist. Populate the space with tasteful modern contemporary furniture appropriate for the room type. Use neutral colors, clean lines, natural materials (oak, linen, matte metal). Keep architecture, walls, floor and windows intact. Output one concise edit prompt (max 70 words). Return STRICT JSON: {"prompt": "..."}.',
   'Stage the space with tasteful modern contemporary furniture appropriate for this room type. Neutral palette, clean lines, natural materials (oak, linen, matte metal). Keep architecture, walls, floor and windows intact. {user_hint}',
   30),

  -- Materiais
  ((select id from public.recipe_categories where slug = 'material'), 'floor-oak',   'Piso em madeira clara', 'Piso madeira','Substituir piso por madeira clara',  'square-stack','target', 'vision',
   'You are a real-estate materials editor. Replace the existing floor with wide-plank light oak wood with subtle natural grain. Preserve floor extents, walls, furniture and all other materials. Output one concise edit prompt (max 50 words). Return STRICT JSON: {"prompt": "..."}.',
   'Replace the floor with wide-plank light oak wood, subtle natural grain, matte finish. Preserve walls, furniture and all other materials exactly. {user_hint}',
   10),
  ((select id from public.recipe_categories where slug = 'material'), 'wall-white',  'Parede branca',         'Parede branca','Repintar paredes de branco neutro',  'paintbrush',  'target', 'vision',
   'You are a real-estate materials editor. Repaint the wall surfaces with a neutral matte white (slight warm undertone). Preserve architecture, baseboards, trim, furniture and flooring exactly. Output one concise edit prompt (max 45 words). Return STRICT JSON: {"prompt": "..."}.',
   'Repaint walls in a neutral matte white with a slight warm undertone. Preserve architecture, trim, baseboards, furniture and flooring. {user_hint}',
   20),

  -- Preparar asset
  ((select id from public.recipe_categories where slug = 'asset'), 'bg-remove',  'Remover fundo',       'Sem fundo',    'Isolar o objeto sobre alpha',         'scissors',   'asset', 'template', null,
   'Remove the background from this object completely. Output the isolated object with clean transparent background (alpha channel). Preserve object edges, soft shadows and details. Do not add any new shadow or ground plane.',
   10),
  ((select id from public.recipe_categories where slug = 'asset'), 'bg-white',   'Fundo branco',        'Fundo branco', 'Isolar em fundo branco studio',       'square',     'asset', 'template', null,
   'Place this object on a clean pure white studio background. Keep object details, edges and natural contact shadow. Centered composition, professional catalog look.',
   20),
  ((select id from public.recipe_categories where slug = 'asset'), 'isolate-center','Isolar no centro', 'Centralizar',  'Reenquadrar e centralizar o objeto',  'focus',      'asset', 'vision',
   'You are an asset prep assistant. The user wants this object isolated and centered on a clean neutral background with consistent lighting for use as a reference. Describe a concise edit prompt (max 45 words) that centers the object, crops out distractions, keeps its natural contact shadow and preserves texture. Return STRICT JSON: {"prompt": "..."}.',
   'Isolate and center this object on a clean neutral light gray background. Remove distractions, keep natural contact shadow and all texture. Use studio-style even lighting. {user_hint}',
   30)
on conflict (slug) do nothing;
