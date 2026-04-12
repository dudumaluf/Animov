# Animov.ai — Prompt Strategy & Preset Catalog

> Documento standalone. Define a estratégia de prompt engineering anti-alucinação, o catálogo de 11 presets do V1, a anatomia de 3 camadas (Vision LLM → JSON estruturado → Prompt final), os schemas de Vision por preset, os templates de prompt final, a estratégia de tiers (Simple/Advanced), e o tratamento de negative prompts opcionais por modelo.
>
> Este doc é o coração criativo/técnico da ferramenta Animov. Ler antes de implementar a tabela `presets`, a Edge Function de geração, e qualquer adapter.

---

## 1. Filosofia core: "não alucinar nada de novo"

Modelos de vídeo generativo (Kling, Seedance, Wan, LTX) alucinam quando você pede conteúdo que **não está visível no frame original**. Em imóveis isso é fatal: o corretor não pode entregar um vídeo com armário, cômodo ou acabamento que não existe na casa real.

A regra de ouro do prompt engineering do Animov é:

> **Descreva apenas o que a câmera faz. Nunca peça conteúdo novo no mundo. Trate o modelo como um operador de câmera num set já montado, não como um diretor de arte.**

### 1.1 Movimentos seguros vs movimentos perigosos

**Seguros (não alucinam):**
- Push-in / dolly-in lento em direção a um ponto visível
- Tilt vertical curto (até ~20°)
- Pan horizontal curto (até ~15°)
- Parallax lateral curto
- Orbit micro (até ~20°) ao redor de objeto central visível
- Rack focus (foco viaja entre planos visíveis)
- Drift handheld estabilizado (microvibração contemplativa)
- Reveal a partir de elemento visível em primeiro plano

**Perigosos (alucinam):**
- "Câmera vira e revela área fora do frame"
- Zoom out longo (cria mundo novo nas bordas)
- "Câmera atravessa porta / janela / parede"
- Pan/tilt longos (>30°)
- Movimento que exige inferir geometria não visível
- Qualquer instrução com "outro cômodo", "lá fora", "ao lado"

### 1.2 Defesa em duas frentes

A defesa contra alucinação vive em dois lugares:

1. **Linguagem do prompt positivo** (sempre disponível, todos os modelos): formulações de ancoragem como *"locked architecture, preserve all visible furniture and surfaces exactly as photographed, photorealistic continuation of the still image, camera-only motion, no scene changes"*. Esse tipo de frase funciona em Kling 2.6 Pro, Seedance 2.0, Kling First-Last O1 Pro — todos os modelos sem negative prompt.
2. **Negative prompt** (opcional, só onde o modelo suporta): camada extra de segurança. Nunca uma muleta — o positivo precisa funcionar sozinho.

---

## 2. Arquitetura de 3 camadas

Toda geração passa por três camadas. Essa separação permite iterar cada uma independentemente sem refazer o resto.

```
┌─────────────────────────────────────────────────────────┐
│ CAMADA 1 — Vision LLM analisa a foto                    │
│   Input: foto + system prompt do preset                 │
│   Output: JSON estruturado (schema próprio do preset)   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ CAMADA 2 — JSON estruturado (âncoras visuais)           │
│   Determinístico, validado com zod                      │
│   Persistido no banco em scenes.vision_data             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ CAMADA 3 — Template do preset preenche slots            │
│   Output: prompt positivo + (negative se suportado)     │
│   Enviado ao VideoModelAdapter                          │
└─────────────────────────────────────────────────────────┘
                          ↓
                  Modelo de vídeo
```

### 2.1 Por que JSON estruturado e não texto livre da vision

- **Determinismo:** o template da Camada 3 é código, não texto improvisado pela LLM.
- **Debug:** você vê exatamente o que a vision "entendeu" da foto no painel admin.
- **Iteração:** trocar a Camada 1 (como a vision olha) ou a Camada 3 (como o prompt é montado) sem afetar a outra.
- **Validação:** zod garante que o JSON tem os campos certos antes de chegar na Camada 3.
- **Cache:** o JSON da vision pode ser cacheado por (foto + preset), reaproveitando entre regenerações.

### 2.2 Schema por preset (não global)

Cada preset define seu próprio schema de Vision. Razões:

- Push-in Sereno só precisa de `focal_point` e `light_stability`. Pedir 10 campos queima tokens e introduz ruído.
- Reveal de Profundidade precisa de `foreground_element`, `background_element`, `depth_axis` — campos que outros presets ignoram.
- Schemas enxutos e específicos = respostas mais rápidas, mais baratas, mais consistentes.

Trade-off: N schemas no código em vez de 1. Mas cada preset já é uma entidade própria, então o custo é trivial.

---

## 3. Estratégia de Tiers (Simple / Advanced)

Tanto a Vision LLM quanto o modelo de vídeo têm tiers. O usuário escolhe o modo:

- **Simple Mode (default):** o usuário só faz upload e escolhe um preset. O sistema usa o tier `default` declarado por cada preset, balanceando custo e qualidade. Recomendado pra ~90% dos casos.
- **Advanced Mode:** o usuário pode override o tier de Vision e o modelo de vídeo por cena. UI revela um painel "advanced" no editor com dois selects.

### 3.1 Tiers de Vision LLM

| Tier   | Modelo sugerido (OpenRouter)        | Quando usar |
|--------|--------------------------------------|-------------|
| `fast` | Gemini 2.0 Flash                     | Presets que precisam só de identificação básica (Push-in Sereno, Tilt, Drift). Barato, suficiente. |
| `smart`| Claude 3.5 Sonnet ou GPT-4o          | Presets que dependem de leitura espacial fina (Parallax Arquitetônico, Reveal de Profundidade, Match Cut). Custo maior, qualidade espacial superior. |

> Os modelos exatos vivem em `system_settings.vision_models` no banco e podem ser trocados pelo admin sem deploy. O preset declara só o tier, não o nome do modelo.

### 3.2 Tiers de modelo de vídeo

Declarados na tabela `models`. Cada preset declara `compatible_models: string[]` — alguns presets só rodam bem em modelos com motion control fino. O Simple Mode escolhe o `default_model` de `system_settings`; o Advanced Mode permite override entre os compatíveis.

---

## 4. Tratamento de negative prompts (opcional por modelo)

Cada `VideoModelAdapter` declara:

```ts
interface VideoModelAdapter {
  id: string;
  displayName: string;
  supportsStartEndFrame: boolean;
  supportsNegativePrompt: boolean;  // ← NOVO
  // ...
}
```

A função `buildPromptForScene(photo, preset, adapter)` retorna:

```ts
{
  positive: string;        // sempre
  negative: string | null; // só se adapter.supportsNegativePrompt
}
```

Quando o adapter não suporta negative, o builder **descarta silenciosamente**. O prompt positivo é construído pra funcionar sozinho — o negative é só uma camada extra.

### 4.1 Negative prompt base (quando suportado)

```
new objects, new rooms, new furniture, morphing walls, warping geometry,
hallucinated architecture, people appearing, text overlays, watermarks,
camera passing through walls, distorted perspective, scene changes,
different lighting, color shifts, blurry, low quality
```

Presets podem adicionar negatives específicos via `preset.negative_additions`.

### 4.2 Status conhecido por modelo (validar com doc fal.ai antes de implementar cada adapter)

| Modelo                  | Negative prompt? |
|-------------------------|------------------|
| Kling 3.0               | sim              |
| Kling 2.6 Pro           | não              |
| Kling First-Last O1 Pro | não              |
| Seedance 2.0            | não (a confirmar)|
| Wan                     | a confirmar      |
| LTX                     | a confirmar      |

> Gate obrigatório: cada adapter, antes de implementar, lê a doc oficial do modelo no fal.ai e atualiza essa tabela + a flag `supportsNegativePrompt`.

---

## 5. Catálogo de Presets V1

11 presets: 7 single image + 4 dual image (transições).

### 5.1 SINGLE IMAGE — Movimentos de câmera

#### Preset 1 — Push-in Sereno

**ID:** `push_in_serene`
**Tipo:** single
**Vision tier default:** `fast`
**Descrição:** Dolly lento em direção ao ponto focal principal. O preset mais universal, funciona em qualquer ambiente.

**Schema da Vision:**
```json
{
  "focal_point": "string (descrição curta do ponto focal — ex: 'large window in the center', 'living room sofa')",
  "light_stability": "stable | shifting",
  "depth_available": "shallow | medium | deep"
}
```

