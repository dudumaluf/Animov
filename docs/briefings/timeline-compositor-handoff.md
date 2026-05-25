# Handoff técnico — Timeline / Compositor de vídeo, imagem e som

> Briefing engenheiro-pra-engenheiro. Esse documento é uma carta de "se eu fosse começar do zero, isso eu já saberia". Foi escrito depois de ~12 meses construindo o editor do **Animov** (web app Next.js de geração de vídeo curto a partir de fotos + IA) e cobre as decisões que sobreviveram à evolução, os bugs que machucaram, e o que eu faria diferente se fosse portar pra um **node-based compositor** (i.e. um "Compositor Node" dentro de um grafo de nós que precisa entregar uma timeline funcional de vídeo + imagem + áudio com playback ao vivo e export final).
>
> Sem snippets longos de código. O objetivo é dar **modelo mental** e **vocabulário compartilhado**, não tutorial.

---

## 0. Contexto do produto (pra você calibrar as escolhas)

- App web, Next.js 14 App Router, TypeScript, Tailwind. Cliente "fat", servidor fino.
- Geração de cenas por LLM/modelos de vídeo (Fal, Kling etc.) — cada cena pode ser **foto parada**, **vídeo gerado** ou **vídeo upload do usuário**.
- Entre duas cenas pode haver **uma transição** (também vídeo).
- Uma faixa de **música global** (única, não multi-track) + opcional **áudio de clip** quando a cena é vídeo upado.
- Aspecto: projeto inteiro tem **um único `exportAspectRatio`** (16:9, 9:16, 1:1, 4:5).
- Persistência: **Supabase** (Postgres + Storage + Auth).
- O "compositor" final roda **no browser** (sem servidor de render).

Esse perfil pesa bastante nas escolhas abaixo. Em particular: **um decoder de vídeo ativo de cada vez** é viável porque sempre estamos exibindo uma única timeline linear, não múltiplas camadas sobrepostas.

---

## 1. Decisões fundamentais (resumo executivo)

| Tema | O que escolhemos | Por quê |
|---|---|---|
| Estado | **Zustand**, dividido em ~3 stores por responsabilidade | Simples, sem boilerplate, sem provider hell |
| Modelo de timeline | **Lista ordenada de cenas + transições adjacentes**, sem multi-track | Cobre 95% do produto, simplifica enormemente |
| Clock de playback | **RAF master clock** em hook React, `<video>` é escravo | Sync entre vídeo + áudio + transições + UI fica governável |
| UI da timeline | **DOM + CSS transforms**, não canvas | Hit-testing/acessibilidade grátis; perf OK com cards pequenos |
| Drag & drop | **dnd-kit** + handlers pointer raw em paralelo | dnd-kit pra reorder/sort; pointer raw pra trim/scrub |
| Áudio | **WebAudio (MediaElementSource)** + grain scrubber decodado | Reproduz fielmente as regras do export |
| Composição/export | **Mediabunny** no browser (fallback Canvas + MediaRecorder) | Zero servidor, decodifica + remuxa MP4 client-side |
| Estado ↔ DB | **PATCH com snapshot completo** + debounce 3s | Simples de raciocinar, evita JSON Patch |

Se você for portar 1:1, esses 8 itens são o esqueleto.

---

## 2. Mental model: 3 camadas de estado

Esse foi o ganho mais importante. **Separe o que tem semântica de "documento" do que tem semântica de "transporte" do que é "preferência do usuário"**:

1. **Domain store** — fonte de verdade do documento que vai pro DB.
   - Cenas, transições, música, aspect ratio, seleção do usuário.
   - Tem `isDirty` / `isSaving` / `isLoading`.
   - **Persiste**.

2. **Transport store** — relógio de playback / UI.
   - `currentTime`, `isPlaying`, `isScrubbing`, `pixelsPerSecond`, modo de visualização.
   - **Não persiste**. É efêmero.

3. **Chrome store** — preferências locais do editor.
   - Layout de painéis, altura de strip, hover-play habilitado, etc.
   - **Persiste em localStorage**, separado do projeto.

Tentativas anteriores de meter playback dentro do domain store causaram: `isDirty` virando ruído (toda execução do clock acionava save debounce), re-render de inspector a cada frame, payload de DB poluído por estado de UI. Separar foi catártico.

