import type { EraId } from './eras';

export type RelationshipType = 'family' | 'friend' | 'rival' | 'mentor' | 'student' | 'partner' | 'stranger';
export type NPCRole = 'tribemember' | 'elder' | 'child' | 'trader' | 'warrior' | 'healer' | 'craftsman' | 'explorer';
export type LifeStage = 'child' | 'young_adult' | 'adult' | 'elder' | 'deceased';

export interface NPCTraits {
  bravery: number;       // 0-100
  curiosity: number;
  kindness: number;
  industriousness: number;
  wisdom: number;
}

export interface NPCDefinition {
  id: string;
  name: string;
  birthTick: number;
  deathTick?: number;
  lifeStage: LifeStage;
  role: NPCRole;
  era: EraId;
  traits: NPCTraits;
  parentId?: string;
  partnerId?: string;
  childrenIds: string[];
  relationships: NPCRelationship[];
  isPlayable: boolean;
  isRetiredPlayer: boolean;
  backstory: string;
}

export interface NPCRelationship {
  targetId: string;
  type: RelationshipType;
  bond: number;          // 0-100, strength of relationship
}

export interface SuccessionCandidate {
  npc: NPCDefinition;
  relationship: RelationshipType;
  bond: number;
  reason: string;
}

export interface LifespanConfig {
  /** Ticks per "year" of in-game life */
  ticksPerYear: number;
  /** Life stages and their age ranges (in years) */
  childMaxAge: number;
  youngAdultMaxAge: number;
  adultMaxAge: number;
  /** Expected lifespan varies by era */
  maxAge: number;
  /** Chance of early death per year after adultMaxAge */
  elderDeathChance: number;
}

/** Era-specific lifespan configurations */
export const ERA_LIFESPAN: Record<string, LifespanConfig> = {
  dawn: {
    ticksPerYear: 100,      // 10 seconds real-time = 1 year
    childMaxAge: 12,
    youngAdultMaxAge: 20,
    adultMaxAge: 35,
    maxAge: 45,
    elderDeathChance: 0.08,
  },
  awakening: {
    ticksPerYear: 100,
    childMaxAge: 12,
    youngAdultMaxAge: 20,
    adultMaxAge: 38,
    maxAge: 50,
    elderDeathChance: 0.06,
  },
  roots: {
    ticksPerYear: 90,
    childMaxAge: 14,
    youngAdultMaxAge: 22,
    adultMaxAge: 40,
    maxAge: 55,
    elderDeathChance: 0.05,
  },
  forge: {
    ticksPerYear: 80,
    childMaxAge: 14,
    youngAdultMaxAge: 22,
    adultMaxAge: 45,
    maxAge: 60,
    elderDeathChance: 0.04,
  },
  empire: {
    ticksPerYear: 70,
    childMaxAge: 15,
    youngAdultMaxAge: 25,
    adultMaxAge: 50,
    maxAge: 65,
    elderDeathChance: 0.04,
  },
  convergence: {
    ticksPerYear: 60,
    childMaxAge: 14,
    youngAdultMaxAge: 24,
    adultMaxAge: 45,
    maxAge: 55,
    elderDeathChance: 0.05,
  },
  enlightenment: {
    ticksPerYear: 50,
    childMaxAge: 15,
    youngAdultMaxAge: 25,
    adultMaxAge: 50,
    maxAge: 65,
    elderDeathChance: 0.04,
  },
  revolution: {
    ticksPerYear: 40,
    childMaxAge: 16,
    youngAdultMaxAge: 25,
    adultMaxAge: 55,
    maxAge: 70,
    elderDeathChance: 0.03,
  },
  modern: {
    ticksPerYear: 30,
    childMaxAge: 18,
    youngAdultMaxAge: 28,
    adultMaxAge: 60,
    maxAge: 82,
    elderDeathChance: 0.02,
  },
  horizon: {
    ticksPerYear: 25,
    childMaxAge: 18,
    youngAdultMaxAge: 30,
    adultMaxAge: 80,
    maxAge: 150,
    elderDeathChance: 0.01,
  },
};
