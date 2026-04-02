/**
 * UIManager - Central manager for all UI panels.
 *
 * Creates and mounts every panel as a DOM element inside #ui-overlay,
 * listens to EventBus for state changes, and routes data to the
 * appropriate panel. Also manages era CSS class on the overlay so
 * era themes cascade down to all children.
 */

import type { EventBus } from '@/core/EventBus';
import type {
  EraId,
  EraProgression,
  ResourceState,
  PopulationState,
  TechTreeState,
  PlayerCharacter,
  GameEventDefinition,
} from '@/types';

import { ResourcePanel } from '@/ui/panels/ResourcePanel';
import { PopulationPanel } from '@/ui/panels/PopulationPanel';
import { TechTreePanel } from '@/ui/panels/TechTreePanel';
import { EventPanel } from '@/ui/panels/EventPanel';
import { EraProgressPanel } from '@/ui/panels/EraProgressPanel';
import { CharacterPanel } from '@/ui/panels/CharacterPanel';

// Import stylesheets (bundler will inject them)
import '@/ui/styles/base.css';
import '@/ui/styles/glass.css';
import '@/ui/styles/eras/dawn.css';

export class UIManager {
  private overlay!: HTMLElement;
  private currentEraClass = 'era-dawn';

  // Panels
  private resourcePanel!: ResourcePanel;
  private populationPanel!: PopulationPanel;
  private techTreePanel!: TechTreePanel;
  private eventPanel!: EventPanel;
  private eraProgressPanel!: EraProgressPanel;
  private characterPanel!: CharacterPanel;

  private panels: Map<string, { show: () => void; hide: () => void; getElement: () => HTMLElement }> = new Map();

  constructor(private eventBus: EventBus) {}

  // ---------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------

  /** Call once after the DOM is ready. Creates all panels and mounts them. */
  initialize(): void {
    this.overlay = document.getElementById('ui-overlay')!;
    if (!this.overlay) {
      // If the element doesn't exist yet, create it inside game-container
      const container = document.getElementById('game-container');
      this.overlay = document.createElement('div');
      this.overlay.id = 'ui-overlay';
      if (container) {
        container.appendChild(this.overlay);
      } else {
        document.body.appendChild(this.overlay);
      }
    }

    // Apply default era class
    this.overlay.classList.add(this.currentEraClass);

    // Instantiate all panels
    this.resourcePanel = new ResourcePanel(this.eventBus);
    this.populationPanel = new PopulationPanel(this.eventBus);
    this.techTreePanel = new TechTreePanel(this.eventBus);
    this.eventPanel = new EventPanel(this.eventBus);
    this.eraProgressPanel = new EraProgressPanel(this.eventBus);
    this.characterPanel = new CharacterPanel(this.eventBus);

    // Register in the panels map for generic show/hide
    this.panels.set('resource', this.resourcePanel);
    this.panels.set('population', this.populationPanel);
    this.panels.set('tech-tree', this.techTreePanel);
    this.panels.set('event', this.eventPanel);
    this.panels.set('era-progress', this.eraProgressPanel);
    this.panels.set('character', this.characterPanel);

    // Mount panel elements into the overlay
    this.overlay.appendChild(this.resourcePanel.getElement());
    this.overlay.appendChild(this.populationPanel.getElement());
    this.overlay.appendChild(this.techTreePanel.getElement());
    this.overlay.appendChild(this.characterPanel.getElement());
    this.overlay.appendChild(this.eraProgressPanel.getElement());
    this.overlay.appendChild(this.eventPanel.getElement());  // modal on top

    // Listen for era changes to swap CSS class
    this.eventBus.on('era:advance', ({ to }) => {
      this.setEra(to as EraId);
    });

    // Keyboard shortcut: T to toggle tech tree
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        // Ignore if user is typing in an input
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
        this.techTreePanel.toggle();
      }
    });
  }

  // ---------------------------------------------------------------
  // Panel visibility
  // ---------------------------------------------------------------

  showPanel(id: string): void {
    const panel = this.panels.get(id);
    if (panel) {
      panel.show();
      this.eventBus.emit('ui:panelOpened', { panelId: id });
    }
  }

  hidePanel(id: string): void {
    const panel = this.panels.get(id);
    if (panel) {
      panel.hide();
      this.eventBus.emit('ui:panelClosed', { panelId: id });
    }
  }

  // ---------------------------------------------------------------
  // Data update helpers
  // ---------------------------------------------------------------

  /** Push new resource state to the resource bar. */
  updateResourceDisplay(resources: ResourceState[]): void {
    this.resourcePanel.update(resources);
  }

  /** Push new population state to the population panel. */
  updatePopulationDisplay(state: PopulationState): void {
    this.populationPanel.update(state);
  }

  /** Push new tech tree state to the tech tree panel. */
  updateTechTreeDisplay(state: TechTreeState): void {
    this.techTreePanel.update(state);
  }

  /** Push character data to the character panel. */
  updateCharacterDisplay(character: PlayerCharacter): void {
    this.characterPanel.update(character);
  }

  /** Push era progression data to the era progress panel. */
  updateEraProgressDisplay(state: EraProgression): void {
    this.eraProgressPanel.update(state);
  }

  /** Show a game event modal. */
  showGameEvent(event: GameEventDefinition): void {
    this.eventPanel.showEvent(event);
  }

  /** Dismiss the game event modal. */
  dismissGameEvent(): void {
    this.eventPanel.hide();
  }

  // ---------------------------------------------------------------
  // Era theme management
  // ---------------------------------------------------------------

  /** Swap the era CSS class on #ui-overlay. */
  setEra(eraId: EraId): void {
    this.overlay.classList.remove(this.currentEraClass);
    this.currentEraClass = `era-${eraId}`;
    this.overlay.classList.add(this.currentEraClass);
  }

  // ---------------------------------------------------------------
  // Direct accessors (for advanced use)
  // ---------------------------------------------------------------

  getResourcePanel(): ResourcePanel { return this.resourcePanel; }
  getPopulationPanel(): PopulationPanel { return this.populationPanel; }
  getTechTreePanel(): TechTreePanel { return this.techTreePanel; }
  getEventPanel(): EventPanel { return this.eventPanel; }
  getEraProgressPanel(): EraProgressPanel { return this.eraProgressPanel; }
  getCharacterPanel(): CharacterPanel { return this.characterPanel; }
}
