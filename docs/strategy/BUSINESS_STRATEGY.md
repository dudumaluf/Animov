# Animov.ai — Documento Estrategico de Negocios

> Documento confidencial. Uso interno e para negociacoes com potenciais parceiros e investidores.
> Data: 13 de abril de 2026.
> Autor: Eduardo Maluf de Campos — Fundador, CTO, unico desenvolvedor e designer.

---

## 1. Resumo Executivo

**Animov.ai** e uma plataforma SaaS que transforma fotos de imoveis em videos cinematograficos usando inteligencia artificial generativa. O corretor faz upload das fotos, escolhe um preset de movimento de camera (dolly in, orbit, ken burns, panoramica, etc.), e recebe um video profissional pronto para publicar — em minutos, sem saber editar video, sem contratar videomaker.

O mercado imobiliario brasileiro tem mais de 900 mil corretores ativos (COFECI 2025), alem de milhares de imobiliarias, construtoras e profissionais de social media imobiliario. A maioria desses profissionais nao produz video porque o custo e alto (R$500 a R$2.000+ por video profissional) ou porque nao tem habilidade tecnica. O Animov resolve isso: fotos que o corretor ja tem se transformam em conteudo cinematografico por uma fracao do custo, em uma fracao do tempo.

O produto ja esta **funcional e em producao**. O site esta no ar com landing page interativa em WebGL, editor completo no navegador, geracao de video por IA, composicao final com musica, sistema de creditos, painel administrativo, e deploy automatizado. Tudo foi construido por **uma unica pessoa em 4 dias**.

---

## 2. O Produto — O que ja Existe

### 2.1 Funcionalidades Entregues

| Modulo | Descricao | Complexidade Estimada (time tradicional) |
|--------|-----------|------------------------------------------|
| Landing Page | Site institucional com WebGL interativo (React Three Fiber), animacoes scroll-driven, presets visuais, secoes de pricing, "como funciona" com steps animados | 3-4 semanas |
| Autenticacao | Login/registro com Supabase Auth, Row-Level Security em todas as tabelas, sessoes seguras | 1 semana |
| Editor de Video | Film strip com cards de cena, drag-and-drop (dnd-kit), zoom/pan com trackpad, menus de contexto, inspector de propriedades, multi-versao por cena | 4-6 semanas |
| Pipeline de Geracao AI | 3 camadas: (1) Vision LLM analisa a foto, (2) prompt engine aplica preset cinematografico, (3) modelo de video gera o clip. Tudo orquestrado por API routes seguras | 3-4 semanas |
| 7 Presets Cinematograficos | Dolly In, Dolly Out, Orbit, Panoramica, Ken Burns, Rise, Push In — cada um com estrategia de prompt profissional calibrada para ambientes imobiliarios | 2 semanas |
| Transicoes AI | Gera video de transicao entre duas cenas usando start/end frame conditioning. Nao e crossfade — e video novo gerado por IA conectando as cenas | 2 semanas |
| Composicao de Video | Junta todos os clips num video final H.264 MP4 com audio AAC, direto no browser (Mediabunny + WebCodecs). Sem servidor de render | 2-3 semanas |
| Sistema de Creditos | Debito atomico via Supabase RPC (PostgreSQL function), refund automatico em caso de falha na geracao, historico de transacoes | 1-2 semanas |
| Edicao de Imagem com AI | Modal full-screen para editar fotos com IA (modelo nano-banana-2), presets de estilo, prompts customizados | 1-2 semanas |
| Musica AI + Upload | Geracao de trilha sonora com Minimax Music 2.6, upload de MP3 customizado, mixagem automatica no export | 1 semana |
| Painel Admin | Dashboard completo: overview, gerenciamento de usuarios, creditos, presets, logs de geracao com debug data, configuracoes de modelos | 2-3 semanas |
| Pagina de Conta | Saldo de creditos, historico de transacoes, perfil do usuario | 1 semana |
| Persistencia | Supabase Postgres (11 tabelas com RLS), Storage para fotos e videos, auto-save, backup/import/export de projetos em JSON | 2 semanas |
| Deploy | CI/CD automatizado via Vercel + GitHub, deploy a cada push | 0.5 semana |

### 2.2 Numeros que Importam

