import { EventBus } from './EventBus';
import { GameLoop } from './GameLoop';
import { SaveManager } from './SaveManager';
import { SceneManager } from '@/rendering/SceneManager';
import { UIManager } from '@/ui/UIManager';

import { EraSubsystem } from '@/subsystems/EraSubsystem';
import { ResourceSubsystem } from '@/subsystems/ResourceSubsystem';
import { PopulationSubsystem } from '@/subsystems/PopulationSubsystem';
import { TechTreeSubsystem } from '@/subsystems/TechTreeSubsystem';
import { CharacterSubsystem } from '@/subsystems/CharacterSubsystem';
import { EnvironmentSubsystem } from '@/subsystems/EnvironmentSubsystem';
import { EventSubsystem } from '@/subsystems/EventSubsystem';
import { NPCSubsystem } from '@/subsystems/NPCSubsystem';

import type { SubsystemBase } from './SubsystemBase';
import type { TechEffect, EventConsequence, EraId } from '@/types';

/**
 * GameWorld – the master orchestrator.
 *
 * Owns every subsystem, the game loop, the rendering layer, and the UI layer.
 * It wires cross-subsystem callbacks and routes data from subsystems to UI.
 */
export class GameWorld {
  readonly eventBus = new EventBus();
  private gameLoop: GameLoop;
  private sceneManager: SceneManager;
  private uiManager: UIManager;
  private saveManager: SaveManager;

  // Subsystems (ordered by dependency)
  private era: EraSubsystem;
  private resources: ResourceSubsystem;
  private population: PopulationSubsystem;
  private techTree: TechTreeSubsystem;
  private character: CharacterSubsystem;
  private environment: EnvironmentSubsystem;
  private events: EventSubsystem;
  private npcs: NPCSubsystem;

  private subsystems: SubsystemBase<unknown>[] = [];

  /** Tick counter used for periodic UI pushes. */
  private uiRefreshCounter = 0;
  private static readonly UI_REFRESH_INTERVAL = 5; // every 5 ticks = 0.5s

  constructor() {
    // Subsystems
    this.era = new EraSubsystem(this.eventBus);
    this.resources = new ResourceSubsystem(this.eventBus);
    this.population = new PopulationSubsystem(this.eventBus);
    this.techTree = new TechTreeSubsystem(this.eventBus);
    this.character = new CharacterSubsystem(this.eventBus);
    this.environment = new EnvironmentSubsystem(this.eventBus);
    this.events = new EventSubsystem(this.eventBus);
    this.npcs = new NPCSubsystem(this.eventBus);

    this.subsystems = [
      this.era,
      this.resources,
      this.population,
      this.techTree,
      this.character,
      this.environment,
      this.events,
      this.npcs,
    ];

    // Rendering & UI
    this.sceneManager = new SceneManager(this.eventBus);
    this.uiManager = new UIManager(this.eventBus);
    this.saveManager = new SaveManager();

    // Game loop
    this.gameLoop = new GameLoop(
      (tick) => this.update(tick),
      (alpha) => this.render(alpha),
    );
  }

  // ─── Initialization ────────────────────────────────────────────────

  async initialize(): Promise<void> {
    // Init save system
    await this.saveManager.initialize();

    // Init PixiJS rendering
    await this.sceneManager.init();

    // Init all subsystems
    for (const sub of this.subsystems) {
      sub.initialize();
    }

    // Wire cross-subsystem callbacks
    this.wireCallbacks();

    // Wire event-driven bridges
    this.wireEventBridges();

    // Init UI
    this.uiManager.initialize();

    // Push initial state to UI
    this.refreshAllUI();

    // Show main menu first
    this.sceneManager.switchTo('mainMenu');

    // Listen for "start game" from main menu
    this.eventBus.on('ui:panelOpened', ({ panelId }) => {
      if (panelId === 'mainMenu') {
        this.addStartButton();
      }
    });

    // Add start button now (main menu is already showing)
    this.addStartButton();

    // Start the loop
    this.gameLoop.start();
  }

  // ─── Main loop callbacks ───────────────────────────────────────────

