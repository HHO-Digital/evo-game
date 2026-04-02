import { Container } from 'pixi.js';
import type { EraId } from '@/types';
import { clamp, lerp } from '@/utils/math';
import { EventBus } from '@/core/EventBus';
import { InputManager } from '@/core/InputManager';
import { ParallaxBackground } from '@/rendering/components/ParallaxBackground';
import { ParticleEffects } from '@/rendering/components/ParticleEffects';
import { CharacterRenderer } from '@/rendering/components/CharacterRenderer';

/** World width in pixels. The character can walk within these bounds. */
const WORLD_WIDTH = 5000;

/** Character horizontal movement speed in pixels per second. */
const MOVE_SPEED = 120;

/** How quickly the camera eases toward the character (per-second factor). */
const CAMERA_EASE = 3.5;

/**
 * The main gameplay scene.
 *
 * Contains four visual layers (back-to-front):
 *  1. ParallaxBackground -- multi-layer scrolling terrain
 *  2. Character layer    -- the player character
 *  3. Particle layer     -- campfire embers, ambient effects, etc.
 *
 * Handles:
 *  - Keyboard input for character movement (arrow keys / WASD)
 *  - Smooth camera following with lerp easing
 *  - Era-advance events and visual transitions
 */
export class GameScene {
  public readonly container: Container;

  private background: ParallaxBackground;
  private characterLayer: Container;
  private particleLayer: Container;

  private character: CharacterRenderer;
  private particles: ParticleEffects;
  private input: InputManager;

  private currentEra: EraId = 'dawn';
  private width = 0;
  private height = 0;

  /** Camera X represents the world-space position the viewport is centered on. */
  private cameraX = 0;
  /** Target camera X (follows the character). */
  private cameraTargetX = 0;

  /** Character world-space X position. */
  private charWorldX = 0;
  /** Ground Y in screen-space (computed from height). */
  private groundY = 0;

  /** EventBus unsubscribe handles. */
  private unsubs: Array<() => void> = [];

  /** Index of the campfire emitter, or -1 if not active. */
  private campfireEmitter = -1;

  constructor(private eventBus: EventBus) {
    this.container = new Container();

    // --- Input ---
    this.input = new InputManager();
    this.input.initialize();

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

      // Gradual era blending: as milestones are completed the visuals
      // smoothly morph toward the next era's palette.
      this.eventBus.on('era:blendChanged', ({ progress, nextEra }) => {
        this.background.setBlendProgress(progress, nextEra as EraId);
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
    this.groundY = height * 0.72;

    this.background.init(width, height, era);
    this.character.setEra(era);

    // Place character in the middle of the world
    this.charWorldX = WORLD_WIDTH * 0.35;
    this.cameraX = this.charWorldX - width / 2;
    this.cameraTargetX = this.cameraX;

    this.updateCharacterScreenPosition();

    // Start campfire embers near the character
    this.particles.clear();
    this.campfireEmitter = this.particles.play(
      'campfire',
      this.charScreenX() + 30,
      this.groundY - 2,
    );

    // Ambient floating particles
    this.particles.play('ambient', width * 0.5, height * 0.5);
  }

  /**
   * Per-frame update.
   * @param dt Delta time in seconds.
   * @param _alpha Interpolation alpha from the game loop (0..1).
   */
  update(dt: number, _alpha: number): void {
    // --- Character movement from input ---
    let moveDir: -1 | 0 | 1 = 0;

    if (this.input.isAnyKeyDown('ArrowLeft', 'a', 'A')) {
      moveDir = -1;
    } else if (this.input.isAnyKeyDown('ArrowRight', 'd', 'D')) {
      moveDir = 1;
    }

    const isMoving = moveDir !== 0;

    if (isMoving) {
      this.charWorldX += moveDir * MOVE_SPEED * dt;
      // Clamp to world bounds (leave a small margin so the character
      // doesn't disappear at the edges)
      this.charWorldX = clamp(this.charWorldX, 40, WORLD_WIDTH - 40);
    }

    // Update character animation state
    this.character.setMoving(isMoving, moveDir);

    // --- Camera: smooth follow ---
    this.cameraTargetX = this.charWorldX - this.width / 2;
    // Clamp camera so it doesn't show beyond world edges
    this.cameraTargetX = clamp(this.cameraTargetX, 0, Math.max(0, WORLD_WIDTH - this.width));

    // Exponential ease toward target
    this.cameraX = lerp(this.cameraX, this.cameraTargetX, 1 - Math.exp(-CAMERA_EASE * dt));

    // --- Update subsystems ---
    this.background.update(this.cameraX, dt * 1000);
    this.updateCharacterScreenPosition();

    // Keep campfire emitter tracking a fixed world position near the character's start
    if (this.campfireEmitter >= 0) {
      const campfireWorldX = WORLD_WIDTH * 0.35 + 30;
      this.particles.moveEmitter(
        this.campfireEmitter,
        campfireWorldX - this.cameraX,
        this.groundY - 2,
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
    this.campfireEmitter = this.particles.play(
      'campfire',
      this.charScreenX() + 30,
      this.groundY - 2,
    );
    this.particles.play('ambient', this.width * 0.5, this.height * 0.5);
  }

  /**
   * Handle viewport resize.
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.groundY = height * 0.72;

    this.background.resize(width, height);
    this.updateCharacterScreenPosition();
  }

  /**
   * Clean up resources and subscriptions.
   */
  dispose(): void {
    for (const unsub of this.unsubs) unsub();
    this.unsubs = [];
    this.input.dispose();
    this.particles.dispose();
    this.character.dispose();
    this.container.destroy({ children: true });
  }

  // ---- Private helpers ----

  /**
   * Convert character world X to screen-space X, accounting for camera.
   */
  private charScreenX(): number {
    return this.charWorldX - this.cameraX;
  }

  /**
   * Update the character's on-screen position based on world position and camera.
   */
  private updateCharacterScreenPosition(): void {
    this.character.setPosition(this.charScreenX(), this.groundY);
  }
}