### Sharp edge prático

`currentTime` atualizando a cada frame em Zustand significa que **qualquer componente que se inscrever nele re-renderiza a 60fps**. Auditoria de subscribers é obrigatória. Componentes "lentos" (ruler, strip de cards) precisam derivar de `activeSegmentId` ou ler de refs, não de `currentTime`.

---

## 3. Modelo de dados na timeline

```
Project
├── scenes[]               # ordem = posição no array (sem sort_order client-side)
│   ├── id, photoUrl, videoUrl
│   ├── status             # idle | generating | ready | error
│   ├── videoVersions[]    # cada versão tem sua própria duração nativa
│   ├── activeVersion      # qual versão tá sendo usada
│   ├── duration           # duração efetiva (DERIVADA de trim, mas armazenada)
│   ├── trimStart, trimEnd # janela não-destrutiva sobre o vídeo nativo
│   ├── generationTargetSeconds  # quantos seg pedir pra IA na PRÓXIMA geração
│   ├── imageTransform     # scale + offset + background (letterbox)
│   ├── sourceType         # generated | video-upload | image-only
│   └── audioVolume        # só pra video-upload
│
├── transitions[]          # id = `t-${fromSceneId}-${toSceneId}`
│   ├── status, videoUrl, duration, presetId
│   └── enabled            # toggle de custo (não afeta playback, sharp edge!)
│
├── musicUrl
├── audioMix               # fades + ducking + volumes
└── exportAspectRatio
```

**Invariantes que valem ouro:**

- **Ordem é o índice do array.** Sem `sort_order`. Operações de reorder/insert/delete são `set()` único em Zustand que atualiza `scenes[]` E re-chama `rebuildTransitions()` na mesma transação.
- **Transições são derivadas** da adjacência: ao reordenar, walk `scenes[]` aos pares; pra cada par, mantém transição existente (se id bate) ou cria stub idle.
- **Transição órfã** (cuja cena de origem ou destino sumiu) é **promovida a cena nova** se ela já tinha vídeo gerado. Decisão de produto: "não jogar fora trabalho pago". Documente isso porque pode confundir usuários ("apareceu uma cena que eu não criei").

---

## 4. O "duration triangle"

Essa parte é traiçoeira. **Toda timeline com trim e geração assíncrona vive com 3 conceitos de duração coexistindo:**

1. **`videoVersions[i].duration`** — duração nativa do arquivo (o que `<video>.duration` deveria retornar).
2. **`trimStart` / `trimEnd`** — janela não-destrutiva. Efetivo = `(trimEnd ?? native) - (trimStart ?? 0)`.
3. **`generationTargetSeconds`** — "quantos segundos pedir ao modelo na próxima geração". Limpa depois do sucesso.

E uma **derivada armazenada** pra evitar cálculo a cada render:

4. **`scene.duration`** — duração efetiva na edição. **Recalculada toda vez que trim muda.** Persiste no DB.

A regra: **toda mutação de trim re-escreve `duration`**. Se você esquecer isso em algum mutator, a timeline diverge silenciosamente.

### Healing bidirecional (importantíssimo)

Modelos de geração de vídeo **mentem sobre a duração**. Pediu 5s, entrega 4.7s. O `videoVersions[i].duration` salvo no DB vai estar errado vs o que o `<video>.duration` real vai reportar quando o arquivo carregar.

A consequência sem healing: o engine avança o `currentTime` além do EOF, o browser clampa `.currentTime` na última frame, parece **freeze de playback** até o fim do segmento.

A solução que aplicamos: uma função `reconcileVideoVersionDuration(sceneId, versionIndex, realDuration)` que roda no `onLoadedMetadata` dos `<video>` elements. Ela:

- **Cresce** o valor armazenado se nativo > armazenado (tolerância ~50ms).
- **Encolhe** se armazenado > nativo (tolerância maior, 500ms, pra evitar partial metadata).
- Quando encolhe na versão ativa, **clampa `trimEnd`** e **recalcula `scene.duration`** automaticamente.
- **NÃO marca `isDirty`** — healing é em memória, não vira save storm. Persiste no próximo edit real do usuário.

Defesas adicionais no engine:

