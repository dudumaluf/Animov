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
