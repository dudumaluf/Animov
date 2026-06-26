# 🗺️ Animov.ai — Próximos Passos (guia do dono)

> **Respira.** Tá tudo sob controle. Você fez MUITA coisa e o que falta é menos do que parece.
> Este arquivo é o seu mapa: siga as fases **de cima pra baixo**, marque os `- [ ]` conforme avança.
> Não precisa decorar nada — é só seguir.
>
> _Última verificação contra o repositório real: 22/06/2026._

---

## 1. 📍 Onde você está agora

Legenda: ✅ no ar / feito · 🟡 em andamento · ⛔ não feito

- ✅ **Hotfixes de produção** (editor + dashboard) — no `main`, deploy READY.
- ✅ **Reference Studio** — no `main`, deploy READY.
- ✅ **Billing (Stripe) — validado no TESTE e JÁ NO AR em produção (modo teste).** Pacote **e** assinatura testados de ponta a ponta (assinatura Starter creditou +20cr, linha em `subscriptions`, Customer Portal OK). Código commitado (`c4036ca`), deploy READY, e a produção já tem as envs do Stripe (teste) + um webhook de teste registrado (`we_1TlJbS…`). **Falta:** validar uma compra no site real → depois **virar a chave TEST→LIVE** (FASE 2-B).
- ✅ **Fila global de geração (Fal) — JÁ NO AR em produção.** Código commitado, `CRON_SECRET` setado, plano **Vercel Pro confirmado**, cron por minuto ativo. **Falta só:** validar disparando >2 gerações (FASE 3.1).

> **👇 VOCÊ ESTÁ AQUI.** Já passamos FASE 0 ✅, FASE 1 ✅ e o deploy da FASE 2-A ✅. Próxima parada: **uma compra de teste em produção** (`animov.vercel.app/conta`, cartão `4242…`). Depois: virar o LIVE (FASE 2-B) e validar a fila (FASE 3).

---

## 2. 👉 COMECE AQUI (a sua única próxima ação)

**Entre em https://animov.vercel.app → login → /conta → faça uma compra de teste com o cartão `4242 4242 4242 4242`** (validade futura qualquer, CVC qualquer).

A produção está **em modo TESTE do Stripe** agora — então **cartão real é recusado, só o de teste funciona**. É de propósito: validar o fluxo no site real antes de cobrar de verdade.

**Deu certo quando:** o crédito cai (ou a assinatura aparece em /conta). Aí billing está validado em produção e seguimos pra **virar o LIVE (FASE 2-B)** e **validar a fila (FASE 3)**.

⏱️ **Mantenha essa janela curta** — enquanto prod está em modo teste, ninguém paga de verdade.

> _(FASE 0 e FASE 1 abaixo já estão concluídas — ficam aqui como registro.)_

---

## 3. ✅ FASE 0 — Confirmar que a produção está estável  ·  ✅ CONCLUÍDA

> ✅ **Feito.** Você confirmou: dashboard sem os erros `#425/#418/#423` e projetos abrindo sem o crash de `height`. Hotfixes `ecad164` e `f076d1d` validados em produção. _(Passos abaixo ficam como registro.)_

Só conferência. Nada pra programar aqui.

- [ ] Abrir https://animov.vercel.app e dar **Cmd + Shift + R** (hard refresh) no dashboard.
- [ ] Abrir o **Console do navegador** (F12 → aba Console). **Não pode ter** os erros `#425`, `#418` ou `#423` (hidratação).
- [ ] Entrar em **um projeto existente** (inclusive em modo "Revisão"). **Não pode** crashar com `Cannot read properties of undefined (reading 'height')`.

**Deu certo quando:** dashboard abre sem erro no console e você consegue entrar nos projetos sem tela branca/crash.
✅ Se passou, os hotfixes `ecad164` e `f076d1d` estão confirmados em produção. Pode seguir tranquilo.

---

## 4. ✅ FASE 1 — Testar Billing (Stripe) no modo TESTE  ·  ✅ CONCLUÍDA

