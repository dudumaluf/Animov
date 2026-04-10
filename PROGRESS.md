# Animov.ai — Progresso

## Fase atual: 1 — Fundação

### Concluído
- [x] 1.1 Repo + Next.js 14 + Tailwind + shadcn/ui + TS strict
  - Next.js 14 App Router, pnpm, TypeScript strict + noUncheckedIndexedAccess
  - Tailwind configurado com paleta Animov (dark default, light toggle)
  - shadcn/ui inicializado (radix, lucide icons)
  - Fontes: Instrument Serif (display), DM Sans (body), DM Mono (labels)
  - next-themes com ThemeProvider (dark default)
  - Grain texture overlay
  - Route groups com placeholders
  - GitHub remote: dudumaluf/Animov

- [x] 1.2 Supabase project + schema + RLS + seed
  - Schema: users, credits, credit_transactions, projects, scenes, transitions, final_renders, generation_logs, models, presets, system_settings
  - Trigger auto-create profile + 3 créditos boas-vindas
  - RLS com is_admin() helper
  - Seed: 5 modelos AI, 6 presets, settings

- [x] 1.3 Auth (email/password) + layout base
  - Login e cadastro com Supabase Auth (server actions)
  - Callback route pra confirmação de email
  - Layout (app) protegido: redirect se não logado
  - Layout admin protegido: redirect se não admin
  - Sidebar com navegação, créditos, nome, logout
  - ddmaluf@gmail.com auto-promovido a admin via trigger
  - Middleware Next.js pra session refresh

### Em andamento
- [ ] 1.4 PROGRESS.md vivo

### Blockers
- Nenhum

### Notas/decisões
- Instrument Serif como font display (CSS var --font-display)
- Dark (#0D0D0B) como tema default, light (#F5F2EC) via toggle
- drei ScrollControls (não GSAP) pra R3F scroll
- Framer Motion pra animações DOM
- Auth: email/password agora, Google OAuth depois
- Admin: ddmaluf@gmail.com promovido automaticamente no cadastro