- **Tempo de desenvolvimento:** 4 dias (68 horas)
- **Pessoas envolvidas:** 1 (fundador: dev + design + arquitetura + produto)
- **Equivalente em time tradicional:** 2-3 devs senior + 1 designer por **3-5 meses**
- **Custo equivalente de mercado para construir do zero:** R$150.000 a R$300.000

### 2.3 Stack Tecnologica

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 14 (App Router), TypeScript strict |
| UI | Tailwind CSS, shadcn/ui, Radix, Framer Motion |
| 3D / Landing | React Three Fiber, drei, three.js |
| Estado | Zustand (persist + Supabase sync) |
| Drag & Drop | dnd-kit |
| Auth + Database | Supabase (Auth, Postgres, Storage, RLS, RPCs) |
| AI Video | fal.ai — Kling O1 Pro (image-to-video) |
| AI Vision | fal.ai OpenRouter — Gemini Flash / Claude Sonnet |
| AI Imagem | fal.ai — Nano Banana 2 Edit |
| AI Musica | fal.ai — Minimax Music 2.6 |
| Video Export | Mediabunny (WebCodecs, H.264+AAC) |
| Hosting | Vercel (auto-deploy via GitHub) |
| Repositorio | GitHub privado (github.com/dudumaluf/Animov) |

---

## 3. Custos e Investimento Realizado

### 3.1 Gastos Diretos (out-of-pocket)

| Item | Valor (USD) | Valor (BRL aprox.) |
|------|-------------|---------------------|
| Cursor (AI coding assistant) | US$300 | R$1.740 |
| fal.ai (tokens de geracao AI) | US$50 | R$290 |
| Supabase Pro (mensal) | US$25/mes | R$145/mes |
| Vercel Pro (mensal) | US$20/mes | R$116/mes |
| **Total desembolso direto** | **~US$395** | **~R$2.290 + infra recorrente** |

### 3.2 Custo de Mao de Obra (Sweat Equity)

| Metrica | Valor |
|---------|-------|
| Dias trabalhados | 4 dias inteiros (7h da manha ate meia-noite) |
| Horas totais | ~68 horas |
| Escopo do trabalho | Concepcao, arquitetura, design UI/UX, desenvolvimento full-stack, integracao AI, testes, deploy |
| Rate de referencia (Europa) | EUR 1.000/dia como dev WebGL senior |
| Valor equivalente (rate Europa) | 4 x R$6.200 = **R$24.800** |
| Valor equivalente (rate dev senior BR) | 68h x R$200/h = **R$13.600** |

### 3.3 Investimento Total

| Calculo | Valor |
|---------|-------|
| Desembolso direto | R$2.290 |
| Mao de obra (taxa Europa) | R$24.800 |
| **Total (referencia Europa)** | **~R$27.000** |
| Total (referencia dev senior BR) | ~R$15.900 |

> Nota: estes valores nao incluem o custo de oportunidade de 4 dias de dedicacao exclusiva fora de outros projetos remunerados, nem o conhecimento acumulado de anos de experiencia em WebGL, React, e arquitetura de software que permitiu a velocidade de execucao.

---

## 4. Custos Operacionais (Projecao Mensal)

### 4.1 Custos Variaveis por Geracao

| Operacao | Custo Unitario (USD) | Custo Unitario (BRL aprox.) |
|----------|----------------------|-----------------------------|
| Video (Kling O1 Pro, 5 segundos) | US$0.56 | R$3.25 |
| Video (Kling O1 Pro, 7 segundos) | US$0.78 | R$4.53 |
| Vision LLM (analise de foto) | US$0.01-0.05 | R$0.06-0.29 |
| Edicao de imagem (1K) | US$0.08 | R$0.46 |
| Edicao de imagem (4K) | US$0.16 | R$0.93 |
| Musica AI | A definir | A definir |

**Custo estimado de um projeto completo (5 cenas + transicoes + musica):** US$3-6 (~R$17-35)

### 4.2 Custos Fixos

| Item | Mensal (USD) | Mensal (BRL) |
|------|-------------|--------------|
| Supabase Pro | US$25 | R$145 |
| Vercel Pro | US$20 | R$116 |
| Dominio (anualizado) | ~US$1.25 | ~R$7 |
| **Total fixo mensal** | **~US$46** | **~R$268** |

### 4.3 Margem de Contribuicao

