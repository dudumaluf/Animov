# Animov.ai — Briefing para Google Stitch

## Conceito Visual e UX/UI

---

## 1. O Produto

**Animov.ai** é uma plataforma SaaS brasileira que transforma fotos de imóveis em vídeos cinematográficos com IA. O corretor faz upload das fotos, escolhe um preset de movimento de câmera (dolly in, orbit, ken burns, etc), personaliza com texto e logo, e recebe um vídeo pronto para publicar no Instagram, WhatsApp e portais imobiliários.

**O que o produto entrega:** fotos estáticas → vídeo com movimento de câmera cinematográfico → pronto para publicar. Em menos de 5 minutos. Sem saber editar vídeo.

---

## 2. Identidade da Marca

### Nome

**Animov** — fusão de animação + movimento + imóvel + movie. Lê-se em português e inglês simultaneamente. O `v` final é o elemento gráfico central da marca.

### Personalidade

A marca é como um arquiteto que também é cineasta. Precisa ser técnico o suficiente para ter credibilidade, humano o suficiente para não intimidar um corretor autônomo, e premium o suficiente para justificar o preço.

- Confiante sem ser arrogante
- Premium sem ser frio
- Brasileiro sem ser regional
- Cinematográfico sem ser pesado

### Tom de voz

Editorial. Frases curtas. Sem exclamações. Sem emojis na UI. Sem "incrível", "revolucionário", "poderoso". O produto fala por si.

---

## 3. Direção Visual

### Referências estéticas

- **Arquitectura:** Revistas Wallpaper*, Dezeen — tipografia forte, imagens que respiram, muito espaço negativo
- **Cinema:** Cartazes de filmes de auteur europeus — composição assimétrica, hierarquia clara
- **Tech premium:** Linear.app, Vercel, Resend — UI que some, o conteúdo aparece
- **Movimento:** Site "Motion" photographer portfolio — cards em perspectiva 3D, scroll fluido, dark/light toggle

### O que define o visual do Animov

1. **Espaço de respiro generoso** — nunca apertado, nunca lotado
2. **Os vídeos/imagens são os protagonistas** — a UI é o suporte, não o show
3. **Tipografia como elemento de design** — não só informação
4. **Layouts não-convencionais** — arc, scatter, perspectiva — nunca grid quadrada comum
5. **Movimento com propósito** — cada animação tem razão de existir

---

## 4. Sistema Visual

### Paleta de cores

**Modo Claro (principal):**

- Background: `#F5F2EC` — papel envelhecido, quente, não branco puro
- Background secundário: `#EDEAE2` — levemente mais escuro
- Texto principal: `#111110` — quase preto, não preto puro
- Texto secundário: `#6B6860` — cinza quente
- Accent primário: `#1A3A2A` — verde musgo escuro, sofisticado
- Accent dourado: `#C8A96E` — ouro queimado, aparece em detalhes e headlines
- Borda: `rgba(0,0,0,0.07)` — sutilíssima

**Modo Escuro (toggle disponível):**

- Background: `#0D0D0B` — quase preto quente
- Background secundário: `#141412`
- Texto principal: `#F0EDE6` — creme
- Texto secundário: `#5A5855`
- Accent primário: `#3A6B4A` — verde musgo mais claro
- Accent dourado: `#C8A96E` — igual, é o fio condutor entre os modos

### Tipografia

**Display / Headlines grandes:**
Cormorant Garamond — serif italiana, peso 300 e 400, itálico generoso
Usar para: headlines de seção, números grandes, citações
Tamanhos: 64–120px na landing, 32–48px no app

**UI / Corpo:**
DM Sans — peso 300, 400, 500
Usar para: parágrafos, labels de formulário, botões
Tamanhos: 13–16px

**Mono / Labels e dados:**
DM Mono — peso 300, 400
Usar para: eyebrows de seção, metadados, preços, números técnicos, status badges
Tamanhos: 10–13px, sempre uppercase com letter-spacing generoso

**Hierarquia típica de uma seção:**

