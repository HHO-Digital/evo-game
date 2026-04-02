import type { EraId } from './eras';
import type { ResourceCost } from './resources';

export type EventType = 'discovery' | 'disaster' | 'encounter' | 'cultural' | 'political';
export type TriggerType = 'random' | 'population_threshold' | 'tech_unlock' | 'resource_threshold' | 'timed';

export interface GameEventDefinition {
  id: string;
  name: string;
  era: EraId;
  type: EventType;
  trigger: EventTrigger;
  description: string;
  choices: EventChoice[];
  weight: number;
  unique: boolean;
  prerequisiteTech?: string;
}

export interface EventTrigger {
  type: TriggerType;
  condition?: {
    target?: string;
    value?: number;
    minTick?: number;
    maxTick?: number;
  };
}

export interface EventChoice {
  id: string;
  text: string;
  requirements?: ResourceCost[];
  consequences: EventConsequence[];
  description?: string;
}

export interface EventConsequence {
  type: 'resource_change' | 'population_change' | 'tech_unlock' | 'stat_change' |
        'era_progress' | 'happiness_change' | 'health_change' | 'unlock_building';
  target?: string;
  value: number;
  duration?: number;
}

export interface ActiveEvent {
  definition: GameEventDefinition;
  triggeredAt: number;
  resolved: boolean;
  choiceMade?: string;
}