Para um projeto de 5 cenas vendido a R$40 (plano pago):
- Custo AI: ~R$20
- Margem bruta: **~R$20 (50%)**

Para um projeto de 5 cenas no plano Pro (custo efetivo por projeto menor pois o plano inclui creditos):
- Margem estimada: **60-75%**

---

## 5. Mercado e Oportunidade

### 5.1 Tamanho do Mercado

| Segmento | Estimativa Brasil |
|----------|-------------------|
| Corretores ativos (COFECI) | 900.000+ |
| Imobiliarias | 40.000+ |
| Construtoras / Incorporadoras | 5.000+ |
| Profissionais de social media imobiliario | Dezenas de milhares |

### 5.2 O Problema

- Video profissional de imovel custa R$500-2.000+ (filmagem + edicao)
- Demora dias ou semanas para ficar pronto
- Maioria dos corretores nao faz video por custo ou complexidade
- Listings com video recebem **403% mais inquiries** do que sem video (fonte: National Association of Realtors)
- Instagram e TikTok tornaram video essencial para marketing imobiliario

### 5.3 A Solucao

- Upload das fotos que o corretor **ja tem**
- Video pronto em **minutos**, nao dias
- Custo de **R$3-8 por video** ao inves de R$500-2.000
- Sem instalar nada — funciona no navegador
- Qualidade cinematografica com presets profissionais
- Exporta com musica, pronto para postar

---

## 6. Modelos de Negocio

### Modelo A — SaaS para Corretores (B2C / B2SMB)

**Como funciona:** plataforma self-service com planos mensais.

| Plano | Preco/mes | Credits inclusos | Publico |
|-------|-----------|------------------|---------|
| Free | R$0 | 3 credits | Teste / freemium |
| Starter | R$79 | 20 credits | Corretor autonomo |
| Pro | R$199 | 60 credits | Corretor ativo / equipe pequena |
| Team | R$499 | 200 credits | Imobiliaria / equipe |

- Credits adicionais disponiveis para compra avulsa
- Watermark no plano Free, sem watermark nos pagos
- Retencao de projetos: 30 dias (Free), 1 ano (pagos)

**Vantagens:** receita recorrente previsivel, escalavel, valuation alto (multiplo de ARR).
**Desafios:** exige investimento em marketing, suporte ao cliente, gestao de churn.

**Projecao conservadora (12 meses):**
- 500 usuarios pagos x R$120 ticket medio = R$60.000 MRR = R$720.000 ARR

### Modelo B — Licenciamento para Incorporadoras (B2B Enterprise)

**Como funciona:** contrato anual com incorporadoras e construtoras. Possibilidade de whitelabel (marca da construtora no produto).

| Tier | Preco/mes | Volume |
|------|-----------|--------|
| Standard | R$5.000 | ate 100 videos/mes |
| Premium | R$12.000 | ate 500 videos/mes |
| Enterprise | R$20.000+ | ilimitado + customizacao |

**Vantagens:** ticket alto, contratos de 12-24 meses, receita previsivel.
**Desafios:** ciclo de venda longo, necessidade de time comercial, customizacoes.

### Modelo C — Venda da Tecnologia (Exit)

**Como funciona:** venda completa do IP (codigo-fonte, marca, base de usuarios, infraestrutura).

| Cenario | Valuation Estimado |
|---------|-------------------|
| Pre-revenue, MVP funcional | R$200.000 - R$500.000 |
| Com 6 meses de MRR comprovado | 3-8x ARR |
| Com base de usuarios significativa (5k+) | Negociacao com premium |

**Compradores potenciais:** portais imobiliarios (ZAP, Viva Real, OLX Imoveis), construtoras com departamento digital, empresas de martech imobiliario.

### Modelo D — Hibrido (Recomendado)

1. **Fase 1 (agora):** Lancar como SaaS (Modelo A) para validar product-market fit e gerar receita
2. **Fase 2 (mes 3-6):** Oferecer planos Enterprise/whitelabel (Modelo B) como upsell
3. **Fase 3 (a qualquer momento):** Manter portas abertas para exit (Modelo C) se surgir proposta vantajosa

---

## 7. Diferenciais Competitivos

### 7.1 vs. Videomakers Tradicionais

