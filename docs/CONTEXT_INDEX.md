# Animov.ai — Context Index

> Cole este arquivo no inicio de cada sessao com o Cursor.
> Ele nao contem os detalhes — contem o MAPA de onde encontrar cada coisa.

---

## Projeto

**Animov.ai** — SaaS que transforma fotos de imoveis em videos cinematograficos com IA.
**Repo:** `animov/` dentro de `/Users/morpheus/Documents/Apps/Animov/`
**Stack:** Next.js 14, Supabase, fal.ai, Zustand, Tailwind, shadcn/ui, R3F
**Deploy:** Vercel (auto-deploy no push) | GitHub: dudumaluf/Animov

---

## Documentos — Quando ler cada um

| Documento | Caminho | Quando ler |
|-----------|---------|------------|
| **MASTER_PLAN.md** | `docs/MASTER_PLAN.md` | Inicio de sessao (visao geral, arquitetura, diretrizes) |
| **ROADMAP.md** | `docs/tracking/ROADMAP.md` | Antes de escolher proxima tarefa (checklist ticavel) |
| **PROGRESS.md** | `docs/tracking/PROGRESS.md` | Saber o estado atual rapido (snapshot) |
| **CHANGELOG.md** | `docs/tracking/CHANGELOG.md` | Saber o que foi feito em sessoes anteriores |
| **Prompt Strategy** | `docs/strategy/animov-prompt-strategy.md` | Antes de mexer em presets, prompts, ou vision |
| **Briefing v2** | `docs/briefings/animov_briefing_v2.md` | Referencia de fases, gates, user flows |
| **Briefing v1** | `docs/briefings/animov_briefing_v1.md` | Referencia historica (schema original, regras) |

---

## Estrutura docs/

```
docs/
├── MASTER_PLAN.md              -- Biblia do projeto
├── CONTEXT_INDEX.md            -- Este arquivo (mapa)
├── tracking/
│   ├── ROADMAP.md              -- Checklist ticavel por fase
│   ├── PROGRESS.md             -- Snapshot do estado atual
│   └── CHANGELOG.md            -- Historico de sessoes
├── briefings/
│   ├── animov_briefing_v1.md   -- Briefing original ImoVid
│   └── animov_briefing_v2.md   -- Briefing Animov v2
└── strategy/
    └── animov-prompt-strategy.md -- Presets, 3 camadas, anti-alucinacao
```

---

## Regras rapidas

1. Ler MASTER_PLAN.md no inicio de cada sessao grande
2. Checar ROADMAP.md pra saber o que falta
3. Atualizar ROADMAP.md (marcar [x]) e PROGRESS.md ao concluir tarefas
4. Adicionar ao CHANGELOG.md no fim de cada sessao
5. Testar local (`pnpm dev`) antes de push
6. FAL_KEY nunca no client — tudo server-side
7. Commits pequenos e descritivos
8. Antes de integrar modelo fal.ai: LER A DOC primeiro

---

## Estado resumido (atualizar aqui a cada sessao)

**Fase atual:** 3+4 em andamento
**Ultimo deploy:** 11 abril 2026
**Proximo foco:** Testar editor local, ajustar UX, fechar gaps criticos (creditos, auth, drag-drop)
