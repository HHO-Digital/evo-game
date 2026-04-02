import { Container } from 'pixi.js';
import type { EraId } from '@/types';
import { EventBus } from '@/core/EventBus';
import { ParallaxBackground } from '@/rendering/components/ParallaxBackground';
import { ParticleEffects } from '@/rendering/components/ParticleEffects';
import { CharacterRenderer } from '@/rendering/components/CharacterRenderer';

/**
 * The main gameplay scene.
 *
 * Contains three visual layers (back-to-front):
 *  1. ParallaxBackground -- multi-layer scrolling terrain
 *  2. Character layer -- the player character
 *  3. Particle layer -- campfire embers, ambient effects, etc.
 *
 * Listens for era-advance events and transitions the visuals accordingly.
 */
export class GameScene {
  public readonly container: Container;

  private background: ParallaxBackground;
  private characterLayer: Container;
  private particleLayer: Container;

  private character: CharacterRenderer;
  private particles: ParticleEffects;

  private currentEra: EraId = 'dawn';
  private width = 0;
  private height = 0;
  private cameraX = 0;

  /** EventBus unsubscribe handles. */
  private unsubs: Array<() => void> = [];

  /** Index of the campfire emitter, or -1 if not active. */
  private campfireEmitter = -1;

  constructor(private eventBus: EventBus) {
    this.container = new Container();

    // --- Background ---
    this.background = new ParallaxBackground();
    this.container.addChild(this.background.container);

    // --- Character layer ---
    this.characterLayer = new Container();
    this.container.addChild(this.characterLayer);

    this.character = new CharacterRenderer();
    this.characterLayer.addChild(this.character.container);

    // --- Particle layer (in front of character) ---
    this.particleLayer = new Container();
    this.container.addChild(this.particleLayer);

    this.particles = new ParticleEffects(400);
    this.particleLayer.addChild(this.particles.container);

    // --- EventBus subscriptions ---
    this.unsubs.push(
      this.eventBus.on('era:advance', ({ to }) => {
        this.transitionEra(to as EraId);
      }),
    );
  }

  /**
   * Initialize / reset the scene for a given viewport size and era.
   */
  init(width: number, height: number, era: EraId = 'dawn'): void {
    this.width = width;
    this.height = height;
    this.currentEra = era;

    this.background.init(width, height, era);
    this.character.setEra(era);

    // Place character on the ground (~72% down the screen)
    const groundY = height * 0.72;
    this.character.setPosition(width * 0.35, groundY);

    // Start campfire embers near the character
    this.particles.clear();
    this.campfireEmitter = this.particles.play(
      'campfire',
      width * 0.42,
      groundY - 2,
    );

    // Ambient floating particles
    this.particles.play('ambient', width * 0.5, height * 0.5);
  }

  /**
   * Per-frame update.
   * @param dt Delta time in seconds.
   * @param alpha Interpolation alpha from the game loop (0..1).
   */
  update(dt: number, alpha: number): void {
    // Slow automatic scroll for a living background
    this.cameraX += dt * 8;
    this.background.update(this.cameraX, dt * 1000);

    // Keep campfire emitter tracking character position
    if (this.campfireEmitter >= 0) {
      this.particles.moveEmitter(
        this.campfireEmitter,
        this.width * 0.42 - this.cameraX * 0.5,
        this.height * 0.72 - 2,
      );
    }

    this.character.update(dt);
    this.particles.update(dt);
  }

  /**
   * Switch visual era. Rebuilds background, swaps palette, restarts particles.
   */
  transitionEra(era: EraId): void {
    if (era === this.currentEra) return;
    this.currentEra = era;

    this.background.setEra(era);
    this.character.setEra(era);

    // Restart particle effects for new era
    this.particles.clear();
    const groundY = this.height * 0.72;
    this.campfireEmitter = this.particles.play('campfire', this.width * 0.42, groundY - 2);
    this.particles.play('ambient', this.width * 0.5, this.height * 0.5);
  }

  /**
   * Handle viewport resize.
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    this.background.resize(width, height);

    // Reposition character
    const groundY = height * 0.72;
    this.character.setPosition(width * 0.35, groundY);
  }

  /**
   * Clean up resources and subscriptions.
   */
  dispose(): void {
    for (const unsub of this.unsubs) unsub();
    this.unsubs = [];
    this.particles.dispose();
    this.character.dispose();
    this.container.destroy({ children: true });
  }
}