- Suprimir re-seeks quando o offset esperado já passou da duração nativa (evita loop de `seeking`/`seeked` events).
- Forçar `el.loop = false` no segmento ativo (o engine é a única autoridade pra avançar).

---

## 5. Engine de playback — master clock RAF

**Princípio:** **a fonte de verdade do tempo do projeto NÃO é `<video>.currentTime`**, é o store de transporte. O `<video>` é escravo.

### Como funciona

- Um `useEffect` arma um `requestAnimationFrame` loop quando `isPlaying === true`.
- A cada tick: `dt = clamp(now - lastTick, 0, 100ms)`, `currentTime += dt`, escreve no store.
- Calcula o segmento ativo via `timeToSegment(segments, currentTime)`.
- Se o segmento mudou: pausa anterior, ativa próximo (seek pra `trimStart + localOffset`, play se `isPlaying`).
- Se ainda no mesmo segmento: faz **drift correction** — se `|el.currentTime - expectedOffset| > 200ms`, re-seek. Caso contrário, deixa o decoder rodar livre.

### Por que NÃO usar `<video>.timeupdate` como master

Disparado de forma imprevisível pelo browser (~4-15Hz, varia por engine). Sub-frame imprecisão. Múltiplos vídeos = múltiplas fontes de tempo brigando. Com RAF + drift correction você tem **uma única autoridade**.

### O que NÃO colocar em ref

Hot values do engine (segments, panX, zoom) vivem em **refs**. O RAF loop não pode depender de re-renders do React pra ver valores atualizados — você precisa garantir que ele lê o valor **atual** sem reconstruir o efeito a cada mudança.

Mas o `currentTime` que **escreve no store** continua sendo Zustand — pra os consumers terem reatividade. Você só precisa garantir que esses consumers sejam leves.

---

## 6. Sync multi-source — 1 decoder ativo, registry pattern

**Modelo:** existe **um `<video>` no DOM por cena/transição** (renderizados pelo strip). Esses elementos vão pra um **`videoRegistry`** indexado por segment id. O engine consulta o registry pra saber qual elemento ativar/pausar.

### Por que registry e não um decoder único compartilhado

Tentativa anterior: um único `<video>` que troca de `src`. Resultado: **latência de swap** (browser tem que abrir o arquivo, parse de moov, etc.) — playback "engasga" toda vez que cruza boundary.

Com registry: cada elemento já está **`preload="auto"`** e quando a timeline entra no modo playback, fazemos **warmup** (play + pause em frame 0) de todos os segmentos. Boundary crossing vira `pause(antigo)` + `play(novo)` — instantâneo.

### Premount (lead time)

`PREMOUNT_LEAD_SECONDS = 1.0`. Um segundo antes do fim do segmento atual, o próximo recebe um play silencioso + pause em `trimStart`. Isso garante que o decoder dele já tá "quente" quando o boundary chega. Marcado em um `Set` pra disparar uma vez por segmento.

### Transições — sequenciais, não overlapping

**Decisão consciente.** No nosso modelo a transição é **um segmento próprio**, com seu próprio `[startTime, endTime)`. Não há A/B crossfade no preview — quem renderiza o "fade" é o próprio vídeo da transição (gerado pela IA).

Vantagem: lookup de segmento é um `findIndex` simples (interval membership), sem cálculo de blending entre 2 decoders.

Desvantagem: se você precisar de **overlap real** (ex: dissolve manual com blending no canvas), esse modelo não te dá de graça. Tem que adicionar conceito de "layer" + composite no canvas overlay.

**Pro seu compositor node:** se quer overlap genuíno, considere render-to-canvas dos N decoders ativos + composite + saída via stream. Mas é outra ordem de complexidade.

---

## 7. Áudio — WebAudio pra valer (não `<audio>` element controls)

### Grafo de áudio

```
<audio music>  ── MediaElementSource ──┬── musicGain ─┐
                                       └── duckingAnalyser (RMS)
<video clip>   ── MediaElementSource ──── clipGain ───┼── destination
                                                      │
MusicGrainScrubber (decoded AudioBuffer) ─ scrubGain ─┘
```

### Por que WebAudio e não `<audio>.volume` simples

