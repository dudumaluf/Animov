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

### Em andamento
- [ ] 1.2 Supabase project + schema inicial + RLS + seed admin
- [ ] 1.3 Auth (email + Google) + layout base
- [ ] 1.4 PROGRESS.md inicializado

### Blockers
- Nenhum

### Notas/decisões
- Instrument Serif como font display (com CSS var --font-display pra trocar fácil)
- DM Sans / DM Mono do Stitch briefing aprovados
- Dark (#0D0D0B) como tema default, light (#F5F2EC) via toggle
- drei ScrollControls (não GSAP) pra R3F scroll — grátis, nativo
- Framer Motion pra animações DOM — MIT license
- Supabase project ID: yhnbxrfcofjjyvuyxner
