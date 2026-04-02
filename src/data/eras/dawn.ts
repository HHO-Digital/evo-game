import type { EraDefinition } from '@/types';

export const DAWN_ERA: EraDefinition = {
  id: 'dawn',
  name: 'Dawn',
  subtitle: 'The First Spark',
  period: '~200,000 BCE',
  description:
    'Humanity takes its first tentative steps. Small bands of wanderers learn to shape stone, ' +
    'harness fire, and speak the first words that will echo through millennia.',
  order: 0,
  colors: {
    primary: '#CC7722',
    secondary: '#8B4513',
    accent: '#F5F5DC',
    background: '#1a0a2e',
    text: '#F5F5DC',
  },
  uiTheme: {
    panelBackground: 'rgba(139, 69, 19, 0.15)',
    panelBorder: '2px solid #CC7722',
    borderRadius: '2px',
    fontFamily: '"Courier New", monospace',
    cssClass: 'era-dawn',
  },
  milestones: [
    {
      id: 'dawn_master_fire',
      description: 'Master Fire',
      completed: false,
      required: true,
      requirement: {
        type: 'technology',
        target: 'fire_making',
      },
    },
    {
      id: 'dawn_grow_tribe',
      description: 'Grow the Tribe',
      completed: false,
      required: true,
      requirement: {
        type: 'population',
        value: 15,
      },
    },
    {
      id: 'dawn_first_art',
      description: 'First Art',
      completed: false,
      required: true,
      requirement: {
        type: 'technology',
        target: 'cave_painting',
      },
    },
    {
      id: 'dawn_great_hunt',
      description: 'Great Hunt',
      completed: false,
      required: false,
      requirement: {
        type: 'resource',
        target: 'meat',
        value: 25,
      },
    },
  ],
};
