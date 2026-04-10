# Animov.ai — Progresso

## Fase atual: 2 — Landing

### Concluído
- [x] 1.1 Repo + Next.js 14 + Tailwind + shadcn/ui + TS strict
- [x] 1.2 Supabase schema + RLS + seed
- [x] 1.3 Auth (email/password) + layout base

- [x] 2.1 Estrutura one-pager + tipografia serif + preto absoluto
  - Navbar fixa com links anchor + CTA
  - Hero com titulo serif gigante, eyebrow dourado, stats, CTA duplo
  - Como funciona: 3 passos com numeros itálico dourado
  - Pricing: 3 planos (Free/Starter/Pro) com card dourado destaque
  - Footer minimalista
  - Framer Motion: fade-in, stagger, useInView pra cada seção

- [x] 2.2 R3F scene com cards de imóvel
  - Canvas com ScrollControls (drei) + 4 páginas de scroll
  - 12 cards com fotos Park Avenue como texturas
  - PlaneGeometry + meshBasicMaterial + useTexture

- [x] 2.3 Scroll-driven layouts (grid → cilindro → espiral)
  - Grid em perspectiva (4 colunas, profundidade por row)
  - Cilindro: cards dispostos em anel 360°
  - Espiral: raio crescente + distribuição vertical
  - Transições suaves via lerp entre os 3 layouts

- [x] 2.4 Parallax de títulos sincronizado com presets
  - Html overlay com drei pra título da seção
  - Labels de presets (Dolly In, Orbit, Ken Burns, Reveal, Float Up, Cinematic Pan)

### Em andamento
- [ ] 2.5 Responsivo + fallback mobile
- [ ] Polish visual (ajustes de spacing, timing, cores)

### Blockers
- Nenhum

### Notas/decisões
- R3F v8 + drei v9 (compatíveis com React 18 / Next.js 14)
- dynamic import com ssr: false pra Canvas R3F
- Framer Motion pra animações DOM (não GSAP)
- 12 fotos Park Avenue como mock assets
- ScrollControls com damping 0.3 pra scroll suave