```
DM MONO UPPERCASE 11PX          ← eyebrow / label de seção
Cormorant Garamond 64px         ← headline principal
DM Sans 15px weight 300         ← subtítulo ou corpo
DM Mono 11px uppercase          ← CTA ou dado técnico
```

### Elementos gráficos

- O `v` de Animov como símbolo — ângulo de câmera, telhado, frame, play button
- Linhas finas `1px` como divisores — nunca blocos pesados
- Cards com `border-radius: 8px` — nem sharp demais, nem arredondado demais
- Sombras suaves e quentes: `box-shadow: 0 8px 40px rgba(0,0,0,0.10)`
- Grain texture muito sutil sobre backgrounds — 3–5% de opacidade

---

## 5. Telas a Gerar no Stitch

---

### TELA 1 — Landing Page / Hero

**Layout:**

- Navbar fixa no topo: logo "Animov" à esquerda (Cormorant Garamond), links centrais (Gallery, Preços), toggle dark/light + botão "Começar grátis" à direita
- Hero ocupa 100vh
- Metade esquerda: headline em Cormorant grande + subtítulo + dois CTAs
- Metade direita (e extravasando): conjunto de cards de fotos de imóveis em perspectiva 3D, dispostos em arco diagonal — como se estivessem sobre uma superfície inclinada, os cards mais próximos maiores, os mais distantes menores — efeito de profundidade real
- Fundo: cor papel `#F5F2EC` com grain textura sutil
- Canto inferior esquerdo: 3 stats em DM Mono — "2.400+ vídeos gerados", "< 5 min por projeto", "R$ 3,95 por vídeo"

**Texto do hero:**

```
Eyebrow (DM Mono, uppercase, dourado):
— ANIMOV · DESDE 2025

Headline (Cormorant Garamond, 80px, weight 300):
Seus imóveis,
em movimento.

Subtítulo (DM Sans, 15px, cinza):
Fotos que você já tem → vídeo cinematográfico
pronto para publicar. Sem editar. Sem agência.

CTA primário: "Criar meu primeiro vídeo"  [botão pill dark]
CTA secundário: "Ver exemplos →"  [texto link]
```

**Os cards de imóveis no arco:**

- 8–12 cards em perspectiva
- Tamanhos variados: os centrais maiores (200×280px), os das extremidades menores (100×140px)
- Cada card mostra uma foto de ambiente diferente: sala, cozinha, quarto, fachada, área externa, banheiro
- Inclinados levemente em ângulos diferentes (rotate entre -8deg e +8deg)
- Disposição em arco suave — como se estivessem em uma estante curvada
- Cards têm sombra suave quente
- Sobre 2–3 cards: badge pequeno em DM Mono mostrando o preset — "DOLLY IN", "ORBIT", "KEN BURNS"

---

### TELA 2 — Landing Page / Como Funciona

**Layout:**

- Seção com padding generoso (120px top/bottom)
- Eyebrow: "— COMO FUNCIONA"
- Headline: "Três passos. Um vídeo." (Cormorant, grande)
- Abaixo: 3 blocos em linha, com muito espaço entre eles — layout assimétrico, não grid uniforme
- Cada bloco tem: número grande em Cormorant itálico dourado (01, 02, 03), título, descrição curta, e uma imagem/mockup do passo

**Conteúdo dos 3 passos:**

```
01 — Sobe as fotos
Arraste as fotos do imóvel. Mínimo 2, máximo 10.
A ordem que você define é a ordem das cenas.
[Mockup: dropzone com 4 fotos em grid]

02 — Escolhe o estilo
Dolly In, Orbit, Ken Burns, Reveal, Float Up.
Cada preset move a câmera de um jeito diferente.
[Mockup: grid de preset cards com GIF preview]

03 — Baixa e publica
Seu vídeo pronto em menos de 5 minutos.
Com seu logo, sua trilha, sua marca.
[Mockup: vídeo player com resultado final]
```

---

### TELA 3 — Landing Page / Showcase de Outputs

**Layout:**