**System prompt da Vision:**
```
You are a cinematographer analyzing a real estate photo. Identify the most
visually compelling focal point in the frame — a window, a piece of
furniture, an architectural element. Assess whether lighting is stable
(consistent across the frame) or shifting (mixed sources, strong contrast).
Estimate the available depth for a forward camera move.

Respond ONLY in JSON matching the schema. Do not invent elements not
visible in the photo.
```

**Template do prompt final (Camada 3):**
```
Slow cinematic dolly-in toward {focal_point}. Camera moves forward
smoothly, advancing approximately {depth == "deep" ? "20%" : depth == "medium" ? "12%" : "6%"}
of the visible depth. Subtle handheld stabilization. Lighting remains
{light_stability}. Photorealistic continuation of the still image.
Locked architecture. Preserve all visible furniture and surfaces exactly
as photographed. Camera-only motion, no scene changes.
```

---

#### Preset 2 — Parallax Arquitetônico

**ID:** `parallax_architectural`
**Tipo:** single
**Vision tier default:** `smart` (precisa de leitura espacial fina)
**Descrição:** Movimento lateral curto que destaca profundidade entre primeiro plano e fundo.

**Schema da Vision:**
```json
{
  "foreground_element": "string",
  "background_element": "string",
  "parallax_axis": "left_to_right | right_to_left",
  "depth_separation": "weak | moderate | strong"
}
```

**System prompt da Vision:**
```
You are a cinematographer planning a parallax shot for a real estate photo.
Identify a clear foreground element and a clear background element with
visible depth separation between them. Decide which lateral direction would
best reveal that separation. Assess the strength of the depth separation.

If the photo has no clear depth separation (flat composition), set
depth_separation to "weak" — the system will fall back to a different motion.

Respond ONLY in JSON. Do not invent elements not visible.
```

**Template:**
```
Subtle lateral parallax movement, camera glides {parallax_axis} by
approximately 8% of frame width. Foreground {foreground_element} shifts
slightly faster than background {background_element}, revealing natural
depth. Photorealistic, locked architecture, preserve all surfaces and
furniture exactly. Camera-only motion, no scene changes, no new elements.
```

---

#### Preset 3 — Tilt Vertical Elegante

**ID:** `tilt_vertical`
**Tipo:** single
**Vision tier default:** `fast`
**Descrição:** Tilt up ou down lento revelando altura do pé-direito ou do piso ao teto.

**Schema:**
```json
{
  "tilt_direction": "up | down",
  "tilt_subject": "string (o que está sendo revelado — ex: 'high ceiling', 'wooden floor')",
  "vertical_range_available": "short | medium | tall"
}
```

**System prompt:**
```
You are a cinematographer planning a vertical tilt for a real estate photo.
Decide whether tilting up (to reveal height/ceiling) or tilting down
(to reveal floor/foreground) would be more impactful given the composition.
Identify what is being revealed.

Respond ONLY in JSON.
```

**Template:**
```
Slow elegant vertical tilt {tilt_direction}, revealing {tilt_subject}.
Tilt range approximately {range == "tall" ? "18°" : range == "medium" ? "12°" : "8°"}.
Smooth motorized motion, no shake. Photorealistic, locked architecture,
preserve all visible elements exactly as photographed. Camera-only motion.
```

---

#### Preset 4 — Orbit Sutil

**ID:** `orbit_subtle`
**Tipo:** single
**Vision tier default:** `smart`
**Descrição:** Micro-orbit (15-20 graus máx) ao redor de um objeto central visível.

**Schema:**
```json
{
  "orbit_subject": "string (objeto central — ex: 'kitchen island', 'dining table')",
  "orbit_direction": "clockwise | counter_clockwise",
  "subject_centered": "true | false"
}
```

**System prompt:**
```
You are a cinematographer planning a subtle orbit shot. Identify a clear
central subject suitable for orbiting (well-defined object, roughly centered
in frame, with visible space around it). Determine the better orbit direction
based on lighting and composition. If no suitable centered subject exists,
set subject_centered to false.

Respond ONLY in JSON.
```

**Template:**
```
Subtle {orbit_direction} orbit around {orbit_subject}, approximately 15
degrees of arc. Slow, smooth, locked focus on the subject. Background
parallax follows naturally. Photorealistic, preserve all visible architecture
and furniture exactly. Camera-only motion, no new elements.
```

