import type { EraId, ResourceCost } from '@/types';

export interface BuildingDefinition {
  id: string;
  name: string;
  era: EraId;
  icon: string;
  description: string;
  prerequisiteTech: string;
  cost: ResourceCost[];
  effects: BuildingEffect[];
  maxCount: number;
}

export interface BuildingEffect {
  type:
    | 'population_capacity'
    | 'happiness'
    | 'storage'
    | 'gather_rate'
    | 'decay_reduction';
  target?: string;
  value: number;
}

export interface BuildingState {
  id: string;
  count: number;
  available: boolean;
}

export const BUILDINGS: BuildingDefinition[] = [
  {
    id: 'campfire',
    name: 'Campfire',
    era: 'dawn',
    icon: '🔥',
    description:
      'A controlled flame at the heart of camp. It warms the band, cooks food, ' +
      'and keeps predators at bay.',
    prerequisiteTech: 'fire_making',
    cost: [
      { resourceId: 'wood', amount: 8 },
      { resourceId: 'flint', amount: 3 },
    ],
    effects: [
      { type: 'population_capacity', value: 2 },
      { type: 'happiness', value: 5 },
    ],
    maxCount: 3,
  },
  {
    id: 'lean_to',
    name: 'Lean-to Shelter',
    era: 'dawn',
    icon: '🏕️',
    description:
      'A simple framework of branches and hides propped against a rock face. ' +
      'Enough to keep the worst of the weather off.',
    prerequisiteTech: 'shelter_building',
    cost: [
      { resourceId: 'wood', amount: 12 },
      { resourceId: 'hides', amount: 4 },
    ],
    effects: [
      { type: 'population_capacity', value: 3 },
    ],
    maxCount: 4,
  },
  {
    id: 'drying_rack',
    name: 'Drying Rack',
    era: 'dawn',
    icon: '🥓',
    description:
      'Strips of meat hung over a smoky fire dry slowly in the air, ' +
      'lasting far longer than fresh cuts.',
    prerequisiteTech: 'sharp_spear',
    cost: [
      { resourceId: 'wood', amount: 6 },
      { resourceId: 'hides', amount: 2 },
    ],
    effects: [
      { type: 'decay_reduction', target: 'meat', value: 0.015 },
    ],
    maxCount: 2,
  },
  {
    id: 'stone_cache',
    name: 'Stone Cache',
    era: 'dawn',
    icon: '🪨',
    description:
      'A pit lined with flat stones and covered with a hide tarp. ' +
      'Keeps a reserve of flint safe and dry.',
    prerequisiteTech: 'stone_tools',
    cost: [
      { resourceId: 'flint', amount: 5 },
      { resourceId: 'wood', amount: 3 },
    ],
    effects: [
      { type: 'storage', target: 'flint', value: 20 },
    ],
    maxCount: 2,
  },
];

/** Find a building definition by id. */
export function getBuildingDef(buildingId: string): BuildingDefinition | undefined {
  return BUILDINGS.find(b => b.id === buildingId);
}

/** Return all buildings available in the given era. */
export function getBuildingsForEra(eraId: string): BuildingDefinition[] {
  return BUILDINGS.filter(b => b.era === eraId);
}
