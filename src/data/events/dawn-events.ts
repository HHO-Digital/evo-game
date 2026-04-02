import type { GameEventDefinition } from '@/types';

export const DAWN_EVENTS: GameEventDefinition[] = [
  // ─── Discovery events ──────────────────────────────────────────────
  {
    id: 'lightning_strike',
    name: 'Lightning Strike',
    era: 'dawn',
    type: 'discovery',
    weight: 5,
    unique: true,
    description:
      'A bolt from the heavens splits a great tree. Flames lick the dry grass — ' +
      'but within the terror lies an opportunity.',
    trigger: {
      type: 'random',
      condition: { maxTick: 400 },
    },
    choices: [
      {
        id: 'harness_fire',
        text: 'Cautiously gather the flame',
        description: 'Risk the burn to seize a gift of the sky.',
        consequences: [
          { type: 'tech_unlock', target: 'fire_making', value: 1 },
          { type: 'health_change', value: -5 },
        ],
      },
      {
        id: 'flee_fire',
        text: 'Flee to safety',
        description: 'Live to learn another day.',
        consequences: [
          { type: 'happiness_change', value: -5 },
        ],
      },
    ],
  },
  {
    id: 'berry_bush_discovery',
    name: 'Berry Bush Discovery',
    era: 'dawn',
    type: 'discovery',
    weight: 10,
    unique: false,
    description:
      'A scout stumbles upon a thick grove of berry bushes, their branches heavy with ripe fruit.',
    trigger: {
      type: 'random',
    },
    choices: [
      {
        id: 'gorge',
        text: 'Feast now',
        description: 'Fill every belly while the bounty lasts.',
        consequences: [
          { type: 'resource_change', target: 'berries', value: 15 },
          { type: 'happiness_change', value: 5 },
        ],
      },
      {
        id: 'ration',
        text: 'Gather carefully for later',
        description: 'Discipline now means food tomorrow.',
        consequences: [
          { type: 'resource_change', target: 'berries', value: 25 },
        ],
      },
    ],
  },
  {
    id: 'cave_discovery',
    name: 'Cave Discovery',
    era: 'dawn',
    type: 'discovery',
    weight: 6,
    unique: true,
    description:
      'Deep in the hillside, a yawning opening reveals a dry cave. ' +
      'It could shelter the whole band from the elements.',
    trigger: {
      type: 'random',
    },
    choices: [
      {
        id: 'move_in',
        text: 'Claim the cave',
        description: 'A roof of stone is better than open sky.',
        consequences: [
          { type: 'population_change', value: 3 },
          { type: 'happiness_change', value: 10 },
        ],
      },
      {
        id: 'explore_deeper',
        text: 'Explore deeper first',
        description: 'Who knows what lurks in the dark?',
        consequences: [
          { type: 'resource_change', target: 'flint', value: 10 },
          { type: 'stat_change', target: 'intelligence', value: 1 },
        ],
      },
    ],
  },

  // ─── Encounter events ──────────────────────────────────────────────
  {
    id: 'rival_band',
    name: 'Rival Band Approaches',
    era: 'dawn',
    type: 'encounter',
    weight: 7,
    unique: false,
    description:
      'Smoke rises on the horizon. Another band of wanderers draws near — their intentions unclear.',
    trigger: {
      type: 'population_threshold',
      condition: { target: 'total', value: 8 },
    },
    choices: [
      {
        id: 'fight',
        text: 'Drive them off',
        description: 'Show strength and defend what is yours.',
        consequences: [
          { type: 'population_change', value: -2 },
          { type: 'stat_change', target: 'strength', value: 2 },
          { type: 'resource_change', target: 'meat', value: 5 },
        ],
      },
      {
        id: 'trade',
        text: 'Offer to trade',
        description: 'Share resources and perhaps gain allies.',
        requirements: [{ resourceId: 'berries', amount: 5 }],
        consequences: [
          { type: 'resource_change', target: 'hides', value: 8 },
          { type: 'stat_change', target: 'charisma', value: 2 },
          { type: 'happiness_change', value: 5 },
        ],
      },
      {
        id: 'flee',
        text: 'Retreat quietly',
        description: 'Avoid confrontation entirely.',
        consequences: [
          { type: 'happiness_change', value: -10 },
          { type: 'stat_change', target: 'adaptability', value: 1 },
        ],
      },
    ],
  },
  {
    id: 'wounded_animal',
    name: 'Wounded Animal',
    era: 'dawn',
    type: 'encounter',
    weight: 8,
    unique: false,
    prerequisiteTech: 'sharp_spear',
    description:
      'A great beast lies wounded near the camp — still dangerous, but weakened. ' +
      'Its eyes watch you with something almost like understanding.',
    trigger: {
      type: 'tech_unlock',
      condition: { target: 'sharp_spear' },
    },
    choices: [
      {
        id: 'mercy',
        text: 'Show mercy and tend its wounds',
        description: 'Compassion may yield unexpected rewards.',
        consequences: [
          { type: 'stat_change', target: 'wisdom', value: 3 },
          { type: 'happiness_change', value: 10 },
        ],
      },
      {
        id: 'hunt',
        text: 'Finish it off for the tribe',
        description: 'Meat and hides to sustain the band.',
        consequences: [
          { type: 'resource_change', target: 'meat', value: 15 },
          { type: 'resource_change', target: 'hides', value: 8 },
          { type: 'stat_change', target: 'strength', value: 1 },
        ],
      },
    ],
  },

  // ─── Disaster events ───────────────────────────────────────────────
  {
    id: 'harsh_winter',
    name: 'Harsh Winter',
    era: 'dawn',
    type: 'disaster',
    weight: 4,
    unique: true,
    description:
      'The cold descends with a vengeance. Frost coats the ground and food becomes scarce. ' +
      'The tribe must endure or perish.',
    trigger: {
      type: 'timed',
      condition: { minTick: 500 },
    },
    choices: [
      {
        id: 'huddle',
        text: 'Huddle together and conserve',
        description: 'Burn less, eat less, wait it out.',
        consequences: [
          { type: 'resource_change', target: 'wood', value: -15 },
          { type: 'resource_change', target: 'berries', value: -10 },
          { type: 'happiness_change', value: -15 },
        ],
      },
      {
        id: 'brave_hunt',
        text: 'Send hunters into the snow',
        description: 'Desperate times call for brave souls.',
        consequences: [
          { type: 'population_change', value: -1 },
          { type: 'resource_change', target: 'meat', value: 10 },
          { type: 'stat_change', target: 'strength', value: 2 },
        ],
      },
    ],
  },

  // ─── Cultural events ───────────────────────────────────────────────
  {
    id: 'strange_lights',
    name: 'Strange Lights in Sky',
    era: 'dawn',
    type: 'cultural',
    weight: 6,
    unique: true,
    prerequisiteTech: 'star_watching',
    description:
      'The night sky blazes with shimmering curtains of green and violet light. ' +
      'The star watcher says the ancestors are speaking.',
    trigger: {
      type: 'tech_unlock',
      condition: { target: 'star_watching' },
    },
    choices: [
      {
        id: 'observe',
        text: 'Record the patterns',
        description: 'Study the lights and remember their shapes.',
        consequences: [
          { type: 'stat_change', target: 'intelligence', value: 3 },
          { type: 'stat_change', target: 'wisdom', value: 2 },
        ],
      },
      {
        id: 'celebrate',
        text: 'Dance and celebrate',
        description: 'Let the tribe rejoice under the ancestor-lights.',
        consequences: [
          { type: 'happiness_change', value: 20 },
          { type: 'stat_change', target: 'charisma', value: 2 },
        ],
      },
    ],
  },
  {
    id: 'elders_dream',
    name: "Elder's Dream",
    era: 'dawn',
    type: 'cultural',
    weight: 5,
    unique: true,
    description:
      'The eldest of the band wakes trembling from a vivid dream — ' +
      'a vision of great beasts falling to spears and the tribe feasting for days.',
    trigger: {
      type: 'population_threshold',
      condition: { target: 'total', value: 12 },
    },
    choices: [
      {
        id: 'heed_dream',
        text: 'Heed the vision',
        description: 'Prepare for a great hunt as the dream foretold.',
        consequences: [
          { type: 'stat_change', target: 'wisdom', value: 2 },
          { type: 'happiness_change', value: 10 },
          { type: 'era_progress', target: 'dawn', value: 1 },
        ],
      },
      {
        id: 'dismiss_dream',
        text: 'Dismiss it as fancy',
        description: 'Dreams are just dreams.',
        consequences: [
          { type: 'stat_change', target: 'intelligence', value: 1 },
        ],
      },
    ],
  },
];
