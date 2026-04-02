import type { ResourceDefinition } from '@/types';

export const RESOURCES: ResourceDefinition[] = [
  // Dawn era resources
  {
    id: 'flint',
    name: 'Flint',
    icon: '🪨',
    category: 'raw',
    eraIntroduced: 'dawn',
    baseGatherRate: 0.3,
    maxStorage: 50,
    description: 'Sharp stones for tools',
  },
  {
    id: 'wood',
    name: 'Wood',
    icon: '🪵',
    category: 'raw',
    eraIntroduced: 'dawn',
    baseGatherRate: 0.5,
    maxStorage: 100,
    description: 'Fuel and building material',
  },
  {
    id: 'berries',
    name: 'Berries',
    icon: '🫐',
    category: 'raw',
    eraIntroduced: 'dawn',
    baseGatherRate: 0.8,
    maxStorage: 40,
    storageDecay: 0.01,
    description: 'Foraged food',
  },
  {
    id: 'meat',
    name: 'Meat',
    icon: '🥩',
    category: 'raw',
    eraIntroduced: 'dawn',
    baseGatherRate: 0.2,
    maxStorage: 30,
    storageDecay: 0.02,
    description: 'Hunted game',
  },
  {
    id: 'hides',
    name: 'Hides',
    icon: '🦴',
    category: 'raw',
    eraIntroduced: 'dawn',
    baseGatherRate: 0.15,
    maxStorage: 25,
    description: 'Animal skins for clothing',
  },

  // Awakening era resources
  {
    id: 'fish',
    name: 'Fish',
    icon: '🐟',
    category: 'raw',
    eraIntroduced: 'awakening',
    baseGatherRate: 0.6,
    maxStorage: 50,
    storageDecay: 0.02,
    description: 'River and lake catch',
  },
  {
    id: 'herbs',
    name: 'Herbs',
    icon: '🌿',
    category: 'raw',
    eraIntroduced: 'awakening',
    baseGatherRate: 0.3,
    maxStorage: 30,
    description: 'Medicinal and cooking plants',
  },
  {
    id: 'ceramics',
    name: 'Ceramics',
    icon: '🏺',
    category: 'processed',
    eraIntroduced: 'awakening',
    baseGatherRate: 0.1,
    maxStorage: 20,
    description: 'Fired clay vessels',
  },
];

/** Look up a resource definition by its id. */
export function getResourceDef(resourceId: string): ResourceDefinition | undefined {
  return RESOURCES.find(r => r.id === resourceId);
}

/** Return all resource definitions introduced in (or before) a given era. */
export function getResourcesForEra(eraId: string): ResourceDefinition[] {
  const eraOrder = ['dawn', 'awakening', 'roots', 'forge', 'empire', 'convergence', 'enlightenment', 'revolution', 'modern', 'horizon'];
  const maxIndex = eraOrder.indexOf(eraId);
  if (maxIndex === -1) return [];
  return RESOURCES.filter(r => {
    const rIdx = eraOrder.indexOf(r.eraIntroduced);
    return rIdx >= 0 && rIdx <= maxIndex;
  });
}
