# Animov.ai — Progresso

> Snapshot do estado atual do projeto. Atualizado: 12 abril 2026.
> Checklist detalhado: [ROADMAP.md](./ROADMAP.md) | Biblia: [MASTER_PLAN.md](../MASTER_PLAN.md)

---

## Estado: Fases 3+4 quase completas

### O que funciona hoje

- **Landing** completa (R3F, scroll-driven, visual polish, Leva controls)
- **Editor** funcional (film strip, drag-drop, inspector, zoom, presets, persistencia Supabase)
- **Geracao** funcional (Vision LLM 3 camadas → Kling O1 Pro → video)
- **Composicao** funcional (Mediabunny, MP4 H.264, 1920x1080)
- **Auth + creditos** conectados (valida saldo, debita na geracao)
- **Deploy** no Vercel (auto-deploy no push, env vars configuradas)
- **Skeleton loading** no editor (sem flash de tela vazia)

### Proximo foco

1. Context menu inteligente no "+" (opcoes por posicao)
2. Melhorar UX dos presets (sair do grid no inspector)
3. Preset Recipe Manager (admin) — criar/refinar presets, ver system prompts
4. Prompt influenciado por input do usuario
5. Debug/Advanced view (vision data, prompt, custo por cena)

### Gaps criticos restantes pra V1

- Outros adapters (Seedance, Wan, LTX) — so Kling O1 implementado
- Transicoes AI (start/end frame) — botao existe mas nao gera
- Admin panel — placeholder
- Compartilhamento publico `/v/[slug]` — placeholder
- Stripe/pagamento — keys configuradas, nao integrado
- Google OAuth — so email/password
- Generation logs — nao grava no banco