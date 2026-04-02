import { Container, Graphics } from 'pixi.js';
import { randomRange } from '@/utils/math';

/** A single particle in the pool. */
interface Particle {
  /** The Graphics object drawn once and reused. */
  graphic: Graphics;
  /** Current X position. */
  x: number;
  /** Current Y position. */
  y: number;
  /** X velocity (px/s). */
  vx: number;
  /** Y velocity (px/s). Negative = upward. */
  vy: number;
  /** Remaining lifetime in seconds. */
  life: number;
  /** Total lifetime in seconds (used for alpha fade). */
  maxLife: number;
  /** Whether this particle slot is active. */
  active: boolean;
  /** Base size in pixels. */
  size: number;
}

/** Configuration for an emitter preset. */
interface EmitterConfig {
  /** Particles spawned per second. */
  rate: number;
  /** Min / max initial speed upward. */
  speedMin: number;
  speedMax: number;
  /** Horizontal spread speed range. */
  spreadMin: number;
  spreadMax: number;
  /** Min / max lifetime in seconds. */
  lifeMin: number;
  lifeMax: number;
  /** Particle radius range. */
  sizeMin: number;
  sizeMax: number;
  /** Colors to randomly choose from (hex numbers). */
  colors: number[];
  /** Gravity applied each frame (px/s^2, positive = down). */
  gravity: number;
}

const EMITTER_PRESETS: Record<string, EmitterConfig> = {
  campfire: {
    rate: 25,
    speedMin: 30,
    speedMax: 70,
    spreadMin: -15,
    spreadMax: 15,
    lifeMin: 0.6,
    lifeMax: 1.8,
    sizeMin: 1.5,
    sizeMax: 3.5,
    colors: [0xff6600, 0xff9933, 0xffcc00, 0xff4400],
    gravity: -10,
  },
  eraTransition: {
    rate: 80,
    speedMin: 80,
    speedMax: 200,
    spreadMin: -120,
    spreadMax: 120,
    lifeMin: 0.5,
    lifeMax: 1.5,
    sizeMin: 2,
    sizeMax: 5,
    colors: [0xffffff, 0xffddaa, 0xddccff, 0xaaddff],
    gravity: 20,
  },
  ambient: {
    rate: 5,
    speedMin: 5,
    speedMax: 15,
    spreadMin: -10,
    spreadMax: 10,
    lifeMin: 2,
    lifeMax: 5,
    sizeMin: 1,
    sizeMax: 2,
    colors: [0xffcc88, 0xffaa66],
    gravity: -3,
  },
};

/**
 * Pool-based particle effect system using PixiJS Graphics for each particle.
 *
 * Usage:
 *  1. Instantiate and add `particleEffects.container` to your scene.
 *  2. Call `play(preset, x, y)` to start emitting.
 *  3. Call `update(deltaSec)` every frame.
 */
export class ParticleEffects {
  public readonly container: Container;

  private pool: Particle[] = [];
  private readonly maxParticles: number;

  /** Active emitters: preset key, origin, accumulator, active flag. */
  private emitters: Array<{
    config: EmitterConfig;
    x: number;
    y: number;
    accumulator: number;
    active: boolean;
    /** If > 0, emitter auto-stops after this many seconds. */
    duration: number;
    elapsed: number;
  }> = [];

  constructor(maxParticles = 300) {
    this.container = new Container();
    this.maxParticles = maxParticles;

    // Pre-allocate pool
    for (let i = 0; i < maxParticles; i++) {
      const graphic = new Graphics();
      graphic.circle(0, 0, 1).fill(0xffffff);
      graphic.visible = false;
      this.container.addChild(graphic);

      this.pool.push({
        graphic,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        active: false,
        size: 1,
      });
    }
  }

