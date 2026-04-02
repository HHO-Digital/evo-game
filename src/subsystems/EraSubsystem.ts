import { SubsystemBase } from '@/core/SubsystemBase';
import type { EventBus } from '@/core/EventBus';
import type { EraId, EraProgression, Milestone, EraDefinition } from '@/types';
import { DAWN_ERA } from '@/data/eras/dawn';
import { AWAKENING_ERA } from '@/data/eras/awakening';

/**
 * EraSubsystem
 * Tracks the current era, monitors milestone completion, and orchestrates
 * transitions between eras when the player meets all required milestones.
 *
 * Supports gradual era blending: as milestones are completed, eraBlendProgress
 * increases from 0.0 to 1.0, driving smooth visual interpolation between
 * the current era and the next era.
 */

const ERA_SEQUENCE: EraId[] = [
  'dawn', 'awakening', 'roots', 'forge', 'empire',
  'convergence', 'enlightenment', 'revolution', 'modern', 'horizon',
];

const ERA_DEFINITIONS: Record<string, EraDefinition> = {
  dawn: DAWN_ERA,
  awakening: AWAKENING_ERA,
};

export class EraSubsystem extends SubsystemBase<EraProgression> {
  // ── Caches updated via events ─────────────────────────────────────
  private populationTotal = 0;
  private researchedTechs: Set<string> = new Set();
  private resourceAmounts: Map<string, number> = new Map();

  // ── Event unsubscribers ───────────────────────────────────────────
  private unsubscribers: (() => void)[] = [];

  /** The last emitted blend progress, used to avoid redundant events. */
  private lastEmittedBlend = 0;

  constructor(eventBus: EventBus) {
    super(eventBus, {
      currentEra: 'dawn',
      milestones: [],
      canAdvance: false,
      completedEras: [],
      eraBlendProgress: 0,
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  initialize(): void {
    this.loadEraMilestones('dawn');

    this.unsubscribers.push(
      this.eventBus.on('tech:researched', ({ techId }) => {
        this.researchedTechs.add(techId);
        this.checkMilestones();
      }),
      this.eventBus.on('population:changed', ({ total }) => {
        this.populationTotal = total;
        this.checkMilestones();
      }),
      this.eventBus.on('resource:changed', ({ resourceId, amount }) => {
        this.resourceAmounts.set(resourceId, amount);
        this.checkMilestones();
      }),
    );
  }

  update(_tickCount: number): void {
    // Milestone checking is event-driven; nothing to poll each tick.
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
  }

  // ── Public API ────────────────────────────────────────────────────

  /** Attempt to advance to the next era. Returns true on success. */
  advanceEra(): boolean {
    if (!this.state.canAdvance) return false;

    const currentIndex = ERA_SEQUENCE.indexOf(this.state.currentEra);
    if (currentIndex === -1 || currentIndex >= ERA_SEQUENCE.length - 1) return false;

    const nextEra = ERA_SEQUENCE[currentIndex + 1];
    const previousEra = this.state.currentEra;

    this.state.completedEras.push(previousEra);
    this.state.currentEra = nextEra;
    this.state.canAdvance = false;
    // Reset blend progress for the new era
    this.state.eraBlendProgress = 0;
    this.lastEmittedBlend = 0;

    this.loadEraMilestones(nextEra);

    this.eventBus.emit('era:advance', { from: previousEra, to: nextEra });
    this.emitStateChange();

    return true;
  }

  /** Get the full definition for the current era (if loaded). */
  getCurrentEraDefinition(): EraDefinition | undefined {
    return ERA_DEFINITIONS[this.state.currentEra];
  }

  /**
   * Get the current blend progress (0.0 = fully current era, 1.0 = ready for next).
   * Used by the rendering layer to drive visual interpolation.
   */
  getBlendProgress(): number {
    return this.state.eraBlendProgress;
  }

  /**
   * Get the ID of the next era in the sequence, or null if at the last era.
   */
  getNextEraId(): EraId | null {
    const currentIndex = ERA_SEQUENCE.indexOf(this.state.currentEra);
    if (currentIndex === -1 || currentIndex >= ERA_SEQUENCE.length - 1) return null;
    return ERA_SEQUENCE[currentIndex + 1];
  }

  // ── Internal helpers ──────────────────────────────────────────────

  private loadEraMilestones(eraId: EraId): void {
    const def = ERA_DEFINITIONS[eraId];
    if (!def) {
      console.warn(`[EraSubsystem] No definition found for era "${eraId}"`);
      this.state.milestones = [];
      return;
    }
    // Deep-copy milestones so we don't mutate the definition.
    this.state.milestones = def.milestones.map(m => ({
      ...m,
      completed: false,
    }));
  }

  private checkMilestones(): void {
    let anyChanged = false;

    for (const milestone of this.state.milestones) {
      if (milestone.completed) continue;

      if (this.isMilestoneComplete(milestone)) {
        milestone.completed = true;
        anyChanged = true;
        this.eventBus.emit('era:milestoneCompleted', {
          eraId: this.state.currentEra,
          milestoneId: milestone.id,
        });
      }
    }

    if (anyChanged) {
      const requiredMilestones = this.state.milestones.filter(m => m.required);
      const allRequiredDone = requiredMilestones.every(m => m.completed);

      if (allRequiredDone && !this.state.canAdvance) {
        this.state.canAdvance = true;
      }

      // ── Update blend progress ────────────────────────────────────
      this.updateBlendProgress();

      this.emitStateChange();
    }
  }

  /**
   * Recalculate era blend progress based on milestone completion ratio.
   * Progress = completedMilestones / totalMilestones (all milestones, not just required).
   * Emits 'era:blendChanged' when the progress changes meaningfully.
   */
  private updateBlendProgress(): void {
    const total = this.state.milestones.length;
    if (total === 0) {
      this.state.eraBlendProgress = 0;
      return;
    }

    const completed = this.state.milestones.filter(m => m.completed).length;
    const newProgress = completed / total;

    this.state.eraBlendProgress = newProgress;

    // Only emit if the change is meaningful (avoid spamming for tiny floating-point diffs)
    const BLEND_EPSILON = 0.001;
    if (Math.abs(newProgress - this.lastEmittedBlend) > BLEND_EPSILON) {
      this.lastEmittedBlend = newProgress;

      const nextEra = this.getNextEraId();
      if (nextEra) {
        this.eventBus.emit('era:blendChanged', {
          progress: newProgress,
          currentEra: this.state.currentEra,
          nextEra,
        });
      }
    }
  }

  private isMilestoneComplete(milestone: Milestone): boolean {
    return this.checkRequirement(milestone.requirement);
  }

  private checkRequirement(req: Milestone['requirement']): boolean {
    switch (req.type) {
      case 'technology':
        return req.target != null && this.researchedTechs.has(req.target);

      case 'population':
        return req.value != null && this.populationTotal >= req.value;

      case 'resource':
        if (req.target == null || req.value == null) return false;
        return (this.resourceAmounts.get(req.target) ?? 0) >= req.value;

      case 'building':
        // Building milestone support can be expanded later.
        return false;

      case 'event':
        // Event milestone support can be expanded later.
        return false;

      case 'composite':
        if (!req.children || req.children.length === 0) return false;
        return req.children.every(child => this.checkRequirement(child));

      default:
        return false;
    }
  }
}
