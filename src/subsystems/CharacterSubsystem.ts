import { SubsystemBase } from '@/core/SubsystemBase';
import type { EventBus } from '@/core/EventBus';
import type { PlayerCharacter, StatId, CharacterStats } from '@/types';
import { clamp, randomInt } from '@/utils/math';

/**
 * CharacterSubsystem
 * Manages the player's character — stats, XP, levelling, and appearance
 * changes that reflect the current era and accomplishments.
 */

/** XP required for each successive level (constant for simplicity). */
const XP_PER_LEVEL = 100;

/** Passive XP gained per tick when at least one worker is assigned. */
const PASSIVE_XP_PER_TICK = 0.05;

/** Ticks between passive XP grants. */
const PASSIVE_XP_INTERVAL = 10;

const STAT_KEYS: StatId[] = ['strength', 'intelligence', 'charisma', 'wisdom', 'adaptability'];

export class CharacterSubsystem extends SubsystemBase<PlayerCharacter> {
  private unsubscribers: (() => void)[] = [];

  /** Cached total active (non-idle) workers — used for passive XP. */
  private activeWorkers = 0;

  constructor(eventBus: EventBus) {
    super(eventBus, {
      name: 'Elder',
      era: 'dawn',
      stats: {
        strength: 5,
        intelligence: 5,
        charisma: 5,
        wisdom: 5,
        adaptability: 5,
      },
      appearance: {
        bodyType: 'sturdy',
        clothing: ['loincloth'],
        accessories: [],
        heldItems: ['walking_stick'],
        stance: 'standing',
      },
      title: 'Elder',
      xp: 0,
      level: 1,
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  initialize(): void {
    this.unsubscribers.push(
      this.eventBus.on('tech:researched', () => {
        this.boostStat('intelligence', 1);
        this.gainXP(15, 'tech_research');
      }),
      this.eventBus.on('gameEvent:choiceMade', ({ choiceId }) => {
        // Award XP for making narrative decisions.
        this.gainXP(10, `event_choice:${choiceId}`);
      }),
      this.eventBus.on('population:roleAssigned', ({ role, count }) => {
        if (role !== 'idle') {
          // Keep a running tally — this is approximate; a precise sum would
          // require all role events, but the main gameplay loops ensure the
          // subsystem eventually converges.
          this.activeWorkers = Math.max(this.activeWorkers, count);
        }
      }),
      this.eventBus.on('era:advance', ({ to }) => {
        this.state.era = to as PlayerCharacter['era'];
        this.gainXP(50, 'era_advance');
      }),
    );
  }

  update(tickCount: number): void {
    // Passive XP from having workers doing things.
    if (tickCount % PASSIVE_XP_INTERVAL === 0 && this.activeWorkers > 0) {
      const amount = PASSIVE_XP_PER_TICK * this.activeWorkers;
      this.gainXP(amount, 'passive');
    }
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
  }

  // ── Public API ────────────────────────────────────────────────────

  /** Award XP and level up if the threshold is crossed. */
  gainXP(amount: number, source: string): void {
    if (amount <= 0) return;

    this.state.xp += amount;
    this.eventBus.emit('character:xpGained', { amount, source });

    // Level-up loop (in case a large XP grant crosses multiple levels).
    while (this.state.xp >= this.state.level * XP_PER_LEVEL) {
      this.state.xp -= this.state.level * XP_PER_LEVEL;
      this.state.level += 1;

      // Boost a random stat on level-up.
      const statKey = STAT_KEYS[randomInt(0, STAT_KEYS.length - 1)];
      this.boostStat(statKey, 1);

      this.eventBus.emit('character:levelUp', {
        stat: statKey,
        newValue: this.state.stats[statKey],
      });
    }

    this.emitStateChange();
  }

  /** Increase a specific stat. */
  boostStat(stat: StatId, amount: number): void {
    this.state.stats[stat] = clamp(this.state.stats[stat] + amount, 0, 99);
  }

  /** Get the value of a specific stat. */
  getStat(stat: StatId): number {
    return this.state.stats[stat];
  }

  /** Update the character's title. */
  setTitle(title: string): void {
    this.state.title = title;
  }

  /** Update appearance (e.g. when era changes). */
  updateAppearance(changes: Partial<PlayerCharacter['appearance']>): void {
    Object.assign(this.state.appearance, changes);
    this.emitStateChange();
  }
}
