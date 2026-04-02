export type RoleId =
  | 'idle'
  | 'gatherer'
  | 'hunter'
  | 'farmer'
  | 'builder'
  | 'soldier'
  | 'scholar'
  | 'artisan'
  | 'merchant'
  | 'shaman';

export interface RoleDefinition {
  id: RoleId;
  name: string;
  icon: string;
  description: string;
  eraUnlocked: string;
  resourceProduced?: string;
  gatherMultiplier?: number;
}

export interface PopulationGroup {
  role: RoleId;
  count: number;
  efficiency: number;
}

export interface PopulationState {
  total: number;
  capacity: number;
  groups: PopulationGroup[];
  happiness: number;
  health: number;
  growthRate: number;
}
