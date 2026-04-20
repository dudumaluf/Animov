# Animov.ai — Progresso

> Snapshot do estado atual do projeto. Atualizado: 13 abril 2026.
> Checklist detalhado: [ROADMAP.md](./ROADMAP.md) | Biblia: [MASTER_PLAN.md](../MASTER_PLAN.md)

---

## Estado: Fases 1-5 substancialmente completas + Fase 4b Onda 1-3 completas + Fase 4c (Timeline + Trim + Asset Editing) shipada

### O que funciona

**Landing + Auth + Dashboard**
- Landing completa (R3F, scroll-driven, visual polish)
- Auth email/password + admin auto ([ddmaluf@gmail.com](mailto:ddmaluf@gmail.com))
- Dashboard lista projetos reais (criar, deletar, duplicar em breve)

**Editor Core**
- Editor `/editor/[projectId]` full-screen (sem sidebar da app)
- Film strip com scene/transition/edit nodes, drag-drop reorder (dnd-kit)
- Context menus "+" entre cenas e no final (inserir foto, criar edit, video upload)
- Inspector colapsavel harmonizado (cena + Edit Final com mesmo layout)
- Smart Canvas pan/zoom (anchor no mouse, zoom com ponto de ancora correto)
- Toolbar (nome editavel, contador, custo, botao Gerar, status save, credits)

**Pipeline de Geracao**
- `/api/generate-scene` com auth check + credits debit atomico + refund on failure
- Vision LLM 3 camadas (fal.ai OpenRouter, fast/smart tiers)
- 7 presets single-image + 4 presets dual-image (transicoes) com vision schemas + prompt templates
- Adapters: **Kling O1 Pro** (5/10s) + **Kling V3** (3-15s range)
- Multi-version por cena (videoVersions array, switcher "1/3" no hover)
- Transicoes AI (start+end frame)
- `generation_logs` gravados em cada geracao (debug data)

**Timeline Dual-Mode (novo)**
- `viewMode: "canvas" | "timeline"` com troca seamless
- Cards crescem em timeline mantendo rounded corners intactos
- Playhead, scrub, play/pause, auto-follow opcional
- Sprite frames para scrubbing instantaneo (`SpriteFrame`)
- `VideoMirror` elimina flash de preto na troca entre clipes
- Pre-montagem do proximo segmento (transicao seamless)
- Preview modular: `TheaterView` (full) + `HeadlinePreview` (flutuante)
- Cena image-only renderiza no preview durante playback/scrub
- Playhead auto-pan na borda (drag ate extremidade faz timeline correr)
- Ruler estendido ate viewport + memoizado (sem flicker, labels cobrindo toda a tira)
- AutoFollow recenter com retry + fallback linear (sem bug de playhead preso a esquerda)
- Divisor arrastavel Preview/Strip no modo Foco (`theaterStripHeight` persistido, clamp 72-360px)

**Trim Nao-Destrutivo (novo)**
- Migration `00008_scene_trim.sql` (`trim_start` / `trim_end`)
- Edge handles no film-strip (ew-resize) em modo timeline
- `TrimControls` no inspector (campos numericos + botao limpar)
- Timeline engine respeita trim em todos os paths (seek, scrub, drift, premount)
- Export composicao respeita trim em video + audio PCM

**Clip Duration vs Generation Target (novo)**
- Migration `00009_scene_generation_target.sql` (`generation_target_seconds`)
- `Scene.generationTargetSeconds` separa duracao do clip ja gerado da target da proxima geracao
- Inspector "Alvo (gerar)" atualiza target; clip label ao lado mostra duracao real do video
- `DurationPill` click-to-edit no canvas e timeline (popover inline)
- Pill adapta entre imagem (ajusta `duration`) e video (ajusta `trimEnd`)
- Target limpa automaticamente apos geracao bem sucedida

**Asset Editing (novo)**
- `AssetEditModal` + `AssetContextMenu` (double-click ou right-click)
- Quick actions ("remove background", "white background") + edicoes custom
- A/B `CompareSlider` compartilhado (fix de clipPath)
- Drag-to-place de referencias em cima da imagem (Vision LLM composer)

**Recipes System (novo)**
- DB: `recipe_categories` + `recipes` (migration `00007_recipes.sql`)
- Admin CRUD completo em `/admin/recipes` (slugify, duplicate, edit, delete, categorias color-coded)
- `RecipesDrawer` deslizante + drag recipe -> prompt field
- `RecipeChip` compacto (pilula color-coded alinhada com thumbnails de referencia)
- API `/api/edit-image/compose-from-recipe` com `vision_system_prompt` + `prompt_template`
- 1 recipe ativa + prompt custom (LLM compoe prompt final pro nano-banana-2)

**Composicao + Export**
- Mediabunny (WebCodecs + H.264+AAC MP4) + fallback MediaRecorder
- Video upload nodes (MP4 proprios importados mantem audio no export)
- Export **16:9** e **9:16** (toggle no inspector do Edit node)
- Botao "Gerar/Renderizar" + "Baixar ultima versao" no Edit node
- Progress indicator granular com steps

**Audio**
- Musica AI (Minimax 2.6) + upload MP3 custom
- Mixed no export final
- Volume por clip + volume da trilha
- Fade in/out da musica
- Ducking automatico (musica abaixa em clips com audio)

**Persistencia**
- Supabase + localStorage (source of truth + cache)
- IDs UUID estaveis para cenas
- Auto-save 3s debounce + load on mount
- Videos em Supabase Storage (nao mais data/blob URLs)
- Export/Import JSON portavel (`project-portable`)

**Admin**
- Overview, usuarios, creditos manuais, presets, geracoes com debug, settings
- Recipes CRUD completo

**Account**
- Saldo, historico, perfil

**Deploy**
- Vercel auto-deploy
- Migrations rodadas: 00001-00007 (recipes); 00008 (trim) + 00009 (generation_target) pendentes em producao

### Proximo foco

1. **Aplicar migrations `00008_scene_trim.sql` + `00009_scene_generation_target.sql`** em Supabase producao (bloqueiam trim + target em prod)
2. **Crossfade client-side** entre cenas (roadmap 4b.7, ainda `ready: false` no context menu)
3. **Admin UI** para troca de FAL_KEY write-only (roadmap 5.5)
4. **Debug view** completo no inspector (vision JSON + prompt gerado + custo por cena)
5. **Nodes overlay** (texto/titulo + imagem/logo)
6. **Beat sync** na musica
7. Fase 6 — Polish V1 (compartilhamento, empty states, QA, SEO)
8. Fase 7 — Stripe/pagamento
