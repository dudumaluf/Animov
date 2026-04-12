# Animov.ai — Visual Design System v2

> Documento vivo. Reflete as decisoes visuais REAIS implementadas no codigo.
> Usar como referencia pra criar novas telas, componentes e assets.
> Atualizado: 11 abril 2026.

---

## 1. Identidade

### Nome
**Animov** — fusao de animacao + movimento + imovel + movie.

### Personalidade
Arquiteto-cineasta. Tecnico pra ter credibilidade, humano pra nao intimidar, premium pra justificar o preco.

- Confiante sem ser arrogante
- Premium sem ser frio
- Brasileiro sem ser regional
- Cinematografico sem ser pesado

### Tom de voz
Editorial. Frases curtas. Sem exclamacoes. Sem emojis na UI. O produto fala por si.

---

## 2. Paleta de Cores

### Dark mode (DEFAULT — toda a experiencia comeca aqui)

| Token | Hex | Uso |
|-------|-----|-----|
| `--bg` | `#0D0D0B` | Background principal (quase preto quente) |
| `--bg-secondary` | `#141412` | Cards, panels, areas recuadas |
| `--text` | `#F0EDE6` | Texto principal (creme) |
| `--text-secondary` | `#5A5855` | Labels, metadata, hints |
| `--accent-gold` | `#C8A96E` | Destaque, CTAs, numeros, precos, status |
| `--accent-green` | `#3A6B4A` | Verde musgo (uso minimo) |
| `--border` | `rgba(255,255,255,0.05)` | Bordas sutis |

### Light mode (toggle disponivel)

| Token | Hex | Uso |
|-------|-----|-----|
| `--bg` | `#F5F2EC` | Background papel envelhecido |
| `--bg-secondary` | `#EDEAE2` | Cards, areas recuadas |
| `--text` | `#111110` | Texto principal |
| `--text-secondary` | `#6B6860` | Labels, metadata |
| `--accent-gold` | `#C8A96E` | Mesmo em ambos os modos (fio condutor) |

### Regra de ouro
O accent gold `#C8A96E` e o unico elemento que permanece identico em dark e light. E a assinatura visual.

---

## 3. Tipografia

### Fontes implementadas

| Funcao | Fonte | CSS Variable | Pesos |
|--------|-------|-------------|-------|
| Display / Headlines | **Instrument Serif** | `--font-display` | 400, italic |
| Body / UI | **DM Sans** | `--font-body` | 300, 400, 500 |
| Labels / Dados | **DM Mono** | `--font-mono` | 300, 400 |

### Tamanhos (Tailwind tokens)

| Token | Tamanho | Uso |
|-------|---------|-----|
| `text-display-xl` | `clamp(3.5rem, 8vw, 7.5rem)` | Headlines hero, titulos de secao grandes |
| `text-display-lg` | `clamp(2.5rem, 5vw, 4rem)` | Titulos de secao |
| `text-display-md` | `clamp(2rem, 3.5vw, 3rem)` | Subtitulos |
| `text-label-sm` | `0.8125rem` | Botoes, labels de formulario |
| `text-label-xs` | `0.6875rem` | Eyebrows, metadata, badges |

### Hierarquia tipica

```
DM MONO UPPERCASE 11PX TRACKING-WIDEST    — eyebrow / label de secao
Instrument Serif 64-120px italic           — headline principal
DM Sans 15px weight 300                    — subtitulo / corpo
DM Mono 11px uppercase                     — CTA / dado tecnico / status
```

### Regras
- Headlines SEMPRE em Instrument Serif (nunca sans-serif)
- Italico generoso em headlines (enfase, elegancia)
- Eyebrows SEMPRE em DM Mono uppercase com tracking-widest e cor `--accent-gold`
- Corpo SEMPRE em DM Sans weight 300 (light, elegante)
- Numeros e precos em DM Mono
- Nunca usar Inter, Roboto, ou system fonts

---

## 4. Espacamento e Layout

### Principios
1. **Espaco de respiro generoso** — nunca apertado, nunca lotado
2. **Videos/imagens sao os protagonistas** — UI e suporte, nao o show
3. **Layouts nao-convencionais** — perspectiva, scatter, arco (nunca grid quadrada comum)
4. **Assimetria controlada** — headline a esquerda, conteudo 3D a direita

### Valores padrao
- Padding de secao: `py-32 px-6 md:px-10`
- Gap entre cards: `gap-6` a `gap-16` dependendo da hierarquia
- Border radius: `rounded-xl` (12px) pra cards, `rounded-full` pra botoes
- Bordas: `1px` sempre, nunca 2px+

---

## 5. Componentes UI

### Botoes

**Primario (CTA):**
- `rounded-full bg-accent-gold text-[#0D0D0B]`
- Font: DM Mono uppercase tracking-widest
- Hover: `opacity-80`
- Tamanho: `px-5 py-2` (compact) a `px-7 py-3` (hero)

**Secundario:**
- `rounded-full bg-[var(--text)] text-[var(--bg)]`
- Mesmo font/tracking

**Ghost / Link:**
- DM Mono uppercase tracking-widest
- Cor: `--text-secondary`, hover: `--text`
- Sem background, sem borda

