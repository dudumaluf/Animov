# Animov.ai — Changelog

> Historico de sessoes de desenvolvimento.

---

## Sessao 1 — 11 abril 2026 (manha)

**Foco: Fase 1 (fundacao) + Fase 2 (landing visual polish)**

### Feito:

- Familiarizacao com o projeto existente (Fases 1+2 parciais ja existiam)
- Hero.Text — Leva controls pra alinhamento (left/center/right), padding, maxWidth, verticalPosition
- Hero.Text — defaults gravados (left, paddingX 48, maxWidth 640)
- Strip.Twist — toggle enable/disable
- Strip.Spiral — defaults de cilindro (turns 1, heightPerTurn 0)
- Strip.Material — backside mode (gradient vs photo darkened)
- Strip.Preset — sistema de presets com dropdown (Cilindro Suave, Espiral Torcida)
- Strip — depthWrite fix (backside rendering corretamente)
- Cards — defaults gravados (layout, transform, animation)
- Cards — loop infinito vertical (modulo + drift sincronizado)
- Cards — entry + exit animation (scroll-driven, fade + movement)
- Hero → How-it-works — gradient fade (sem corte duro)
- How-it-works — scroll-driven step highlight (um passo por vez)
- How-it-works — Leva controls (eyebrow, title, align, size, italic, padding, maxWidth)
- Pricing — Leva controls (heading, footer text editavel)
- Pricing — botoes alinhados (flex-col + flex-1)
- Navbar — labels editaveis via Leva
- Navbar — reorganizada (Inicio, Presets, Como funciona, Planos)
- Ancora #presets ajustada pro ponto certo do scroll
- scroll-behavior: smooth adicionado globalmente
- Leva escondido por default + Shift+M toggle
- Commit + push: `feat: landing phase 2 complete`

---

## Sessao 2 — 11 abril 2026 (tarde/noite)

**Foco: Fase 3 (editor) + Fase 4 (pipeline) + Supabase + Vercel**

### Feito:

- Zustand store completo (cenas, transicoes, presets, reorder, custo, geracao)
- Editor layout full-screen `/editor/[projectId]` (sem sidebar da app)
- Editor toolbar (nome editavel, contador, custo, botao Gerar, status save)
- Drop zone (drag-drop + click, modo full e compacto)
- Film strip (scene cards + transition cards + "+" buttons)
- Inspector colapsavel (toggle on click, slide-in, preset grid, duracao, custo)
- Video autoplay nos cards + fullscreen preview modal
- VideoModelAdapter interface + Kling O1 Pro adapter
- API route `/api/generate-scene` (upload fal.ai → Vision → prompt → video)
- Vision LLM service (fal.ai OpenRouter, tiers fast/smart)
- 7 presets catalog com vision schemas + prompt templates
- Prompt builder 3 camadas (Vision → JSON → Template)
- **Primeira geracao real de video!** (Kling O1 Pro, foto → video cinematografico)
- Supabase persistence completa:
  - `/api/projects` (create, list)
  - `/api/projects/[id]` (load, save scenes)
  - `/api/upload` (photos → Supabase Storage)
  - Auto-save 3s debounce
  - Load on editor mount
  - Dashboard lista projetos reais
- `/editor/new` cria projeto no Supabase e redireciona
- Persistencia dual (localStorage cache + Supabase source of truth)
- Photos convertidas pra data URLs (sobrevivem refresh)
- Vercel CLI instalado + projeto linkado + env vars configuradas
- Deploy producao no Vercel (build OK)
- Lint fixes pra build de producao
- Commits: `feat: editor shell + generation pipeline + Supabase persistence`, `fix: lint errors`

### Primeira geracao:

- Modelo: Kling O1 Pro (fal-ai/kling-video/o1/image-to-video)
- Custo: ~$0.56 por clip 5s
- Resultado: video cinematografico a partir de foto de imovel

---

## Sessao 3 — 11 abril 2026 (noite)

**Foco: Assessment + documentacao**

### Feito:

- Assessment honesto do estado do projeto vs roadmap
- MASTER_PLAN.md criado (biblia do projeto)
- ROADMAP.md criado (checklist ticavel por fase)
- PROGRESS.md atualizado (reflete estado real)
- CHANGELOG.md criado (este arquivo)

---

## Sessao 4 — 12 abril 2026

**Foco: Seguranca, UX, composicao de video, documentacao**

### Feito:

