import type { EraId } from './eras';

export type ResourceCategory = 'raw' | 'processed' | 'abstract';

export interface ResourceDefinition {
  id: string;
  name: string;
  icon: string;
  category: ResourceCategory;
  eraIntroduced: EraId;
  eraObsoleted?: EraId;
  baseGatherRate: number;
  storageDecay?: number;
  maxStorage: number;
  description: string;
}

export interface ResourceState {
  id: string;
  amount: number;
  maxStorage: number;
  gatherRate: number;
  consumers: number;
}

export interface ResourceCost {
  resourceId: string;
  amount: number;
}
