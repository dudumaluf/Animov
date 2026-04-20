# Animov.ai — Roadmap

> Checklist ticavel. Marcar `[x]` conforme itens sao concluidos.
> Atualizado: 13 abril 2026.

---

## Fase 1 — Fundacao [COMPLETA]

- [x] 1.1 Repo + Next.js 14 + Tailwind + shadcn/ui + TS strict
- [x] 1.2 Supabase schema (11 tabelas) + RLS + seed admin + seed models/presets
- [x] 1.3 Auth email/password + layout protegido + admin auto ([ddmaluf@gmail.com](mailto:ddmaluf@gmail.com))
- [x] 1.4 PROGRESS.md inicializado

---

## Fase 2 — Landing [COMPLETA]

- [x] 2.1 Estrutura one-pager (hero, como funciona, pricing, footer, navbar)
- [x] 2.2 R3F scene com scroll (canvas sticky, 400vh)
- [x] 2.3 Geometria ribbon/spiral com toggle
- [x] 2.4 Leva debug panel com controles
- [x] 2.5 Sistema de presets strip (Espiral Torcida, Cilindro Suave)
- [x] 2.6 Valores finais dos cards (layout, transform, animation)
- [x] 2.7 Cards loop infinito vertical + entry/exit scroll-driven
- [x] 2.8 Backside do strip (photo darkened ou gradient)
- [x] 2.9 Twist toggle
- [x] 2.10 Textos editaveis via Leva (hero, secondary, how-it-works, pricing, navbar)
- [x] 2.11 Alinhamento/tamanho customizavel pra headlines
- [x] 2.12 Scroll suave entre secoes
- [x] 2.13 How-it-works scroll-driven step highlight
- [x] 2.14 Gradient fade hero -> how-it-works
- [x] 2.15 Navegacao reorganizada (Inicio, Presets, Como funciona, Planos)
- [x] 2.16 Leva escondido por default + Shift+M
- [x] 2.17 Botoes pricing alinhados

### Pendencias (nao bloqueiam):

- [ ] 2.P1 Responsivo + fallback mobile sem R3F
- [ ] 2.P2 prefers-reduced-motion
- [ ] 2.P3 Tree-shake Leva do build de producao

---

## Fase 3 — Editor Shell [COMPLETA]

- [x] 3.1 Rota `/editor/[projectId]` + layout full-screen (sem sidebar)
- [x] 3.2 Upload de fotos com drag-drop + Supabase Storage
- [x] 3.3 Drag-drop reorder de cenas (dnd-kit)
- [x] 3.4 Cards de transicao automaticos (toggle on/off)
- [x] 3.5 Inspector colapsavel (preset, duracao, custo, status)
- [x] 3.6 Toolbar (nome editavel, contador, custo, botao Gerar, status save)
- [x] 3.7 Drop zone estado vazio + botao "+" entre cenas e no final
- [x] 3.8 Video autoplay nos cards quando pronto
- [x] 3.9 Fullscreen video preview modal (double-click ou botao)
- [x] 3.10 Persistencia Supabase (auto-save 3s, load on mount)
- [x] 3.11 Persistencia localStorage (cache, sobrevive refresh)
- [x] 3.12 `/editor/new` cria projeto no Supabase e redireciona
- [x] 3.13 Drag-drop reorder visual com dnd-kit
- [x] 3.14 Regenerar cena individual (botao no inspector)
- [x] 3.15 Deletar projeto (dashboard)
- [ ] 3.16 Duplicar projeto
- [ ] 3.17 Thumbnails de projetos no dashboard (primeira foto)
- [x] 3.18 Zoom controls no canvas (+/- buttons, keyboard shortcuts)
- [x] 3.19 Context menu "+" entre cenas e no final (inserir foto)

---

## Fase 4 — Pipeline de Geracao [COMPLETA]

- [x] 4.1 API route `/api/generate-scene`
- [x] 4.1b Auth check no generate-scene
- [x] 4.1c Validacao e deducao de creditos na geracao
- [x] 4.2 Vision LLM via fal.ai OpenRouter (fast/smart tiers)
- [x] 4.3 VideoModelAdapter interface + registry
- [x] 4.4 Adapter Kling O1 Pro (first-last frame)
- [x] 4.4b Adapter Kling V3 (3-15s range)
- [ ] 4.5 Adapter Seedance 2.0 (gate: ler doc fal.ai)
- [ ] 4.6 Adapter Wan (gate: ler doc fal.ai)
- [ ] 4.7 Adapter LTX Video (gate: ler doc fal.ai)
- [ ] 4.8 Adapter Kling 2.6 Pro (gate: ler doc fal.ai)
- [x] 4.9 Catalogo de 7 presets single-image com vision schemas + prompt templates
- [x] 4.10 Prompt builder 3 camadas (Vision -> JSON -> Template)
- [x] 4.11 4 presets dual-image (transicoes) — schemas + templates
- [x] 4.12 Geracao de transicoes com start/end frame
- [x] 4.13 Composicao client-side (Mediabunny — WebCodecs + H.264 MP4)
- [x] 4.14 Fallback composicao (MediaRecorder)
- [x] 4.15 Upload render final -> Supabase Storage + tabela `final_renders`
- [x] 4.16 Gravar `generation_logs` em cada geracao (debug)
- [ ] 4.17 Google OAuth (alem de email/password)

