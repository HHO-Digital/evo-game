/**
 * PopulationPanel - Left-side population management panel.
 *
 * Shows total population, capacity, happiness, health, and per-role groups
 * with +/- buttons so the player can reassign population between roles.
 */

import type { EventBus } from '@/core/EventBus';
import type { PopulationState, PopulationGroup } from '@/types';
import { GlassPanel } from '@/ui/components/GlassPanel';
import { formatNumber } from '@/utils/formatting';

export class PopulationPanel {
  private el: HTMLElement;
  private contentEl!: HTMLElement;
  private visible = true;
  private currentState: PopulationState | null = null;

  constructor(private eventBus: EventBus) {
    this.el = this.render();

    this.eventBus.on('population:changed', () => {
      // Full re-render will be triggered by UIManager calling update()
    });
  }

  render(): HTMLElement {
    const wrapper = GlassPanel.createElement({
      classNames: ['population-panel', 'slide-left'],
      title: 'Population',
      dark: true,
    });

    wrapper.style.cssText = `
      position: absolute;
      top: 60px;
      left: 12px;
      width: 220px;
      max-height: calc(100vh - 180px);
      overflow-y: auto;
    `;

    this.contentEl = document.createElement('div');
    this.contentEl.classList.add('population-content');
    this.contentEl.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
    wrapper.appendChild(this.contentEl);

    return wrapper;
  }

  update(state: PopulationState): void {
    this.currentState = state;
    this.contentEl.innerHTML = '';

    // --- Summary section ---
    const summary = document.createElement('div');
    summary.classList.add('pop-summary');
    summary.style.cssText = 'display: flex; flex-direction: column; gap: 6px; font-size: 13px;';

    summary.appendChild(this.createStatRow(
      '\uD83D\uDC65', 'Population',
      `${formatNumber(state.total)} / ${formatNumber(state.capacity)}`
    ));
    summary.appendChild(this.createStatBar('\uD83D\uDE0A', 'Happiness', state.happiness, '#66bb6a'));
    summary.appendChild(this.createStatBar('\u2764\uFE0F', 'Health', state.health, '#ef5350'));
    summary.appendChild(this.createStatRow(
      '\uD83D\uDCC8', 'Growth',
      `${state.growthRate >= 0 ? '+' : ''}${state.growthRate.toFixed(2)}/s`
    ));

    this.contentEl.appendChild(summary);

    // --- Divider ---
    const divider = document.createElement('hr');
    divider.classList.add('glass-divider');
    this.contentEl.appendChild(divider);

    // --- Role groups ---
    const rolesHeader = document.createElement('h3');
    rolesHeader.textContent = 'Roles';
    rolesHeader.style.cssText = 'font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; margin-bottom: 2px;';
    this.contentEl.appendChild(rolesHeader);

    for (const group of state.groups) {
      this.contentEl.appendChild(this.createRoleRow(group));
    }
  }

  /** Create a simple label + value row. */
  private createStatRow(icon: string, label: string, value: string): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
    row.innerHTML = `
      <span style="display:flex;align-items:center;gap:4px;">
        <span style="font-size:14px;">${icon}</span>
        <span style="opacity:0.7;">${label}</span>
      </span>
      <span style="font-weight:600;">${value}</span>
    `;
    return row;
  }

  /** Create a labelled stat bar (0-100). */
  private createStatBar(icon: string, label: string, value: number, color: string): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; flex-direction: column; gap: 3px;';

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
    header.innerHTML = `
      <span style="display:flex;align-items:center;gap:4px;">
        <span style="font-size:14px;">${icon}</span>
        <span style="opacity:0.7;">${label}</span>
      </span>
      <span style="font-weight:600;">${Math.round(value)}%</span>
    `;
    row.appendChild(header);

    const bar = document.createElement('div');
    bar.classList.add('progress-bar');
    bar.style.cssText = 'height: 6px; border-radius: 3px; overflow: hidden; background: rgba(255,255,255,0.08);';

    const fill = document.createElement('div');
    fill.classList.add('progress-fill');
    fill.style.cssText = `
      width: ${Math.min(100, Math.max(0, value))}%;
      height: 100%;
      background: ${color};
      border-radius: 3px;
      transition: width 0.4s ease;
    `;
    bar.appendChild(fill);
    row.appendChild(bar);

    return row;
  }

  /** Create a role assignment row with +/- buttons. */
  private createRoleRow(group: PopulationGroup): HTMLElement {
    const row = document.createElement('div');
    row.classList.add('role-row');
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    `;

    const roleIcon = this.getRoleIcon(group.role);

    const label = document.createElement('div');
    label.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 13px; flex: 1;';
    label.innerHTML = `
      <span style="font-size:15px;">${roleIcon}</span>
      <span style="text-transform:capitalize;">${group.role}</span>
      <span style="font-size:10px;opacity:0.45;">${Math.round(group.efficiency * 100)}%</span>
    `;

    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; align-items: center; gap: 4px;';

    const minusBtn = document.createElement('button');
    minusBtn.classList.add('glass-button', 'small');
    minusBtn.textContent = '\u2212'; // minus sign
    minusBtn.disabled = group.count <= 0;
    minusBtn.addEventListener('click', () => {
      if (group.count > 0) {
        this.eventBus.emit('population:roleAssigned', {
          role: group.role,
          count: group.count - 1,
        });
      }
    });

    const countEl = document.createElement('span');
    countEl.style.cssText = 'min-width: 24px; text-align: center; font-weight: 600; font-size: 13px;';
    countEl.textContent = String(group.count);

    const plusBtn = document.createElement('button');
    plusBtn.classList.add('glass-button', 'small');
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', () => {
      this.eventBus.emit('population:roleAssigned', {
        role: group.role,
        count: group.count + 1,
      });
    });

    controls.appendChild(minusBtn);
    controls.appendChild(countEl);
    controls.appendChild(plusBtn);

    row.appendChild(label);
    row.appendChild(controls);
    return row;
  }

  private getRoleIcon(role: string): string {
    const icons: Record<string, string> = {
      idle: '\uD83D\uDCA4',      // zzz
      gatherer: '\uD83E\uDDF6',  // basket (yarn ball)
      hunter: '\uD83C\uDFF9',    // bow and arrow
      farmer: '\uD83C\uDF3E',    // sheaf of rice
      builder: '\uD83D\uDD28',   // hammer
      soldier: '\u2694\uFE0F',    // crossed swords
      scholar: '\uD83D\uDCDA',   // books
      artisan: '\uD83C\uDFA8',   // palette
      merchant: '\uD83D\uDCB0',  // money bag
      shaman: '\uD83D\uDD2E',    // crystal ball
    };
    return icons[role] ?? '\u25CB';
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