1. **Ducking automático** quando há fala (RMS do clip ataca → music gain abaixa) — impossível com `.volume` element-level sem polling lento.
2. **Fades de music in/out e clip in/out** com envelopes lineares precisos.
3. **Reproduz fielmente o mix do export** — o `composeVideos` aplica as mesmas constantes (fades, ducking), então o que toca no preview = o que sai no MP4.
4. **Grain scrubber pra scrub** (próxima seção).

### Armadilhas WebAudio

- `MediaElementSource` é **single-connect por elemento**. Tentar wrappar duas vezes joga erro. Solução: `WeakMap<HTMLMediaElement, MediaElementSourceNode>`.
- Depois de wrappado, `element.volume` e `element.muted` **viram cosméticos** — quem controla é o gain node. Documente isso pesado, alguém vai esquecer e ficar maluco.
- **AudioContext começa suspenso** até primeira interação do usuário. Sem priming = "scrub silent até tocar Play uma vez". Solução: listener one-shot `pointerdown/keydown/touchstart` que chama `audioContext.resume()`.

### Realidade multi-track

No nosso produto a qualquer instante tocam: **0–1 música global** + **0–1 áudio de clip** (só se cena é `video-upload`). Não é um DAW. Se você precisa N tracks reais, multiplique o grafo, mas saiba que cada `MediaElementSource` ocupa uma instância de decoder.

---

## 8. Scrub — onde mora a perf

Scrub é o gesture mais brutal em editores. **120Hz de eventos de pointer + seek em vídeo (~50ms cada) = morte por mil cortes**.

### Padrões que funcionaram

#### 8.1 Coalescing por RAF

Eventos de pointer escrevem `currentTime` no store imediatamente. **Mas o engine só executa seek 1x por frame** (dentro do seu RAF loop, lê o último valor e só seek se mudou desde último seek aplicado, com epsilon de ~30ms).

#### 8.2 Sprite overlay durante scrub

Pra cada vídeo, pré-extraímos **sprite sheets** JPEG (1 frame a cada N segundos, layout em grid). Durante scrub:
- Esconde o `<video>` ativo
- Mostra um `<div>` com `background-image` apontando pra sprite + `background-position` calculado a partir do `localOffset`
- Resultado: **feedback visual instantâneo** sem esperar decoder seek

Quando scrub termina, restaura o `<video>` e faz seek "de verdade" pra a posição final.

#### 8.3 Music grain scrubber

Pra música scrubar suave, **decodamos o arquivo inteiro num `AudioBuffer`** uma vez (cached por URL) e fazemos "grains" — pequenos pedaços de ~110ms que tocam onde o playhead está agora. Throttling em 30Hz pra não saturar.

Alternativa naïve (`<audio>.currentTime = t` a cada pointer event) = áudio chiando feio. Grain scrubber soa como scrubar em DAW profissional.

#### 8.4 Clip audio desligado durante scrub

Decisão de produto: muta o áudio do clip durante scrub (só a música preview via grains). Evita "vozes glitchadas".

#### 8.5 **SNAPSHOT zoom no início do gesture** (sharp edge clássica)

`deltaT = dx / (pps * zoom)`. Se o usuário mudar o zoom **no meio do drag** (atalho de teclado, gesture trackpad), os mesmos pixels começam a valer mais/menos tempo, e o playhead **pula** descontinuamente.

Fix: **capture `zoom` no pointer-down**, congele essa cópia pelo resto do gesture. Mesma coisa pra `pan origin` se você tem pan-as-scrub.

Vale pra qualquer mapeamento "pixel → unidade de domínio" durante um gesture (timeline scrub, color picker drag, knob drag, whatever).

#### 8.6 Resume after scrub

Pequena UX: lembre se estava tocando antes do scrub começar. Se sim, retoma `play()` automaticamente quando o usuário solta. Patenteiamente esperado pelo usuário.

---

## 9. UI da timeline — DOM, não canvas

### Por que DOM venceu canvas

- **Hit-testing grátis** (clicks, hover, focus, accessibility tab).
- **Drag handles** com dnd-kit funcionam out-of-the-box.
- **Reordering** com transitions CSS suave.
- **Inspector / context menu** com `position: absolute` triviais.

A "perda de perf" temida não materializou — cards têm tamanho fixo proporcional a `duration * pixelsPerSecond`, não rederizam textura nenhuma (sprite só durante scrub via background-image), poucos elementos no DOM (~10-50 normalmente).

