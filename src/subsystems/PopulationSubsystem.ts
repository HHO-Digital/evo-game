import { SubsystemBase } from '@/core/SubsystemBase';
import type { EventBus } from '@/core/EventBus';
import type { PopulationState, PopulationGroup, RoleId } from '@/types';
import { clamp } from '@/utils/math';

/**
 * PopulationSubsystem
 * Manages the tribe's headcount, role assignments, happiness, health,
 * and growth/starvation driven by food availability.
 */

/** How much food one person consumes per tick (berries or meat). */
const FOOD_PER_PERSON_PER_TICK = 0.05;

/** Minimum ticks between natural growth checks. */
const GROWTH_CHECK_INTERVAL = 50; // every 5 seconds at 10 tps

/** Happiness lost per tick when food is depleted. */
const STARVATION_HAPPINESS_LOSS = 0.5;

/** Health lost per tick when happiness is critically low (< 20). */
const CRITICAL_HEALTH_LOSS = 0.3;

/** Population dies when health reaches this threshold. */
const DEATH_HEALTH_THRESHOLD = 10;

export class PopulationSubsystem extends SubsystemBase<PopulationState> {
  private unsubscribers: (() => void)[] = [];

  // ── Food cache updated via events ─────────────────────────────────
  private foodBerries = 0;
  private foodMeat = 0;

  // ── Extra capacity from tech / buildings ──────────────────────────
  private bonusCapacity = 0;