- Auth check + credit validation/deduction no generate-scene API
- Drag-drop reorder de cenas com dnd-kit (grab handle)
- Regenerar cena individual (botao no inspector)
- Deletar projeto do dashboard (trash icon + confirm)
- Fix localStorage quota (safe storage wrapper, nunca crashs)
- Zoom controls no canvas (+/- buttons, keyboard +/-/0)
- Fix zoom pinch conflict (removido Ctrl+scroll)
- Fix hydration error (defer render until mount)
- Video composition com Mediabunny (WebCodecs + H.264 MP4 output, 1920x1080)
- Fallback MediaRecorder pra browsers sem WebCodecs
- Fix timestamps da composicao (globalTime acumulado)
- Progress indicator visivel na toolbar durante export
- Docs organizados em docs/ hierarchy
- Visual Design System v2 criado
- CONTEXT_INDEX.md criado (manifest pra sessoes)
- .env.local.example atualizado com Stripe keys
- Stripe test keys configuradas

### Testes:

- Geracao de 2 videos (Kling O1 Pro) com Vision LLM
- Export MP4 com 2 clips concatenados via Mediabunny (funcionando)

---

## Sessao 5 — 12 abril 2026 (tarde)

**Foco: Editor UX polish + Music + Features avancadas**

### Feito:

- Context menu "+" inteligente entre cenas (Insert Photo, Crossfade soon, AI Transition soon)
- Context menu "+" no final (Add Photos, Criar Edit)
- Preset UX: dropdown com simbolos de direcao (→ ↔ ↕ ↻ ⊙ ◐ ⟵)
- Edit node visual no film strip (composicao, cena count, duracao, export)
- Edit node clicavel → abre inspector com propriedades (musica)
- Musica: adapter Minimax Music 2.6 + API route + inspector com prompt/generate/play
- Cards full-bleed (sem barra preta, preset slide-up no hover)
- Video playback no hover (nao autoplay)
- Download individual por cena (icone no hover)
- Sem numeros nos cards (ordem visual basta)
- Click canvas fecha inspector
- Edit node mesmo tamanho dos scene cards
- Fix hooks order (useCallback antes do early return)
- Fix hydration (skeleton loading)
- Fix localStorage quota (safe storage wrapper)
- Fix Vercel builds (unused imports)
- Standardize "+" button (mesmo estilo everywhere)

### Ideias capturadas pro ROADMAP (Fase 4b):

- Node de texto/titulo overlay
- Node de imagem/logo overlay
- Multi-version por cena (diferentes presets, escolher qual usar "1/3")
- Connector inteligente entre video e edit node
- Musica mixada no export
- Upload MP3 custom
- Corte no beat
- Preset Recipe Manager (admin)
- Debug view (vision data, prompt, custo)
- Prompt influenciado por input

---

## Sessao 6 — 12 abril 2026 (noite)

**Foco: Features + fixes + muitos patches rapidos**

### Feito:

- Download fix (fetch blob, nao redireciona)
- Smart CTA navbar (logado → "Meus projetos")
- Removeu badges de status dos cards
- Music presets (5 opcoes) com dropdown selector
- AI transition: API route, store, context menu com duration picker (3/5/7s)
- Multi-version por cena (videoVersions array, switcher "1/3" no hover)
- TransitionNode visual (mesmo tamanho, loading state, video preview)
- Edit node segue padrao visual dos scene nodes (full bleed, hover info)
- "=" antes do edit node (morph → "+" no hover, abre context menu)
- Composer node placeholder no context menu
- Music tabs (AI generate / Upload MP3)
- Audio no export (Mediabunny AudioBufferSource H.264+AAC ou MediaRecorder fallback)
- Ctrl+S save, persistencia do edit node + music
- Video+audio synced preview no inspector do edit
- Download buttons nos inspectors (scene + edit)
- Toolbar simplificada (removeu Exportar confuso)
- Admin credits API + dev refill endpoint
- Fix hydration, hooks order, localStorage quota, videoVersions undefined
- Fix transition state preservation (rebuildTransitions preserva status)
- Fix transition URLs (upload to fal.ai storage pra data/blob URLs)

### Problemas identificados (debt tecnico):

- Muitos patches rapidos acumulados
- Admin panel ainda placeholder
- Preset que falhou sem debug view
- Creditos so via API dev (sem admin UI)
- Composer node nao implementado
- Crossfade entre cenas nao implementado
- Hacks e fixes pontuais que precisam revisao

---

## Sessao 7 — 13 abril 2026

**Foco: Persistencia robusta, recipes system, asset editing, timeline dual-mode, trim nao-destrutivo, upload video, export 9:16, audio mix**

### Persistencia robusta

- IDs UUID estaveis para cenas (sobrevivem reorder/reload sem regenerar)
- `hasEditNode`, `videoVersions`, `transitions`, `music`, `audioMix`, `exportAspectRatio` persistidos em metadata + colunas dedicadas
- Videos gerados movidos para Supabase Storage (sem data/blob URLs efemeras)
- Upload de transicoes pra fal.ai Storage pra URLs data/blob
- Export/Import de projeto em JSON portavel (`src/lib/project-portable.ts`)
- Fix de combined name+metadata updates na API `/api/projects/[id]`

