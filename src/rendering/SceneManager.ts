import { Application } from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import type { EraId } from '@/types';
import { MainMenuScene } from '@/rendering/scenes/MainMenuScene';
import { GameScene } from '@/rendering/scenes/GameScene';
import { EraTransitionScene } from '@/rendering/scenes/EraTransitionScene';

/** The set of known scene identifiers. */
export type SceneId = 'mainMenu' | 'game' | 'eraTransition';

/**
 * SceneManager owns the PixiJS v8 Application and manages the three game scenes.
 *
 * Lifecycle:
 *  1. `await sceneManager.init()` -- creates the PixiJS app, attaches to #game-canvas
 *  2. `sceneManager.switchTo('mainMenu')` -- shows the main menu
 *  3. `sceneManager.render(alpha)` -- called every frame from the GameLoop
 *  4. `sceneManager.dispose()` -- tear down
 *
 * Resize is handled automatically via a ResizeObserver on the game container.
 */
export class SceneManager {
  private app!: Application;
  private eventBus: EventBus;

  /** Scene instances (created lazily on first init). */
  private mainMenu!: MainMenuScene;
  private gameScene!: GameScene;
  private eraTransition!: EraTransitionScene;

  /** Which scene is currently active (visible & receiving updates). */
  private activeScene: SceneId = 'mainMenu';
  /** Timestamp of last render call, for computing dt. */
  private lastRenderTime = 0;
  /** ResizeObserver handle. */
  private resizeObserver: ResizeObserver | null = null;

  /** Canvas dimensions (kept in sync with the container). */
  private width = 0;
  private height = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  /**
   * Create the PixiJS Application, attach to the existing #game-canvas element,
   * build all scenes, and start observing resize.
   */
  async init(): Promise<void> {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('SceneManager: #game-canvas element not found in the DOM.');
    }

    // Determine initial size from the canvas's parent (the game-container div).
    const container = canvas.parentElement ?? document.body;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    // Create and initialize the PixiJS v8 Application.
    // Preference: WebGPU, fallback to WebGL.
    this.app = new Application();
    await this.app.init({
      canvas,
      width: this.width,
      height: this.height,
      background: 0x000000,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      preference: 'webgpu',
    });

    // Build scene instances
    this.mainMenu = new MainMenuScene(this.eventBus);
    this.gameScene = new GameScene(this.eventBus);
    this.eraTransition = new EraTransitionScene();

    // Add all scene containers to the stage (visibility is toggled per-scene)
    this.app.stage.addChild(this.mainMenu.container);
    this.app.stage.addChild(this.gameScene.container);
    this.app.stage.addChild(this.eraTransition.container);

    // Initialize each scene
    this.mainMenu.init(this.width, this.height);
    this.gameScene.init(this.width, this.height, 'dawn');
    this.eraTransition.init(this.width, this.height);

    // Default: only mainMenu visible
    this.showOnly('mainMenu');

    // Observe resize on the parent container
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this.handleResize(Math.round(width), Math.round(height));
        }
      }
    });
    this.resizeObserver.observe(container);

    this.lastRenderTime = performance.now();
  }

  // ---------------------------------------------------------------------------
  // Scene switching
  // ---------------------------------------------------------------------------

  /**
   * Switch to the specified scene.
   * If switching to 'game', you can optionally specify the starting era.
   */
  switchTo(scene: SceneId, era?: EraId): void {
    this.activeScene = scene;
    this.showOnly(scene);

    if (scene === 'game' && era) {
      this.gameScene.init(this.width, this.height, era);
    }
  }

  /**
   * Play the era-transition cinematic, then switch to the game scene with the new era.
   */
  playEraTransition(eraName: string, subtitle: string, newEra: EraId): void {
    // Show the transition overlay on top of everything
    this.eraTransition.container.visible = true;
    this.activeScene = 'eraTransition';

    this.eraTransition.play(eraName, subtitle, () => {
      // When the cinematic ends, switch to the game scene with the new era
      this.gameScene.transitionEra(newEra);
      this.switchTo('game');
    });
  }

  /**
   * Toggle visibility so only the active scene (and the transition overlay
   * when applicable) is shown.
   */
  private showOnly(scene: SceneId): void {
    this.mainMenu.container.visible = scene === 'mainMenu';
    this.gameScene.container.visible = scene === 'game' || scene === 'eraTransition';
    // eraTransition visibility is managed by EraTransitionScene.play/skip
    if (scene !== 'eraTransition') {
      this.eraTransition.container.visible = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Per-frame render
  // ---------------------------------------------------------------------------

  /**
   * Called by the GameLoop every animation frame.
   *
   * @param alpha Interpolation factor (0..1) from the fixed-timestep accumulator.
   */
  render(alpha: number): void {
    const now = performance.now();
    const dt = (now - this.lastRenderTime) / 1000;
    this.lastRenderTime = now;

    // Clamp dt to avoid huge jumps after tab-away
    const clampedDt = Math.min(dt, 0.1);

    switch (this.activeScene) {
      case 'mainMenu':
        this.mainMenu.update(clampedDt);
        break;
      case 'game':
        this.gameScene.update(clampedDt, alpha);
        break;
      case 'eraTransition':
        // Keep the game scene alive underneath
        this.gameScene.update(clampedDt, alpha);
        this.eraTransition.update(clampedDt);
        break;
    }

    // PixiJS v8 renders automatically via its internal ticker.
    // If the internal ticker were disabled we would call `this.app.render()` here.
  }

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------

  /**
   * Handle a viewport resize.
   */
  private handleResize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    this.app.renderer.resize(width, height);

    this.mainMenu.resize(width, height);
    this.gameScene.resize(width, height);
    this.eraTransition.resize(width, height);
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  /**
   * Get the underlying PixiJS Application (for advanced usage).
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * Get the current active scene id.
   */
  getActiveScene(): SceneId {
    return this.activeScene;
  }

  /**
   * Get the GameScene instance (for subsystems that need to interact with the scene).
   */
  getGameScene(): GameScene {
    return this.gameScene;
  }

  /**
   * Get viewport dimensions.
   */
  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Tear down all scenes, the PixiJS app, and the resize observer.
   */
  dispose(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.mainMenu.dispose();
    this.gameScene.dispose();
    this.eraTransition.dispose();

    this.app.destroy(true, { children: true });
  }
}