**Quando canvas/WebGL ganharia:** se você for desenhar **waveform de áudio com 50k samples por track** ou **múltiplas tracks com clips bem pequenos** (DAW de verdade). Não foi o nosso caso.

### Duas escalas — sharp edge

Mantivemos **`pixelsPerSecond`** (tempo → width) **separado de `zoom` CSS** (transform scale do container). Justificativa: pps quantiza nicely pra ruler ticks, enquanto zoom é livre. Efeito visual = `pps × zoom`.

**Se você for começar do zero, considere UMA única knob "segundos visíveis no viewport"** e deriva tudo dela. Foi nossa maior fonte de deps de useEffect erradas — bugs aparecendo só em production (`StrictMode` em dev mascarava deps faltantes).

### fitToView polimórfico

`fitToView` se comporta diferente por modo:
- **Timeline mode:** ajusta zoom pra `viewportWidth / (totalDuration * pps)`, clampado.
- **Canvas mode:** ajusta scale pra encaixar bounding box do strip com padding.

Sem essa polimorfia, "encaixar tudo" funcionaria num modo e quebraria no outro. Considere `fitToView` parte do contrato de cada modo de visualização.

### dnd-kit + pointer handlers raw — vivem juntos

- **dnd-kit:** reorder de cards (`@dnd-kit/sortable` horizontal), drop de assets em "drop zones" específicas.
- **Pointer handlers raw:** trim handles (esticar in/out do clip), playhead drag, pan da viewport.

Eles **não conflitam** se você for cuidadoso com `stopPropagation` nas regiões raw e com **activation distance** generoso no dnd-kit (8px ou mais). Drag handle dedicado (`GripVertical`) com `{...listeners}` só nele evita conflito com `onClick` do card pra seleção.

### Selection / click vs drag

Background da viewport tem **threshold de "drag-induced click"** — se o pointer se moveu mais que ~4px (distância²=16), considera arraste e **não** dispara seleção/deselção. Sem isso, cada pan vira deselect chato.

---

## 10. Composição / export — sequencial, client-side

### Stack

- **Mediabunny** (lib JS de decode/encode de mídia) — primary path
- **Canvas 2D + MediaRecorder** — fallback se Mediabunny falhar

Tudo no browser. Sem servidor de render. Sem WASM ffmpeg.

### Pipeline (uma frase)

> "Para cada clip ordenado, decoda samples, redesenha com cover crop no aspect ratio de output, registra na timeline do `videoSource`; em paralelo decoda PCM dos clips, mixa com música offline aplicando fades+ducking, muxa AAC; finaliza MP4."

### Coisas que aprendi

- **Não é filter graph.** É concat sequencial puro. Simples = robusto.
- **Cover crop é uma função pura** que recebe (frame, target W×H, source W×H) e desenha. Vive separada da pipeline, fácil de testar.
- **Áudio mix é offline e em chunks** — pra projetos longos, processar em pedaços de N segundos evita OOM.
- **Shortcut: 1 clip, sem música, sem clip audio = passthrough do blob.** Não rasteriza. Vale o `if` no começo.
- **Honest limitation:** o export hoje **NÃO** lê `imageTransform` — porque ele bake'a o transform no **vídeo gerado** antes (quando manda pra IA, já manda já enquadrado). Se você muda o transform DEPOIS de gerar, precisa regenerar pra refletir. Decisão pragmática, custou simplicidade no compositor.

### Bake vs apply at compose time

Tem dois caminhos pra honrar transforms/effects:
1. **Bake**: aplica no asset antes da geração, salva URL do asset transformado, compositor é "burro".
2. **Apply at compose**: compositor lê os efeitos do scene state e aplica per-frame.

A gente foi pelo (1). Mais simples, menos código no compositor. Pena: re-export depois de reframing = regeneração obrigatória.

Pra um node-based compositor, **(2) faz mais sentido** porque cada node já tem efeitos como dados de primeira classe. Vale o investimento.

---

## 11. Armadilhas que pagamos (lista honesta)

### 11.1 Playback freeze por duration mismatch
Modelo retorna duração mentirosa → engine seeka além de EOF → frame congelada. **Fix:** reconciliation bidirecional no `onLoadedMetadata`. (Seção 4.)