- Fundo escuro `#0D0D0B` (contraste com o resto da landing que é clara)
- Eyebrow claro: "— RESULTADOS REAIS"
- Headline em Cormorant creme: "O que os corretores estão publicando."
- Abaixo: layout scatter de vídeos — não grid, não carrossel
- 6 cards de vídeo em posições irregulares mas harmônicas — como se tivessem sido jogados sobre uma mesa
- Cada card: thumbnail do vídeo + play button central + nome do imóvel em DM Mono + cidade
- Tamanhos variados: alguns retrato (9:16), alguns paisagem (16:9)
- Entre os cards: muito espaço escuro — os vídeos respiram
- Hover em cada card: scale(1.03), sombra aumenta, vídeo começa a rodar (autoplay muted)

---

### TELA 4 — Landing Page / Presets

**Layout:**

- Fundo claro, volta ao tom papel
- Eyebrow: "— MOVIMENTOS DE CÂMERA"
- Headline: "Seis formas de mostrar um espaço."
- Abaixo: linha horizontal de 6 cards de preset
- Cada card (proporção quadrada, ~240×240px):
  - GIF de preview do movimento no centro
  - Nome do preset em DM Mono uppercase na base
  - Descrição de 1 linha em DM Sans pequeno
  - Hover: card escala levemente, borda dourada aparece
- Cards ligeiramente sobrepostos em perspectiva — como um baralho aberto em leque

---

### TELA 5 — Landing Page / Planos

**Layout:**

- Padding generoso
- Eyebrow: "— PLANOS"
- Headline: "Simples assim."
- Toggle: Mensal / Anual (-15%)
- 3 cards de plano em linha (Free, Starter, Pro) + 1 card diferenciado para Team
- Cada card: nome do plano em DM Mono, preço em Cormorant grande, créditos em destaque dourado, lista de features em DM Mono pequeno
- Card Starter com borda dourada sutil e badge "Mais popular"
- Abaixo dos cards: linha "Todos os planos incluem cancel a qualquer momento · Suporte em português · Sem taxa de setup"

**Conteúdo dos cards:**

```
FREE
R$ 0
3 créditos
- 3 vídeos de teste
- Marca d'água Animov
- Presets básicos

STARTER ⭐ mais popular
R$ 79/mês
20 créditos/mês
- Sem marca d'água
- Todos os presets
- Logo personalizado
- Trilha sonora
- Armazenamento 1 ano

PRO
R$ 199/mês
60 créditos/mês
- Tudo do Starter
- Qualidade superior (Kling Pro)
- Formato 9:16 Reels
- Link de compartilhamento
- Suporte prioritário

TEAM
R$ 499/mês
200 créditos/mês
- Até 10 usuários
- Dashboard de equipe
- Créditos compartilhados
- Onboarding dedicado
```

---

### TELA 6 — Editor / Passo 1: Upload

**Layout:**

- App autenticado — sidebar esquerda estreita com: logo Animov, ícones de navegação (dashboard, novo projeto, conta), badge de créditos na base
- Área principal: stepper no topo com 3 passos (Fotos → Estilo → Personalizar) — passo atual destacado
- Centro: dropzone grande, área inteira do conteúdo
- Dropzone: borda tracejada `1px` na cor do accent, ícone simples de upload no centro, texto "Arraste as fotos do imóvel aqui" em DM Sans, subtext "mín. 2 · máx. 10 · JPG, PNG, WEBP" em DM Mono pequeno
- Abaixo da dropzone (após upload): grid de 3 colunas com preview das fotos
- Cada foto no grid: imagem + número da cena "Cena 1" em DM Mono no canto superior esquerdo + botão X para remover no canto superior direito
- Handle de drag visível em cada foto (ícone de 6 pontos) para reordenação
- Base da tela: barra com "4 fotos · 2 créditos restantes" à esquerda + botão "Escolher estilo →" à direita (desabilitado até ter ≥ 2 fotos)

---

### TELA 7 — Editor / Passo 2: Presets

**Layout:**

- Mesmo chrome do app (sidebar + stepper)
- Conteúdo dividido em 3 grupos verticais com muito espaço entre eles

