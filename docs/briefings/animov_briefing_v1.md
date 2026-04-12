# ImoVid — AI Video Generator para Corretores Imobiliários

## Briefing Técnico Completo v1.0

---

## VISÃO GERAL

Webapp SaaS para corretores de imóveis criarem vídeos cinematográficos
de imóveis usando IA generativa. O usuário faz upload de fotos dos 
ambientes, escolhe um preset de movimento/estilo, e recebe um vídeo 
editado com transições, overlays de texto, logo e trilha sonora.

Stack: Next.js 14 (App Router) + Supabase + fal.ai + Pagar.me

---

## ARQUITETURA GERAL

Frontend:     Next.js 14 (App Router, TypeScript, Tailwind, shadcn/ui)
Backend:      Next.js API Routes + Supabase Edge Functions
Database:     Supabase (Postgres)
Auth:         Supabase Auth (email + Google OAuth)
Storage:      Supabase Storage (uploads + outputs)
AI Engine:    fal.ai API (Kling 2.1 com first/last frame)
Payments:     Pagar.me (subscription + top-up avulso + Pix)
Video Edit:   FFmpeg.wasm (client-side: concat + overlay + audio)

---

## ESTRUTURA DE PÁGINAS

/ (Landing Page)

- Hero com vídeo demo
- Seção "Como funciona" (3 passos)
- Showcase de vídeos gerados
- Planos e preços
- CTA: "Começar grátis"

/auth → Login / Cadastro (Supabase Auth)

/dashboard

- Créditos disponíveis
- Projetos recentes
- Botão "Novo Projeto"

/projeto/novo → EDITOR PRINCIPAL (ver abaixo)

/projeto/[id] → Visualizar / baixar resultado

/conta → Gerenciar plano, histórico, top-up

/admin (rota protegida) → Gestão de usuários e uso

---

## EDITOR PRINCIPAL — FLUXO UX (3 passos)

### PASSO 1 — Upload de Fotos

- Dropzone com múltiplas imagens (mín. 2, máx. 10)
- Preview em grid reorganizável (drag to reorder)
- Cada imagem = 1 ambiente / cena do vídeo final
- Formatos: JPG, PNG, WEBP — mín. 1080x720px
- Upload vai para Supabase Storage

### PASSO 2 — Escolher Preset

Grid visual de presets (cards com preview em GIF/vídeo curto):

PRESETS DE MOVIMENTO (via fal.ai Kling first/last frame):

- "Dolly In" — câmera avança suavemente para dentro do ambiente
- "Orbit" — câmera gira levemente ao redor do ponto focal
- "Ken Burns" — zoom lento + pan lateral (clássico imobiliário)
- "Reveal" — câmera "descobre" o ambiente de trás pra frente
- "Float Up" — câmera sobe suavemente (efeito drone leve)
- "Cinematic Pan" — pan horizontal com motion blur leve

PRESETS DE ESTILO VISUAL:

- "Luxo" — cores quentes, luz dourada, fade entre cenas
- "Moderno" — corte seco, preto e branco nas transições
- "Natural" — tons frios, transição suave, luz natural

PRESETS DE DURAÇÃO:

- "Story" — 15s total (para Instagram Stories / Reels)
- "Tour" — 30s total
- "Completo" — 60s total

### PASSO 3 — Personalização

- Nome do imóvel / empreendimento (overlay de texto)
- Tagline (ex: "3 quartos • 120m² • Vila Madalena")
- Upload de logo do corretor ou imobiliária (PNG transparente)
- Posição do logo: canto inferior direito / esquerdo
- Escolha de trilha sonora:
  - "Calm Corporate" (piano + strings)
  - "Modern Luxury" (eletrônico suave)
  - "Upbeat" (positivo, alegre)
  - Sem trilha
- Volume da trilha: slider 0–100%

→ Botão "GERAR VÍDEO" (consome 1 crédito — confirmação antes)

---

## PIPELINE TÉCNICO DE GERAÇÃO

### Etapa 1 — Geração de clipes por imagem (fal.ai)

Para cada foto uploaded:

- Chamar fal.ai com modelo: fal-ai/kling-video/v2.1/standard/image-to-video
- Parâmetros baseados no preset escolhido:
  - prompt: gerado dinamicamente pelo preset
  - image_url: URL do Supabase Storage
  - duration: "5" (5s por clipe)
  - aspect_ratio: "16:9"
- Armazenar URL do clipe gerado no Supabase

Exemplos de prompts por preset:

- Dolly In: "smooth cinematic dolly in camera movement, 
real estate photography style, luxury interior, 
no people, architectural photography"
- Orbit: "slow orbit camera movement around the room, 
cinematic, real estate tour, warm lighting"
- Ken Burns: "subtle ken burns effect, slow zoom with 
gentle pan, real estate, professional photography"

### Etapa 2 — Composição final (FFmpeg.wasm no client ou

```
        Supabase Edge Function com ffmpeg)
```

Concatenar todos os clipes gerados na ordem das fotos:

- Aplicar transições entre clipes (crossfade 0.5s)
- Overlay de texto (nome + tagline) — fade in aos 1s, 
fade out nos últimos 2s
- Overlay de logo PNG no canto (opacity 80%)
- Mix de trilha sonora (fade in/out automático)
- Output: MP4 H.264, resolução 1920x1080 ou 1080x1920 
(landscape ou portrait/reels)

### Etapa 3 — Entrega

- Upload do MP4 final para Supabase Storage
- Link de download direto
- Preview no browser
- Compartilhamento: link público temporário (7 dias)

---

## SISTEMA DE CRÉDITOS

### Tabela Supabase: users

- id, email, name, plan (free/starter/pro), 
credits_balance, created_at

### Tabela: credit_transactions

- id, user_id, type (consumption/purchase/bonus),
amount, description, created_at

### Tabela: projects

- id, user_id, status, preset, photos_urls[], 
clips_urls[], final_video_url, credits_used, created_at

### Lógica:

- Ao clicar "Gerar Vídeo": verificar saldo → debitar 1 crédito 
→ iniciar pipeline → em caso de erro técnico: reembolso automático

---

## SISTEMA DE PAGAMENTO (Pagar.me)

### Subscription mensal:

- Criar plano no Pagar.me dashboard
- Webhook no /api/webhooks/pagarme:
  - subscription.paid → add créditos mensais
  - subscription.canceled → downgrade para free
  - subscription.unpaid → notificar + bloquear

### Top-up avulso:

- Checkout único (Pix ou cartão)
- Webhook payment.paid → add créditos na conta

### Créditos mensais são creditados:

- No primeiro acesso após pagamento confirmado
- Ou na data de renovação da subscription

---

## COMPONENTES UI PRINCIPAIS

### CreditBadge

- Exibido no header: "12 créditos"
- Clicável → modal de top-up

### PresetCard

- Thumbnail com preview (GIF animado mostrando o efeito)
- Nome do preset + descrição curta
- Badge de duração
- Estado: selected / unselected

### ProjectCard (no dashboard)

- Thumbnail do vídeo gerado
- Status: processando / pronto / erro
- Data de criação
- Botão: Baixar / Ver / Duplicar

### GenerationProgress

- Modal ou sidebar com steps:
  1. Enviando imagens... ✓
  2. Gerando clipe 1/4... (loading)
  3. Editando vídeo final...
  4. Pronto! ✓
- Estimativa de tempo: ~2–4 min por projeto

---

## VARIÁVEIS DE AMBIENTE NECESSÁRIAS

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FAL_KEY=                          # fal.ai API key (SERVER ONLY)
PAGARME_API_KEY=
PAGARME_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=

---

## REGRAS DE NEGÓCIO IMPORTANTES

1. FAL_KEY nunca exposta no client — todas chamadas ao fal.ai
  passam por /api/generate (server-side)
2. Crédito só é debitado APÓS confirmação do usuário
3. Erro técnico no fal.ai → reembolso automático
4. Usuário free: máx 3 projetos no histórico
5. Vídeos de usuários free têm watermark "ImoVid" no canto
6. Projetos ficam no storage por 30 dias (free) ou 1 ano (pago)
7. Rate limit: máx 3 gerações simultâneas por usuário

---

## PRIORIDADE DE DESENVOLVIMENTO

### MVP (Phase 1):

- Auth (Supabase)
- Upload de fotos
- 3 presets básicos (Dolly In, Ken Burns, Orbit)
- Geração via fal.ai (sem composição ainda)
- Download dos clipes individuais
- Sistema de créditos (manual via admin)

### Phase 2:

- FFmpeg composição (concat + trilha)
- Overlays de texto e logo
- Pagar.me integração
- Landing page completa
- Dashboard completo

### Phase 3:

- Mais presets
- Modo portrait (Reels)
- Compartilhamento público
- Analytics de uso
- App mobile (PWA)

---

## REFERÊNCIAS DE INSPIRAÇÃO UI

- Runway ML (simplicidade do editor)
- Canva (preset cards visuais)
- Descript (progress de geração)
- Tone: profissional mas acessível para corretores não-técnicos