### Editor UX

- Harmonizacao do Inspector (cena + Edit Final com mesmo layout e hierarquia)
- Smart Canvas pan/zoom (anchor no mouse, scroll = scrub no modo timeline)
- Model chip compacto + **Kling V3** (duracao 3-15s range) vs **Kling O1** (5/10s)
- Context menu portal (sem clipping quando perto da borda do viewport)
- Correcoes de upload de transicoes (fix 413/422)
- Progress indicator no export com steps granulares
- Botao "Gerar/Renderizar" + "Baixar ultima versao" no edit node

### Recipes System (novo)

- Migration `00007_recipes.sql` com `recipe_categories` + `recipes` + RLS + seed
- Admin CRUD em `/admin/recipes` com slugify, categorias color-coded, duplicate, edit, delete
- `RecipesDrawer` deslizante com search e categorias
- Drag recipe -> prompt field (drop zone)
- `RecipeChip` compacto (pilula color-coded alinhada com thumbnails de referencia)
- API `/api/edit-image/compose-from-recipe` integrando `vision_system_prompt` + `prompt_template`
- Fluxo: 1 recipe ativa + prompt customizado (LLM compoe prompt final pro nano-banana-2)
- Quick-actions ficam como recipes no catalogo

### Asset Editing (novo)

- `AssetEditModal` + `AssetContextMenu` (double-click ou right-click em referencias)
- Quick actions: "remove background", "white background" + edicoes custom in-place
- Atualiza asset in-place (substitui thumbnail + URL original)
- A/B `CompareSlider` compartilhado com fix de `clipPath` (escala correta do original)
- Drag-to-place de referencias existentes em cima da imagem acima (ponto + Vision LLM compositor que considera luz, perspectiva, integracao)

### Timeline Mode (novo)

- `viewMode: "canvas" | "timeline"` em `timeline-store.ts`
- Dual-mode seamless (cards crescem em timeline mantendo rounded corners intactos)
- Playhead + scrub + play/pause + auto-follow opcional
- `SpriteFrame` para scrubbing instantaneo (sprite sheet gerado no background)
- `VideoMirror` copia frames ativos para canvas (elimina flash de preto na troca entre clipes)
- Pre-montagem do proximo segmento (transicao seamless, sem delay de carregamento)
- Preview modular: `TheaterView` (full cinematico) + `HeadlinePreview` (flutuante)
- Notificacao de progresso de staging sprites (single ou multi-step)
- Scroll = zoom no canvas mode; scroll = scrub no timeline mode

### Playback de imagem em timeline (novo)

- `TheaterView` + `HeadlinePreview` renderizam still image via `next/image` quando so existe `poster` (sem `videoUrl`)
- Cena image-only participa do playback/scrub com `scene.duration` como duracao efetiva
- Fim do "Foco..." placeholder para cenas image-only

### Trim Nao-Destrutivo (novo)

- Migration `00008_scene_trim.sql` (`trim_start` / `trim_end` nullable `numeric(6,3)`)
- `Scene.trimStart` / `Scene.trimEnd` no store + acao `setSceneTrim`
- Edge handles no `film-strip` (ew-resize, visiveis no hover em modo timeline)
- `TrimHandle` component com drag pointer -> seconds conversion
- Campos numericos `TrimControls` no inspector (com botao "Limpar")
- `buildSegments` recalcula duracao efetiva por segmento (`trimEnd - trimStart`)
- `use-timeline-engine` com helper `sourceOffsetFor` (seek correto em activate, scrub, drift correction, premount)
- Export: `composeWithMediabunny` respeita `sourceStart`/`sourceEnd` em video + PCM slicing em audio
- `project-portable` inclui `trimStart` / `trimEnd` no export/import

### Fix: preservacao do duration efetivo apos reload

- `loadFromSupabase` agora usa `duration: dur` (stored effective) em vez de `dbVersions[active].duration ?? dur` (native)
- Garante que hover label do card mostra duracao trimada corretamente apos reload

### Video Upload node (novo)

- `sourceType: "video-upload"` para importar MP4 proprios no edit
- Probe automatico de duracao + extracao de thumbnail
- Audio do video importado respeitado no export (Mediabunny AAC)
- Tratamento como scene normal no store (seleciona, inspeciona, reordena, trima, deleta)

### Export 9:16

- Novo aspect ratio `exportAspectRatio: "16:9" | "9:16"` persistido em metadata
- Composicao adapta dimensions + padding conforme o modo
- Toggle visual no inspector do Edit node