| Criterio | Videomaker | Animov |
|----------|-----------|--------|
| Custo | R$500-2.000/video | R$3-8/video |
| Tempo | 3-7 dias | 5 minutos |
| Escalabilidade | 1 video por vez | Ilimitado simultaneo |
| Consistencia | Varia por profissional | Presets padronizados |
| Disponibilidade | Agendar + deslocar | 24/7, qualquer lugar |

### 7.2 vs. Ferramentas de Video AI Genericas

| Criterio | Runway / HeyGen / Synthesia | Animov |
|----------|----------------------------|--------|
| Foco | Generico | Imobiliario |
| Presets | Genericos | Cinematograficos para imoveis |
| Pipeline | Foto -> video simples | Foto -> Vision AI -> prompt engineering -> video |
| Transicoes | Nao tem ou basicas | AI-generated entre cenas |
| Composicao | Nao tem | Editor completo + export com musica |
| Idioma/Moeda | USD, ingles | BRL, portugues |
| Preco | US$12-96/mes (generico) | R$79-499/mes (especializado) |

### 7.3 Moats (Barreiras de Entrada)

1. **Pipeline de prompt proprietario** — 3 camadas com Vision LLM, nao e trivial replicar
2. **Presets calibrados** — testados e refinados especificamente para fotografia imobiliaria
3. **Transicoes AI entre cenas** — diferencial tecnico real, raro em ferramentas concorrentes
4. **Foco vertical** — conhecimento profundo do usuario (corretor BR) que generalistas nao tem
5. **Velocidade de execucao** — produto funcional em 4 dias demonstra capacidade de iteracao

---

## 8. Estrutura de Parceria — Equity Split

### 8.1 Contexto

O fundador tecnico ja investiu:
- **Todo o capital intelectual:** concepcao do produto, arquitetura, design UI/UX
- **Todo o trabalho tecnico:** 68 horas de desenvolvimento solo
- **Capital financeiro:** ~R$2.290 em ferramentas e infraestrutura
- **Risco:** custo de oportunidade de 4 dias fora de projetos remunerados a EUR 1.000/dia

A tecnologia **ja existe e funciona**. Nao e uma ideia num slide — e um produto em producao gerando videos. Qualquer parceiro entrando agora entra com risco tecnico zero.

### 8.2 Cenarios de Parceria

#### Cenario 1 — Parceiro Comercial Puro (sem aporte financeiro)

O parceiro contribui com: vendas, relacionamento com imobiliarias/construtoras, marketing.

| Papel | Equity | Condicoes |
|-------|--------|-----------|
| Fundador tecnico (Eduardo) | **75-80%** | Vesting imediato sobre 50%, restante em 2 anos |
| Parceiro comercial | **20-25%** | Vesting de 3 anos com cliff de 12 meses |

**Justificativa:** o produto ja esta pronto. O parceiro entra sem ter investido tempo, dinheiro, ou risco tecnico. Sua contribuicao e futura e condicionada a performance.

#### Cenario 2 — Parceiro Comercial + Aporte Financeiro (R$20.000-50.000)

| Papel | Equity | Condicoes |
|-------|--------|-----------|
| Fundador tecnico (Eduardo) | **65-70%** | Vesting imediato sobre 50%, restante em 2 anos |
| Parceiro comercial/investidor | **30-35%** | Vesting de 3 anos com cliff de 6 meses |

**Justificativa:** o aporte cobre custos operacionais dos primeiros meses (marketing, infra, AI tokens) e demonstra comprometimento financeiro.

#### Cenario 3 — Investidor com Aporte Significativo (R$100.000+)

- Negociacao caso a caso via **SAFE note** ou **nota conversivel**
- Fundador tecnico **nunca abaixo de 51%** (controle)
- Preferencia por divida conversivel ao inves de equity direto nesta fase

### 8.3 Clausulas Obrigatorias (qualquer cenario)

| Clausula | O que protege |
|----------|---------------|
| **Vesting com cliff** | Socio precisa permanecer X tempo para receber equity. Se sair antes do cliff, perde tudo |
| **IP pertence a empresa** | Propriedade intelectual e da empresa (CNPJ), nao das pessoas fisicas. Protege contra saida de socio levando tecnologia |
| **Non-compete** | Parceiro nao pode criar ou participar de concorrente por 2 anos apos saida |
| **Tag-along / Drag-along** | Protecao mutua em caso de venda. Ninguem vende sem o outro ter as mesmas condicoes |
| **Buyback clause** | Direito de recompra da participacao do socio que sair, a valor justo pre-definido |
| **Decisoes tecnicas com o CTO** | Arquitetura, stack, roadmap tecnico, contratacoes tecnicas — decisao final do fundador tecnico |
| **Anti-diluicao** | Protecao contra diluicao desproporcional em rodadas futuras |
| **Dedicacao minima** | Parceiro comercial deve dedicar X horas/semana. Se nao cumprir por Y meses, vesting pausa |
| **Metricas de performance** | Metas de vendas/receita atreladas ao vesting do parceiro comercial |