  /**
   * Start emitting particles with the given preset at (x, y).
   * @param preset - key into EMITTER_PRESETS, or a custom EmitterConfig.
   * @param x - Emit origin X.
   * @param y - Emit origin Y.
   * @param duration - If > 0, automatically stop after this many seconds. 0 = indefinite.
   * @returns An index that can be passed to `stop()`.
   */
  play(preset: string | EmitterConfig, x: number, y: number, duration = 0): number {
    const config = typeof preset === 'string'
      ? EMITTER_PRESETS[preset] ?? EMITTER_PRESETS['campfire']
      : preset;

    const idx = this.emitters.length;
    this.emitters.push({
      config,
      x,
      y,
      accumulator: 0,
      active: true,
      duration,
      elapsed: 0,
    });
    return idx;
  }

  /**
   * Stop a specific emitter by index. Existing particles continue to fade.
   */
  stop(index: number): void {
    if (index >= 0 && index < this.emitters.length) {
      this.emitters[index].active = false;
    }
  }

  /**
   * Stop all active emitters.
   */
  stopAll(): void {
    for (const emitter of this.emitters) {
      emitter.active = false;
    }
  }

  /**
   * Move an emitter's origin (e.g., follow the character).
   */
  moveEmitter(index: number, x: number, y: number): void {
    if (index >= 0 && index < this.emitters.length) {
      this.emitters[index].x = x;
      this.emitters[index].y = y;
    }
  }

  /**
   * Advance the particle simulation by `dt` seconds.
   */
  update(dt: number): void {
    // Spawn new particles from active emitters
    for (const emitter of this.emitters) {
      if (!emitter.active) continue;

      // Handle duration-based auto-stop
      if (emitter.duration > 0) {
        emitter.elapsed += dt;
        if (emitter.elapsed >= emitter.duration) {
          emitter.active = false;
          continue;
        }
      }

      emitter.accumulator += dt;
      const interval = 1 / emitter.config.rate;
      while (emitter.accumulator >= interval) {
        emitter.accumulator -= interval;
        this.spawnParticle(emitter.config, emitter.x, emitter.y);
      }
    }

    // Update all active particles
    for (const p of this.pool) {
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.graphic.visible = false;
        continue;
      }

      // Find the config for gravity -- we use a simple default if unknown
      // Since particles may come from different emitters, we store gravity in vy already
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Fade based on remaining life
      const lifeRatio = p.life / p.maxLife;
      p.graphic.alpha = lifeRatio;
      p.graphic.x = p.x;
      p.graphic.y = p.y;

      // Scale shrinks over lifetime
      const scale = (0.3 + 0.7 * lifeRatio) * p.size;
      p.graphic.scale.set(scale, scale);
    }
  }

  /**
   * Spawn one particle from the pool.
   */
  private spawnParticle(config: EmitterConfig, originX: number, originY: number): void {
    const p = this.getInactive();
    if (!p) return;

    const color = config.colors[Math.floor(Math.random() * config.colors.length)];

    p.active = true;
    p.x = originX;
    p.y = originY;
    p.vx = randomRange(config.spreadMin, config.spreadMax);
    // Negative vy = upward movement
    p.vy = -randomRange(config.speedMin, config.speedMax) + config.gravity;
    p.life = randomRange(config.lifeMin, config.lifeMax);
    p.maxLife = p.life;
    p.size = randomRange(config.sizeMin, config.sizeMax);

    // Redraw the graphic with the chosen color
    p.graphic.clear();
    p.graphic.circle(0, 0, 1).fill(color);
    p.graphic.visible = true;
    p.graphic.alpha = 1;
    p.graphic.x = p.x;
    p.graphic.y = p.y;
    p.graphic.scale.set(p.size, p.size);
  }

  /** Find the first inactive particle in the pool, or null if full. */
  private getInactive(): Particle | null {
    for (const p of this.pool) {
      if (!p.active) return p;
    }
    return null;
  }

  /**
   * Remove all particles and emitters immediately.
   */
  clear(): void {
    this.emitters = [];
    for (const p of this.pool) {
      p.active = false;
      p.graphic.visible = false;
    }
  }

  /**
   * Get the count of currently active particles.
   */
  getActiveCount(): number {
    let count = 0;
    for (const p of this.pool) {
      if (p.active) count++;
    }
    return count;
  }

  /**
   * Destroy all resources.
   */
  dispose(): void {
    this.clear();
    this.container.destroy({ children: true });
  }
}
