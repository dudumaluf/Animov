# Animov.ai — Master Plan v3

> Documento-mae do projeto. Visao geral, arquitetura, estado atual, diretrizes.
> Atualizado: 11 abril 2026.
>
> **Arquivos de tracking:** [ROADMAP.md](./ROADMAP.md) (checklist ticavel), [PROGRESS.md](./PROGRESS.md) (snapshot atual), [CHANGELOG.md](./CHANGELOG.md) (historico)
> **Docs de referencia:** [animov_briefing_v1.md](../animov_briefing_v1.md), [animov_briefing_v2.md](../animov_briefing_v2.md), [animov-prompt-strategy.md](../animov-prompt-strategy.md)

---

## 1. Visao do Produto

**Animov.ai** transforma fotos de imoveis em videos cinematograficos curtos usando IA generativa. Nao e uma ferramenta utilitaria — e um estudio com alma artistica, tipografia editorial, preto absoluto, video em evidencia.

**Publico:** corretores, imobiliarias, construtoras, fotografos de imoveis, social media imobiliario BR.

**Proposta de valor:**
- Upload de fotos → preset cinematografico → video pronto em minutos
- Transicoes geradas com start/end frame conditioning
- Custo real transparente antes de gerar
- Multi-model (Kling, Seedance, Wan, LTX) — usuario escolhe qualidade vs custo

---

## 2. Stack e Arquitetura

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 14 App Router, TypeScript strict, pnpm |
| UI | Tailwind v3, shadcn/ui, Radix, Framer Motion |
| 3D/Landing | React Three Fiber + drei |
| Estado | Zustand (persist middleware, localStorage + Supabase sync) |
| Auth | Supabase Auth (email/password; Google OAuth planejado) |
| Database | Supabase Postgres (11 tabelas, RLS completo) |
| Storage | Supabase Storage (bucket `photos`, publico) |
| AI Video | fal.ai (Kling O1 Pro implementado; Seedance, Wan, LTX planejados) |
| AI Vision | fal.ai OpenRouter (Gemini Flash = fast, Claude Sonnet = smart) |
| Hosting | Vercel (conectado ao GitHub, auto-deploy) |
| Repo | github.com/dudumaluf/Animov |

```
Browser                        Vercel (Next.js)                 External
┌─────────┐    ┌──────────────────────────────┐    ┌──────────┐
│ Landing  │    │ /api/generate-scene           │───│ fal.ai   │
│ Editor   │───│ /api/projects                 │   │ Kling O1 │
│ Dashboard│    │ /api/upload                   │   │ OpenRouter│
│ Admin    │    │                               │   └──────────┘
└─────────┘    └──────────┬───────────────────┘
                          │
                   ┌──────┴──────┐
                   │  Supabase   │
                   │  Auth       │
                   │  Postgres   │
                   │  Storage    │
                   └─────────────┘
```

---

## 3. Estado Atual (Resumo)

| Fase | Status | Progresso |
|------|--------|-----------|
| 1 — Fundacao | COMPLETA | Auth, schema, RLS, seed |
| 2 — Landing | COMPLETA (pendencias cosmeticas) | R3F, scroll-driven, visual polish |
| 3 — Editor Shell | ~70% | Film strip, inspector, upload, presets, persistencia |
| 4 — Pipeline | ~40% | 1 adapter (Kling O1), Vision 3 camadas, 7 presets |
| 5 — Admin | NAO INICIADA | Placeholder |
| 6 — Polish V1 | NAO INICIADA | — |
| 7 — Pagamento | FUTURO | — |
| 8 — Growth | FUTURO | — |

> Detalhes: [PROGRESS.md](./PROGRESS.md) | Checklist: [ROADMAP.md](./ROADMAP.md)

---

## 4. Arquitetura do Editor

```
┌─────────────────────────────────────────────────────────┐
│ Toolbar: [nome editavel] [cenas] [salvo/nao] [custo] [Gerar] │
├─────────────────────────────────────────┬───────────────┤
│ Film Strip (horizontal, centralizado)   │ Inspector     │
│ ┌─────┐ ┌─┐ ┌─────┐ ┌─┐ ┌─────┐ (•)  │ (colapsavel)  │
│ │Cena1│ │T│ │Cena2│ │T│ │Cena3│ [+]  │ - Preview     │
│ └─────┘ └─┘ └─────┘ └─┘ └─────┘      │ - Preset      │
│                                         │ - Duracao     │
│                                         │ - Custo       │
│                                         │ - Fullscreen  │
└─────────────────────────────────────────┴───────────────┘
```

**Store:** Zustand com persist middleware. Salva em localStorage (cache rapido) + Supabase (source of truth). Auto-save 3s apos mudancas.

**Fluxo:** Dashboard → /editor/new (cria projeto no Supabase) → /editor/[uuid] → upload fotos (Supabase Storage) → escolhe presets → Gerar → videos salvos no Supabase.

---

## 5. Pipeline de Geracao (3 Camadas)

Baseado no [animov-prompt-strategy.md](../animov-prompt-strategy.md).

```
Foto → [Camada 1: Vision LLM] → JSON estruturado
       → [Camada 2: Validacao] → slots preenchidos
       → [Camada 3: Template]  → prompt cinematografico
       → [Adapter: fal.ai]    → video MP4
```

**Camada 1:** `fal.ai openrouter/router/vision` com system prompt do preset. Tier `fast` (Gemini Flash) ou `smart` (Claude Sonnet).

**Camada 2:** JSON parseado e validado. Cada preset define seu proprio schema (Push-in precisa de `focal_point`, Parallax precisa de `foreground_element` + `background_element`, etc.).

**Camada 3:** Template do preset preenche slots do JSON → prompt final anti-alucinacao. Filosofia: "descreva so o que a camera faz, nunca peca conteudo novo."