### 8.4 O que NAO aceitar

- **50/50 com parceiro que nao codou nem investiu** — o produto ja existe, nao e uma ideia
- **Parceiro que quer equity sem vesting** — sem skin in the game, sem equity
- **Investidor que exige controle (>50%)** — o fundador tecnico precisa de controle para iterar rapido
- **Acordo verbal** — tudo em contrato social registrado, com clausulas claras
- **Parceiro que nao assina NDA antes de ver detalhes** — protecao basica de IP

---

## 9. Valuation e Protecao de Propriedade Intelectual

### 9.1 Metodos de Valuation

| Metodo | Calculo | Resultado |
|--------|---------|-----------|
| **Custo de reposicao** | Quanto custaria contratar um time para construir do zero | R$150.000 - R$300.000 |
| **Comparaveis** | Ferramentas SaaS de video AI em estagio similar (pre-revenue, MVP) | R$200.000 - R$500.000 |
| **Potencial de receita** | 1.000 usuarios x R$100/mes = R$100k MRR = R$1.2M ARR x 5 = | R$6.000.000 |
| **DCF simplificado** | Receita projetada 3 anos, margem 60%, descontado a 25% | R$1.000.000 - R$3.000.000 |

**Para negociacoes pre-revenue:** usar custo de reposicao como piso (R$150k-300k).
**Para negociacoes com receita comprovada:** usar multiplo de ARR (3-8x).

### 9.2 Protecoes de IP Recomendadas

| Acao | Status | Prioridade |
|------|--------|------------|
| Registro da marca "Animov" no INPI | Pendente | Alta |
| Repositorio em GitHub privado | Feito | - |
| NDA antes de qualquer demo tecnica detalhada | Usar sempre | Alta |
| Contrato social com clausulas de IP | Pendente (quando houver socio) | Alta |
| Termos de uso e politica de privacidade | Pendente | Media |
| Copyright no codigo-fonte | Feito (implicitamente) | - |
| Documentacao de autoria (git log, commits, timestamps) | Feito (todo historico no GitHub) | - |

### 9.3 Evidencias de Autoria

O repositorio Git contem **todo o historico de commits** com timestamps, provando que todo o codigo foi escrito pelo fundador. Isso inclui:
- Data e hora de cada alteracao
- Volume de codigo produzido por dia
- Evolucao do projeto do zero ao MVP funcional
- Evidencia irrefutavel de autoria individual

---

## 10. Cenarios de Comercializacao

### Cenario A — Uma Incorporadora Quer Comprar

**Nao venda barato.** Uma incorporadora que quer comprar a ferramenta esta tentando economizar milhoes em producao de video.

| Tipo de Deal | Faixa de Preco | Quando aceitar |
|--------------|---------------|----------------|
| Licenca exclusiva (1 ano) | R$300.000 - R$600.000/ano | Se garantir receita minima e nao impedir SaaS publico |
| Whitelabel exclusivo | R$500.000 - R$1.000.000/ano | Se incluir exclusividade territorial |
| Aquisicao total | R$500.000 - R$2.000.000 (pre-revenue) | So se o preco justificar o potencial perdido |
| Aquisicao com earn-out | Base + % da receita por 3-5 anos | Preferivel se acreditar no potencial |

**Regra:** nunca aceitar menos que o custo de reposicao (R$150k-300k). Idealmente, 2-5x o custo de reposicao.

### Cenario B — SaaS Aberto para Qualquer Corretor

**O caminho de maior valor a longo prazo.** Receita recorrente, base de usuarios, dados de mercado.

