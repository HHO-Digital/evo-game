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

    this.subsystems = [
      this.era,
      this.resources,
      this.population,
      this.techTree,
      this.character,
      this.environment,
      this.events,
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
