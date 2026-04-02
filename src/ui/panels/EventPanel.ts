/**
 * EventPanel - Center-screen modal for in-game events.
 *
 * When a game event fires, this panel displays the event name, flavour
 * description, and a set of choice buttons. Each choice shows the
 * consequences that will occur if the player picks it. The game is
 * paused while the modal is visible.
 */

import type { EventBus } from '@/core/EventBus';
import type { GameEventDefinition, EventChoice, EventConsequence } from '@/types';
import { GlassPanel } from '@/ui/components/GlassPanel';

export class EventPanel {
  private el: HTMLElement;
  private contentEl: HTMLElement;
  private backdropEl: HTMLElement;
  private visible = false;
  private currentEvent: GameEventDefinition | null = null;

  constructor(private eventBus: EventBus) {
    // Semi-transparent backdrop
    this.backdropEl = document.createElement('div');
    this.backdropEl.classList.add('event-backdrop');
    this.backdropEl.style.cssText = `
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.55);
      z-index: 50;
      display: none;
      pointer-events: auto;
    `;

    this.el = this.render();
    this.backdropEl.appendChild(this.el);

    // Listen for triggered events
    this.eventBus.on('gameEvent:triggered', ({ eventId }) => {
      // The UIManager should call showEvent() with the full definition;
      // this listener is a hook for external use.
    });
  }

  render(): HTMLElement {
    const wrapper = GlassPanel.createElement({
      classNames: ['event-panel', 'modal-enter'],
      dark: true,
    });

    wrapper.style.cssText = `
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 420px;
      max-width: 90vw;
      max-height: 80vh;
      overflow-y: auto;
      z-index: 51;
    `;

    this.contentEl = document.createElement('div');
    this.contentEl.classList.add('event-content');
    this.contentEl.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
    wrapper.appendChild(this.contentEl);

    return wrapper;
  }

  /** Show an event with its choices. Pauses the game. */
  showEvent(event: GameEventDefinition): void {
    this.currentEvent = event;
    this.contentEl.innerHTML = '';

    // --- Event type badge ---
    const badge = document.createElement('div');
    badge.style.cssText = `
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
      opacity: 0.5; margin-bottom: -4px;
    `;
    badge.textContent = this.getEventTypeLabel(event.type);
    this.contentEl.appendChild(badge);

    // --- Event name ---
    const title = document.createElement('h2');
    title.style.cssText = 'font-size: 18px; font-weight: 700; line-height: 1.3;';
    title.textContent = event.name;
    this.contentEl.appendChild(title);

    // --- Description ---
    const desc = document.createElement('p');
    desc.style.cssText = 'font-size: 13px; line-height: 1.5; opacity: 0.8;';
    desc.textContent = event.description;
    this.contentEl.appendChild(desc);

    // --- Divider ---
    const divider = document.createElement('hr');
    divider.classList.add('glass-divider');
    this.contentEl.appendChild(divider);

    // --- Choices ---
    const choicesContainer = document.createElement('div');
    choicesContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    for (const choice of event.choices) {
      choicesContainer.appendChild(this.createChoiceButton(event.id, choice));
    }

    this.contentEl.appendChild(choicesContainer);

    this.show();
    this.eventBus.emit('game:paused', {});
  }

  /** Build a choice button showing text + consequences. */
  private createChoiceButton(eventId: string, choice: EventChoice): HTMLElement {
    const btn = document.createElement('button');
    btn.classList.add('glass-button');
    btn.style.cssText = `
      display: flex; flex-direction: column; align-items: flex-start;
      text-align: left; padding: 12px 14px; width: 100%;
    `;

    const choiceText = document.createElement('span');
    choiceText.style.cssText = 'font-size: 13px; font-weight: 600;';
    choiceText.textContent = choice.text;
    btn.appendChild(choiceText);

    // Show consequence summary
    if (choice.consequences.length > 0) {
      const consText = document.createElement('span');
      consText.style.cssText = 'font-size: 11px; opacity: 0.55; margin-top: 4px;';
      consText.textContent = choice.consequences
        .map(c => this.formatConsequence(c))
        .join('  |  ');
      btn.appendChild(consText);
    }

    // Description / flavour hint
    if (choice.description) {
      const hint = document.createElement('span');
      hint.style.cssText = 'font-size: 11px; font-style: italic; opacity: 0.4; margin-top: 2px;';
      hint.textContent = choice.description;
      btn.appendChild(hint);
    }

    btn.addEventListener('click', () => {
      this.eventBus.emit('gameEvent:choiceMade', {
        eventId,
        choiceId: choice.id,
      });
      this.hide();
      this.eventBus.emit('game:resumed', {});
    });

    return btn;
  }

  /** Human-readable consequence summary. */
  private formatConsequence(c: EventConsequence): string {
    const sign = c.value >= 0 ? '+' : '';
    switch (c.type) {
      case 'resource_change':
        return `${sign}${c.value} ${c.target ?? 'resource'}`;
      case 'population_change':
        return `${sign}${c.value} pop`;
      case 'happiness_change':
        return `${sign}${c.value}% happiness`;
      case 'health_change':
        return `${sign}${c.value}% health`;
      case 'tech_unlock':
        return `Unlock: ${c.target ?? 'tech'}`;
      case 'stat_change':
        return `${sign}${c.value} ${c.target ?? 'stat'}`;
      case 'era_progress':
        return `${sign}${c.value} era progress`;
      case 'unlock_building':
        return `Unlock: ${c.target ?? 'building'}`;
      default:
        return `${sign}${c.value}`;
    }
  }

  private getEventTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      discovery: '\uD83D\uDD0D Discovery',
      disaster: '\u26A0\uFE0F Disaster',
      encounter: '\uD83D\uDC65 Encounter',
      cultural: '\uD83C\uDFAD Cultural',
      political: '\uD83C\uDFDB\uFE0F Political',
    };
    return labels[type] ?? type;
  }

  /** Get the backdrop + panel container for mounting. */
  getElement(): HTMLElement {
    return this.backdropEl;
  }

  show(): void {
    this.visible = true;
    this.backdropEl.style.display = 'block';
    this.el.classList.remove('panel-hidden');
    this.el.classList.add('panel-visible');
  }

  hide(): void {
    this.visible = false;
    this.backdropEl.style.display = 'none';
    this.el.classList.add('panel-hidden');
    this.el.classList.remove('panel-visible');
    this.currentEvent = null;
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** Alias so UIManager can pass event definitions through. */
  update(event: GameEventDefinition | null): void {
    if (event) {
      this.showEvent(event);
    } else {
      this.hide();
    }
  }
}
