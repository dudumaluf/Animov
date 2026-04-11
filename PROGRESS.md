# Animov.ai — Progresso

## Fase atual: 2 — Landing (refinamento visual)

### Concluído
- [x] 1.1 Repo + Next.js 14 + Tailwind + shadcn/ui + TS strict
- [x] 1.2 Supabase schema + RLS + seed (projeto: yhnbxrfcofjjyvuyxner)
- [x] 1.3 Auth email/password + layout protegido + admin auto (ddmaluf@gmail.com)
- [x] 2.1 Estrutura one-pager completa (hero, como funciona, pricing, footer, navbar)
- [x] 2.2 R3F scene com scroll nativo unico (canvas sticky em section 400vh)
- [x] 2.3 Geometria ribbon/spiral com toggle entre os dois modos
- [x] 2.4 Leva debug panel com todos os controles expostos

### Em andamento — precisa de refinamento visual (Dudu ajustando valores)
- [ ] 2.5 Ajustar valores finais do spiral/ribbon via Leva
- [ ] 2.6 Ajustar valores finais dos cards via Leva
- [ ] 2.7 Responsivo + fallback mobile + prefers-reduced-motion

### Proximo: Fase 3 — Editor Shell

---

## Decisoes tecnicas

- **Next.js 14** App Router, pnpm, TypeScript strict + noUncheckedIndexedAccess
- **Tailwind v3** + shadcn/ui (radix, componentes reescritos pra TW v3 compat)
- **Dark default** (#0D0D0B), light toggle (#F5F2EC) via next-themes
- **Fontes**: Instrument Serif (display, CSS var --font-display), DM Sans (body), DM Mono (labels)
- **R3F v8 + drei v9** (compativel com React 18 / Next.js 14)
- **Framer Motion** pra animacoes DOM (nao GSAP — evitar licenca comercial)
- **Supabase**: Auth email/password agora, Google OAuth depois
- **Admin**: ddmaluf@gmail.com promovido automaticamente via trigger SQL

## Estado do R3F Landing

### Dois modos de geometria (Strip.Mode no Leva):
1. **Spiral** — helice parametrica (radius, turns, heightPerTurn)
2. **Ribbon** — curva livre CatmullRomCurve3 com 6 control points (p0-p5)

### Recursos implementados:
- **Twist** ao longo do path (twistStart, twistCenter, twistEnd)
- **Start/End transforms** interpolados por scroll (pos, rot, scale, opacity)
- **Custom ShaderMaterial** com:
  - Front: sempre 100% opaco, fade blenda COR pro bgColor (nao alpha)
  - Back: gradient 3 cores (edgeColor → centerColor → edgeColor), direcao h/v
  - Edge fade granular: left/right/top/bottom com start/end independentes
  - UV scroll continuo (uUvOffsetX uniform no shader)
- **Atlas texture**: 12 fotos Park Avenue, imageGapPx pra espacar, gapColor
- **Cards**: grid com columns, spread, zigzag, depth, stagger animation

### O que Dudu precisa fazer:
1. Mexer nos sliders do Leva pra achar valores bons pro spiral/ribbon
2. Mexer nos sliders dos cards pra achar layout editorial
3. Mandar screenshots dos paineis Leva com valores finais

### O que falta implementar:
- Valores finais gravados (Dudu passa, eu codifico)
- Remover Leva do build de producao (manter so em dev)
- Fallback mobile sem R3F
- prefers-reduced-motion

---

## Arquitetura de pastas

```
src/
├── app/
│   ├── (landing)/page.tsx       — landing com dynamic import do R3F
│   ├── (auth)/                  — login, cadastro, callback, actions
│   ├── (app)/                   — dashboard, editor, conta (protegido)
│   ├── admin/                   — painel admin (protegido, role admin)
│   └── v/[slug]/                — video compartilhado publico
├── components/
│   ├── ui/                      — shadcn (button, card, input, label, separator)
│   ├── landing/                 — navbar, hero-with-showcase, landing-scene,
│   │                              how-it-works, pricing, footer
│   └── shared/                  — theme-provider, app-sidebar
├── lib/
│   ├── supabase/                — client, server, middleware, admin
│   └── utils.ts                 — cn()
└── middleware.ts                — session refresh
```

## Infra

- **GitHub**: github.com/dudumaluf/Animov
- **Supabase**: yhnbxrfcofjjyvuyxner
- **Vercel**: nao configurado ainda (priorizar quando quiser testar online)

---

## Roadmap completo (briefing v2)

### Fase 1 — Fundacao [COMPLETA]
- [x] 1.1 Repo + Next.js + Tailwind + shadcn + TS strict
- [x] 1.2 Supabase schema + RLS + seed admin
- [x] 1.3 Auth (email/password) + layout base
- [x] 1.4 PROGRESS.md

### Fase 2 — Landing [EM ANDAMENTO]
- [x] 2.1 Estrutura one-pager + tipografia serif + preto absoluto
- [x] 2.2 R3F scene com cards de video (mock assets)
- [x] 2.3 Scroll-driven layouts (spiral + ribbon + cards)
- [x] 2.4 Leva debug panel pra ajuste visual
- [ ] 2.5 Valores finais do spiral/ribbon (Dudu ajustando)
- [ ] 2.6 Valores finais dos cards (Dudu ajustando)
- [ ] 2.7 Responsivo + fallback mobile + prefers-reduced-motion
- [ ] 2.8 Remover Leva do build de producao
**Gate: Dudu aprova visual da landing**

### Fase 3 — Editor Shell [NAO INICIADA]
- [ ] 3.1 Rota `/editor/[projectId]`, layout film strip
- [ ] 3.2 Upload de fotos + persistencia local (localStorage/IndexedDB)
- [ ] 3.3 Drag-drop de cenas (dnd-kit)
- [ ] 3.4 Cards de transicao automaticos
- [ ] 3.5 Sidebar de modelo/preset/duracao + custo em tempo real
**Gate: Dudu aprova**

### Fase 4 — Pipeline de Geracao [NAO INICIADA]
- [ ] 4.1 Edge Function `generate-scene` com auth + validacao de creditos
- [ ] 4.2 OpenRouter Vision integration + presets no banco
- [ ] 4.3 VideoModelAdapter interface + registry
- [ ] 4.4 Adapter Kling 2.5 (gate: ler doc fal.ai)
- [ ] 4.5 Adapter Seedance 2.0 (gate: ler doc fal.ai)
- [ ] 4.6 Adapters Wan, LTX, Kling 3.0 (cada um com gate)
- [ ] 4.7 Geracao de transicoes com start/end frame
- [ ] 4.8 Composicao client-side WebCodecs + fallbacks
- [ ] 4.9 Upload final + registro em `final_renders`
**Gate: Dudu aprova**

### Fase 5 — Admin [NAO INICIADA]
- [ ] 5.1 Rota `/admin` com guard
- [ ] 5.2 CRUD de usuarios + creditos manuais
- [ ] 5.3 Visualizacao de geracoes + projetos
- [ ] 5.4 Troca de FAL_KEY write-only
- [ ] 5.5 Metricas basicas
**Gate: Dudu aprova**

### Fase 6 — Polish V1 [NAO INICIADA]
- [ ] 6.1 Compartilhamento publico `/v/[slug]`
- [ ] 6.2 Historico de projetos no dashboard
- [ ] 6.3 Regeneracao de cena individual
- [ ] 6.4 Empty states, loading states, error states
- [ ] 6.5 QA completo
**Launch V1**

### Fase 7 — Pagamento (V2) [FUTURO]
- [ ] Webhook Pagar.me/Stripe/Asaas → credita automaticamente
- [ ] Planos recorrentes

### Fase 8 — Growth (V3) [FUTURO]
- [ ] Templates publicos, remix, white-label, API publica

---

## Fora do escopo V1
- Pagamento automatico (creditos manuais via admin por enquanto)
- Edicao manual de transicoes
- Audio/trilha
- Templates publicos
- White-label
- API publica
- Mobile app nativo
