import { SubsystemBase } from '@/core/SubsystemBase';
import type { EventBus } from '@/core/EventBus';
import type { TechTreeState, TechState, TechDefinition, ResourceCost } from '@/types';
import { DAWN_TECHNOLOGIES } from '@/data/technologies/dawn-tech';

/**
 * TechTreeSubsystem
 * Manages available technologies, research progress, prerequisite unlocking,
 * and applying tech effects when research completes.
 */

export class TechTreeSubsystem extends SubsystemBase<TechTreeState> {
  private definitions: Map<string, TechDefinition> = new Map();
  private unsubscribers: (() => void)[] = [];

  /**
   * Callback used to spend resources when research starts.
   * Injected by GameWorld so the subsystem does not hold a direct reference
   * to ResourceSubsystem.
   */
  private spendResources: ((costs: ResourceCost[]) => boolean) | null = null;
  private canAffordCheck: ((costs: ResourceCost[]) => boolean) | null = null;

  /**
   * Callback used to apply effects (modify gather rate, unlock building, etc.).
   * Injected by GameWorld.
   */
  private applyEffect: ((effect: TechDefinition['effects'][number]) => void) | null = null;

  constructor(eventBus: EventBus) {
    super(eventBus, {
      technologies: new Map(),
      currentResearch: null,
      researchProgress: 0,
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  initialize(): void {
    this.loadTechnologies(DAWN_TECHNOLOGIES);
  }

  update(_tickCount: number): void {
    if (!this.state.currentResearch) return;

    const tech = this.state.technologies.get(this.state.currentResearch);
    if (!tech) {
      this.state.currentResearch = null;
      return;
    }

    const def = this.definitions.get(this.state.currentResearch);
    if (!def) return;

    // Increment progress by 1 per tick.
    tech.progress += 1;
    this.state.researchProgress = tech.progress / def.researchTime;

    if (tech.progress >= def.researchTime) {
      this.completeResearch(this.state.currentResearch);
    }
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
  }

  // ── Public API ────────────────────────────────────────────────────

  /** Register the callbacks GameWorld uses to bridge to other subsystems. */
  registerCallbacks(callbacks: {
    spendResources: (costs: ResourceCost[]) => boolean;
    canAfford: (costs: ResourceCost[]) => boolean;
    applyEffect: (effect: TechDefinition['effects'][number]) => void;
  }): void {
    this.spendResources = callbacks.spendResources;
    this.canAffordCheck = callbacks.canAfford;
    this.applyEffect = callbacks.applyEffect;
  }

  /** Begin researching a technology. Returns true if research started. */
  startResearch(techId: string): boolean {
    if (this.state.currentResearch) return false; // already researching

    const tech = this.state.technologies.get(techId);
    if (!tech || !tech.available || tech.researched || tech.researching) return false;

    const def = this.definitions.get(techId);
    if (!def) return false;

    // Affordability check.
    if (def.cost.length > 0) {
      if (!this.canAffordCheck || !this.canAffordCheck(def.cost)) return false;
      if (!this.spendResources || !this.spendResources(def.cost)) return false;
    }

    tech.researching = true;
    tech.progress = 0;
    this.state.currentResearch = techId;
    this.state.researchProgress = 0;

    this.eventBus.emit('tech:started', { techId });
    this.emitStateChange();

    return true;
  }

  /** Immediately unlock a tech (e.g. from an event). */
  unlockTech(techId: string): void {
    const tech = this.state.technologies.get(techId);
    if (!tech || tech.researched) return;

    tech.researched = true;
    tech.researching = false;
    tech.available = true;
    tech.progress = this.definitions.get(techId)?.researchTime ?? 0;

    this.applyTechEffects(techId);
    this.refreshAvailability();

    this.eventBus.emit('tech:researched', { techId });
    this.emitStateChange();
  }

  /** Check if a tech has been researched. */
  isResearched(techId: string): boolean {
    return this.state.technologies.get(techId)?.researched ?? false;
  }

  /** Get all available (but not yet researched) technologies. */
  getAvailableTechs(): TechState[] {
    const result: TechState[] = [];
    for (const tech of this.state.technologies.values()) {
      if (tech.available && !tech.researched) result.push(tech);
    }
    return result;
  }

  /** Get the definition for a tech by id. */
  getDefinition(techId: string): TechDefinition | undefined {
    return this.definitions.get(techId);
  }

  /** Load a set of tech definitions (called when entering a new era). */
  loadTechnologies(techs: TechDefinition[]): void {
    for (const def of techs) {
      this.definitions.set(def.id, def);
      if (!this.state.technologies.has(def.id)) {
        this.state.technologies.set(def.id, {
          id: def.id,
          researched: false,
          researching: false,
          progress: 0,
          available: false,
        });
      }
    }
    this.refreshAvailability();
  }

  // ── Internals ─────────────────────────────────────────────────────

  private completeResearch(techId: string): void {
    const tech = this.state.technologies.get(techId);
    if (!tech) return;

    tech.researched = true;
    tech.researching = false;

    this.state.currentResearch = null;
    this.state.researchProgress = 0;

    this.applyTechEffects(techId);
    this.refreshAvailability();

    this.eventBus.emit('tech:researched', { techId });
    this.emitStateChange();
  }

  private applyTechEffects(techId: string): void {
    const def = this.definitions.get(techId);
    if (!def || !this.applyEffect) return;
    for (const effect of def.effects) {
      this.applyEffect(effect);
    }
  }

  /**
   * Recalculate which techs are available based on prerequisites.
   * A tech becomes available when all its prerequisites are researched.
   */
  private refreshAvailability(): void {
    for (const [id, tech] of this.state.technologies) {
      if (tech.researched || tech.available) continue;

      const def = this.definitions.get(id);
      if (!def) continue;

      const prereqsMet = def.prerequisites.every(prereqId => {
        const prereqTech = this.state.technologies.get(prereqId);
        return prereqTech?.researched ?? false;
      });

      if (prereqsMet) {
        tech.available = true;
        this.eventBus.emit('tech:available', { techId: id });
      }
    }
  }
}
