/**
 * TechTreePanel - Right-side toggleable technology tree panel.
 *
 * Shows technologies grouped by branch with collapsible sections.
 * Displays available, researching, and completed technologies.
 * The player clicks a tech to begin research; a progress bar shows
 * the current research item.
 */

import type { EventBus } from '@/core/EventBus';
import type { TechTreeState, TechState, TechBranch } from '@/types';
import { GlassPanel } from '@/ui/components/GlassPanel';
import { formatTime } from '@/utils/formatting';

interface TechDisplayInfo {
  id: string;
  name: string;
  branch: TechBranch;
  description: string;
  icon: string;
  researchTime: number;
}

/** Lightweight lookup so the panel can show names/descriptions. */
const TECH_DISPLAY_CACHE: Map<string, TechDisplayInfo> = new Map();

export class TechTreePanel {
  private el: HTMLElement;
  private contentEl: HTMLElement;
  private visible = false;
  private collapsedBranches: Set<string> = new Set();
  private currentState: TechTreeState | null = null;

  constructor(private eventBus: EventBus) {
    this.el = this.render();

    // Start hidden (toggled with T)
    this.el.classList.add('panel-hidden');

    this.eventBus.on('tech:researched', () => {
      if (this.currentState) this.rebuildContent();
    });
  }

  render(): HTMLElement {
    const wrapper = GlassPanel.createElement({
      classNames: ['tech-tree-panel', 'slide-right'],
      title: 'Technology',
      closeable: true,
      dark: true,
      onClose: () => this.hide(),
    });

    wrapper.style.cssText = `
      position: absolute;
      top: 60px;
      right: 12px;
      width: 280px;
      max-height: calc(100vh - 120px);
      overflow-y: auto;
    `;

    this.contentEl = document.createElement('div');
    this.contentEl.classList.add('tech-tree-content');
    this.contentEl.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    wrapper.appendChild(this.contentEl);

    return wrapper;
  }

  /**
   * Register display information for techs so the panel can render
   * names and descriptions. Call this once after loading tech definitions.
   */
  static registerTechDisplay(techs: TechDisplayInfo[]): void {
    for (const t of techs) {
      TECH_DISPLAY_CACHE.set(t.id, t);
    }
  }

  update(state: TechTreeState): void {
    this.currentState = state;
    this.rebuildContent();
  }

  private rebuildContent(): void {
    if (!this.currentState) return;
    this.contentEl.innerHTML = '';

    const { technologies, currentResearch, researchProgress } = this.currentState;

    // --- Current research progress ---
    if (currentResearch) {
      const info = TECH_DISPLAY_CACHE.get(currentResearch);
      const section = document.createElement('div');
      section.style.cssText = 'margin-bottom: 4px;';

      const label = document.createElement('div');
      label.style.cssText = 'font-size: 12px; opacity: 0.6; margin-bottom: 4px;';
      label.textContent = 'Researching';
      section.appendChild(label);

      const name = document.createElement('div');
      name.style.cssText = 'font-size: 14px; font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;';
      name.innerHTML = `<span>${info?.icon ?? '\uD83D\uDD2C'}</span><span>${info?.name ?? currentResearch}</span>`;
      section.appendChild(name);

      const bar = document.createElement('div');
      bar.classList.add('progress-bar');
      bar.style.cssText = 'height: 8px; border-radius: 4px; overflow: hidden; background: rgba(255,255,255,0.08);';

      const fill = document.createElement('div');
      fill.classList.add('progress-fill');
      const pct = Math.min(100, Math.max(0, researchProgress * 100));
      fill.style.cssText = `width: ${pct}%; height: 100%; border-radius: 4px; transition: width 0.3s ease;`;
      bar.appendChild(fill);
      section.appendChild(bar);

      const pctLabel = document.createElement('div');
      pctLabel.style.cssText = 'font-size: 11px; opacity: 0.5; margin-top: 3px; text-align: right;';
      pctLabel.textContent = `${Math.round(pct)}%`;
      section.appendChild(pctLabel);

      this.contentEl.appendChild(section);

      const divider = document.createElement('hr');
      divider.classList.add('glass-divider');
      this.contentEl.appendChild(divider);
    }

    // --- Group techs by branch ---
    const branches = new Map<TechBranch, { id: string; state: TechState }[]>();
    for (const [id, state] of technologies) {
      const info = TECH_DISPLAY_CACHE.get(id);
      const branch: TechBranch = info?.branch ?? 'survival';
      if (!branches.has(branch)) branches.set(branch, []);
      branches.get(branch)!.push({ id, state });
    }

    const branchOrder: TechBranch[] = ['survival', 'culture', 'military', 'science', 'governance'];
    const branchIcons: Record<TechBranch, string> = {
      survival: '\uD83C\uDF3F',
      culture: '\uD83C\uDFAD',
      military: '\u2694\uFE0F',
      science: '\uD83D\uDD2C',
      governance: '\uD83C\uDFDB\uFE0F',
    };

    for (const branch of branchOrder) {
      const techs = branches.get(branch);
      if (!techs || techs.length === 0) continue;

      const section = document.createElement('div');
      section.classList.add('tech-branch');

      // Branch header (collapsible)
      const header = document.createElement('div');
      header.style.cssText = `
        display: flex; align-items: center; gap: 6px; cursor: pointer;
        padding: 4px 0; font-size: 13px; font-weight: 600;
        text-transform: capitalize; user-select: none;
      `;
      const collapsed = this.collapsedBranches.has(branch);
      header.innerHTML = `
        <span style="font-size:10px; transition: transform 0.2s; transform: rotate(${collapsed ? '0' : '90'}deg);">\u25B6</span>
        <span>${branchIcons[branch]}</span>
        <span>${branch}</span>
        <span style="font-size:11px;opacity:0.4;margin-left:auto;">
          ${techs.filter(t => t.state.researched).length}/${techs.length}
        </span>
      `;
      header.addEventListener('click', () => {
        if (this.collapsedBranches.has(branch)) {
          this.collapsedBranches.delete(branch);
        } else {
          this.collapsedBranches.add(branch);
        }
        this.rebuildContent();
      });
      section.appendChild(header);

      // Tech items
      if (!collapsed) {
        const list = document.createElement('div');
        list.style.cssText = 'display: flex; flex-direction: column; gap: 4px; padding-left: 12px;';

        for (const tech of techs) {
          list.appendChild(this.createTechItem(tech.id, tech.state));
        }
        section.appendChild(list);
      }

      this.contentEl.appendChild(section);
    }
  }

