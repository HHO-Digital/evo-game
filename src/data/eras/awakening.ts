import type { EraDefinition } from '@/types';

export const AWAKENING_ERA: EraDefinition = {
  id: 'awakening',
  name: 'Awakening',
  subtitle: 'New Horizons',
  period: '~10,000 BCE',
  description:
    'The ice retreats and the world opens wide. People begin to settle, plant the first seeds, ' +
    'and form bonds with the animals that will walk beside them for ages to come.',
  order: 1,
  colors: {
    primary: '#6B8E9B',
    secondary: '#8B9556',
    accent: '#D2B48C',
    background: '#1a1a2e',
    text: '#D2B48C',
  },
  uiTheme: {
    panelBackground: 'rgba(107, 142, 155, 0.15)',
    panelBorder: '2px solid #6B8E9B',
    borderRadius: '4px',
    fontFamily: '"Georgia", serif',
    cssClass: 'era-awakening',
  },
  milestones: [
    {
      id: 'awakening_settle_water',
      description: 'Settle Near Water',
      completed: false,
      required: true,
      requirement: {
        type: 'technology',
        target: 'fishing',
      },
    },
    {
      id: 'awakening_proto_agriculture',
      description: 'Proto-Agriculture',
      completed: false,
      required: true,
      requirement: {
        type: 'technology',
        target: 'proto_farming',
      },
    },
    {
      id: 'awakening_large_settlement',
      description: 'Large Settlement',
      completed: false,
      required: true,
      requirement: {
        type: 'population',
        value: 30,
      },
    },
    {
      id: 'awakening_domesticate_dog',
      description: 'Domesticate Dog',
      completed: false,
      required: false,
      requirement: {
        type: 'technology',
        target: 'animal_domestication',
      },
    },
  ],
};
