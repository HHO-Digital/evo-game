import type { EraId } from './eras';

export interface CharacterStats {
  strength: number;
  intelligence: number;
  charisma: number;
  wisdom: number;
  adaptability: number;
}

export type StatId = keyof CharacterStats;

export interface CharacterAppearance {
  bodyType: string;
  clothing: string[];
  accessories: string[];
  heldItems: string[];
  stance: string;
  aura?: string;
}

export interface PlayerCharacter {
  name: string;
  era: EraId;
  stats: CharacterStats;
  appearance: CharacterAppearance;
  title: string;
  xp: number;
  level: number;
}