---

## Fase 4b — Editor Avancado [QUASE COMPLETA]

### Onda 1 — Core do Edit

- [x] 4b.1 Context menu "+" inteligente (opcoes por posicao)
- [x] 4b.2 Preset UX — dropdown com simbolos de direcao
- [x] 4b.3 Edit node (composicao visual no film strip)
- [x] 4b.4 Cards full-bleed (info so no hover, video play no hover)
- [x] 4b.5 Download individual por cena
- [x] 4b.6 Click canvas fecha inspector
- [ ] 4b.7 Crossfade client-side entre cenas (sem custo AI) — context menu tem placeholder, falta implementacao
- [x] 4b.8 Transicao AI — last frame + first frame -> video intermediario
- [x] 4b.9 Musica: adapter Minimax Music 2.6 + API route + Edit node inspector

### Onda 2 — Nodes e Versoes

- [ ] 4b.10 Node de texto/titulo (overlay no video final)
- [ ] 4b.11 Node de imagem/logo (PNG transparente, overlay)
- [x] 4b.12 Multi-version por cena (gerar com presets diferentes, escolher qual usar "1/3")
- [x] 4b.13 Connector inteligente entre ultimo video e edit node (hover -> "+" com opcoes)
- [x] 4b.14 Musica mixada no export final (audio sobre video no Mediabunny)

### Onda 3 — Audio Avancado

- [x] 4b.15 Upload de MP3 custom (alem de gerar AI)
- [ ] 4b.16 Corte no beat da musica (sync cortes de cena com beats)
- [x] 4b.17 Volume control / fade in/out na trilha + ducking automatico

### Onda 4 — Admin & Debug

- [x] 4b.18 Preset Recipe Manager (admin: criar/editar/ver system prompts, vision schemas)
- [ ] 4b.19 Debug view no inspector (vision data, prompt gerado, custo por cena) — admin tem generations com debug, falta integrar no inspector
- [ ] 4b.20 Prompt influenciado por input do usuario (modelo, preset, opcoes afetam estrategia) — parcial via recipes system

---

## Fase 4c — Timeline + Trim + Asset Editing [COMPLETA]

### Timeline Dual-Mode

- [x] 4c.1 `viewMode: "canvas" | "timeline"` com troca seamless (cards crescem mantendo rounded corners)
- [x] 4c.2 Playhead + scrub + play/pause + auto-follow opcional
- [x] 4c.3 Sprite frames para scrubbing instantaneo (`SpriteFrame`)
- [x] 4c.4 `VideoMirror` copia frames ativos para canvas (elimina flash de preto)
- [x] 4c.5 Pre-montagem do proximo segmento (transicao seamless)
- [x] 4c.6 Preview modular (`TheaterView` + `HeadlinePreview`)
- [x] 4c.7 Playback de imagem em timeline (cena image-only renderiza no preview)
- [x] 4c.8 Scroll = zoom no canvas; scroll = scrub no timeline
- [x] 4c.9 Notificacao de progresso de staging sprites

### Trim Nao-Destrutivo

- [x] 4c.10 Migration `00008_scene_trim.sql` (`trim_start` / `trim_end`)
- [x] 4c.11 `Scene.trimStart` / `Scene.trimEnd` + acao `setSceneTrim` no store
- [x] 4c.12 Edge handles no `film-strip` (ew-resize, visiveis em modo timeline)
- [x] 4c.13 `TrimControls` no inspector (campos numericos + botao limpar)
- [x] 4c.14 `buildSegments` + `use-timeline-engine` respeitam trim (seek, scrub, drift, premount)
- [x] 4c.15 Export `composeWithMediabunny` respeita `sourceStart`/`sourceEnd` em video + PCM audio
- [x] 4c.16 Fix: `loadFromSupabase` preserva duracao efetiva apos reload

### Asset Editing

