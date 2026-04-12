# Animov.ai — Progresso

> Checklist detalhado: [ROADMAP.md](./ROADMAP.md) | Biblia: [MASTER_PLAN.md](../MASTER_PLAN.md)

---

## Estado: Fases 3+4 em andamento

O projeto esta entre as Fases 3 (Editor) e 4 (Pipeline). As Fases 1 e 2 estao completas. O editor funciona, gera videos, salva no Supabase, e esta deployado no Vercel.

---

## O que funciona hoje

### Landing (Fase 2 — completa)
- One-pager com R3F scroll-driven (spiral, cards, entry/exit animations)
- Todos os textos editaveis via Leva (Shift+M pra toggle)
- How-it-works scroll-driven, pricing com cards alinhados
- Scroll suave, gradient fade entre secoes
- Navegacao: Inicio, Presets, Como funciona, Planos

### Editor (Fase 3 — ~70%)
- `/editor/new` cria projeto no Supabase
- Film strip com cards de cena + transicoes
- Inspector colapsavel (preset, duracao, custo)
- Upload fotos → Supabase Storage (URLs permanentes)
- Auto-save Supabase (3s debounce) + localStorage cache
- Video autoplay nos cards + fullscreen preview modal
- Botoes "+" entre cenas e no final
- Dashboard lista projetos reais do Supabase

### Pipeline (Fase 4 — ~40%)
- Vision LLM (fal.ai OpenRouter) com tiers fast/smart
- 7 presets single-image com schemas + templates
- Prompt builder 3 camadas (Vision → JSON → Template)
- Kling O1 Pro adapter funcionando (gera videos reais)
- API route `/api/generate-scene`

### Infra
- GitHub: github.com/dudumaluf/Animov
- Supabase: yhnbxrfcofjjyvuyxner (11 tabelas, RLS, Storage)
- Vercel: deployado, auto-deploy no push, env vars configuradas

---

## Gaps criticos pra V1

1. **Creditos nao conectados** — geracao nao valida nem debita creditos
2. **Auth no generate-scene** — removido pra teste, exposto
3. **Drag-drop reorder** — store pronto, sem UX visual
4. **Composicao de video final** — gera clips individuais, nao concatena
5. **Admin panel** — placeholder
6. **Generation logs** — nao grava debug info no banco
7. **Outros adapters** — so Kling O1, faltam Seedance/Wan/LTX

---

## Arquitetura de pastas

```
src/
├── app/
│   ├── (landing)/page.tsx           — landing R3F + LevaToggle
│   ├── (auth)/                      — login, cadastro, callback, actions
│   ├── (app)/                       — dashboard, conta (protegido, com sidebar)
│   ├── editor/                      — editor (protegido, full-screen, sem sidebar)
│   │   ├── [projectId]/page.tsx
│   │   ├── new/page.tsx
│   │   └── layout.tsx
│   ├── admin/                       — painel admin (protegido, role admin)
│   ├── api/
│   │   ├── generate-scene/route.ts  — geracao de video (Vision + fal.ai)
│   │   ├── projects/                — CRUD projetos
│   │   └── upload/route.ts          — upload fotos Supabase Storage
│   └── v/[slug]/                    — video compartilhado publico
├── components/
│   ├── ui/                          — shadcn
│   ├── landing/                     — navbar, hero, R3F, sections
│   ├── editor/                      — toolbar, film-strip, inspector, drop-zone, modal
│   └── shared/                      — theme-provider, app-sidebar, leva-toggle
├── lib/
│   ├── supabase/                    — client, server, middleware, admin
│   ├── adapters/                    — VideoModelAdapter interface + Kling O1
│   ├── presets/                     — catalogo 7 presets + prompt builder
│   └── vision/                      — call-vision.ts (OpenRouter via fal.ai)
├── stores/
│   └── project-store.ts             — Zustand (persist + Supabase sync)
└── middleware.ts                     — session refresh
```