> ✅ **Feito.** Assinatura Starter testada de ponta a ponta: `invoice.paid` creditou **+20cr** (saldo foi pra 31), linha criada em `subscriptions` (status `active`), e o **Customer Portal** abriu. Idempotência confirmada (3 eventos de pagamento, 1 crédito só). _(Passos abaixo ficam como registro.)_

Objetivo: validar **a compra de ASSINATURA** (o pacote avulso você já testou e funcionou).
Tudo isso roda **localmente** (`localhost:3000`) com chaves de **TESTE** — não mexe em produção.

### 4.1 Preparar o ambiente local
- [ ] No terminal, dentro de `animov/`, subir o app:
```bash
pnpm dev
```
- [ ] **Em outro terminal**, ligar o encaminhamento de webhooks do Stripe:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
- [ ] Copiar o `whsec_...` que esse comando imprime e colar no `.env.local` na variável `STRIPE_WEBHOOK_SECRET`.
- [ ] **Reiniciar** o `pnpm dev` (pra ele ler o novo `whsec`).
- [ ] (Só se precisar recriar o catálogo — já está populado, o comando é seguro e idempotente:)
```bash
node --env-file=.env.local scripts/setup-stripe-catalog.mjs
```

### 4.2 Fazer a compra de assinatura de teste
- [ ] Entrar no app logado, ir em **/conta** e clicar pra assinar um plano (ex.: **Starter**).
- [ ] Pagar com o **cartão de teste**: `4242 4242 4242 4242`, validade futura qualquer, CVC qualquer.

### 4.3 Conferir que funcionou (os 3 sinais)
- [ ] **Créditos entraram** via `invoice.paid` (saldo subiu o valor do plano — Starter = +20).
- [ ] **Apareceu uma linha** na tabela `subscriptions` (Supabase → Table editor → `subscriptions`).
- [ ] **Customer Portal abre** (botão "Gerenciar assinatura" em /conta) e dá pra ver/cancelar a assinatura.

**Deu certo quando:** os 3 itens acima bateram. Aí a assinatura está validada de ponta a ponta no modo teste.

> ⚠️ **Importante:** esse código de billing **ainda não está no GitHub/Vercel** (é WIP no seu PC). Ele **só vai funcionar em produção depois da FASE 2** (commit + envs + LIVE).
> ℹ️ Seu `.env.local`, `localhost` e produção usam **o MESMO banco Supabase**. Então os testes caem no banco real — é normal (o teste do pacote já caiu lá), só fique ciente.

---

## 5. 🟡 FASE 2 — Subir o Billing pra produção + virar a chave LIVE

> ✅ **(A) subir código + envs + webhook de teste: FEITO.** WIP commitado (`c4036ca`) e no ar; deploy READY. As 5 envs do Stripe/cron foram setadas na Vercel (modo **teste**), e um webhook **de teste** (`we_1TlJbS…`) foi registrado apontando pra `https://animov.vercel.app/api/webhooks/stripe`. Smoke-tests passaram (webhook 400, cron 401, /conta 200).
> 🟡 **Falta a (B): virar TEST→LIVE** (criar preços live, webhook live, trocar as chaves pra `*_live_`, atualizar os price IDs do catálogo). É o passo que mexe com dinheiro de verdade — faça quando decidir lançar.

Aqui tem duas coisas: (A) **subir o código** e (B) **trocar de TESTE pra LIVE** no Stripe. Faça na ordem.

### 5.1 (A) Subir o código de billing
- [ ] Commitar e dar push dos arquivos de billing. O push no `main` **dispara o deploy automático na Vercel**.
```bash
# dentro de animov/
git add -A
git commit -m "feat(billing): Stripe checkout, portal, webhook e catálogo"
git push origin main
```
> 💡 O `git status` mostra **vários arquivos** além de billing (admin/settings, fal-balance, ajustes do editor, novos adapters, e os arquivos da fila). É tudo WIP da mesma leva — eles vão subir juntos. **Não precisa escolher arquivo a arquivo**; só saiba que o commit é maior que "só billing".
> 👉 Se quiser separar billing da fila em commits diferentes, dá — mas o caminho mais simples e seguro é subir tudo de uma vez (a fila é a FASE 3).