  private update(tickCount: number): void {
    for (const sub of this.subsystems) {
      sub.update(tickCount);
    }

    // Periodic UI refresh
    this.uiRefreshCounter++;
    if (this.uiRefreshCounter >= GameWorld.UI_REFRESH_INTERVAL) {
      this.uiRefreshCounter = 0;
      this.refreshAllUI();
    }
  }

  private render(alpha: number): void {
    this.sceneManager.render(alpha);
  }

  // ─── Cross-subsystem wiring ────────────────────────────────────────

  private wireCallbacks(): void {
    // TechTree needs to spend resources and apply effects
    this.techTree.registerCallbacks({
      spendResources: (costs) => this.resources.spend(costs),
      canAfford: (costs) => this.resources.canAfford(costs),
      applyEffect: (effect) => this.applyTechEffect(effect),
    });

    // EventSubsystem needs to spend resources and apply consequences
    this.events.registerCallbacks({
      spendResources: (costs) => this.resources.spend(costs),
      canAfford: (costs) => this.resources.canAfford(costs),
      applyConsequence: (consequence) => this.applyEventConsequence(consequence),
    });
  }

  private wireEventBridges(): void {
    // When a game event fires, show it in the UI and pause
    this.eventBus.on('gameEvent:triggered', ({ eventId }) => {
      const active = this.events.getActiveEvent();
      if (active) {
        this.gameLoop.pause();
        this.uiManager.showGameEvent(active.definition);
      }
    });

    // When player makes a choice, resolve the event and resume
    this.eventBus.on('gameEvent:choiceMade', ({ eventId, choiceId }) => {
      this.gameLoop.resume();
    });

    // When era advance button is clicked
    this.eventBus.on('era:advance', ({ from, to }) => {
      // The EraSubsystem has already updated state.
      // Clear any inline CSS blend overrides so the new era's CSS class
      // takes full control of theming after the transition.
      const overlay = document.getElementById('ui-overlay');
      if (overlay) {
        overlay.style.removeProperty('--era-primary');
        overlay.style.removeProperty('--era-secondary');
        overlay.style.removeProperty('--era-border');
      }
      this.lastUIBlend = 0;

      // Play a slow cinematic transition, then update visuals.
      const eraDef = this.era.getCurrentEraDefinition();
      const eraName = eraDef?.name ?? to;
      const subtitle = eraDef?.subtitle ?? '';
      this.sceneManager.playEraTransition(eraName, subtitle, to as EraId);
      this.resources.loadResourcesForEra(to);
    });

    // UI speed controls
    this.eventBus.on('ui:speedChanged', ({ speed }) => {
      this.gameLoop.setSpeed(speed);
    });

    // Pause/resume from UI
    this.eventBus.on('game:paused', () => this.gameLoop.pause());
    this.eventBus.on('game:resumed', () => this.gameLoop.resume());

    // Tech started from UI click
    this.eventBus.on('tech:started', ({ techId }) => {
      this.techTree.startResearch(techId);
    });

    // Population role assignment from UI
    this.eventBus.on('population:roleAssigned', ({ role, count }) => {
      // This is already handled internally by PopulationSubsystem and
      // ResourceSubsystem via their event listeners.
    });

    // ── Gradual era blending ──────────────────────────────────────
    // As the player completes milestones, the blend progress increases.
    // When it exceeds 0.7, start fading the CSS theme toward the next era
    // so the UI panels subtly shift their border / accent colors before
    // the cinematic plays.
    this.eventBus.on('era:blendChanged', ({ progress, currentEra, nextEra }) => {
      this.applyUIBlendTheme(progress, currentEra as EraId, nextEra as EraId);
    });

    // Season changes affect resource gather rates
    this.eventBus.on('environment:seasonChanged', ({ season }) => {
      const mods = this.environment.getSeasonModifiers();
      // Apply season modifiers as temporary overrides
      // (simplified: just update modifier map on resource subsystem)
      for (const [resourceId, modifier] of Object.entries(mods)) {
        // Reset previous season modifier and apply new one
        this.resources.applyGatherModifier(resourceId, modifier);
      }
    });
  }

  // ─── Tech effect application ───────────────────────────────────────

