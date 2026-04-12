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
| **MASTER_PLAN.md** | `animov/MASTER_PLAN.md` | Inicio de sessao (visao geral, arquitetura, diretrizes) |
| **ROADMAP.md** | `animov/ROADMAP.md` | Antes de escolher proxima tarefa (checklist ticavel) |
| **PROGRESS.md** | `animov/PROGRESS.md` | Saber o estado atual rapido (snapshot) |
| **CHANGELOG.md** | `animov/CHANGELOG.md` | Saber o que foi feito em sessoes anteriores |
| **Prompt Strategy** | `animov-prompt-strategy.md` | Antes de mexer em presets, prompts, ou vision |
| **Briefing v2** | `animov_briefing_v2.md` | Referencia de fases, gates, user flows |
| **Briefing v1** | `animov_briefing_v1.md` | Referencia historica (schema original, regras) |

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
**Ultimo commit:** docs: master plan, roadmap, progress update, changelog
**Proximo foco:** Testar editor local, ajustar UX, fechar gaps criticos (creditos, auth, drag-drop)