**Arquivos:** `src/lib/vision/call-vision.ts`, `src/lib/presets/catalog.ts`, `src/lib/presets/build-prompt.ts`

---

## 6. Modelos de Video

| Modelo | Adapter | Status | Custo/s | Start+End Frame |
|--------|---------|--------|---------|-----------------|
| Kling O1 Pro | `kling-o1.ts` | IMPLEMENTADO | $0.112 | Sim |
| Kling 2.6 Pro | — | PLANEJADO | ~$0.08 | Nao |
| Seedance 2.0 | — | PLANEJADO | ~$0.06 | A confirmar |
| Wan | — | PLANEJADO | ~$0.03 | Nao |
| LTX Video | — | PLANEJADO | ~$0.02 | Nao |

> Gate obrigatorio: antes de implementar cada adapter, ler doc oficial do fal.ai e colar link+resumo no commit.

---

## 7. Supabase Schema

**11 tabelas com RLS ativo:**

| Tabela | Usada no codigo? | Conectada ao editor? |
|--------|-------------------|---------------------|
| `users` | Sim (layout, admin guard) | — |
| `credits` | Sim (layout sidebar) | NAO (geracao nao valida/debita) |
| `credit_transactions` | Nao | NAO |
| `projects` | Sim (CRUD API, dashboard, editor) | SIM |
| `scenes` | Sim (save/load API) | SIM |
| `transitions` | Parcial (schema existe, save incompleto) | PARCIAL |
| `final_renders` | Nao | NAO |
| `models` | Nao (adapter registry e em codigo) | NAO |
| `presets` | Nao (catalogo e em codigo) | NAO |
| `generation_logs` | Nao | NAO |
| `system_settings` | Nao | NAO |

**Storage:** Bucket `photos` (publico, criado automaticamente pelo admin client).

**Gaps criticos:** creditos nao conectados, generation_logs nao gravados, final_renders nao usado.

---

## 8. Decisoes Tecnicas

| Decisao | Razao |
|---------|-------|
| Framer Motion (nao GSAP) | Evitar licenca comercial |
| localStorage + Supabase sync | Rapido offline, persistente online |
| fal.ai pra tudo (video + vision) | Uma API key, um billing, simplifica infra |
| Presets em codigo (nao no banco) | Iteracao rapida sem migrations; mover pro banco no V2 |
| R3F v8 + drei v9 | Compativel com React 18 / Next.js 14 |
| Zustand (nao Redux/Jotai) | Simples, sem boilerplate, persist middleware nativo |
| Film strip (nao canvas livre) | V1 guiado, menos overwhelm pro usuario nao-tecnico |
| Dark default (#0D0D0B) | Vibe estudio/editorial, video em evidencia |

---

## 9. Roadmap Resumido

| Fase | Nome | Status |
|------|------|--------|
| 1 | Fundacao | COMPLETA |
| 2 | Landing | COMPLETA |
| 3 | Editor Shell | EM ANDAMENTO (~70%) |
| 4 | Pipeline de Geracao | EM ANDAMENTO (~40%) |
| 5 | Admin Panel | NAO INICIADA |
| 6 | Polish V1 | NAO INICIADA |
| 7 | Pagamento (V2) | FUTURO |
| 8 | Growth (V3) | FUTURO |

> Checklist detalhado: [ROADMAP.md](./ROADMAP.md)

---

## 10. Diretrizes para o Cursor

1. **Checar antes de codar.** Ler MASTER_PLAN.md e ROADMAP.md antes de iniciar qualquer tarefa grande.
2. **Atualizar ao concluir.** Apos completar um item, marcar no ROADMAP.md e atualizar PROGRESS.md.
3. **Um step por vez.** Parar em gates de aprovacao.
4. **Nao inventar.** Libs, rotas, nomes — nada sem confirmar.
5. **Perguntar quando tiver duvida.** Melhor travar e perguntar do que assumir.
6. **Commits pequenos.** Um commit = uma unidade logica.
7. **Antes de integrar modelo fal.ai: LER A DOC.** Gate obrigatorio por adapter.
8. **Testar local antes de push.** `pnpm dev` → testar → commit → push (Vercel deploya automatico).
9. **FAL_KEY nunca no client.** Toda chamada fal.ai passa por API route server-side.
10. **Persistencia dual.** localStorage pra velocidade, Supabase pra durabilidade. Sempre sincronizar.

---

## 11. Documentos de Referencia

| Documento | Conteudo | Quando consultar |
|-----------|----------|-----------------|
| [animov_briefing_v1.md](../animov_briefing_v1.md) | Briefing original ImoVid (schema, creditos, UX original) | Referencia historica |
| [animov_briefing_v2.md](../animov_briefing_v2.md) | Briefing Animov v2 (stack, fases, gates, editor, pipeline) | Arquitetura e fases |
| [animov-prompt-strategy.md](../animov-prompt-strategy.md) | Estrategia de prompts, 11 presets, 3 camadas, tiers | Antes de mexer em presets/prompts |
| [ROADMAP.md](./ROADMAP.md) | Checklist ticavel por fase | Antes de cada tarefa |
| [PROGRESS.md](./PROGRESS.md) | Snapshot do estado atual | Inicio de cada sessao |
| [CHANGELOG.md](./CHANGELOG.md) | Historico de sessoes | Referencia do que foi feito quando |

---

## Fora do Escopo V1

- Pagamento automatico (creditos manuais via admin)
- Edicao manual de transicoes (curva, duracao custom)
- Audio/trilha sonora
- Templates publicos
- White-label
- API publica
- Mobile app nativo
- Presets customizados pelo usuario
- Prompts multilingues
- Canvas livre (V1 e film strip guiado)