- [ ] **Migration `00026_billing` no Supabase de produção:** ✅ **JÁ APLICADA** (confirmado: as tabelas `subscriptions`, `stripe_events`, `billing_catalog` e a coluna `users.stripe_customer_id` já existem, e `free_credits = 0` já está setado). **Nada a fazer aqui** — só conferir no Supabase se quiser ter certeza.

### 5.2 (B) Setar as variáveis do Stripe na Vercel
Vercel → projeto **animov** → **Settings → Environment Variables** (escopo **Production**). **Nunca cole segredo aqui neste arquivo.**
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET` (o do endpoint registrado em produção — ver 5.3)
- [ ] `NEXT_PUBLIC_APP_URL = https://animov.vercel.app`
- [ ] `FOUNDER_NOTIFY_WEBHOOK` (opcional — te avisa a cada compra)
> ⚠️ Variável nova **só vale em deploy novo**. Depois de setar, **faça um redeploy**.

### 5.3 (B) Trocar TESTE → LIVE no Stripe (o pulo do gato)
Faça com calma; é o único ponto que mexe com dinheiro de verdade.
- [ ] No painel do Stripe, **vire o toggle pra modo LIVE**.
- [ ] **Criar os 6 produtos/preços em LIVE** (iguais ao catálogo: Starter R$79/20cr, Pro R$199/60cr, Team R$499/200cr, Pack 20cr R$89, Pack 50cr R$199, Pack 120cr R$429).
  > O script `setup-stripe-catalog.mjs` é **só TESTE** (ele recusa chave `sk_live`). Então **crie os preços LIVE na mão no painel** e, em cada preço, coloque o `metadata`: `credits`, `plan`, `kind` (rede de segurança caso o catálogo não esteja preenchido).
- [ ] **Registrar o webhook LIVE**: Stripe (LIVE) → Developers → Webhooks → Add endpoint →
  `https://animov.vercel.app/api/webhooks/stripe`
  Eventos: `checkout.session.completed`, `invoice.paid`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
  Copiar o `whsec` **LIVE** → colar na env `STRIPE_WEBHOOK_SECRET` da Vercel (passo 5.2).
- [ ] **Atualizar o `billing_catalog`** com os **price IDs LIVE** (painel admin do app, ou um `update` no Supabase). Hoje ele tem os IDs de **TESTE** — se não trocar, as compras LIVE vão depender só do `metadata.credits` do preço.
- [ ] Ativar **cartão + Pix** no modo LIVE (Stripe → Settings → Payment methods).
- [ ] **Redeploy** na Vercel e fazer **uma compra real pequena** (um pacote) pra confirmar que o crédito cai.

**Deu certo quando:** uma compra LIVE de verdade credita o usuário e aparece em `stripe_events`/`credit_transactions`.

---

## 6. 🟡 FASE 3 — Fila global de concorrência (Fal)

> ✅ **Quase tudo feito:** código commitado e no ar, `CRON_SECRET` setado na Vercel, plano **Pro confirmado**, e o cron por minuto está ativo. **Falta só validar** (item 6.1 abaixo: disparar >2 gerações e ver a fila funcionando).

Garante que você nunca estoura o limite de jobs simultâneos da Fal (hoje 2). Já existe um "heartbeat" por minuto na Vercel que empurra a fila.

- [ ] Commitar/pushar os arquivos da fila (se você **não** subiu tudo junto na FASE 2):
  `src/lib/jobs/dispatch.ts`, `src/lib/jobs/queue-client.ts`, `src/app/api/cron/dispatch/route.ts`, `src/app/api/generate-scene/submit/route.ts`, `src/app/api/generate-transition/submit/route.ts`, `src/app/api/generate/status/route.ts`, `vercel.json`, `src/stores/jobs-store.ts`.