**Grupo 1 — Movimento de Câmera:**
Label: "MOVIMENTO DE CÂMERA" em DM Mono
Grid de 6 cards (3×2 ou 6×1 scroll horizontal):
Cada card: 160×160px · GIF preview · nome em DM Mono · descrição 1 linha · estado selecionado: borda `2px` dourada

**Grupo 2 — Estilo Visual:**
Label: "ESTILO VISUAL"
3 cards maiores lado a lado:
Luxo · Moderno · Natural
Cada um com: amostra de paleta de cores + nome + 1 linha de descrição

**Grupo 3 — Formato:**
Label: "FORMATO DE SAÍDA"
2 opções grandes side by side:
16:9 (ícone de tela wide) + 9:16 (ícone de tela portrait)
Label abaixo: "YouTube · TV" e "Instagram Reels · Stories"

**Base da tela:**
"← Voltar" à esquerda · "Personalizar →" à direita

---

### TELA 8 — Editor / Passo 3: Personalização

**Layout:**

- Área dividida: painel de configuração à esquerda (60%) + preview mockup à direita (40%)

**Painel esquerdo:**
Seções separadas por linha fina `1px`:

```
IDENTIDADE DO IMÓVEL
Campo: Nome do imóvel [placeholder: "Apartamento Vila Madalena"]
Campo: Tagline [placeholder: "3 quartos · 120m² · R$ 850.000"]

LOGO
Dropzone pequena para PNG transparente
Ou: "Usar logo do perfil" com preview do logo salvo
Toggle: Posição — Canto inferior esquerdo / direito

TRILHA SONORA
4 opções em cards horizontais compactos:
[▶] Calm Corporate   [▶] Modern Luxury   [▶] Upbeat   [▶] Natural Warm
+ opção "Sem trilha"
Slider de volume aparece ao selecionar uma trilha

RESUMO
1 crédito · 4 cenas · Tour 30s · Dolly In · Luxo · 16:9
"Você tem 12 créditos restantes"
```

**Preview à direita:**
Mockup estático de tela 16:9 (ou 9:16 se selecionado) mostrando:

- Imagem de fundo (primeira foto do upload)
- Overlay de texto no canto inferior esquerdo (título + tagline)
- Logo na posição selecionada
- Badge "Preview aproximado — o vídeo final terá movimento"
Atualiza em tempo real conforme usuário digita

**Base da tela:**
"← Voltar" à esquerda · Botão grande "Gerar Vídeo — 1 crédito" à direita

---

### TELA 9 — Geração em Progresso

**Layout:**

- Modal centralizado sobre o editor (fundo com blur)
- Proporção: ~480px largura
- Topo: nome do projeto "Apartamento Vila Madalena"
- Centro: lista de steps com status em tempo real

```
✓  Preparando fotos
◉  Gerando cena 1 de 4 ...........  [barra de progresso fina]
○  Gerando cena 2 de 4
○  Gerando cena 3 de 4
○  Gerando cena 4 de 4
○  Montando vídeo final
○  Pronto
```

- Ícones: ✓ verde para concluído · ◉ animado para em progresso · ○ cinza para aguardando
- Barra de progresso: linha fina dourada que avança
- Abaixo dos steps: "Tempo estimado: ~3 minutos"
- Texto menor em DM Mono cinza: "Pode fechar esta aba. Você receberá um email quando ficar pronto."
- Link: "Ver meus projetos"

---

### TELA 10 — Dashboard

**Layout:**

- Sidebar esquerda: logo, navegação, badge de créditos
- Header do conteúdo: "Bom dia, João." em Cormorant + botão "Novo vídeo" à direita
- Se créditos ≤ 2: banner sutil abaixo do header — linha fina dourada à esquerda, texto "Você tem 2 créditos. Receba 20/mês no plano Starter." + link "Ver planos"
- Grid de projetos: 3 colunas, cards com proporção 16:9

**Cada ProjectCard:**