### 11.2 Playhead jumping durante scrub com zoom
`deltaT` calculado com live zoom enquanto usuário muda zoom mid-drag. **Fix:** snapshot zoom no pointer-down. (Seção 8.5.)

### 11.3 Playhead preso em x=0 em produção
Effect com deps incompletas — StrictMode em dev double-mount mascarava. Produção single-mount não re-rodava sync de pan. **Fix:** expandir deps (`segmentSignature`, `layoutKey`, `zoom`) + ResizeObserver fallback + safety net rAF.

### 11.4 Wheel scrub atualizava tempo mas preview travado
Wheel só chamava `seek()`, esqueceu de chamar `setScrubbing(true)`. Engine nunca entrava no path de scrub. **Fix:** wheel também flipa `isScrubbing`, com debounce 160ms pra sair.

### 11.5 Background tab dessincroniza música
Tab em background = RAF throttle, mas `<audio>` continua decodando. Música anda mais rápido que o clock. **Fix:** drift correction a cada ~1.5s realinha `audio.currentTime` com `currentTime % audio.duration`. Aceita pequenas correções audíveis em troca de não acumular drift.

### 11.6 `transition.enabled` toggle só afetava custo, não playback
Bug semântico — propriedade existe, mas o `buildSegments` não a checava. Usuário desligava transição achando que removia da timeline; só removia do cálculo de custo. **Lição:** quando adicionar flag em domain entity, audite TODOS os derivadores.

### 11.7 `MediaElementSource` double-wrap explode
WebAudio rejeita conectar o mesmo `<audio>`/`<video>` 2x. Hot-reload em dev disparava isso. **Fix:** `WeakMap<HTMLMediaElement, MediaElementSourceNode>` cache.

### 11.8 Pan velocity inconsistente em clips muito curtos
Cards têm `min-width` mínimo (8px) pra não sumirem. Mas se `duration * pps < 8px`, o DOM fica mais largo que o "tempo" daquele clip — pan via DOM bbox vai em velocidade errada. **Fix:** detectar essa condição e usar pan linear matemático em vez de bbox-based.

### 11.9 Promote orphan transitions = scene fantasma
Reordenou de jeito que invalidou uma transição que já tinha vídeo. Nossa lógica "promove" ela a scene nova. Aparece uma cena que o usuário não criou. Documente. Considere UI feedback ("essa cena veio de uma transição que você gerou").

### 11.10 Healing sem `isDirty` deixa heal não persistido
Healing é em memória pra evitar save storm — mas se usuário fecha app sem fazer outro edit, o heal não persiste. Próxima sessão re-heala. **Aceitamos.** Trade-off explícito.

---

## 12. O que eu faria diferente

1. **Single zoom knob.** `secondsInViewport` é a única source of truth, deriva `pps` e `cssZoom` quando necessário. Adeus deps bug.
2. **Interaction controller único pra timeline.** Hoje scrub/trim/reorder/pan são 4 stacks diferentes (rAF, pointer raw, dnd-kit, viewport handlers). Um controller central que entende modos seria mais robusto.
3. **Apply transforms at compose time**, não bake. Compositor lê o state inteiro, decoder agnostic. Re-export sem regen.
4. **Export como job no mesmo queue que generation**, com progresso reportado no mesmo painel. Hoje é one-shot do botão. Pra projetos longos seria melhor.
5. **Música como lane visível** (mini waveform) se o compositor promete "som". Hoje é metadata invisível na strip.
6. **Image-only export path** (duplicar frame por X segundos) — hoje cena image-only **não exporta**, precisa gerar vídeo antes. Storyboard puro fica refém.
7. **Versionar `videoVersions[i].duration` com hash do arquivo.** Hoje a heal funciona mas é stateless. Hash do blob daria invalidação certa.

---

## 13. Recomendações práticas pro seu Compositor Node

Tomando todos os patterns acima e traduzindo pra **um node num grafo** cuja saída é "um vídeo composto":

### 13.1 Estrutura sugerida do node

