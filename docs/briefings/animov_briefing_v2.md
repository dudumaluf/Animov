# Animov.ai — Briefing Técnico & Criativo v2

> Documento-mãe pro Cursor. Ler junto com o briefing original do ImoVid v1 (schema Supabase, regras FAL_KEY server-side, créditos, planos). Este aqui sobrescreve o ImoVid onde houver conflito.

---

## 0. Regras de ouro (Cursor, leia antes de qualquer coisa)

1. **Um step por vez.** Sempre parar num gate de aprovação antes de avançar.
2. **Não inventar.** Libs, arquivos, nomes de funções, rotas, colunas — nada sem confirmar.
3. **Pergunta quando tiver dúvida.** Melhor travar e perguntar do que assumir.
4. **Commits pequenos e descritivos.** Um commit = uma unidade lógica.
5. **Manter `PROGRESS.md` vivo.** Atualizar a cada step concluído (o que foi feito, o que falta, blockers).
6. **Antes de integrar qualquer modelo do fal.ai: LER A DOC OFICIAL DO MODELO.** Gate obrigatório por adapter.
7. **Liberdade condicional.** Cursor pode propor features/libs/padrões óbvios pra SaaS funcionar — **propor primeiro, implementar depois da aprovação**. Foco do Dudu é UX/UI/criativo, não micro-especificação.

---

## 1. Visão do Produto

**Animov.ai** é um SaaS que transforma fotos de imóveis em vídeos cinematográficos curtos usando IA generativa de vídeo. A diferença posicional: não é uma ferramenta utilitária com cara de dashboard corporativo. É uma **ferramenta com alma artística**, linguagem visual de sala de edição, tipografia editorial, preto absoluto, vídeo em evidência. Corretor/construtora entra e sente que tá num estúdio, não num gerador de conteúdo.

Público-alvo: corretores, imobiliárias, construtoras, fotógrafos de imóveis, social media do mercado imobiliário BR.

Proposta de valor core:

- Upload de fotos → escolha de preset cinematográfico → vídeo pronto em minutos.
- Transições entre fotos geradas automaticamente com start/end frame conditioning.
- Custo real por vídeo transparente antes de gerar.
- Multi-model (Kling, Seedance, Wan, LTX) — o usuário escolhe qualidade vs. custo.

---

## 2. Stack

- **Framework:** Next.js 14 App Router, TypeScript strict
- **UI:** Tailwind, shadcn/ui, Radix primitives
- **3D/Landing:** React Three Fiber + drei + three
- **Estado:** zustand (client), React Server Components onde fizer sentido
- **Drag & drop:** dnd-kit
- **Forms:** react-hook-form + zod
- **Backend:** Supabase (Auth, Postgres, Storage, Edge Functions, Vault)
- **LLM:** OpenRouter (Vision models pra leitura de foto + geração de prompt)
- **Video gen:** fal.ai (Kling 2.5/3.0, Seedance 2.0, Wan, LTX)
- **Composição client-side:** WebCodecs + mp4-muxer, fallback MediaRecorder, FFmpeg.wasm pra extração de frames
- **Infra:** Vercel (hosting), GitHub (repo), Supabase Cloud
- **Persistência de edição:** localStorage/IndexedDB até "Gerar"

---

## 3. Schema do Banco (Supabase Postgres)

Base vem do ImoVid v1. Ajustes:

- `users` — id (uuid, auth), email, role ('user'|'admin'), created_at
- `credits` — user_id (fk), balance (int), updated_at
- `credit_transactions` — id, user_id, delta, reason, admin_id (nullable), created_at
- `projects` — id, user_id, name, status ('draft'|'generating'|'ready'|'failed'), model_id, created_at, updated_at
- `scenes` — id, project_id, order_index, photo_url, preset_id, prompt_generated, video_url, duration, status, cost_credits
- `transitions` — id, project_id, from_scene_id, to_scene_id, order_index, video_url, status, cost_credits
- `final_renders` — id, project_id, composed_video_url, total_cost, shared_slug (nullable), created_at
- `presets` — id, name, description, camera_hint, llm_system_prompt, featured (bool)
- `models` — id, provider, model_key, display_name, cost_per_second, supports_start_end_frame (bool), active (bool)
- `generation_logs` — id, user_id, project_id, model_id, request_payload, response_payload, cost, created_at
- `system_settings` — key, value (jsonb) — pra default_model, etc.

RLS: usuário só vê seus projetos. Admin (email `ddmaluf@gmail.com` seed) vê tudo via policy baseada em `users.role = 'admin'`.

---

## 4. BYOK seguro pro fal.ai