> Fallback: se `subject_centered == false`, o sistema cai pra Push-in Sereno automaticamente e loga warning.

---

#### Preset 5 — Rack Focus

**ID:** `rack_focus`
**Tipo:** single
**Vision tier default:** `smart`
**Descrição:** Câmera estática, foco viaja do primeiro plano pro fundo (ou vice-versa).

**Schema:**
```json
{
  "near_focus_subject": "string",
  "far_focus_subject": "string",
  "focus_direction": "near_to_far | far_to_near"
}
```

**System prompt:**
```
You are a cinematographer planning a rack focus shot. Identify a clear
near-plane subject and a clear far-plane subject. Decide the more
narratively interesting focus direction.

Respond ONLY in JSON.
```

**Template:**
```
Static camera, rack focus pull from {focus_direction == "near_to_far" ? "{near_focus_subject} in foreground" : "{far_focus_subject} in background"}
to {focus_direction == "near_to_far" ? "{far_focus_subject} in background" : "{near_focus_subject} in foreground"}.
Smooth, slow focus transition. Camera position is locked, no movement.
Photorealistic, preserve all visible elements exactly.
```

---

#### Preset 6 — Golden Hour Drift

**ID:** `golden_hour_drift`
**Tipo:** single
**Vision tier default:** `fast`
**Descrição:** Push-in lentíssimo + leve flutuação handheld estabilizado, vibe contemplativa. Bom pra fotos com luz natural forte.

**Schema:**
```json
{
  "light_quality": "warm_natural | cool_natural | mixed | artificial",
  "atmospheric_subject": "string (elemento que carrega a atmosfera — ex: 'sunlight on the floor', 'window light on wall')"
}
```

**System prompt:**
```
You are a cinematographer planning a contemplative drift shot. Assess the
quality of light in the photo. Identify the atmospheric subject — the element
that carries the mood (a patch of sunlight, a backlit curtain, light on a
texture).

Respond ONLY in JSON.
```

**Template:**
```
Extremely slow contemplative drift forward, micro handheld breathing
movement, camera advances barely 4% of depth. {light_quality} lighting
preserved with focus on {atmospheric_subject}. Cinematic, meditative pace.
Photorealistic, locked architecture, preserve every visible surface and
furniture exactly as photographed. Camera-only motion.
```

---

#### Preset 7 — Reveal de Profundidade

**ID:** `depth_reveal`
**Tipo:** single
**Vision tier default:** `smart`
**Descrição:** Câmera sai de um elemento próximo (esquadria, planta, móvel) e abre pro ambiente. O "véu" inicial é sempre algo já visível na foto.

**Schema:**
```json
{
  "veil_element": "string (elemento próximo que serve como véu — ex: 'door frame', 'plant in foreground')",
  "revealed_space": "string (o que é revelado atrás)",
  "veil_position": "left | right | top | bottom | center"
}
```

**System prompt:**
```
You are a cinematographer planning a depth reveal shot. Identify an element
in the immediate foreground of the photo that can act as a "veil" — the
camera will start framed by this element and pull back/move to reveal the
space behind it. The veil MUST already be visible in the photo. If no
suitable foreground veil exists, set veil_element to "none".

Respond ONLY in JSON.
```

**Template:**
```
Camera starts framed by {veil_element} in the {veil_position} of the frame,
slowly pulls back to reveal {revealed_space}. The {veil_element} remains
visible throughout, gradually showing more of the space behind it.
Photorealistic, preserve all visible architecture and furniture exactly.
Camera-only motion, no new elements appear.
```

> Fallback: se `veil_element == "none"`, cai pra Push-in Sereno.

---

### 5.2 DUAL IMAGE — Transições (start frame + end frame)

#### Preset 8 — Continuous Camera

**ID:** `continuous_camera`
**Tipo:** dual
**Vision tier default:** `smart`
**Descrição:** Finge que é a mesma câmera continuando o movimento. Só funciona quando vision detecta que é o mesmo ambiente ou ambientes adjacentes plausíveis.

**Schema:**
```json
{
  "spatial_relationship": "same_room | adjacent_rooms | different_rooms",
  "implied_camera_motion": "string (ex: 'forward dolly through doorway', 'pan from left to right')",
  "common_elements": "string[] (elementos visualmente comuns entre as duas fotos)"
}
```