```
CompositorNode {
  inputs: {
    timeline_clips: ClipRef[]       // refs a outros nodes que produzem vídeo
    audio_track:    AudioRef?       // ref a node que produz áudio (música)
    aspect_ratio:   "16:9" | ...
  }
  state: {
    scenes:       Scene[]            // reorder, trim, transforms
    transitions:  Transition[]
    audio_mix:    AudioMixConfig
    selection:    Selection
  }
  outputs: {
    composed_video: VideoBlob        // bake final
    preview_stream: MediaStream?     // pra UI fazer live preview
  }
}
```

Cada node externo já entrega URL ou Blob — o Compositor não gera mídia, só **organiza, sincroniza e exporta**.

### 13.2 Sub-componentes internos

- **`DomainStore`** — Zustand, persisted (parte do save do grafo).
- **`TransportStore`** — Zustand, ephemeral (currentTime, isPlaying).
- **`PlaybackEngine`** — hook React, RAF master clock, video registry, premount.
- **`AudioMixer`** — WebAudio graph, grain scrubber.
- **`Compositor`** — Mediabunny pipeline, export-on-demand.

### 13.3 Princípios que NÃO negocio

1. **Master clock no transport store, vídeo é escravo.**
2. **Snapshot de qualquer escala mid-gesture.**
3. **Healing de duration na carga de metadata.**
4. **`<video>` é escravo, registry indexado por id.**
5. **Sprite overlay durante scrub.**
6. **WebAudio com `MediaElementSource` + ducking + fades, mesmo math do export.**
7. **AudioContext priming em primeira interação.**
8. **Domain store separado de transport store separado de chrome store.**
9. **Click vs drag-induced click com threshold de movimento.**
10. **Premount lead time pro próximo segmento.**

### 13.4 Libs pra olhar

- **Zustand** — state, sem ceremony.
- **dnd-kit** (`@dnd-kit/core`, `@dnd-kit/sortable`) — drag/drop sortable.
- **Mediabunny** — decode/encode/mux client-side.
- **requestVideoFrameCallback** (browser API) — pra "mirror" um `<video>` em canvas sem decodificar duas vezes.
- **WebAudio API** nativa — sem wrapper, vale aprender direto.
- **lucide-react** — ícones (não tem nada a ver com timeline, mas usamos pra controles).

### 13.5 Anti-padrões — não faça

- **`<video>.timeupdate` como master clock.** Variabilidade brutal entre browsers.
- **Decoder único compartilhado com `src` swap.** Lag insuportável no boundary.
- **`<audio>.volume` pra ducking.** Polling lento, sem envelope.
- **Canvas-based timeline** pra UI normal — overkill, perde acessibilidade.
- **JSON Patch pra save.** Snapshot completo + diff no servidor = mais simples.
- **`currentTime` em React state com setState.** Use Zustand ou ref + force update controlado.
- **dnd-kit pra TUDO.** Trim handles e scrub precisam ser raw pointer.

---

## 14. Glossário rápido

| Termo | O que é |
|---|---|
| **Segment** | Unidade na timeline de playback: cena ou transição com `[startTime, endTime)`. Derivada de `scenes + transitions`. |
| **Premount** | Play+pause do próximo segmento ~1s antes do boundary, pra warmup do decoder. |
| **Drift correction** | Re-seek do `<video>` quando ele se desencontra do master clock por > 200ms. |
| **Sprite overlay** | Background-image com sprite sheet pré-extraído mostrado durante scrub no lugar do `<video>`. |
| **Grain scrubber** | Pedaços de 110ms de `AudioBuffer` decodado tocados em sequência rápida pra scrubar música suave. |
| **Bake vs Apply** | Bake = aplica efeito no asset; Apply = aplica no compositor per-frame. |
| **Healing** | Reconciliação bidirecional de duração armazenada vs duração real do arquivo. |
| **Cover crop** | Função pura `(srcW, srcH, dstW, dstH) → {sx, sy, sw, sh, dx, dy, dw, dh}` pra desenhar com cover behavior. |
| **fitToView polimórfico** | `fitToView` se comporta diferente conforme `viewMode` (timeline vs canvas). |

---

**TL;DR pra outra LLM:** Construir uma timeline de vídeo + áudio + imagem que toca ao vivo no browser é fácil de fazer **funcionar** e difícil de fazer **suave**. Os 10 princípios da seção 13.3 são onde mora a suavidade. O resto é detalhe de implementação.
