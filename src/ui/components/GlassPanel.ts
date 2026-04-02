/**
 * GlassPanel - Reusable wrapper that creates a styled glass-panel DOM element.
 *
 * Supports optional title bar, close button, and draggable behaviour.
 */

export interface GlassPanelOptions {
  /** Additional CSS class names to apply */
  classNames?: string[];
  /** If set, renders a title bar at the top of the panel */
  title?: string;
  /** Show a close (x) button in the title bar */
  closeable?: boolean;
  /** Allow the user to drag the panel by its title bar */
  draggable?: boolean;
  /** Use the darker glass variant */
  dark?: boolean;
  /** Callback fired when the close button is clicked */
  onClose?: () => void;
}

export class GlassPanel {
  /**
   * Create a glass-panel DOM element with the given options.
   */
  static createElement(options: GlassPanelOptions = {}): HTMLElement {
    const panel = document.createElement('div');
    panel.classList.add(options.dark ? 'glass-panel-dark' : 'glass-panel');
    panel.classList.add('ui-panel');

    if (options.classNames) {
      options.classNames.forEach(c => panel.classList.add(c));
    }

    // Title bar
    if (options.title || options.closeable) {
      const titleBar = document.createElement('div');
      titleBar.classList.add('glass-title-bar');

      const heading = document.createElement('h3');
      heading.textContent = options.title ?? '';
      titleBar.appendChild(heading);

      if (options.closeable) {
        const closeBtn = document.createElement('button');
        closeBtn.classList.add('glass-close-btn');
        closeBtn.textContent = '\u00D7'; // multiplication sign (x)
        closeBtn.addEventListener('click', () => {
          options.onClose?.();
        });
        titleBar.appendChild(closeBtn);
      }

      panel.appendChild(titleBar);

      // Divider below title bar
      const divider = document.createElement('hr');
      divider.classList.add('glass-divider');
      panel.appendChild(divider);

      // Draggable logic
      if (options.draggable) {
        GlassPanel.makeDraggable(panel, titleBar);
      }
    }

    return panel;
  }

  /**
   * Attach drag behaviour: user can click-drag the handle to reposition the
   * panel within its parent.
   */
  private static makeDraggable(panel: HTMLElement, handle: HTMLElement): void {
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;
      panel.style.position = 'absolute';
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handle.style.cursor = 'grab';
    handle.addEventListener('mousedown', (e: MouseEvent) => {
      isDragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      handle.style.cursor = 'grabbing';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', () => {
        handle.style.cursor = 'grab';
        onMouseUp();
      });
    });
  }
}