- [x] 4c.17 `AssetEditModal` + `AssetContextMenu` (double-click / right-click)
- [x] 4c.18 Quick actions ("remove background", "white background") + edicoes custom
- [x] 4c.19 A/B `CompareSlider` compartilhado (fix de clipPath)
- [x] 4c.20 Drag-to-place de referencias (Vision LLM composer)

### Recipes System

- [x] 4c.21 Migration `00007_recipes.sql` (`recipe_categories` + `recipes` + RLS + seed)
- [x] 4c.22 Admin CRUD em `/admin/recipes` (slugify, duplicate, edit, delete, categorias)
- [x] 4c.23 `RecipesDrawer` deslizante + drag -> prompt
- [x] 4c.24 `RecipeChip` compacto (pilula color-coded)
- [x] 4c.25 API `/api/edit-image/compose-from-recipe` (vision_system_prompt + prompt_template)

### Video Upload + Export

- [x] 4c.26 Video upload nodes (`sourceType: "video-upload"`)
- [x] 4c.27 Probe automatico de duracao + thumbnail
- [x] 4c.28 Audio do video importado respeitado no export
- [x] 4c.29 Export 9:16 (alem de 16:9)
- [x] 4c.30 Project portable (JSON import/export)

---

## Fase 4d — Pending Polish [EM PROGRESSO]

- [x] 4d.1 **Separar clip duration vs generation target** (hover do card = clip; grid 5/10s = target exclusivo do inspector) — migration 00009 + `generationTargetSeconds` + inspector "Alvo (gerar)"
- [x] 4d.1.1 Pill de duracao editavel (click-to-edit) no canvas e timeline — `duration-pill.tsx` com popover inline
- [x] 4d.1.2 Playhead auto-pan quando arrastado para a borda do viewport
- [x] 4d.1.3 Ruler fixes (labels estendidos ate viewport, memoizado, sem flicker)
- [x] 4d.1.4 AutoFollow recenter fix (retry + fallback linear quando DOM nao esta pronto)
- [x] 4d.1.5 Divisor redimensionavel Preview/Strip no modo Foco (`theaterStripHeight` persistido)
- [ ] 4d.2 Crossfade client-side entre cenas (herdado de 4b.7)
- [ ] 4d.3 Node de texto/titulo overlay (herdado de 4b.10)
- [ ] 4d.4 Node de imagem/logo overlay (herdado de 4b.11)
- [ ] 4d.5 Beat sync na musica (herdado de 4b.16)
- [ ] 4d.6 Admin: troca de FAL_KEY write-only (herdado de 5.5)
- [ ] 4d.7 Debug view completo no inspector (vision data + prompt + custo) — completar 4b.19/4b.20
- [ ] 4d.8 Adapters adicionais (Seedance, Wan, LTX, Kling 2.6 Pro) — 4.5-4.8
- [ ] 4d.9 Google OAuth — 4.17

---

## Fase 5 — Admin [QUASE COMPLETA]

- [x] 5.1 Rota `/admin` com guard
- [x] 5.2 CRUD de usuarios + promover/despromover admin
- [x] 5.3 Creditos manuais (conceder/remover com motivo)
- [x] 5.4 Visualizacao de geracoes + projetos + debug mode (vision JSON, prompts, custos)
- [ ] 5.5 Troca de FAL_KEY (write-only, nunca exibe)
- [x] 5.6 Metricas basicas (uso diario, custo total, top users)

---

## Fase 6 — Polish V1 [NAO INICIADA]

- [ ] 6.1 Compartilhamento publico `/v/[slug]`
- [ ] 6.2 Historico de projetos no dashboard (thumbnails, busca, filtros)
- [ ] 6.3 Galeria de videos gerados (independente de projeto)
- [x] 6.4 Regeneracao de cena individual
- [ ] 6.5 Empty states, loading states, error states em todas as telas
- [ ] 6.6 QA completo (cross-browser, edge cases)
- [ ] 6.7 SEO/OG tags na landing e paginas publicas

**-> Launch V1**

---

## Fase 7 — Pagamento (V2) [FUTURO]

- [ ] 7.1 Webhook Pagar.me/Stripe/Asaas -> credita automaticamente
- [ ] 7.2 Planos recorrentes (Free, Starter, Pro)
- [ ] 7.3 Checkout avulso (top-up de creditos)
- [ ] 7.4 Pagina `/conta` com historico de pagamentos

---

## Fase 8 — Growth (V3) [FUTURO]

- [ ] 8.1 Templates publicos
- [ ] 8.2 Remix de projetos
- [ ] 8.3 White-label
- [ ] 8.4 API publica
- [ ] 8.5 Integracoes (Instagram, WhatsApp Business)
- [ ] 8.6 PWA / mobile