### Cards
- Background: `--bg-secondary` ou `border border-white/5`
- Border radius: `rounded-xl`
- Sombras: minimas (preferir bordas sutis)
- Hover: `border-accent-gold/20` ou `border-white/10`
- Card destacado: `border-accent-gold/30 bg-accent-gold/5`

### Badges de status
- Draft/Idle: `bg-white/5 text-text-secondary`
- Gerando: `bg-accent-gold/10 text-accent-gold` (pulsante)
- Pronto: `bg-green-500/10 text-green-400`
- Erro: `bg-red-500/10 text-red-400`

### Icones
- Lucide React (linha fina, consistente)
- Tamanho padrao: 16px (small), 20px (medium), 24px (large)
- Cor: `--text-secondary`, nunca coloridos (exceto status)

---

## 6. Elementos WebGL (R3F)

### Landing — Spiral/Ribbon Strip

Um elemento 3D unico domina o hero: uma fita/espiral de fotos que roda com scroll.

**Geometria:**
- Dois modos: Spiral (helice parametrica) e Ribbon (CatmullRomCurve3)
- Presets salvos: "Espiral Torcida" (default), "Cilindro Suave"
- Twist controlavel ao longo do path
- Band width, segments, closed/open

**Material (Custom ShaderMaterial):**
- Front: fotos em atlas texture, fade blenda cor pro bgColor (nao alpha)
- Back: mesmas fotos darkened (75%) ou gradient 3 cores
- Edge fade: left/right/top/bottom independentes
- UV scroll continuo (animacao constante)

**Animacao scroll-driven:**
- Start/End transforms interpolados por scroll progress (0→1)
- Posicao, rotacao, escala, opacidade — tudo interpolado

### Landing — Cards de Foto

Cards 3D flutuantes que entram, loopam, e saem conforme scroll.

**Layout:** coluna unica, zigzag opcional, depth variation
**Entry:** fly-in com cubic ease-in-out, stagger por card
**Loop:** drift vertical infinito (modulo + clock sincronizado), todos os cards em sync
**Exit:** fly-out com fade, scroll-driven

### Transicao entre secoes
- Gradient overlay `transparent → var(--bg)` no bottom da secao R3F
- Impede corte duro entre canvas 3D e DOM sections

---

## 7. Telas Implementadas

### Landing (dark default)
1. **Hero** — headline serif esquerda + espiral 3D direita + stats bottom
2. **Presets area** — cards 3D + "Seis formas de mostrar um espaco" (scroll-driven)
3. **Como funciona** — 3 passos com scroll-driven highlight (um por vez, italic xl center)
4. **Planos** — 3 cards (Free, Starter, Pro) com badge "Mais popular"
5. **Footer** — minimalista

### Editor (full-screen, fundo `#0A0A09`)
1. **Toolbar** — nome editavel, contador de cenas, status save, custo, botao Gerar
2. **Drop zone** — estado vazio, drag-drop grande com icone upload
3. **Film strip** — horizontal centralizado, scene cards + transition toggles + "+"
4. **Inspector** — slide-in lateral, preview foto/video, grid presets, duracao, custo
5. **Fullscreen modal** — video em tela cheia com controls

### Dashboard
- Lista de projetos do Supabase com status badges e datas
- Botao "Novo projeto" (accent gold)
- Cards com hover → accent gold no titulo

---

## 8. Animacoes e Motion

### Principios
- Toda animacao tem razao de existir (nao decorativa)
- Framer Motion pra DOM, R3F useFrame pra 3D
- `prefers-reduced-motion` planejado (nao implementado ainda)

### Padroes implementados
| Contexto | Tipo | Duracao | Easing |
|----------|------|---------|--------|
| Secoes entrando | fade + translateY(20→0) | 800ms | ease-out |
| Steps highlight | opacity + translateY(8→0) | 700ms | ease-out |
| Inspector slide-in | width 0→320px | 300ms | ease-out |
| Cards entry (3D) | cubic ease-in-out | ~200ms scroll progress |
| Cards loop (3D) | linear drift, modulo wrap | continuo |
| Scroll entre secoes | smooth | nativo browser |
| Hero text fade | opacity driven by scroll | progressivo |

---

## 9. O Que Evitar

- Purple gradients, neon, glassmorphism
- Icones com muita personalidade (usar Lucide, linha fina)
- Fontes genericas (Inter, Roboto, system fonts)
- Layouts simetricos e previsiveis
- Cards com border-radius > 12px
- Animacoes que chamam mais atencao que o conteudo
- Sombras pesadas (preferir bordas sutis)
- Backgrounds brancos puros ou pretos puros (#000)
- Texto todo em caps lock (exceto eyebrows/labels em DM Mono)
- Emojis na UI

---

## 10. Evolucoes Planejadas (nao implementadas)

- Preset icons animados (mini SVG/Lottie mostrando o movimento da camera)
- Nomes amigaveis com tooltips tecnicos ("Avanco Suave" com tooltip "Push-in / Dolly In")
- Canvas livre (arrastar cenas livremente, nao so film strip linear)
- Grain texture sutil sobre backgrounds (3-5% opacidade)
- O `v` de Animov como simbolo visual (angulo de camera, telhado, frame, play button)
- Dark/light toggle na navbar (atualmente so dark)
- Showcase de outputs na landing (scatter layout de videos)