### Audio Mix

- Volume por clip + volume da trilha (slider por clip que tem audio)
- Fade in/out da musica (comeco + fim do edit)
- Ducking automatico (musica abaixa quando clip com audio toca, curva suave)
- `DEFAULT_AUDIO_MIX` + persistencia via metadata
- Controles integrados ao layout do inspector (sem slider solto)

### Fixes tecnicos

- `useCallback` movido antes de early return em `SortableSceneCard` (ESLint rules-of-hooks)
- `<img>` -> `next/image` com `fill + unoptimized` em `TheaterView` e `HeadlinePreview`
- Transicoes preservam status no `rebuildTransitions` (sem regressao ao alterar cenas vizinhas)
- ESLint + TS zero warnings apos Fase 2 do trim
- `DEFAULT_AUDIO_MIX` unused import removido (build Vercel)

### Tarefas explicitas pro proximo PR

- Crossfade client-side entre cenas (ainda aberto)
- Admin UI para troca de FAL_KEY (ainda aberto)
- Debug view completo no inspector (vision JSON + prompt gerado + custo por cena)

---

## Sessao 8 — 13 abril 2026 (tarde)

**Foco: Duration pill editavel, timeline polish (playhead auto-pan, ruler, recenter), divisor redimensionavel no modo Foco**

### Separacao clip duration vs generation target (novo)

- Migration `00009_scene_generation_target.sql` (`generation_target_seconds nullable numeric(6,3)`)
- `Scene.generationTargetSeconds` opcional no store + acao `setSceneGenerationTarget`
- `generateScene`/`generateAll` usam `generationTargetSeconds ?? duration` no payload
- Apos geracao bem sucedida: limpa `generationTargetSeconds` (scene.duration recebe o real)
- Inspector: grid de duracao vira **"Alvo (gerar)"** com hint do clip atual quando `ready`
- Saves e loads tratam a nova coluna preservando `null` por default

### DurationPill (novo)

- Componente `duration-pill.tsx` com popover portal (click-outside + Esc)
- Imagem: slider + input numerico clamped em [1, 30]s atualizando `scene.duration`
- Video: slider + input atualizando `trimEnd` (mantendo `trimStart` fixo), respeitando native max e trim minimo de 0.5s
- Botao "Resetar trim" no video-mode quando existe trim custom
- Integrado no `film-strip` (canvas e timeline) substituindo span read-only
- Coexiste com `TrimHandle` (drag edge) — ambos escrevem no mesmo estado

### Playhead auto-pan (novo)

- rAF loop durante drag: zona morta de 72px em cada borda do viewport
- Velocidade de pan proporcional a proximidade da borda (max 14px/frame)
- `seek` recalculado a cada frame compensando o pan aplicado (pointer sob cursor representa o tempo correto)
- Usuario pode percorrer timeline inteira sem soltar o scrubhead

### Ruler fixes (novo)

- Ticks agora estendem ate o viewport (nao apenas `total`), cobrindo pan para alem do conteudo
- `useMemo` em ticks (`[total, effectivePps, majorInterval, panX, viewportWidth]`)
- Culling de labels aumentado para `-60/+60` (labels da borda direita nao desaparecem prematuramente)
- `React.memo` no componente principal (evita repaints do scrub em momentos irrelevantes)
- `contain: layout paint` para isolar o repaint ao area da regua

### AutoFollow recenter fix

- `syncPanToCurrentTime` retorna `boolean` (true=ok, false=DOM nao pronto)
- Effect de recentramento tenta ate 3 frames antes de usar fallback
- Fallback linear (`syncPanToCurrentTimeLinear`) calcula pan via `pps * currentTime` quando o card nao esta no DOM
- Playhead: `useEffect` em `autoFollow` aciona micro-seek que forca um re-render alinhado
- Playhead scrub reescrito com rAF loop proprio (sem race contra engine autoFollow)

### Divisor redimensionavel Preview/Strip no modo Foco (novo)

- `theaterStripHeight` persistido no `editor-settings-store` (default 112, clamp [72, 360])
- Migration v2 -> v3 com fallback seguro
- Componente `theater-divider.tsx` (2px visivel, 12px hit area, cursor row-resize)
- Drag debounced via rAF (store update por frame, nao por pointermove)
- Handle visual highlight no hover e durante drag
- Integrado no `page.tsx` entre TheaterView e strip
- Strip height passa de `h-[112px]` hardcoded para `style={{ height: theaterStripHeight }}`

### Tarefas explicitas pro proximo PR

- Crossfade client-side entre cenas (ainda aberto)
- Admin UI para troca de FAL_KEY (ainda aberto)
- Debug view completo no inspector (vision JSON + prompt gerado + custo por cena)