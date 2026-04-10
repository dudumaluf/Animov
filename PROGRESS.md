# Animov.ai — Progresso

## Fase atual: 1 — Fundação

### Concluído
- [x] 1.1 Repo + Next.js 14 + Tailwind + shadcn/ui + TS strict
  - Next.js 14 App Router, pnpm, TypeScript strict + noUncheckedIndexedAccess
  - Tailwind configurado com paleta Animov (dark default, light toggle)
  - shadcn/ui inicializado (radix, lucide icons)
  - Fontes: Instrument Serif (display), DM Sans (body), DM Mono (labels)
  - next-themes com ThemeProvider (dark default)
  - CSS custom properties: cores Animov + shadcn component vars
  - Grain texture overlay
  - Route groups com placeholders: (landing), (auth), (app), admin, v/[slug]
  - .env.local.example documentado
  - GitHub remote: dudumaluf/Animov

- [x] 1.2 Supabase project + schema + RLS + seed
  - Projeto linkado: yhnbxrfcofjjyvuyxner
  - Schema completo: users, credits, credit_transactions, projects, scenes, transitions, final_renders, generation_logs, models, presets, system_settings
  - Auto-create user profile + 3 créditos de boas-vindas via trigger on auth.users
  - RLS ativo em todas as tabelas: user vê seus dados, admin vê tudo
  - Função is_admin() como helper pra policies
  - Seed: 5 modelos (Kling 2.5/3.0, Seedance 2.0, Wan, LTX), 6 presets cinematográficos, settings iniciais
  - Supabase client helpers: browser, server, middleware, admin
  - Middleware Next.js configurado pra refresh de sessão

### Em andamento
- [ ] 1.3 Auth (email + Google) + layout base
- [ ] 1.4 PROGRESS.md (vivo)

### Blockers
- Nenhum

### Notas/decisões
- Instrument Serif como font display (com CSS var --font-display pra trocar fácil)
- DM Sans / DM Mono do Stitch briefing aprovados
- Dark (#0D0D0B) como tema default, light (#F5F2EC) via toggle
- drei ScrollControls (não GSAP) pra R3F scroll — grátis, nativo
- Framer Motion pra animações DOM — MIT license
- Supabase project ID: yhnbxrfcofjjyvuyxner
- Admin seed via trigger: ddmaluf@gmail.com será promovido a admin no primeiro cadastro
