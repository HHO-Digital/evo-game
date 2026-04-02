/**
 * ResourcePanel - Horizontal bar at the top of the screen.
 *
 * Displays each active resource with an icon, current amount, and rate of
 * change. Updates reactively from ResourceSubsystem state.
 */

import type { EventBus } from '@/core/EventBus';
import type { ResourceState } from '@/types';
import { GlassPanel } from '@/ui/components/GlassPanel';
import { formatNumber, formatRate } from '@/utils/formatting';

export class ResourcePanel {
  private el: HTMLElement;
  private contentEl!: HTMLElement;
  private visible = true;
  private resourceElements: Map<string, HTMLElement> = new Map();

  constructor(private eventBus: EventBus) {
    this.el = this.render();

    // React to individual resource changes
    this.eventBus.on('resource:changed', ({ resourceId, amount, delta }) => {
      this.updateSingleResource(resourceId, amount, delta);
    });
  }

  /** Build the initial DOM structure. */
  render(): HTMLElement {
    const wrapper = GlassPanel.createElement({
      classNames: ['resource-panel'],
      dark: true,
    });

    // Override layout for top bar styling
    wrapper.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      border-radius: 0 0 12px 12px;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      min-height: 44px;
      z-index: 20;
    `;

    this.contentEl = document.createElement('div');
    this.contentEl.classList.add('resource-bar');
    this.contentEl.style.cssText = `
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
      width: 100%;
    `;

    wrapper.appendChild(this.contentEl);
    return wrapper;
  }

  /** Full update: replace all resource displays from state array. */
  update(resources: ResourceState[]): void {
    // Track which ids are still present
    const activeIds = new Set<string>();

    for (const res of resources) {
      activeIds.add(res.id);

      let itemEl = this.resourceElements.get(res.id);
      if (!itemEl) {
        itemEl = this.createResourceItem(res);
        this.resourceElements.set(res.id, itemEl);
        this.contentEl.appendChild(itemEl);
      }

      this.populateResourceItem(itemEl, res);
    }

    // Remove items no longer in state
    for (const [id, el] of this.resourceElements) {
      if (!activeIds.has(id)) {
        el.remove();
        this.resourceElements.delete(id);
      }
    }
  }

  /** Create the DOM node for a single resource item. */
  private createResourceItem(res: ResourceState): HTMLElement {
    const item = document.createElement('div');
    item.classList.add('resource-item');
    item.dataset.resourceId = res.id;
    item.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
    `;

    const icon = document.createElement('span');
    icon.classList.add('resource-icon');
    icon.style.cssText = 'font-size: 16px; line-height: 1;';
    item.appendChild(icon);

    const amount = document.createElement('span');
    amount.classList.add('resource-amount');
    amount.style.cssText = 'font-weight: 600; min-width: 36px;';
    item.appendChild(amount);

    const rate = document.createElement('span');
    rate.classList.add('resource-rate');
    rate.style.cssText = 'font-size: 11px; opacity: 0.6;';
    item.appendChild(rate);

    return item;
  }

  /** Fill in the values for a resource item element. */
  private populateResourceItem(el: HTMLElement, res: ResourceState): void {
    const icon = el.querySelector('.resource-icon') as HTMLElement;
    const amount = el.querySelector('.resource-amount') as HTMLElement;
    const rate = el.querySelector('.resource-rate') as HTMLElement;

    if (icon) icon.textContent = this.getResourceIcon(res.id);
    if (amount) amount.textContent = formatNumber(res.amount);
    if (rate) {
      const rateText = formatRate(res.gatherRate - res.consumers);
      rate.textContent = rateText;
      rate.style.color = (res.gatherRate - res.consumers) >= 0
        ? 'rgba(120, 220, 120, 0.8)'
        : 'rgba(220, 120, 120, 0.8)';
    }
  }

  /** Quick update for a single resource (from event). */
  private updateSingleResource(id: string, amount: number, delta: number): void {
    const el = this.resourceElements.get(id);
    if (!el) return;
    const amountEl = el.querySelector('.resource-amount') as HTMLElement;
    const rateEl = el.querySelector('.resource-rate') as HTMLElement;
    if (amountEl) amountEl.textContent = formatNumber(amount);
    if (rateEl) {
      rateEl.textContent = formatRate(delta);
      rateEl.style.color = delta >= 0
        ? 'rgba(120, 220, 120, 0.8)'
        : 'rgba(220, 120, 120, 0.8)';
    }
  }

  /** Map resource ids to emoji / text icons. */
  private getResourceIcon(id: string): string {
    const icons: Record<string, string> = {
      food: '\uD83C\uDF56',       // meat on bone
      wood: '\uD83E\uDEB5',       // wood
      stone: '\uD83E\uDEA8',      // rock
      hide: '\uD83E\uDDCD',       // person standing (placeholder)
      herbs: '\uD83C\uDF3F',      // herb
      faith: '\u2728',             // sparkles
      knowledge: '\uD83D\uDCDC',  // scroll
    };
    return icons[id] ?? '\u25CF'; // filled circle as fallback
  }

  /** Return the root element for mounting. */
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
