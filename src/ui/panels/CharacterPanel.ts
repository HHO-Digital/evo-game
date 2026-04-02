/**
 * CharacterPanel - Bottom-left compact panel showing the player character.
 *
 * Displays the character name, title, level, and stat bars for
 * strength, intelligence, charisma, wisdom, and adaptability.
 */

import type { EventBus } from '@/core/EventBus';
import type { PlayerCharacter, StatId } from '@/types';
import { GlassPanel } from '@/ui/components/GlassPanel';

/** Maximum stat value for bar scaling. */
const MAX_STAT = 100;

export class CharacterPanel {
  private el: HTMLElement;
  private contentEl!: HTMLElement;
  private visible = true;

  constructor(private eventBus: EventBus) {
    this.el = this.render();

    this.eventBus.on('character:levelUp', () => {
      // UIManager will push updated state via update()
    });
  }

  render(): HTMLElement {
    const wrapper = GlassPanel.createElement({
      classNames: ['character-panel', 'slide-up'],
      dark: true,
    });

    wrapper.style.cssText = `
      position: absolute;
      bottom: 12px;
      left: 12px;
      width: 200px;
    `;

    this.contentEl = document.createElement('div');
    this.contentEl.classList.add('character-content');
    this.contentEl.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    wrapper.appendChild(this.contentEl);

    return wrapper;
  }

  update(character: PlayerCharacter): void {
    this.contentEl.innerHTML = '';

    // --- Name and title ---
    const identity = document.createElement('div');
    identity.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display: flex; justify-content: space-between; align-items: baseline;';

    const name = document.createElement('h3');
    name.style.cssText = 'font-size: 14px; font-weight: 700;';
    name.textContent = character.name;
    nameRow.appendChild(name);

    const level = document.createElement('span');
    level.style.cssText = 'font-size: 11px; font-weight: 600; opacity: 0.6;';
    level.textContent = `Lv.${character.level}`;
    nameRow.appendChild(level);

    identity.appendChild(nameRow);

    const title = document.createElement('div');
    title.style.cssText = 'font-size: 11px; opacity: 0.5; font-style: italic;';
    title.textContent = character.title;
    identity.appendChild(title);

    this.contentEl.appendChild(identity);

    // --- XP bar ---
    const xpSection = document.createElement('div');
    xpSection.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const xpLabel = document.createElement('div');
    xpLabel.style.cssText = 'display: flex; justify-content: space-between; font-size: 10px; opacity: 0.45;';
    const xpToNext = this.xpForLevel(character.level + 1);
    xpLabel.innerHTML = `<span>XP</span><span>${character.xp} / ${xpToNext}</span>`;
    xpSection.appendChild(xpLabel);

    const xpBar = document.createElement('div');
    xpBar.classList.add('progress-bar');
    xpBar.style.cssText = 'height: 4px; border-radius: 2px; overflow: hidden; background: rgba(255,255,255,0.08);';

    const xpFill = document.createElement('div');
    xpFill.classList.add('progress-fill');
    const xpPct = Math.min(100, (character.xp / xpToNext) * 100);
    xpFill.style.cssText = `width: ${xpPct}%; height: 100%; border-radius: 2px; transition: width 0.4s ease;`;
    xpBar.appendChild(xpFill);
    xpSection.appendChild(xpBar);

    this.contentEl.appendChild(xpSection);

    // --- Divider ---
    const divider = document.createElement('hr');
    divider.classList.add('glass-divider');
    this.contentEl.appendChild(divider);

    // --- Stat bars ---
    const stats: { id: StatId; label: string; icon: string; color: string }[] = [
      { id: 'strength',     label: 'STR', icon: '\uD83D\uDCAA', color: '#e57373' },
      { id: 'intelligence', label: 'INT', icon: '\uD83E\uDDE0', color: '#64b5f6' },
      { id: 'charisma',     label: 'CHA', icon: '\u2728',       color: '#ffd54f' },
      { id: 'wisdom',       label: 'WIS', icon: '\uD83E\uDD89', color: '#81c784' },
      { id: 'adaptability', label: 'ADP', icon: '\uD83C\uDF00', color: '#ce93d8' },
    ];

    for (const stat of stats) {
      const val = character.stats[stat.id];
      this.contentEl.appendChild(this.createStatBar(stat.icon, stat.label, val, stat.color));
    }
  }

  /** Create a compact stat bar row. */
  private createStatBar(icon: string, label: string, value: number, color: string): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 6px;';

    const iconEl = document.createElement('span');
    iconEl.style.cssText = 'font-size: 12px; width: 16px; text-align: center;';
    iconEl.textContent = icon;
    row.appendChild(iconEl);

    const labelEl = document.createElement('span');
    labelEl.style.cssText = 'font-size: 10px; width: 26px; opacity: 0.6; font-weight: 600;';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const barOuter = document.createElement('div');
    barOuter.classList.add('progress-bar');
    barOuter.style.cssText = 'flex: 1; height: 6px; border-radius: 3px; overflow: hidden; background: rgba(255,255,255,0.08);';

    const barFill = document.createElement('div');
    barFill.classList.add('progress-fill');
    const pct = Math.min(100, (value / MAX_STAT) * 100);
    barFill.style.cssText = `width: ${pct}%; height: 100%; background: ${color}; border-radius: 3px; transition: width 0.4s ease;`;
    barOuter.appendChild(barFill);
    row.appendChild(barOuter);

    const valEl = document.createElement('span');
    valEl.style.cssText = 'font-size: 10px; width: 22px; text-align: right; font-weight: 600;';
    valEl.textContent = String(Math.round(value));
    row.appendChild(valEl);

    return row;
  }

  /** Simple levelling curve: 100 * level^1.5 */
  private xpForLevel(level: number): number {
    return Math.round(100 * Math.pow(level, 1.5));
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