  private applyTechEffect(effect: TechEffect): void {
    switch (effect.type) {
      case 'modify_gather_rate':
        this.resources.applyGatherModifier(effect.target, effect.value ?? 0);
        break;
      case 'modify_capacity':
        this.population.addBonusCapacity(effect.value ?? 0);
        break;
      case 'modify_stat':
        this.character.boostStat(effect.target as any, effect.value ?? 1);
        break;
      case 'unlock_role':
        // Role unlocking is handled by the population panel checking tech state
        break;
      case 'unlock_building':
        // Building system to be expanded
        break;
      case 'unlock_resource':
        // Resource already loaded per-era; this is for special unlocks
        break;
      case 'era_progress':
        // Handled by milestone system
        break;
      case 'unlock_event':
        // Events check prerequisites themselves
        break;
    }
  }

  // ─── Event consequence application ─────────────────────────────────

  private applyEventConsequence(consequence: EventConsequence): void {
    switch (consequence.type) {
      case 'resource_change':
        if (consequence.target) {
          if (consequence.value >= 0) {
            this.resources.addResource(consequence.target, consequence.value);
          } else {
            this.resources.removeResource(consequence.target, Math.abs(consequence.value));
          }
        }
        break;
      case 'population_change':
        this.population.changePopulation(consequence.value);
        break;
      case 'tech_unlock':
        if (consequence.target) {
          this.techTree.unlockTech(consequence.target);
        }
        break;
      case 'stat_change':
        if (consequence.target) {
          this.character.boostStat(consequence.target as any, consequence.value);
        }
        break;
      case 'happiness_change':
        this.population.modifyHappiness(consequence.value);
        break;
      case 'health_change':
        this.population.modifyHealth(consequence.value);
        break;
      case 'era_progress':
        // Handled by milestone system
        break;
      case 'unlock_building':
        // Building system to be expanded
        break;
    }
  }

  // ─── Gradual UI theme blending ─────────────────────────────────

  /**
   * CSS custom properties for each era's UI theme.
   * These are the core tokens that get interpolated.
   */
  private static readonly ERA_CSS_TOKENS: Record<string, { primary: string; secondary: string; border: string }> = {
    dawn:          { primary: '#CC7722', secondary: '#8B4513', border: '#5C4033' },
    awakening:     { primary: '#6B8E9B', secondary: '#8B9556', border: '#4A6060' },
    roots:         { primary: '#7A9A50', secondary: '#5A7040', border: '#506040' },
    forge:         { primary: '#C86030', secondary: '#8A4020', border: '#6A3828' },
    empire:        { primary: '#B89050', secondary: '#7A6030', border: '#605028' },
    convergence:   { primary: '#6080B0', secondary: '#406080', border: '#385060' },
    enlightenment: { primary: '#C0A060', secondary: '#806830', border: '#605028' },
    revolution:    { primary: '#908070', secondary: '#605040', border: '#484038' },
    modern:        { primary: '#5080A0', secondary: '#306070', border: '#284858' },
    horizon:       { primary: '#4060A0', secondary: '#284878', border: '#203858' },
  };

  /** Track the last applied blend so we do not thrash the DOM. */
  private lastUIBlend = 0;

  /**
   * When blend progress exceeds 0.7, start interpolating key CSS custom
   * properties on the #ui-overlay toward the next era's palette.
   * This makes panel borders, accent colors, and progress bars
   * subtly shift before the era-advance cinematic fires.
   */
  private applyUIBlendTheme(progress: number, currentEra: EraId, nextEra: EraId): void {
    // Only start UI blending once we are well past the halfway mark
    const UI_BLEND_START = 0.7;
    const overlay = document.getElementById('ui-overlay');
    if (!overlay) return;

    if (progress < UI_BLEND_START) {
      // Remove any inline overrides so the CSS class rules apply cleanly
      if (this.lastUIBlend > 0) {
        overlay.style.removeProperty('--era-primary');
        overlay.style.removeProperty('--era-secondary');
        overlay.style.removeProperty('--era-border');
        this.lastUIBlend = 0;
      }
      return;
    }

    // Map global [0.7..1.0] range into a local [0..1] blend factor
    const t = (progress - UI_BLEND_START) / (1.0 - UI_BLEND_START);
    // Avoid micro-updates
    if (Math.abs(t - this.lastUIBlend) < 0.01) return;
    this.lastUIBlend = t;

    const fromTokens = GameWorld.ERA_CSS_TOKENS[currentEra] ?? GameWorld.ERA_CSS_TOKENS['dawn'];
    const toTokens = GameWorld.ERA_CSS_TOKENS[nextEra] ?? fromTokens;

    overlay.style.setProperty('--era-primary', this.lerpCSSColor(fromTokens.primary, toTokens.primary, t));
    overlay.style.setProperty('--era-secondary', this.lerpCSSColor(fromTokens.secondary, toTokens.secondary, t));
    overlay.style.setProperty('--era-border', this.lerpCSSColor(fromTokens.border, toTokens.border, t));
  }

