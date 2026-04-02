/**
 * Simple keyboard input manager.
 *
 * Tracks which keys are currently held down so that other systems
 * (e.g. GameScene) can poll input state each frame. This class only
 * handles keyboard input for gameplay; UI panels use their own DOM
 * event handlers.
 *
 * Usage:
 *   const input = new InputManager();
 *   input.initialize();
 *   // in game loop:
 *   if (input.isKeyDown('ArrowRight') || input.isKeyDown('d')) { ... }
 *   // on shutdown:
 *   input.dispose();
 */
export class InputManager {
  /** Set of currently pressed key values (KeyboardEvent.key). */
  private keysDown: Set<string> = new Set();

  /** Bound listener references for cleanup. */
  private onKeyDownBound: ((e: KeyboardEvent) => void) | null = null;
  private onKeyUpBound: ((e: KeyboardEvent) => void) | null = null;
  private onBlurBound: (() => void) | null = null;

  private initialized = false;

  /**
   * Start listening for keyboard events.
   * Safe to call multiple times; only the first call attaches listeners.
   */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.onKeyDownBound = this.handleKeyDown.bind(this);
    this.onKeyUpBound = this.handleKeyUp.bind(this);
    this.onBlurBound = this.handleBlur.bind(this);

    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    // Clear all keys when the window loses focus to avoid "stuck" keys
    window.addEventListener('blur', this.onBlurBound);
  }

  /**
   * Check whether a specific key is currently held down.
   *
   * @param key The KeyboardEvent.key value to check (e.g. 'ArrowLeft', 'a', ' ', 'Escape').
   * @returns true if the key is currently pressed.
   */
  isKeyDown(key: string): boolean {
    return this.keysDown.has(key);
  }

  /**
   * Convenience: returns true if any of the given keys are down.
   */
  isAnyKeyDown(...keys: string[]): boolean {
    for (const key of keys) {
      if (this.keysDown.has(key)) return true;
    }
    return false;
  }

  /**
   * Remove all event listeners and clear state.
   */
  dispose(): void {
    if (!this.initialized) return;

    if (this.onKeyDownBound) {
      window.removeEventListener('keydown', this.onKeyDownBound);
    }
    if (this.onKeyUpBound) {
      window.removeEventListener('keyup', this.onKeyUpBound);
    }
    if (this.onBlurBound) {
      window.removeEventListener('blur', this.onBlurBound);
    }

    this.onKeyDownBound = null;
    this.onKeyUpBound = null;
    this.onBlurBound = null;
    this.keysDown.clear();
    this.initialized = false;
  }

  // ---- Private handlers ----

  private handleKeyDown(e: KeyboardEvent): void {
    // Only track gameplay-relevant keys to avoid intercepting
    // browser shortcuts or text input in UI panels.
    if (this.isTrackedKey(e.key)) {
      // Prevent default scrolling for arrow keys and space
      e.preventDefault();
      this.keysDown.add(e.key);
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keysDown.delete(e.key);
  }

  private handleBlur(): void {
    this.keysDown.clear();
  }

  /**
   * Returns true if the key is one we care about for gameplay.
   */
  private isTrackedKey(key: string): boolean {
    switch (key) {
      // Arrow keys
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
      // WASD
      case 'w':
      case 'W':
      case 'a':
      case 'A':
      case 's':
      case 'S':
      case 'd':
      case 'D':
      // Common actions
      case ' ': // Space
      case 'Escape':
        return true;
      default:
        return false;
    }
  }
}
