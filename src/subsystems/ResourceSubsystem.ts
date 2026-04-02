import { SubsystemBase } from '@/core/SubsystemBase';
import type { EventBus } from '@/core/EventBus';
import type { ResourceState, ResourceCost, ResourceDefinition } from '@/types';
import { RESOURCES, getResourcesForEra } from '@/data/resources';
import { clamp } from '@/utils/math';

/**
 * ResourceSubsystem
 * Owns every resource the player can gather, store, and spend. Each tick it
 * applies gather rates (scaled by worker counts), decay, and storage caps.
 */

export interface ResourceSubsystemState {
  resources: Map<string, ResourceState>;
}

/** Internal tracking of workers per role that produce a resource. */
interface WorkerCache {
  gatherers: number; // gathers berries, wood, flint
  hunters: number;   // gathers meat, hides
}

export class ResourceSubsystem extends SubsystemBase<ResourceSubsystemState> {
  private definitions: Map<string, ResourceDefinition> = new Map();
  private workers: WorkerCache = { gatherers: 0, hunters: 0 };
  private unsubscribers: (() => void)[] = [];

  /** Externally applied rate modifiers (tech effects, buildings, seasons). */
  private gatherModifiers: Map<string, number> = new Map();
  /** Extra storage granted by buildings / techs. */
  private storageModifiers: Map<string, number> = new Map();
  /** Decay reductions from buildings. */
  private decayReductions: Map<string, number> = new Map();

  constructor(eventBus: EventBus) {
    super(eventBus, { resources: new Map() });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  initialize(): void {
    this.loadResourcesForEra('dawn');

    this.unsubscribers.push(
      this.eventBus.on('population:roleAssigned', ({ role, count }) => {
        if (role === 'gatherer') this.workers.gatherers = count;
        if (role === 'hunter') this.workers.hunters = count;
      }),
    );
  }

  update(_tickCount: number): void {
    for (const [id, res] of this.state.resources) {
      const def = this.definitions.get(id);
      if (!def) continue;

      const previousAmount = res.amount;

      // ── Production ────────────────────────────────────────────
      const workerCount = this.getWorkerCountForResource(id);
      const modifier = this.gatherModifiers.get(id) ?? 0;
      const effectiveRate = (def.baseGatherRate + modifier) * workerCount;
      res.gatherRate = effectiveRate;

      res.amount += effectiveRate;

      // ── Decay ─────────────────────────────────────────────────
      if (def.storageDecay && def.storageDecay > 0 && res.amount > 0) {
        const reduction = this.decayReductions.get(id) ?? 0;
        const effectiveDecay = Math.max(0, def.storageDecay - reduction);
        res.amount -= res.amount * effectiveDecay;
      }

      // ── Storage cap ───────────────────────────────────────────
      const extraStorage = this.storageModifiers.get(id) ?? 0;
      res.maxStorage = def.maxStorage + extraStorage;
      res.amount = clamp(res.amount, 0, res.maxStorage);

      // ── Emit changes ──────────────────────────────────────────
      const delta = res.amount - previousAmount;
      if (Math.abs(delta) > 0.001) {
        this.eventBus.emit('resource:changed', {
          resourceId: id,
          amount: res.amount,
          delta,
        });
      }

      if (res.amount <= 0 && previousAmount > 0) {
        this.eventBus.emit('resource:depleted', { resourceId: id });
      }
    }
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
  }

  // ── Public API ────────────────────────────────────────────────────

  /** Load (or reload) the resource set for a given era. Existing amounts are preserved. */
  loadResourcesForEra(eraId: string): void {
    const defs = getResourcesForEra(eraId);
    for (const def of defs) {
      this.definitions.set(def.id, def);
      if (!this.state.resources.has(def.id)) {
        this.state.resources.set(def.id, {
          id: def.id,
          amount: 0,
          maxStorage: def.maxStorage,
          gatherRate: 0,
          consumers: 0,
        });
      }
    }
  }

  /** Add an amount of a resource (clamped to storage). */
  addResource(resourceId: string, amount: number): void {
    const res = this.state.resources.get(resourceId);
    if (!res) return;
    const previous = res.amount;
    res.amount = clamp(res.amount + amount, 0, res.maxStorage);
    const delta = res.amount - previous;
    if (Math.abs(delta) > 0.001) {
      this.eventBus.emit('resource:changed', { resourceId, amount: res.amount, delta });
    }
  }

  /** Remove an amount of a resource. Returns the actual amount removed. */
  removeResource(resourceId: string, amount: number): number {
    const res = this.state.resources.get(resourceId);
    if (!res) return 0;
    const removed = Math.min(res.amount, amount);
    res.amount -= removed;
    if (removed > 0.001) {
      this.eventBus.emit('resource:changed', { resourceId, amount: res.amount, delta: -removed });
    }
    if (res.amount <= 0) {
      this.eventBus.emit('resource:depleted', { resourceId });
    }
    return removed;
  }

  /** Check whether the player can pay a list of resource costs. */
  canAfford(costs: ResourceCost[]): boolean {
    for (const cost of costs) {
      const res = this.state.resources.get(cost.resourceId);
      if (!res || res.amount < cost.amount) return false;
    }
    return true;
  }

  /** Spend resources. Returns true if successful, false if not affordable. */
  spend(costs: ResourceCost[]): boolean {
    if (!this.canAfford(costs)) return false;
    for (const cost of costs) {
      this.removeResource(cost.resourceId, cost.amount);
    }
    return true;
  }

  /** Get the current amount of a resource. */
  getAmount(resourceId: string): number {
    return this.state.resources.get(resourceId)?.amount ?? 0;
  }

  /** Get the ResourceState for a specific resource. */
  getResourceState(resourceId: string): Readonly<ResourceState> | undefined {
    return this.state.resources.get(resourceId);
  }

  // ── Modifier API (called by TechTree, Buildings, Environment) ─────

  /** Apply an additive gather-rate modifier (e.g. from tech effects). */
  applyGatherModifier(resourceId: string, delta: number): void {
    const current = this.gatherModifiers.get(resourceId) ?? 0;
    this.gatherModifiers.set(resourceId, current + delta);
  }

  /** Apply an additive storage modifier. */
  applyStorageModifier(resourceId: string, delta: number): void {
    const current = this.storageModifiers.get(resourceId) ?? 0;
    this.storageModifiers.set(resourceId, current + delta);
  }

  /** Apply a decay reduction for a resource. */
  applyDecayReduction(resourceId: string, delta: number): void {
    const current = this.decayReductions.get(resourceId) ?? 0;
    this.decayReductions.set(resourceId, current + delta);
  }

  // ── Internals ─────────────────────────────────────────────────────

  /**
   * Map resource ids to the worker counts that produce them.
   * gatherers  -> berries, wood, flint, herbs
   * hunters    -> meat, hides
   */
  private getWorkerCountForResource(resourceId: string): number {
    switch (resourceId) {
      case 'berries':
      case 'wood':
      case 'flint':
      case 'herbs':
      case 'fish':
        return this.workers.gatherers;
      case 'meat':
      case 'hides':
        return this.workers.hunters;
      case 'ceramics':
        // Produced by artisans — future expansion.
        return 0;
      default:
        return 0;
    }
  }
}
