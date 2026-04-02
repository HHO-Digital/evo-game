/**
 * EraProgressPanel - Bottom-center compact panel showing current era
 * progress.
 *
 * Displays the current era name, a checklist of milestones (with
 * checkmarks for completed ones), and an "Advance Era" button that
 * becomes active when all required milestones are finished.
 */

import type { EventBus } from '@/core/EventBus';
import type { EraProgression, Milestone } from '@/types';
import { GlassPanel } from '@/ui/components/GlassPanel';

export class EraProgressPanel {
  private el: HTMLElement;
  private contentEl: HTMLElement;
  private visible = true;
  private currentState: EraProgression | null = null;

  constructor(private eventBus: EventBus) {
    this.el = this.render();

    this.eventBus.on('era:milestoneCompleted', () => {
      // UIManager will call update() with latest state
    });
  }

  render(): HTMLElement {
    const wrapper = GlassPanel.createElement({
      classNames: ['era-progress-panel', 'slide-up'],
      dark: true,
    });

    wrapper.style.cssText = `
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      width: 300px;
      max-width: 90vw;
    `;

    this.contentEl = document.createElement('div');
    this.contentEl.classList.add('era-progress-content');
    this.contentEl.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    wrapper.appendChild(this.contentEl);

    return wrapper;
  }

  update(state: EraProgression): void {
    this.currentState = state;
    this.contentEl.innerHTML = '';

    // --- Era name ---
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

    const eraName = document.createElement('h3');
    eraName.style.cssText = 'font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;';
    eraName.textContent = this.formatEraName(state.currentEra);
    header.appendChild(eraName);

    // Completed count
    const completed = state.milestones.filter(m => m.completed).length;
    const total = state.milestones.length;
    const countBadge = document.createElement('span');
    countBadge.style.cssText = 'font-size: 11px; opacity: 0.5;';
    countBadge.textContent = `${completed}/${total}`;
    header.appendChild(countBadge);

    this.contentEl.appendChild(header);

    // --- Milestone list ---
    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

    for (const milestone of state.milestones) {
      list.appendChild(this.createMilestoneRow(milestone));
    }

    this.contentEl.appendChild(list);

    // --- Advance button ---
    if (state.canAdvance) {
      const divider = document.createElement('hr');
      divider.classList.add('glass-divider');
      this.contentEl.appendChild(divider);

      const advanceBtn = document.createElement('button');
      advanceBtn.classList.add('glass-button', 'primary');
      advanceBtn.style.cssText = 'width: 100%; justify-content: center; padding: 10px; font-size: 14px;';
      advanceBtn.textContent = '\u2728 Advance Era';
      advanceBtn.addEventListener('click', () => {
        this.eventBus.emit('era:advance', {
          from: state.currentEra,
          to: this.getNextEra(state.currentEra),
        });
      });
      this.contentEl.appendChild(advanceBtn);
    }
  }

  private createMilestoneRow(milestone: Milestone): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; padding: 2px 0;
      opacity: ${milestone.completed ? '0.6' : '1'};
    `;

    const check = document.createElement('span');
    check.style.cssText = 'font-size: 13px; flex-shrink: 0; width: 18px; text-align: center;';
    check.textContent = milestone.completed ? '\u2705' : (milestone.required ? '\u25CB' : '\u25CB');
    row.appendChild(check);

    const desc = document.createElement('span');
    desc.style.cssText = `
      flex: 1;
      ${milestone.completed ? 'text-decoration: line-through;' : ''}
    `;
    desc.textContent = milestone.description;
    row.appendChild(desc);

    if (milestone.required && !milestone.completed) {
      const reqBadge = document.createElement('span');
      reqBadge.style.cssText = 'font-size: 9px; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.05em;';
      reqBadge.textContent = 'req';
      row.appendChild(reqBadge);
    }

    return row;
  }

  private formatEraName(eraId: string): string {
    const names: Record<string, string> = {
      dawn: 'The Dawn of Man',
      awakening: 'The Awakening',
      roots: 'Roots of Civilization',
      forge: 'Age of the Forge',
      empire: 'Rise of Empires',
      convergence: 'The Convergence',
      enlightenment: 'The Enlightenment',
      revolution: 'Industrial Revolution',
      modern: 'The Modern Age',
      horizon: 'Beyond the Horizon',
    };
    return names[eraId] ?? eraId;
  }

  private getNextEra(current: string): string {
    const order = [
      'dawn', 'awakening', 'roots', 'forge', 'empire',
      'convergence', 'enlightenment', 'revolution', 'modern', 'horizon',
    ];
    const idx = order.indexOf(current);
    return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : current;
  }

  getElement(): HTMLElement {
    return this.el;
  }

  show(): void {
    this.visible = true;
    this.el.classList.remove('panel-hidden');
    this.el.classList.add('panel-visible');
  }

  hide(): void {
    this.visible = false;
    this.el.classList.add('panel-hidden');
    this.el.classList.remove('panel-visible');
  }

  isVisible(): boolean {
    return this.visible;
  }
}