- [ ] **Migration `00027_generation_queue` no Supabase de produção:** ✅ **JÁ APLICADA** (confirmado: tabela `generation_jobs` existe e `fal_max_concurrent = 2` já está setado). **Nada a fazer** — só conferir se quiser.
- [ ] **Setar `CRON_SECRET` na Vercel** (Settings → Environment Variables → Production). A Vercel manda esse valor automaticamente como `Authorization: Bearer` pro cron.
  > 🔒 Sem `CRON_SECRET` em produção, o `/api/cron/dispatch` responde **401 de propósito** (fecha por segurança). Ou seja: **sem essa env, a fila não avança sozinha pelo cron.**
- [ ] **Confirmar plano Vercel Pro** — o `vercel.json` agenda o cron **a cada minuto** (`* * * * *`), e isso **exige Pro**. _(a verificar — ver FASE 7)_
- [ ] **Deploy** e conferir em Vercel → projeto → **Cron Jobs** que `/api/cron/dispatch` aparece rodando a cada minuto.

### 6.1 Validar a fila
- [ ] Disparar **mais de 2 gerações** ao mesmo tempo.
- [ ] Ver no app o aviso **"na fila #N"** (na activity drawer) nos jobs que passaram do limite.
- [ ] Acompanhar os jobs saírem de `queued` → `submitted` → `completed` conforme o dispatcher libera as vagas (tabela `generation_jobs` no Supabase, ou a própria UI).

**Deu certo quando:** com >2 jobs, no máximo 2 ficam "em andamento" e o resto espera e vai entrando sozinho.

---

## 7. 🏁 FASE 4 — Checklist final de lançamento

Teste de fumaça de ponta a ponta, como se você fosse um cliente novo.

- [ ] **Cadastro novo** → conferir que o usuário começa com **0 créditos** (`free_credits = 0`, já configurado).
- [ ] **Comprar um pacote** → créditos caem na conta + aparece a transação no extrato (`credit_transactions`).
- [ ] **Gerar um vídeo** → conferir que o crédito **debita** certinho; com >2 jobs, a **fila** funciona.
- [ ] **Assinatura** → renovação/ativação credita via `invoice.paid` e o **Customer Portal** funciona.
- [ ] **Monitorar saldo da Fal** (rota admin de fal-balance / painel da Fal) pra não ficar sem saldo no meio de uma geração.
- [ ] Conferir que reembolsos automáticos funcionam (se um job falha, o crédito volta).

**Deu certo quando:** um estranho consegue cadastrar, comprar, gerar e ver o saldo mexer — sem você intervir.

---

## 8. 🙋 Decisões / o que eu preciso de você

Coisas que eu **não consegui confirmar sozinho** ou que dependem da sua decisão:

- [x] **Plano da Vercel é Pro?** ✅ **Confirmado** (você confirmou). O cron por minuto está liberado.
- [x] **Envs setadas na Vercel?** ✅ **Feito** — as 5 do Stripe/cron foram setadas em Production (modo **teste** por enquanto): `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`.
- [ ] **Confirmar que quer ir LIVE** (criar produtos/preços live + trocar as chaves). Decisão registrada: **testar em TESTE primeiro (estamos aqui), depois virar LIVE** — você decide quando virar.
- [ ] **Ciência:** `localhost` e produção usam **o mesmo Supabase**. Testes locais escrevem no banco real (já aconteceu com o teste do pacote).
- [ ] **Migrations 00026 e 00027:** ✅ **já aplicadas em produção** — não precisa rodar nada. (Só te avisando, é uma boa notícia.)

---

### 📌 Resumo de uma linha
**Billing e Fila já estão NO AR em produção (modo teste), validados localmente. Falta: validar uma compra no site real, virar a chave TEST→LIVE (FASE 2-B) e validar a fila (FASE 3).**
👉 **Próxima ação:** uma compra de teste em `animov.vercel.app/conta` com o cartão `4242…`.