| Marco | Timeline | Impacto no Valor |
|-------|----------|------------------|
| 100 usuarios pagos | Mes 3-4 | Valida product-market fit |
| R$10k MRR | Mes 6 | Prova de receita, abre portas para investimento |
| R$50k MRR | Mes 12 | Negocio sustentavel, valuation de R$3-5M |
| R$100k MRR | Mes 18-24 | Candidato a Series A, valuation R$6-10M |

### Cenario C — Alguem Quer "Tirar um Pedaco"

**Sinais de alerta:**
- "Vamos ser socios 50/50, eu entro com os clientes" — sem vesting, sem metricas, sem risco
- "Me da 30% que eu consigo uma reuniao com a incorporadora X" — intermediario, nao socio
- "A ideia e simples, qualquer um faria" — nao, ninguem fez. Voce fez em 4 dias o que demoraria meses
- "Vamos combinar depois, confia em mim" — sem contrato, sem acordo

**Resposta padrao:** "Obrigado pelo interesse. Antes de discutir qualquer parceria, preciso de um NDA assinado. Depois, podemos conversar sobre termos com contrato formal. O produto ja existe e esta em producao — qualquer participacao sera proporcional a contribuicao real e mensuravel."

---

## 11. Roadmap de Negocio

| Periodo | Acao | Objetivo |
|---------|------|----------|
| Semana 1-2 | Definir estrutura de parceria (se aplicavel) | Clareza juridica antes de crescer |
| Semana 2-4 | Integrar Stripe, testar com 10-20 corretores beta | Validar pricing e product-market fit |
| Mes 2 | Refinar pricing baseado em feedback real | Otimizar conversao e margem |
| Mes 3 | Marketing: Instagram, YouTube, parcerias com imobiliarias | Aquisicao de primeiros clientes |
| Mes 4-6 | Escalar base, adicionar modelos de video (Seedance, Wan), Google OAuth | Aumentar retencao e value |
| Mes 6+ | Avaliar B2B enterprise, possivel seed round | Crescimento acelerado |

---

## 12. Resumo para Negociacao

### Para um potencial parceiro comercial:

> "O Animov ja existe e funciona. Eu construi sozinho em 4 dias o que levaria um time meses e centenas de milhares de reais. O site esta no ar, os videos estao sendo gerados, a infraestrutura esta rodando. Estou buscando alguem para a area comercial — mas preciso que fique claro: o produto ja tem valor significativo. Qualquer participacao vai ser proporcional a contribuicao real, com vesting, cliff, e contrato formal. Sem acordo verbal, sem 50/50 gratuito."

### Para um potencial investidor:

> "O Animov resolve um problema real para 900 mil corretores no Brasil. O MVP esta pronto e em producao, construido com stack de ponta por um dev senior com experiencia internacional. O custo de reposicao da tecnologia e R$150-300k. Com investimento em marketing e time comercial, a projecao e atingir R$100k MRR em 12-18 meses. Estou aberto a investimento via nota conversivel, mantendo controle da operacao."

### Para uma incorporadora interessada em comprar:

> "O Animov nao e um projeto — e um produto funcional com pipeline de AI proprietario. A tecnologia ja gera videos cinematograficos a partir de fotos em minutos. Se o interesse e licenciamento exclusivo, podemos conversar sobre termos. Se e aquisicao, o piso e o custo de reposicao da tecnologia (R$150-300k), mas o valor real esta no potencial de mercado e na propriedade intelectual do pipeline."

---

## Anexo: Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Concorrente copia a ideia | Media | Medio | Velocidade de execucao + foco vertical + pipeline proprietario |
| Custos de AI sobem | Baixa | Alto | Multi-model (trocar para modelo mais barato), repassar ao usuario |
| fal.ai sai do ar | Baixa | Alto | Adapters abstratos permitem trocar provider rapidamente |
| Parceiro sai e leva clientes | Media | Alto | Clausulas de non-compete + IP na empresa + vesting |
| Mercado nao paga por video AI | Baixa | Alto | Validar com beta antes de investir em escala |
| Corretor nao entende a ferramenta | Media | Medio | Onboarding, video tutoriais, presets simples |

---

> **Disclaimer:** Este documento contem estimativas e projecoes baseadas em dados de mercado publicos e custos reais do projeto. Nao constitui assessoria juridica, financeira ou contabil. Recomenda-se consultar um advogado societario e um contador antes de formalizar qualquer parceria ou investimento.

---

*Animov.ai — Documento Estrategico v1.0*
*Confidencial — Abril 2026*
