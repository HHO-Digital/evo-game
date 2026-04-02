import type { EraId } from './eras';
import type { ResourceCost } from './resources';

export type TechBranch = 'survival' | 'culture' | 'military' | 'science' | 'governance';

export interface TechEffect {
  type: 'unlock_building' | 'unlock_resource' | 'modify_gather_rate' | 'modify_capacity' |
        'modify_stat' | 'unlock_role' | 'era_progress' | 'unlock_event';
  target: string;
  value?: number;
}

export interface TechDefinition {
  id: string;
  name: string;
  era: EraId;
  branch: TechBranch;
  description: string;
  cost: ResourceCost[];
  researchTime: number;
  prerequisites: string[];
  effects: TechEffect[];
  icon: string;
}

export interface TechState {
  id: string;
  researched: boolean;
  researching: boolean;
  progress: number;
  available: boolean;
}

export interface TechTreeState {
  technologies: Map<string, TechState>;
  currentResearch: string | null;
  researchProgress: number;
}