  /** Linearly interpolate two hex color strings for CSS overrides. */
  private lerpCSSColor(hexA: string, hexB: string, t: number): string {
    const a = parseInt(hexA.replace('#', ''), 16);
    const b = parseInt(hexB.replace('#', ''), 16);
    const rA = (a >> 16) & 0xff, gA = (a >> 8) & 0xff, bA = a & 0xff;
    const rB = (b >> 16) & 0xff, gB = (b >> 8) & 0xff, bB = b & 0xff;
    const r = Math.round(rA + (rB - rA) * t);
    const g = Math.round(gA + (gB - gA) * t);
    const bl = Math.round(bA + (bB - bA) * t);
    return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
  }

  // ─── UI data pushing ───────────────────────────────────────────────

  private refreshAllUI(): void {
    // Resources
    const resourceStates = Array.from(this.resources.getState().resources.values());
    this.uiManager.updateResourceDisplay(resourceStates);

    // Population
    this.uiManager.updatePopulationDisplay(this.population.getState());

    // Tech tree
    this.uiManager.updateTechTreeDisplay(this.techTree.getState());

    // Character
    this.uiManager.updateCharacterDisplay(this.character.getState());

    // Era progress
    this.uiManager.updateEraProgressDisplay(this.era.getState());
  }

  // ─── Start game ────────────────────────────────────────────────────

  private addStartButton(): void {
    const overlay = document.getElementById('ui-overlay');
    if (!overlay) return;

    // Check if button already exists
    if (document.getElementById('start-game-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'start-game-btn';
    btn.className = 'glass-button primary';
    btn.textContent = 'Begin the Journey';
    btn.style.cssText = `
      position: absolute;
      bottom: 20%;
      left: 50%;
      transform: translateX(-50%);
      padding: 16px 48px;
      font-size: 20px;
      z-index: 20;
      pointer-events: auto;
      cursor: pointer;
      letter-spacing: 2px;
      text-transform: uppercase;
    `;

    btn.addEventListener('click', () => {
      btn.remove();
      this.startGame();
    });

    overlay.appendChild(btn);
  }

  private startGame(): void {
    this.sceneManager.switchTo('game', 'dawn');
    this.uiManager.setEra('dawn');
    this.refreshAllUI();
  }

  // ─── Save / Load ──────────────────────────────────────────────────

  async save(slotId = 'autosave'): Promise<void> {
    const data: Record<string, unknown> = {};
    data['tickCount'] = this.gameLoop.getTickCount();
    for (const sub of this.subsystems) {
      data[sub.constructor.name] = sub.getState();
    }
    const eraDef = this.era.getCurrentEraDefinition();
    await this.saveManager.save(
      slotId,
      data,
      this.era.getState().currentEra,
      eraDef?.name ?? 'Unknown',
      this.gameLoop.getTickCount(),
    );
    this.eventBus.emit('game:saved', { slotId });
  }

  // ─── Accessors ─────────────────────────────────────────────────────

  getEventBus(): EventBus { return this.eventBus; }
  getGameLoop(): GameLoop { return this.gameLoop; }
  getSceneManager(): SceneManager { return this.sceneManager; }

  // ─── Cleanup ───────────────────────────────────────────────────────

  dispose(): void {
    this.gameLoop.dispose();
    for (const sub of this.subsystems) {
      sub.dispose();
    }
    this.sceneManager.dispose();
    this.eventBus.clear();
  }
}
