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