- Thumbnail do vídeo (ocupa 70% do card)
- Barra de progresso dourada sobre a thumbnail se status = gerando
- Base do card: nome do projeto + data em DM Mono + status badge
- Status badges: "Pronto" (verde suave) · "Gerando..." (âmbar animado) · "Erro" (vermelho suave)
- Hover: aparecem 3 ícones: Download · Compartilhar · Mais opções (···)
- Card de canto especial: sempre o primeiro da grid, fundo tracejado, ícone + no centro, texto "Novo vídeo"

---

### TELA 11 — Resultado / Projeto Concluído

**Layout:**

- Tela cheia do app
- Esquerda (55%): player de vídeo grande com controls customizados
  - Play/pause central grande
  - Barra de progresso fina dourada
  - Tempo em DM Mono
  - Ícone de som
  - Fullscreen
- Direita (45%): painel de informações e ações

**Painel direito:**

```
APARTAMENTO VILA MADALENA
Gerado em 3 min 42 seg · 4 cenas · 30s

[Botão principal] ↓ Baixar MP4

[Botão secundário] Compartilhar link público

──────────────────────────────

DETALHES
Preset: Dolly In · Luxo · 16:9
Criado em: 12 de abril, 2025
Expira em: 12 de abril, 2026

──────────────────────────────

Duplicar projeto →
```

---

## 6. Microinterações e Motion Design

Descrever para o Stitch o comportamento esperado de animações:

**Scroll da landing:**

- Cards do hero se reorganizam ao fazer scroll — o arco vai virando grid
- Cada seção entra com fade + translateY(20px) → translateY(0) ao entrar no viewport
- Parallax sutil nos cards: camadas mais próximas se movem mais rápido

**Mouse hover nos cards de preset:**

- GIF começa a rodar ao hover
- Card sobe 4px (translateY(-4px))
- Sombra aumenta
- Borda dourada aparece com fade

**Botão de geração:**

- Ao clicar: ripple effect sutil
- Transição para modal de progresso: fade + scale(0.98) no fundo

**Toggle dark/light:**

- Transição suave 400ms em background e cores
- O grain texture permanece em ambos os modos

**Cards de projeto no dashboard:**

- Entrada em stagger: cada card entra 60ms depois do anterior
- Hover: ícones de ação aparecem com fade-in 150ms

---

## 7. Instruções Específicas para o Stitch

**Pedir ao Stitch:**

1. Criar conceito visual completo para as 11 telas descritas acima
2. Manter consistência absoluta de tipografia, cor e espaçamento entre todas as telas
3. Priorizar versão desktop (1440px) mas mostrar como as telas principais adaptam para mobile (390px)
4. Usar modo claro como padrão — mostrar toggle de dark mode apenas na navbar
5. Os vídeos/fotos de imóveis nas telas podem ser placeholders de alta qualidade — ambientes residenciais modernos, fotografia profissional, luz natural
6. O logo Animov deve aparecer em Cormorant Garamond com o `v` final em dourado `#C8A96E`
7. Não usar sombras pesadas, não usar gradientes coloridos, não usar ilustrações — só fotografia real e tipografia
8. A UI do editor deve parecer mais leve e menos chamativa que a landing — o editor some, o conteúdo do usuário aparece

**O que evitar absolutamente:**

- Purple gradients, neon, glassmorphism excessivo
- Ícones com muita personalidade (usar ícones simples, linha fina — Lucide ou similar)
- Fontes genéricas (Inter, Roboto, system fonts)
- Layouts simétricos e previsíveis
- Cards com bordas arredondadas exageradas (> 12px)
- Animações que chamam mais atenção que o conteúdo

---

## 8. Referências Visuais para Anexar ao Stitch

Buscar e anexar referências das seguintes categorias:

- **Layout com cards em perspectiva/arco:** site Motion (photographer portfolio), Awwwards galleries
- **UI minimalista premium:** Linear.app, Vercel dashboard, Resend.com
- **Tipografia editorial:** Wallpaper* magazine digital, Kinfolk website
- **Dark/light toggle bem executado:** Raycast.com, Arc browser site
- **Cards de vídeo em scatter layout:** Behance, são Paulo Art Biennial sites

---

*Animov.ai — Briefing Visual v1.0*
*Para uso no Google Stitch — Geração de conceito UX/UI*