- `FAL_KEY` **nunca** toca o client. Vive no Supabase Vault (ou env da Edge Function).
- Toda chamada fal.ai → Edge Function autenticada (JWT do usuário) → valida créditos → chama fal.ai → debita créditos → retorna resultado.
- UI admin: mostra só `Key configurada ✓ / ✗` + botão "Substituir" (write-only, nunca exibe a key).
- Zero surface no client: nada de `NEXT_PUBLIC_FAL`_*.

---

## 5. Landing (One-pager R3F)

Inspirações: Codrops Cinematic 3D Scroll, Codrops Horizontal Parallax, Fojcik Kinetic Images (Tower/Paper/Spiral), Delphi, tipografia serif editorial.

**Direção:** preto absoluto (#000), tipografia serif grande (Instrument Serif ou similar), vídeo em evidência, zero ruído visual.

**Estrutura:**

1. **Hero** — título serif enorme ("Seu imóvel em movimento" ou similar), vídeo de fundo sutil, CTA minimalista.
2. **Preset Showcase (R3F scroll-driven)** — cards de vídeo que se reorganizam conforme scroll:
  - Grid em perspectiva → cilindro (rolo de filme) → espiral → plano.
  - Cada layout sincronizado com título em parallax representando um **preset real da tool** (ex: "Tour Sereno", "Reveal Dramático", "Golden Hour Walk").
3. **Como funciona** — 3 momentos tipográficos (foto → preset → vídeo).
4. **Pricing** — simples, baseado em créditos.
5. **Footer** — minimalista.

Performance: lazy load de vídeos, poster frames estáticos, `prefers-reduced-motion` respeitado, fallback sem R3F pra mobile fraco.

---

## 6. Editor (Film Strip)

**Zero wizard.** Vibe de mesa de edição.

- **Layout:** fundo preto, tipografia serif grande no topo (nome do projeto editável inline), film strip horizontal ocupando o centro.
- **Cards de Cena:** thumbnail da foto, preset escolhido, duração, custo em créditos. Hover mostra preview do vídeo se já gerado.
- **Cards de Transição:** visualmente distintos (mais estreitos, ícone de morph, cor de acento), intercalados automaticamente entre cenas. No V1 são **automáticas** (não editáveis além de ligar/desligar).
- **Drag & drop** (dnd-kit) pra reordenar cenas. Transições recalculam sozinhas.
- **Sidebar direita:** seleção de modelo (Kling 2.5, Seedance 2.0, Wan, LTX), preset global, duração por cena. Custo total atualiza em tempo real conforme escolhas.
- **Botão Gerar:** destaque, mostra custo total, valida créditos, dispara pipeline.
- **Timeline inferior:** preview do render final quando pronto, scrub, aprovar, exportar, compartilhar.

Persistência: tudo em localStorage/IndexedDB até clicar Gerar. No Gerar, sobe projeto completo pro Supabase.

---

## 7. Pipeline de Geração

```
[Foto + Preset]
      ↓
[Vision LLM via OpenRouter]
  → lê a foto, aplica system prompt do preset
  → retorna prompt específico de câmera/movimento/mood
      ↓
[VideoModelAdapter.generate(prompt, photo, opts)]
  → adapter do modelo escolhido (Kling/Seedance/Wan/LTX)
  → chama fal.ai via Edge Function
  → retorna video clip URL
      ↓
[Transições] (se ativadas)
  → adapter com start_frame = último frame cena N
  → adapter com end_frame = primeiro frame cena N+1
  → gera clipe de transição
      ↓
[Composição client-side]
  → baixa clipes
  → WebCodecs + mp4-muxer concatena
  → MediaRecorder como fallback
  → FFmpeg.wasm pra extração de frames quando necessário
      ↓
[Upload do render final → Supabase Storage]
      ↓
[Registro em final_renders]
```

---

## 8. Camada de Abstração — VideoModelAdapter

```ts
interface VideoModelAdapter {
  id: string;
  displayName: string;
  supportsStartEndFrame: boolean;
  estimateCost(opts: GenOpts): number; // em créditos
  generateScene(input: SceneInput): Promise<ClipResult>;
  generateTransition?(input: TransitionInput): Promise<ClipResult>;
}
```

Um arquivo por adapter em `lib/adapters/`. **Gate obrigatório:** antes de implementar qualquer adapter, Cursor **deve ler a doc oficial do modelo no fal.ai** e colar o link + resumo dos params no PR/commit. Sem isso, não merge.

Adapters V1: `kling-25.ts`, `kling-30.ts`, `seedance-20.ts`, `wan.ts`, `ltx.ts`. Registrados num `modelRegistry.ts`.

---

## 9. Admin

Seed: `ddmaluf@gmail.com` → role `admin` hardcoded na migration inicial.

Painel `/admin`:

- **Usuários:** lista, busca, ver detalhes, promover/despromover admin.
- **Créditos:** conceder/remover manualmente, com motivo obrigatório → grava em `credit_transactions`.
- **Gerações:** histórico por user, filtros por modelo/status/período, custo acumulado.
- **Projetos:** ver, editar, deletar projetos/vídeos de qualquer user.
- **Configurações:** trocar FAL_KEY (write-only), trocar modelo default, ativar/desativar modelos.
- **Métricas:** uso diário, custo total fal.ai vs créditos consumidos, top users, conversão.

---

## 10. User Flows

1. **Onboard:** landing → cadastro (email ou Google) → dashboard vazio → "Criar primeiro projeto".
2. **Criar projeto:** nome → upload de fotos (drag-drop múltiplo) → editor abre com cenas pré-populadas.
3. **Editar:** reordenar, escolher preset global ou por cena, escolher modelo, ver custo.
4. **Gerar:** confirma custo → debita créditos → pipeline roda → notificação quando pronto.
5. **Revisar:** preview clipe a clipe, regerar cena individual se quiser (custo extra), aprovar render final.
6. **Exportar/Compartilhar:** download MP4 ou link público (`/v/[slug]`).
7. **Histórico:** dashboard lista todos os projetos, status, thumbnail.

---

## 11. Plano por Fases (com gates)

### Fase 1 — Fundação (gate: Dudu aprova antes de Fase 2)

1.1. Repo + Next.js + Tailwind + shadcn + TS strict
1.2. Supabase project + schema inicial + RLS + seed admin
1.3. Auth (email + Google) + layout base
1.4. PROGRESS.md inicializado
**Gate.**

### Fase 2 — Landing

2.1. Estrutura one-pager + tipografia serif + preto absoluto
2.2. R3F scene com cards de vídeo (mock assets)
2.3. Scroll-driven layouts (grid → cilindro → espiral)
2.4. Parallax de títulos sincronizado com presets
2.5. Responsivo + fallback mobile
**Gate.**

### Fase 3 — Editor Shell

3.1. Rota `/editor/[projectId]`, layout film strip
3.2. Upload de fotos + persistência local
3.3. Drag-drop de cenas (dnd-kit)
3.4. Cards de transição automáticos
3.5. Sidebar de modelo/preset/duração + custo em tempo real
**Gate.**

### Fase 4 — Pipeline

4.1. Edge Function `generate-scene` com auth + validação de créditos
4.2. OpenRouter Vision integration + presets no banco
4.3. VideoModelAdapter interface + registry
4.4. Adapter Kling 2.5 (gate: ler doc fal.ai)
4.5. Adapter Seedance 2.0 (gate: ler doc fal.ai)
4.6. Adapters Wan, LTX, Kling 3.0 (cada um com gate)
4.7. Geração de transições com start/end frame
4.8. Composição client-side WebCodecs + fallbacks
4.9. Upload final + registro em `final_renders`
**Gate.**

### Fase 5 — Admin

5.1. Rota `/admin` com guard
5.2. CRUD de usuários + créditos manuais
5.3. Visualização de gerações + projetos
5.4. Troca de FAL_KEY write-only
5.5. Métricas básicas
**Gate.**

### Fase 6 — Polish V1

6.1. Compartilhamento público `/v/[slug]`
6.2. Histórico de projetos no dashboard
6.3. Regeneração de cena individual
6.4. Empty states, loading states, error states
6.5. QA completo
**Launch V1.**

### Fase 7 — V2: Pagamento

Webhook Pagar.me/Stripe/Asaas (definir) → credita automaticamente. Planos recorrentes opcionais.

### Fase 8 — V3: Growth

Templates públicos, remix de projetos de outros users, marca d'água white-label, API pública, integrações (Instagram, WhatsApp Business).

---

## 12. Tracking de Progresso

`PROGRESS.md` na raiz do repo, atualizado a cada step:

```md
# Animov.ai — Progresso

## Fase atual: 2 — Landing

### Concluído
- [x] 1.1 Repo + Next.js setup
- [x] 1.2 Supabase schema
...

### Em andamento
- [ ] 2.2 R3F scene com cards

### Blockers
- Nenhum

### Notas/decisões
- Escolhido Instrument Serif como fonte principal (aprovado 10/04)
```

---

## 13. Referências Visuais

14 screenshots enviados anteriormente:

- Codrops Cinematic 3D Scroll
- Codrops Horizontal Parallax
- Fojcik Tower / Paper / Spiral (kinetic images)
- Delphi (dark editorial)
- 3 slides tipográficos serif

Usar como norte estético, não copiar pixel-perfect.

---

## 14. Fora do escopo V1 (não implementar ainda)

- Pagamento automático
- Edição manual de transições (curva, duração custom)
- Áudio/trilha
- Templates públicos
- White-label
- API pública
- Mobile app nativo

---

**Fim do briefing. Cursor: confirma que leu tudo, faz perguntas se tiver, e começa pela Fase 1.1 aguardando gate.**