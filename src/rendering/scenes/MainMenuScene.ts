import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { EventBus } from '@/core/EventBus';

/**
 * Simple main-menu / title screen scene.
 *
 * Displays:
 *  - Animated gradient background
 *  - "EVO" title text
 *  - "The Story of Us" subtitle
 *  - Floating ambient particles
 *
 * The actual "Play" button lives in the HTML/CSS UI overlay. This scene emits
 * a `ui:panelOpened` event with panelId 'mainMenu' so the UI layer knows to
 * show the menu controls. When the user clicks Play, the UI layer calls
 * SceneManager.switchTo('game').
 */
export class MainMenuScene {
  public readonly container: Container;

  private width = 0;
  private height = 0;

  /** Background gradient graphics. */
  private bg: Graphics;

  /** Floating ambient particle dots. */
  private particleDots: Array<{
    graphic: Graphics;
    x: number;
    y: number;
    vx: number;
    vy: number;
    alpha: number;
    speed: number;
  }> = [];

  /** Title text. */
  private titleText: Text;
  /** Subtitle text. */
  private subtitleText: Text;

  /** Animation phase accumulator. */
  private phase = 0;

  private unsubs: Array<() => void> = [];

  constructor(private eventBus: EventBus) {
    this.container = new Container();

    // --- Background ---
    this.bg = new Graphics();
    this.container.addChild(this.bg);

    // --- Title ---
    this.titleText = new Text({
      text: 'EVO',
      style: new TextStyle({
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 96,
        fontWeight: 'bold',
        fill: 0xffeedd,
        letterSpacing: 16,
        dropShadow: {
          color: 0x000000,
          blur: 8,
          distance: 4,
          angle: Math.PI / 4,
          alpha: 0.6,
        },
      }),
    });
    this.titleText.anchor.set(0.5, 0.5);
    this.container.addChild(this.titleText);

    // --- Subtitle ---
    this.subtitleText = new Text({
      text: 'The Story of Us',
      style: new TextStyle({
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 28,
        fill: 0xccaa88,
        letterSpacing: 6,
      }),
    });
    this.subtitleText.anchor.set(0.5, 0.5);
    this.container.addChild(this.subtitleText);
  }

  /**
   * Initialize the scene to the given viewport size.
   */
  init(width: number, height: number): void {
    this.width = width;
    this.height = height;

    this.drawBackground();
    this.positionText();
    this.createParticles();

    // Notify UI layer
    this.eventBus.emit('ui:panelOpened', { panelId: 'mainMenu' });
  }

  /**
   * Draw the animated gradient background.
   */
  private drawBackground(): void {
    const g = this.bg;
    g.clear();

    // Deep space-to-warm gradient
    const steps = 40;
    const stripH = Math.ceil(this.height / steps);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      // Dark deep blue at top, warm dark brown/orange at bottom
      const r = Math.round(10 + t * 40);
      const gr = Math.round(5 + t * 20);
      const b = Math.round(30 + (1 - t) * 20);
      const color = (r << 16) | (gr << 8) | b;
      g.rect(0, i * stripH, this.width, stripH + 1).fill(color);
    }
  }

  /**
   * Position title and subtitle text.
   */
  private positionText(): void {
    this.titleText.x = this.width / 2;
    this.titleText.y = this.height * 0.35;
    this.subtitleText.x = this.width / 2;
    this.subtitleText.y = this.height * 0.35 + 70;
  }

  /**
   * Create floating particle dots for atmosphere.
   */
  private createParticles(): void {
    // Remove any existing
    for (const p of this.particleDots) {
      p.graphic.destroy();
    }
    this.particleDots = [];

    const count = 50;
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const size = 1 + Math.random() * 2;
      const brightness = 0.2 + Math.random() * 0.5;
      const colorVal = Math.round(255 * brightness);
      const warmShift = Math.round(200 * brightness);
      const color = (colorVal << 16) | (warmShift << 8) | Math.round(100 * brightness);
      g.circle(0, 0, size).fill(color);

      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      g.x = x;
      g.y = y;
      g.alpha = 0.3 + Math.random() * 0.5;
      this.container.addChild(g);

      this.particleDots.push({
        graphic: g,
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: -5 - Math.random() * 10,
        alpha: g.alpha,
        speed: 0.5 + Math.random() * 1.5,
      });
    }
  }

  /**
   * Per-frame update.
   * @param dt Delta time in seconds.
   */
  update(dt: number): void {
    this.phase += dt;

    // Subtle title pulsing
    const scale = 1 + Math.sin(this.phase * 1.2) * 0.015;
    this.titleText.scale.set(scale, scale);

    // Subtitle gentle alpha oscillation
    this.subtitleText.alpha = 0.7 + Math.sin(this.phase * 0.8 + 1) * 0.3;

    // Animate floating particles
    for (const p of this.particleDots) {
      p.y += p.vy * p.speed * dt;
      p.x += p.vx * dt;

      // Wrap around
      if (p.y < -10) {
        p.y = this.height + 10;
        p.x = Math.random() * this.width;
      }
      if (p.x < -10) p.x = this.width + 10;
      if (p.x > this.width + 10) p.x = -10;

      p.graphic.x = p.x;
      p.graphic.y = p.y;
      // Gentle alpha flicker
      p.graphic.alpha = p.alpha + Math.sin(this.phase * 2 + p.x * 0.01) * 0.15;
    }
  }

  /**
   * Handle viewport resize.
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.drawBackground();
    this.positionText();

    // Redistribute particles
    for (const p of this.particleDots) {
      p.x = Math.random() * width;
      p.y = Math.random() * height;
    }
  }

  /**
   * Clean up.
   */
  dispose(): void {
    for (const unsub of this.unsubs) unsub();
    this.unsubs = [];
    for (const p of this.particleDots) {
      p.graphic.destroy();
    }
    this.particleDots = [];
    this.container.destroy({ children: true });
  }
}
