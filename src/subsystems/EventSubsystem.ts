import { SubsystemBase } from '@/core/SubsystemBase';
import type { EventBus } from '@/core/EventBus';
import type {
  GameEventDefinition,
  ActiveEvent,
  EventConsequence,
  ResourceCost,
} from '@/types';
import { DAWN_EVENTS } from '@/data/events/dawn-events';
import { chance } from '@/utils/math';

/**
 * EventSubsystem
 * Fires narrative events based on triggers (random, population, tech, timed),
 * presents choices to the player, and applies consequences.
 */

// ── Constants ────────────────────────────────────────────────────────

/** Minimum ticks between consecutive events. */
const EVENT_COOLDOWN = 300; // ~30 seconds at 10 tps

/** Base probability of a random event firing each tick (after cooldown). */
const RANDOM_EVENT_CHANCE = 0.003;

export interface EventSubsystemState {
  triggeredEvents: string[];
  activeEvent: ActiveEvent | null;
  eventCooldown: number;
}

export class EventSubsystem extends SubsystemBase<EventSubsystemState> {
  private definitions: GameEventDefinition[] = [];
  private unsubscribers: (() => void)[] = [];

  // ── Caches from other subsystem events ────────────────────────────
  private populationTotal = 0;
  private researchedTechs: Set<string> = new Set();
  private resourceAmounts: Map<string, number> = new Map();

  // ── Callbacks injected by GameWorld ────────────────────────────────
  private spendResources: ((costs: ResourceCost[]) => boolean) | null = null;
  private canAffordCheck: ((costs: ResourceCost[]) => boolean) | null = null;
  private applyConsequence: ((consequence: EventConsequence) => void) | null = null;

  constructor(eventBus: EventBus) {
    super(eventBus, {
      triggeredEvents: [],
      activeEvent: null,
      eventCooldown: 0,
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  initialize(): void {
    this.loadEvents(DAWN_EVENTS);

    this.unsubscribers.push(
      this.eventBus.on('population:changed', ({ total }) => {
        this.populationTotal = total;
      }),
      this.eventBus.on('tech:researched', ({ techId }) => {
        this.researchedTechs.add(techId);
      }),
      this.eventBus.on('resource:changed', ({ resourceId, amount }) => {
        this.resourceAmounts.set(resourceId, amount);
      }),
    );
  }

  update(tickCount: number): void {
    // Decrement cooldown.
    if (this.state.eventCooldown > 0) {
      this.state.eventCooldown -= 1;
      return;
    }

    // Don't fire a new event while one is active.
    if (this.state.activeEvent) return;

    // Check if any event should fire this tick.
    if (!chance(RANDOM_EVENT_CHANCE)) return;

    const eligible = this.getEligibleEvents(tickCount);
    if (eligible.length === 0) return;

    const chosen = this.weightedSelect(eligible);
    if (chosen) {
      this.fireEvent(chosen, tickCount);
    }
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
  }

  // ── Public API ────────────────────────────────────────────────────

  /** Register callbacks that bridge to other subsystems. */
  registerCallbacks(callbacks: {
    spendResources: (costs: ResourceCost[]) => boolean;
    canAfford: (costs: ResourceCost[]) => boolean;
    applyConsequence: (consequence: EventConsequence) => void;
  }): void {
    this.spendResources = callbacks.spendResources;
    this.canAffordCheck = callbacks.canAfford;
    this.applyConsequence = callbacks.applyConsequence;
  }

  /** Player chooses a response to the active event. */
  resolveEvent(choiceId: string): boolean {
    const active = this.state.activeEvent;
    if (!active || active.resolved) return false;

    const choice = active.definition.choices.find(c => c.id === choiceId);
    if (!choice) return false;

    // Check choice requirements (resource costs).
    if (choice.requirements && choice.requirements.length > 0) {
      if (!this.canAffordCheck || !this.canAffordCheck(choice.requirements)) return false;
      if (!this.spendResources || !this.spendResources(choice.requirements)) return false;
    }

    // Apply consequences.
    if (this.applyConsequence) {
      for (const consequence of choice.consequences) {
        this.applyConsequence(consequence);
      }
    }

    active.resolved = true;
    active.choiceMade = choiceId;

    this.eventBus.emit('gameEvent:choiceMade', {
      eventId: active.definition.id,
      choiceId,
    });

    // Clear active event after a brief display period (handled by UI).
    this.state.activeEvent = null;
    this.state.eventCooldown = EVENT_COOLDOWN;
    this.emitStateChange();

    return true;
  }

  /** Load event definitions (called when entering a new era). */
  loadEvents(events: GameEventDefinition[]): void {
    // Avoid duplicates.
    const existingIds = new Set(this.definitions.map(d => d.id));
    for (const evt of events) {
      if (!existingIds.has(evt.id)) {
        this.definitions.push(evt);
      }
    }
  }

  /** Check whether a specific event has already been triggered. */
  wasTriggered(eventId: string): boolean {
    return this.state.triggeredEvents.includes(eventId);
  }

  /** Get the currently active event (if any). */
  getActiveEvent(): Readonly<ActiveEvent> | null {
    return this.state.activeEvent;
  }

  // ── Internals ─────────────────────────────────────────────────────

  private fireEvent(def: GameEventDefinition, tickCount: number): void {
    this.state.activeEvent = {
      definition: def,
      triggeredAt: tickCount,
      resolved: false,
    };

    if (def.unique) {
      this.state.triggeredEvents.push(def.id);
    }

    this.eventBus.emit('gameEvent:triggered', { eventId: def.id });
    this.emitStateChange();
  }

  private getEligibleEvents(tickCount: number): GameEventDefinition[] {
    return this.definitions.filter(def => {
      // Skip already-triggered unique events.
      if (def.unique && this.state.triggeredEvents.includes(def.id)) return false;

      // Check prerequisite tech.
      if (def.prerequisiteTech && !this.researchedTechs.has(def.prerequisiteTech)) return false;

      // Check trigger conditions.
      return this.isTriggerMet(def, tickCount);
    });
  }

  private isTriggerMet(def: GameEventDefinition, tickCount: number): boolean {
    const trigger = def.trigger;
    const cond = trigger.condition;

    switch (trigger.type) {
      case 'random':
        // Random events are always eligible (filtered by weight).
        // Optional tick window restrictions.
        if (cond?.maxTick != null && tickCount > cond.maxTick) return false;
        if (cond?.minTick != null && tickCount < cond.minTick) return false;
        return true;

      case 'population_threshold':
        if (!cond || cond.value == null) return false;
        return this.populationTotal >= cond.value;

      case 'tech_unlock':
        if (!cond || !cond.target) return false;
        return this.researchedTechs.has(cond.target);

      case 'resource_threshold':
        if (!cond || !cond.target || cond.value == null) return false;
        return (this.resourceAmounts.get(cond.target) ?? 0) >= cond.value;

      case 'timed':
        if (!cond) return false;
        if (cond.minTick != null && tickCount < cond.minTick) return false;
        if (cond.maxTick != null && tickCount > cond.maxTick) return false;
        return true;

      default:
        return false;
    }
  }

  private weightedSelect(events: GameEventDefinition[]): GameEventDefinition | null {
    const totalWeight = events.reduce((sum, e) => sum + e.weight, 0);
    if (totalWeight === 0) return null;

    let roll = Math.random() * totalWeight;
    for (const evt of events) {
      roll -= evt.weight;
      if (roll <= 0) return evt;
    }
    return events[events.length - 1] ?? null;
  }
}
