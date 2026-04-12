# Animov.ai — Progresso

> Snapshot do estado atual do projeto. Atualizado: 12 abril 2026.
> Checklist detalhado: [ROADMAP.md](./ROADMAP.md) | Biblia: [MASTER_PLAN.md](../MASTER_PLAN.md)

---

## Estado: Fases 3+4 completas, Fase 4b em andamento

### O que funciona hoje

- **Landing** completa (R3F, scroll-driven, visual polish, Leva controls)
- **Editor** funcional com UX polido:
  - Film strip com drag-drop, zoom, context menu "+"
  - Cards full-bleed (info/video play so no hover)
  - Inspector colapsavel (click cena ou click canvas)
  - Preset dropdown com simbolos de direcao
  - Download individual por cena
  - Edit node (composicao) com export MP4
  - Edit node inspector com geracao de musica AI
- **Geracao** funcional (Vision LLM 3 camadas → Kling O1 Pro → video)
- **Composicao** funcional (Mediabunny, MP4 H.264, 1920x1080)
- **Musica** integrada (Minimax Music 2.6, $0.15/track, instrumental)
- **Auth + creditos** conectados
- **Deploy** no Vercel (auto-deploy no push)
- **Persistencia** Supabase (projects, scenes, photos storage)

### Proximo foco (Fase 4b Onda 2)

1. Node de texto/titulo overlay
2. Node de imagem/logo overlay
3. Multi-version por cena (gerar com presets diferentes, "1/3")
4. Connector inteligente antes do edit node
5. Musica mixada no export final
6. Crossfade + Transicao AI entre cenas

### Gaps restantes pra V1

- Outros adapters video (Seedance, Wan, LTX)
- Admin panel
- Compartilhamento publico `/v/[slug]`
- Stripe/pagamento
- Generation logs