**System prompt:**
```
You are a cinematographer analyzing two real estate photos to plan a
continuous camera transition. Determine the spatial relationship between
them. Describe the implied camera motion that would naturally connect
them. List any visually common elements (same flooring, same wall color,
matching window).

If the photos show clearly different rooms with no spatial relationship,
set spatial_relationship to "different_rooms" — the system will fall back
to a soft dissolve.

Respond ONLY in JSON.
```

**Template:**
```
Continuous camera movement: {implied_camera_motion}. The camera flows
naturally from the first frame to the second, maintaining consistent
{common_elements}. Smooth interpolation, no cuts. Photorealistic,
preserve all visible architecture from both frames. Camera-only motion.
```

> Fallback: se `spatial_relationship == "different_rooms"`, cai pra Soft Dissolve com Drift.

---

#### Preset 9 — Match Cut Cinematográfico

**ID:** `match_cut`
**Tipo:** dual
**Vision tier default:** `smart`
**Descrição:** Encontra elemento visual comum (linha, forma, cor dominante) e usa como ponto de costura.

**Schema:**
```json
{
  "match_type": "shape | line | color | composition",
  "match_element_a": "string (elemento na primeira foto)",
  "match_element_b": "string (elemento correspondente na segunda)",
  "match_confidence": "high | medium | low"
}
```

**System prompt:**
```
You are a cinematographer planning a match cut between two real estate
photos. Find a visual element that exists in both photos and could serve
as a cut point — a matching shape, line, color, or compositional element.
Rate your confidence in the match.

Respond ONLY in JSON.
```

**Template:**
```
Match cut transition based on {match_type}: {match_element_a} in the
first frame aligns visually with {match_element_b} in the second frame.
Brief held moment on the matching element, then smooth transition to
the new context. Photorealistic, preserve both compositions exactly.
```

> Fallback: se `match_confidence == "low"`, cai pra Soft Dissolve.

---

#### Preset 10 — Soft Dissolve com Drift

**ID:** `soft_dissolve_drift`
**Tipo:** dual
**Vision tier default:** `fast`
**Descrição:** Dissolve suave + leve push-in nas duas pontas. Default seguro pra qualquer par de fotos, nunca falha feio.

**Schema:**
```json
{
  "dissolve_pace": "slow | medium",
  "primary_subject_a": "string",
  "primary_subject_b": "string"
}
```

**System prompt:**
```
You are a cinematographer planning a soft dissolve transition. Identify
the primary subject of each photo. Suggest a dissolve pace based on the
mood of the images.

Respond ONLY in JSON.
```

**Template:**
```
{dissolve_pace} cross-dissolve transition. First frame shows {primary_subject_a}
with subtle forward drift; gradually dissolves into second frame showing
{primary_subject_b} with matching subtle forward drift. Cinematic, smooth.
Photorealistic, preserve both compositions exactly.
```

---

#### Preset 11 — Whip Pan Estilizado

**ID:** `whip_pan`
**Tipo:** dual
**Vision tier default:** `fast`
**Descrição:** Transição rápida lateral, vibe editorial. Mais arriscado, melhor pra ambientes parecidos.

**Schema:**
```json
{
  "whip_direction": "left | right",
  "ambient_similarity": "high | medium | low"
}
```

**System prompt:**
```
You are a cinematographer planning a whip pan transition. Decide the
direction (which feels more natural given the compositions). Assess
how similar the two ambients are visually.

Respond ONLY in JSON.
```

**Template:**
```
Fast {whip_direction} whip pan transition. Brief motion blur during the
whip, lasting roughly 0.4 seconds. Frame settles into the second image
matching the same lateral motion. Stylized, editorial pacing.
Photorealistic, preserve both end states exactly.
```

> Fallback: se `ambient_similarity == "low"`, sugere Soft Dissolve no UI antes de gerar.

---

## 6. Tabela `presets` no Supabase

