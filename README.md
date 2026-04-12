# Animov.ai

Transforme fotos de imóveis em vídeos cinematográficos com IA.

## Stack

- **Framework:** Next.js 14 (App Router, TypeScript strict)
- **UI:** Tailwind CSS, shadcn/ui, Radix primitives
- **Fonts:** Instrument Serif, DM Sans, DM Mono
- **Theme:** Dark default, light toggle (next-themes)
- **3D/Landing:** React Three Fiber + drei (Fase 2)
- **Backend:** Supabase (Auth, Postgres, Storage, Edge Functions)
- **Video AI:** fal.ai (Kling, Seedance, Wan, LTX)
- **Infra:** Vercel + Supabase Cloud

## Getting Started

```bash
pnpm install
cp .env.local.example .env.local
# Fill in Supabase and API keys
pnpm dev
```

## Project Structure

```
src/
├── app/
│   ├── (landing)/     # Public landing page
│   ├── (auth)/        # Login / Cadastro
│   ├── (app)/         # Authenticated app (dashboard, editor, conta)
│   ├── admin/         # Admin panel
│   └── v/[slug]/      # Public shared videos
├── components/
│   ├── ui/            # shadcn/ui
│   ├── landing/       # R3F scenes, hero, sections
│   ├── editor/        # Film strip, scene cards
│   ├── dashboard/     # Project cards, stats
│   └── shared/        # Navbar, footer, theme toggle
├── lib/
│   ├── supabase/      # Client, server, middleware
│   ├── adapters/      # VideoModelAdapter implementations
│   └── composition/   # WebCodecs + mp4-muxer
├── hooks/
├── stores/            # Zustand
└── types/
```

## Documentation

```
docs/
├── MASTER_PLAN.md              # Project bible
├── CONTEXT_INDEX.md            # Quick reference map
├── tracking/
│   ├── ROADMAP.md              # Tickable checklist per phase
│   ├── PROGRESS.md             # Current state snapshot
│   └── CHANGELOG.md            # Session history
├── briefings/                  # Original project specs
└── strategy/                   # Prompt engineering docs
```

See [docs/MASTER_PLAN.md](./docs/MASTER_PLAN.md) for full project overview.
See [docs/tracking/ROADMAP.md](./docs/tracking/ROADMAP.md) for current status.