  private createTechItem(id: string, state: TechState): HTMLElement {
    const info = TECH_DISPLAY_CACHE.get(id);

    const item = document.createElement('div');
    item.classList.add('tech-item');
    item.style.cssText = `
      display: flex; align-items: center; gap: 8px;
      padding: 6px 8px; border-radius: 4px; font-size: 12px;
      transition: background 0.15s ease;
      cursor: ${state.available && !state.researched && !state.researching ? 'pointer' : 'default'};
      opacity: ${state.available || state.researched ? '1' : '0.4'};
      background: ${state.researching ? 'rgba(204, 119, 34, 0.15)' : 'transparent'};
    `;

    // Status indicator
    const status = document.createElement('span');
    status.style.cssText = 'font-size: 14px; flex-shrink: 0;';
    if (state.researched) {
      status.textContent = '\u2705'; // check mark
    } else if (state.researching) {
      status.textContent = '\u23F3'; // hourglass
    } else if (state.available) {
      status.textContent = info?.icon ?? '\u25CB';
    } else {
      status.textContent = '\uD83D\uDD12'; // locked
    }
    item.appendChild(status);

    const textCol = document.createElement('div');
    textCol.style.cssText = 'display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = `
      font-weight: 500;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      ${state.researched ? 'text-decoration: line-through; opacity: 0.6;' : ''}
    `;
    nameEl.textContent = info?.name ?? id;
    textCol.appendChild(nameEl);

    if (info?.description && state.available && !state.researched) {
      const desc = document.createElement('div');
      desc.style.cssText = 'font-size: 10px; opacity: 0.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
      desc.textContent = info.description;
      textCol.appendChild(desc);
    }

    item.appendChild(textCol);

    // Research time
    if (state.available && !state.researched && info) {
      const time = document.createElement('span');
      time.style.cssText = 'font-size: 10px; opacity: 0.45; white-space: nowrap;';
      time.textContent = formatTime(info.researchTime);
      item.appendChild(time);
    }

    // Click to research
    if (state.available && !state.researched && !state.researching) {
      item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(255,255,255,0.06)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
      });
      item.addEventListener('click', () => {
        this.eventBus.emit('tech:started', { techId: id });
      });
    }

    return item;
  }

  getElement(): HTMLElement {
    return this.el;
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    this.visible = true;
    this.el.classList.remove('panel-hidden');
    this.el.classList.add('panel-visible');
    this.eventBus.emit('ui:panelOpened', { panelId: 'tech-tree' });
  }

  hide(): void {
    this.visible = false;
    this.el.classList.add('panel-hidden');
    this.el.classList.remove('panel-visible');
    this.eventBus.emit('ui:panelClosed', { panelId: 'tech-tree' });
  }

  isVisible(): boolean {
    return this.visible;
  }
}