  constructor(eventBus: EventBus) {
    super(eventBus, {
      total: 5,
      capacity: 10,
      groups: [
        { role: 'idle', count: 3, efficiency: 1 },
        { role: 'gatherer', count: 2, efficiency: 1 },
      ],
      happiness: 70,
      health: 80,
      growthRate: 0,
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  initialize(): void {
    // Broadcast initial role counts so ResourceSubsystem can cache them.
    for (const g of this.state.groups) {
      this.eventBus.emit('population:roleAssigned', { role: g.role, count: g.count });
    }
    this.eventBus.emit('population:changed', { total: this.state.total, delta: 0 });

    this.unsubscribers.push(
      this.eventBus.on('resource:changed', ({ resourceId, amount }) => {
        if (resourceId === 'berries') this.foodBerries = amount;
        if (resourceId === 'meat') this.foodMeat = amount;
      }),
    );
  }

  update(tickCount: number): void {
    // ── Food consumption ────────────────────────────────────────
    const totalConsumption = this.state.total * FOOD_PER_PERSON_PER_TICK;
    const totalFood = this.foodBerries + this.foodMeat;
    const isStarving = totalFood < totalConsumption;

    // We don't directly mutate resources — the ResourceSubsystem handles
    // that via its own update. Instead, we track the *consumers* count on
    // the resource state by emitting role counts. The actual deduction
    // happens here by emitting resource change requests. For simplicity we
    // model consumption as an effect on happiness/health when food is low.

    if (isStarving) {
      this.state.happiness = Math.max(0, this.state.happiness - STARVATION_HAPPINESS_LOSS);
    } else if (this.state.happiness < 70) {
      // Slowly recover happiness when well-fed.
      this.state.happiness = Math.min(100, this.state.happiness + 0.1);
    }

    // ── Health ──────────────────────────────────────────────────
    if (this.state.happiness < 20) {
      this.state.health = Math.max(0, this.state.health - CRITICAL_HEALTH_LOSS);
    } else if (this.state.health < 80 && !isStarving) {
      this.state.health = Math.min(100, this.state.health + 0.05);
    }

    // ── Death from low health ───────────────────────────────────
    if (this.state.health <= DEATH_HEALTH_THRESHOLD && this.state.total > 1) {
      this.changePopulation(-1);
    }

    // ── Natural growth ──────────────────────────────────────────
    if (tickCount % GROWTH_CHECK_INTERVAL === 0) {
      this.state.capacity = 10 + this.bonusCapacity;
      const foodSurplus = totalFood - totalConsumption * GROWTH_CHECK_INTERVAL;
      const hasRoom = this.state.total < this.state.capacity;
      const isHealthy = this.state.health > 50 && this.state.happiness > 40;

      if (foodSurplus > 0 && hasRoom && isHealthy) {
        // Growth chance proportional to surplus / population.
        const growthChance = clamp(foodSurplus / (this.state.total * 5), 0, 0.6);
        this.state.growthRate = growthChance;
        if (Math.random() < growthChance) {
          this.changePopulation(1);
        }
      } else {
        this.state.growthRate = 0;
      }
    }
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Reassign `count` people from one role to another.
   * Returns the number actually reassigned.
   */
  assignRole(fromRole: RoleId, toRole: RoleId, count: number): number {
    if (count <= 0) return 0;

    const fromGroup = this.getOrCreateGroup(fromRole);
    const actual = Math.min(count, fromGroup.count);
    if (actual === 0) return 0;

    fromGroup.count -= actual;

    const toGroup = this.getOrCreateGroup(toRole);
    toGroup.count += actual;

    // Emit updated counts for both roles.
    this.eventBus.emit('population:roleAssigned', { role: fromRole, count: fromGroup.count });
    this.eventBus.emit('population:roleAssigned', { role: toRole, count: toGroup.count });
    this.emitStateChange();

    return actual;
  }

  /** Directly change population (positive = grow, negative = die). */
  changePopulation(delta: number): void {
    if (delta === 0) return;

    const previous = this.state.total;
    this.state.total = Math.max(1, this.state.total + delta);

    // When population shrinks, remove from idle first, then largest group.
    if (delta < 0) {
      let remaining = Math.abs(delta);
      // Prefer removing idle.
      const idle = this.getOrCreateGroup('idle');
      const fromIdle = Math.min(remaining, idle.count);
      idle.count -= fromIdle;
      remaining -= fromIdle;
      // Remove from largest group if needed.
      while (remaining > 0) {
        const largest = this.state.groups
          .filter(g => g.count > 0)
          .sort((a, b) => b.count - a.count)[0];
        if (!largest) break;
        const take = Math.min(remaining, largest.count);
        largest.count -= take;
        remaining -= take;
        this.eventBus.emit('population:roleAssigned', { role: largest.role, count: largest.count });
      }
      if (fromIdle > 0) {
        this.eventBus.emit('population:roleAssigned', { role: 'idle', count: idle.count });
      }
    } else {
      // New arrivals start as idle.
      const idle = this.getOrCreateGroup('idle');
      idle.count += delta;
      this.eventBus.emit('population:roleAssigned', { role: 'idle', count: idle.count });
    }

    this.eventBus.emit('population:changed', {
      total: this.state.total,
      delta: this.state.total - previous,
    });
    this.emitStateChange();
  }

  /** Modify happiness directly (clamped 0-100). */
  modifyHappiness(delta: number): void {
    this.state.happiness = clamp(this.state.happiness + delta, 0, 100);
  }

  /** Modify health directly (clamped 0-100). */
  modifyHealth(delta: number): void {
    this.state.health = clamp(this.state.health + delta, 0, 100);
  }

  /** Apply bonus population capacity from tech or buildings. */
  addBonusCapacity(amount: number): void {
    this.bonusCapacity += amount;
    this.state.capacity = 10 + this.bonusCapacity;
  }

  /** Get count for a specific role. */
  getRoleCount(role: RoleId): number {
    return this.state.groups.find(g => g.role === role)?.count ?? 0;
  }

  /** Get total food consumption per tick. */
  getConsumptionPerTick(): number {
    return this.state.total * FOOD_PER_PERSON_PER_TICK;
  }

  // ── Internals ─────────────────────────────────────────────────────

  private getOrCreateGroup(role: RoleId): PopulationGroup {
    let group = this.state.groups.find(g => g.role === role);
    if (!group) {
      group = { role, count: 0, efficiency: 1 };
      this.state.groups.push(group);
    }
    return group;
  }
}
