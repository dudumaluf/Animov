# Animov.ai — Progresso

## Fase atual: 2 → 3 — Landing concluida (visual), partindo pro Editor

### Concluido

- 1.1 Repo + Next.js 14 + Tailwind + shadcn/ui + TS strict
- 1.2 Supabase schema + RLS + seed (projeto: yhnbxrfcofjjyvuyxner)
- 1.3 Auth email/password + layout protegido + admin auto ([ddmaluf@gmail.com](mailto:ddmaluf@gmail.com))
- 2.1 Estrutura one-pager completa (hero, como funciona, pricing, footer, navbar)
- 2.2 R3F scene com scroll nativo unico (canvas sticky em section 400vh)
- 2.3 Geometria ribbon/spiral com toggle entre os dois modos
- 2.4 Leva debug panel com todos os controles expostos
- 2.5 Sistema de presets strip (Espiral Torcida, Cilindro Suave) com dropdown e set()
- 2.6 Valores finais dos cards ajustados (layout, transform, animation)
- 2.7 Cards com loop infinito vertical (modulo + drift sincronizado)
- 2.8 Cards com entry + exit animation (scroll-driven)
- 2.9 Backside do strip com modo photo (mesmas fotos darkened) ou gradient
- 2.10 Twist toggle (enable/disable) no strip
- 2.11 Todos os textos editaveis via Leva (hero, secondary, how-it-works, pricing, navbar)
- 2.12 Alinhamento e tamanho customizavel pra todos os headlines (left/center/right, md/lg/xl, italic)
- 2.13 Scroll suave entre secoes (scroll-behavior: smooth)
- 2.14 How-it-works com scroll-driven step highlight (3 passos, um por vez)
- 2.15 Gradient fade suave na transicao hero → how-it-works (sem corte duro)
- 2.16 Navegacao reorganizada (Inicio, Presets, Como funciona, Planos)
- 2.17 Leva escondido por default + toggle Shift+M
- 2.18 Botoes de pricing alinhados (flex-col + flex-1 na feature list)

### Pendente (refinamento futuro, nao bloqueia Fase 3)

- 2.P1 Responsivo + fallback mobile sem R3F
- 2.P2 prefers-reduced-motion
- 2.P3 Remover Leva do build de producao (ja escondido, falta tree-shake)

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
- **Admin**: [ddmaluf@gmail.com](mailto:ddmaluf@gmail.com) promovido automaticamente via trigger SQL

## Estado do R3F Landing

### Strip presets (dropdown no Leva):

1. **Espiral Torcida** (default) — radius 2.8, turns 2.4, twist habilitado
2. **Cilindro Suave** — radius 3.6, turns 1.1, sem twist

### Recursos implementados:

- **Twist toggle** (enable/disable) ao longo do path
- **Strip presets** com set() automatico de todos os paineis
- **Start/End transforms** interpolados por scroll
- **Custom ShaderMaterial** com front (photo) e back (photo darkened ou gradient)
- **Atlas texture**: 12 fotos Park Avenue
- **Cards**: layout 1-coluna, loop infinito vertical, entry + exit animations
- **Todos os textos** editaveis via Leva (hero, secondary, how-it-works, pricing, navbar)
- **Leva hidden by default**, toggle com Shift+M

---

## Arquitetura de pastas

```
src/
├── app/
│   ├── (landing)/page.tsx       — landing com dynamic import do R3F + LevaToggle
│   ├── (auth)/                  — login, cadastro, callback, actions
│   ├── (app)/                   — dashboard, editor, conta (protegido)
│   ├── admin/                   — painel admin (protegido, role admin)
│   └── v/[slug]/                — video compartilhado publico
├── components/
│   ├── ui/                      — shadcn (button, card, input, label, separator)
│   ├── landing/                 — navbar, hero-with-showcase, landing-scene,
│   │                              how-it-works, pricing, footer
│   └── shared/                  — theme-provider, app-sidebar, leva-toggle
├── lib/
│   ├── supabase/                — client, server, middleware, admin
│   └── utils.ts                 — cn()
└── middleware.ts                — session refresh
```

## Infra

- **GitHub**: github.com/dudumaluf/Animov
- **Supabase**: yhnbxrfcofjjyvuyxner
- **Vercel**: nao configurado ainda

---

## Roadmap completo (briefing v2)

### Fase 1 — Fundacao [COMPLETA]

- 1.1 Repo + Next.js + Tailwind + shadcn + TS strict
- 1.2 Supabase schema + RLS + seed admin
- 1.3 Auth (email/password) + layout base
- 1.4 PROGRESS.md

### Fase 2 — Landing [VISUAL OK — pendencias menores nao bloqueiam]

- 2.1–2.18 Concluidos (ver lista acima)
- 2.P1–P3 Pendencias de polish (responsivo, reduced-motion, tree-shake Leva)
**Gate: Dudu aprovou visual**

### Fase 3 — Editor Shell [PROXIMO]

- 3.1 Rota `/editor/[projectId]`, layout film strip
- 3.2 Upload de fotos + persistencia local (localStorage/IndexedDB)
- 3.3 Drag-drop de cenas (dnd-kit)
- 3.4 Cards de transicao automaticos
- 3.5 Sidebar de modelo/preset/duracao + custo em tempo real
**Gate: Dudu aprova**

### Fase 4 — Pipeline de Geracao [NAO INICIADA]

- 4.1 Edge Function `generate-scene` com auth + validacao de creditos
- 4.2 OpenRouter Vision integration + presets no banco (11 presets do prompt-strategy.md)
- 4.3 VideoModelAdapter interface + registry
- 4.4 Adapter Kling 2.6 Pro (gate: ler doc fal.ai)
- 4.5 Adapter Seedance 2.0 (gate: ler doc fal.ai)
- 4.6 Adapters Wan, LTX, Kling 3.0, First-Last O1 Pro (cada um com gate)
- 4.7 Geracao de transicoes com start/end frame
- 4.8 Composicao client-side WebCodecs + fallbacks
- 4.9 Upload final + registro em `final_renders`
**Gate: Dudu aprova**

### Fase 5 — Admin [NAO INICIADA]

- 5.1 Rota `/admin` com guard
- 5.2 CRUD de usuarios + creditos manuais
- 5.3 Visualizacao de geracoes + projetos + debug mode (vision JSON, prompts, custos)
- 5.4 Troca de FAL_KEY write-only
- 5.5 Metricas basicas
**Gate: Dudu aprova**

### Fase 6 — Polish V1 [NAO INICIADA]

- 6.1 Compartilhamento publico `/v/[slug]`
- 6.2 Historico de projetos no dashboard
- 6.3 Regeneracao de cena individual
- 6.4 Empty states, loading states, error states
- 6.5 QA completo
**Launch V1**

### Fase 7 — Pagamento (V2) [FUTURO]

- Webhook Pagar.me/Stripe/Asaas → credita automaticamente
- Planos recorrentes

### Fase 8 — Growth (V3) [FUTURO]

- Templates publicos, remix, white-label, API publica

---

## Documentos de referencia

- **animov_briefing_v1.md** — briefing original ImoVid (schema, regras FAL_KEY, creditos)
- **animov_briefing_v2.md** — briefing Animov (stack, fases, gates, editor, pipeline)
- **animov-prompt-strategy.md** — estrategia de prompts, 11 presets, arquitetura 3 camadas, tiers

## Fora do escopo V1

- Pagamento automatico (creditos manuais via admin por enquanto)
- Edicao manual de transicoes
- Audio/trilha
- Templates publicos
- White-label
- API publica
- Mobile app nativo
- Presets customizados pelo usuario
- Prompts multilingues