```sql
create table presets (
  id text primary key,                    -- ex: 'push_in_serene'
  display_name text not null,
  description text not null,
  type text not null check (type in ('single', 'dual')),
  vision_tier_default text not null check (vision_tier_default in ('fast', 'smart')),
  vision_system_prompt text not null,
  vision_schema jsonb not null,           -- JSON Schema do output esperado
  prompt_template text not null,          -- template com {slots}
  negative_additions text,                -- adicionar ao negative base (se modelo suportar)
  fallback_preset_id text references presets(id),
  compatible_models text[],               -- ids de models compatíveis (null = todos)
  featured boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);
```

Seed inicial: os 11 presets desta seção 5.

---

## 7. Função `buildPromptForScene`

Pseudo-código da Edge Function:

```ts
async function buildPromptForScene(
  photo: PhotoInput | [PhotoInput, PhotoInput],
  preset: Preset,
  adapter: VideoModelAdapter,
  visionTierOverride?: 'fast' | 'smart'
): Promise<{ positive: string; negative: string | null; visionData: object }> {

  const tier = visionTierOverride ?? preset.vision_tier_default;
  const visionModel = await getVisionModelForTier(tier);

  // CAMADA 1: Vision LLM analisa
  const visionData = await callVisionLLM({
    model: visionModel,
    systemPrompt: preset.vision_system_prompt,
    image: photo,
    responseSchema: preset.vision_schema,
  });

  // CAMADA 2: validar com zod
  const validated = validateVisionOutput(visionData, preset.vision_schema);

  // Checar fallback condicional
  if (shouldFallback(validated, preset)) {
    const fallbackPreset = await getPreset(preset.fallback_preset_id);
    return buildPromptForScene(photo, fallbackPreset, adapter, visionTierOverride);
  }

  // CAMADA 3: preencher template
  const positive = renderTemplate(preset.prompt_template, validated);

  // Negative só se adapter suportar
  const negative = adapter.supportsNegativePrompt
    ? buildNegativePrompt(preset.negative_additions)
    : null;

  return { positive, negative, visionData: validated };
}
```

---

## 8. Modo Debug do Admin

Crítico pra iterar. Pra cada cena gerada, o painel admin mostra:

- Foto original (ou par de fotos)
- Preset escolhido
- Tier de vision usado + modelo exato
- JSON da vision (Camada 2)
- Prompt positivo final (Camada 3)
- Negative prompt (se houver)
- Modelo de vídeo + adapter usado
- Vídeo resultante
- Custo real em créditos
- Tempo de geração
- Botão "regenerar com prompt editado" (admin pode override manual o positivo/negative pra testar variações)

Esse loop é o que vai te dar o produto bom em uma semana de uso real.

---

## 9. Tabela `generation_logs` (extensão)

Adicionar ao schema do briefing v2:

```sql
alter table generation_logs add column vision_model text;
alter table generation_logs add column vision_data jsonb;
alter table generation_logs add column final_positive_prompt text;
alter table generation_logs add column final_negative_prompt text;
alter table generation_logs add column preset_id text references presets(id);
alter table generation_logs add column fallback_used boolean default false;
```

---

## 10. Roadmap de iteração pós-V1

Coisas que **não** entram no V1 mas o doc deve referenciar pra Cursor não tentar resolver agora:

- Presets customizados pelo usuário
- Prompts multilíngues (V1 é inglês na Camada 3 — modelos respondem melhor)
- Aprendizado: tracking de "preset funcionou bem" (rating do user) → ajuste automático de templates
- A/B test entre tiers de vision

---

## 11. Gates de implementação (pra Cursor)

1. **Gate A:** schema do banco (`presets` + alterações em `generation_logs`) com seed dos 11 presets aprovado por mim antes de qualquer código.
2. **Gate B:** função `buildPromptForScene` implementada e testada com uma foto mock + preset Push-in Sereno, retornando o JSON da vision + prompt final, **sem** ainda chamar fal.ai. Eu valido o prompt visualmente.
3. **Gate C:** primeiro adapter integrado (sugestão: começar pelo que tem doc mais clara — provavelmente Kling 2.6 Pro ou Seedance 2.0). Antes de implementar, ler doc oficial do fal.ai e atualizar a tabela da seção 4.2.
4. **Gate D:** modo debug do admin funcionando antes de integrar o segundo adapter.
5. **Gate E:** segundo e terceiro adapters só depois de validar o loop com 10+ gerações reais no primeiro.

---

**Fim do documento. Cursor: confirma leitura, lista dúvidas, e aguarda Gate A.**
