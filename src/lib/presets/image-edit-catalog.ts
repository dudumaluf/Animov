export type ImageEditPreset = {
  id: string;
  category: string;
  displayName: string;
  description: string;
  icon: string;
  promptTemplate: string;
  requiredReferences: { key: string; label: string }[];
  active: boolean;
  userVisible: boolean;
};

export const IMAGE_EDIT_CATEGORIES = [
  { id: "lighting", label: "Iluminação" },
  { id: "staging", label: "Staging" },
  { id: "cleanup", label: "Limpeza" },
  { id: "perspective", label: "Perspectiva" },
  { id: "people", label: "Pessoas" },
  { id: "style", label: "Estilo" },
];

export const IMAGE_EDIT_PRESETS: ImageEditPreset[] = [
  {
    id: "golden_hour",
    category: "lighting",
    displayName: "Golden Hour",
    description: "Luz dourada do pôr do sol",
    icon: "☀",
    promptTemplate: "Change the lighting to warm golden hour sunlight streaming through the windows. Keep all architecture and furniture exactly as they are. Photorealistic result.",
    requiredReferences: [],
    active: true,
    userVisible: true,
  },
  {
    id: "night_mode",
    category: "lighting",
    displayName: "Modo Noturno",
    description: "Iluminação noturna elegante",
    icon: "🌙",
    promptTemplate: "Transform this room to an elegant nighttime scene with warm interior lighting, ambient lamps on, and dark sky visible through windows. Keep all architecture exact. Photorealistic.",
    requiredReferences: [],
    active: true,
    userVisible: true,
  },
  {
    id: "add_furniture",
    category: "staging",
    displayName: "Mobiliar",
    description: "Adiciona móveis ao ambiente",
    icon: "🛋",
    promptTemplate: "Add the furniture shown in the reference image to this room, matching the room's perspective, lighting, and style. Place it naturally. Photorealistic integration.",
    requiredReferences: [{ key: "furniture", label: "Móvel" }],
    active: true,
    userVisible: true,
  },
  {
    id: "luxury_staging",
    category: "staging",
    displayName: "Staging Luxo",
    description: "Staging completo com móveis premium",
    icon: "✨",
    promptTemplate: "Stage this empty room with luxury modern furniture and tasteful decor. High-end design, warm tones, photorealistic. Keep all architecture and windows exactly as they are.",
    requiredReferences: [],
    active: true,
    userVisible: true,
  },
  {
    id: "declutter",
    category: "cleanup",
    displayName: "Limpar Cena",
    description: "Remove bagunça e itens pessoais",
    icon: "🧹",
    promptTemplate: "Remove all clutter, personal items, and mess from this room. Keep all furniture, architecture, and fixtures. Clean, tidy, ready for a real estate photo. Photorealistic.",
    requiredReferences: [],
    active: true,
    userVisible: true,
  },
  {
    id: "wider_angle",
    category: "perspective",
    displayName: "Ângulo Amplo",
    description: "Visão mais ampla do ambiente",
    icon: "↔",
    promptTemplate: "Show a wider angle view of this room, extending the visible space on all sides while maintaining the same perspective and style. Photorealistic architectural photography.",
    requiredReferences: [],
    active: true,
    userVisible: true,
  },
  {
    id: "add_person",
    category: "people",
    displayName: "Adicionar Pessoa",
    description: "Coloca uma pessoa na cena",
    icon: "👤",
    promptTemplate: "Place the person from the reference image naturally into this room scene, matching the room's perspective and lighting. Professional real estate lifestyle photo.",
    requiredReferences: [{ key: "person", label: "Pessoa" }],
    active: true,
    userVisible: true,
  },
  {
    id: "change_style",
    category: "style",
    displayName: "Mudar Estilo",
    description: "Aplica estilo de design de referência",
    icon: "🎨",
    promptTemplate: "Apply the interior design style shown in the reference image to this room. Match the colors, materials, and aesthetic while keeping the room's architecture. Photorealistic.",
    requiredReferences: [{ key: "reference", label: "Referência" }],
    active: true,
    userVisible: true,
  },
];

export function getImageEditPreset(id: string): ImageEditPreset | undefined {
  return IMAGE_EDIT_PRESETS.find((p) => p.id === id);
}

export function getVisibleImageEditPresets(): ImageEditPreset[] {
  return IMAGE_EDIT_PRESETS.filter((p) => p.active && p.userVisible);
}
