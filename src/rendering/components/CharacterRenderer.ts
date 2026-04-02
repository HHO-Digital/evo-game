import { Container, Graphics } from 'pixi.js';
import type { EraId } from '@/types';

/**
 * Era-specific visual style for a detailed, realistic humanoid character.
 * Each era defines skin, hair, clothing, accessories, and body build.
 */
interface CharacterStyle {
  skinTone: number;
  skinHighlight: number;
  skinShadow: number;
  hairColor: number;
  hairStyle: 'wild' | 'tied' | 'short' | 'braided';
  clothingPrimary: number;
  clothingSecondary: number;
  clothingAccent: number;
  hasShoulderFur: boolean;
  hasBelt: boolean;
  hasHeadband: boolean;
  toolType: 'spear' | 'staff' | 'axe' | null;
  toolColor: number;
  bodyBuild: 'muscular' | 'lean' | 'average';
  eyeColor: number;
}

/** Character dimensions at the base scale. */
const BASE_HEIGHT = 90;
const HEAD_RATIO = 1 / 7.5;
const HEAD_RADIUS = (BASE_HEIGHT * HEAD_RATIO) / 2 * 2.2;
const TORSO_HEIGHT = BASE_HEIGHT * 0.30;
const TORSO_WIDTH = HEAD_RADIUS * 2.8;
const LEG_LENGTH = BASE_HEIGHT * 0.40;
const ARM_LENGTH = BASE_HEIGHT * 0.32;
const NECK_LENGTH = BASE_HEIGHT * 0.04;
const SHOULDER_WIDTH = TORSO_WIDTH * 1.15;
const HIP_WIDTH = TORSO_WIDTH * 0.75;
const LIMB_THICKNESS = 5;
const HAND_RADIUS = 3;
const FOOT_LENGTH = 8;
const FOOT_HEIGHT = 4;

const ERA_STYLES: Partial<Record<EraId, CharacterStyle>> = {
  dawn: {
    skinTone: 0xc8956c,
    skinHighlight: 0xdaaa80,
    skinShadow: 0xa67a52,
    hairColor: 0x3a2a1a,
    hairStyle: 'wild',
    clothingPrimary: 0x8b6914,
    clothingSecondary: 0x6b4226,
    clothingAccent: 0x5a3a1a,
    hasShoulderFur: true,
    hasBelt: false,
    hasHeadband: false,
    toolType: 'spear',
    toolColor: 0x7a5c30,
    bodyBuild: 'muscular',
    eyeColor: 0x3a2a1a,
  },
  awakening: {
    skinTone: 0xc8956c,
    skinHighlight: 0xdaaa80,
    skinShadow: 0xa67a52,
    hairColor: 0x2a1a0a,
    hairStyle: 'tied',
    clothingPrimary: 0x8b7d5a,
    clothingSecondary: 0x6b5a3a,
    clothingAccent: 0xa09060,
    hasShoulderFur: false,
    hasBelt: true,
    hasHeadband: true,
    toolType: 'staff',
    toolColor: 0x5a4020,
    bodyBuild: 'lean',
    eyeColor: 0x3a2a1a,
  },
  roots: {
    skinTone: 0xc8956c,
    skinHighlight: 0xdaaa80,
    skinShadow: 0xa67a52,
    hairColor: 0x1a0a00,
    hairStyle: 'short',
    clothingPrimary: 0x6b4226,
    clothingSecondary: 0x4a2a16,
    clothingAccent: 0x8b6914,
    hasShoulderFur: false,
    hasBelt: true,
    hasHeadband: false,
    toolType: 'axe',
    toolColor: 0x777777,
    bodyBuild: 'average',
    eyeColor: 0x3a2a1a,
  },
};

const DEFAULT_STYLE: CharacterStyle = ERA_STYLES['dawn']!;

/**
 * Renders a detailed, proportional human character using PixiJS Graphics.
 *
 * Features:
 * - Realistic body proportions (~1:7.5 head-to-body)
 * - Multi-layer shading for depth
 * - Era-specific clothing, hair, and tools
 * - Walking animation with arm/leg swing and body sway
 * - Idle animation with breathing and occasional head turn
 * - Foot shadow
 * - Direction facing based on movement
 */
export class CharacterRenderer {
  public readonly container: Container;

  private graphics: Graphics;
  private shadowGraphics: Graphics;
  private currentEra: EraId = 'dawn';
  private style: CharacterStyle = DEFAULT_STYLE;

  // --- Animation state ---
  /** Idle breathing phase (radians). */
  private breathPhase = 0;
  private readonly breathSpeed = 2.0;
  private readonly breathAmount = 1.5;

  /** Head turn timer for idle. */
  private headTurnTimer = 0;
  private headTurnAngle = 0;
  private headTurnTarget = 0;
  private readonly headTurnInterval = 4.0;

  /** Walk cycle phase (radians). */
  private walkPhase = 0;
  private readonly walkCycleSpeed = 8.0;

  /** Movement state. */
  private isMoving = false;
  private moveDirection: -1 | 0 | 1 = 0;
  private facingDirection: -1 | 1 = 1;

  /** Position (feet / ground contact point). */
  private groundX = 0;
  private groundY = 0;

  constructor() {
    this.container = new Container();

    this.shadowGraphics = new Graphics();
    this.container.addChild(this.shadowGraphics);

    this.graphics = new Graphics();
    this.container.addChild(this.graphics);

    this.applyStyle(this.style);
  }

  /**
   * Set the character's foot position in scene-space.
   */
  setPosition(x: number, y: number): void {
    this.groundX = x;
    this.groundY = y;
    this.container.x = x;
    this.container.y = y;
  }

  /**
   * Get the character's current foot position.
   */
  getPosition(): { x: number; y: number } {
    return { x: this.groundX, y: this.groundY };
  }

  /**
   * Set whether the character is moving and in which direction.
   * @param moving Whether the character is currently walking.
   * @param direction -1 for left, 1 for right, 0 for stationary.
   */
  setMoving(moving: boolean, direction: -1 | 0 | 1): void {
    this.isMoving = moving;
    this.moveDirection = direction;
    if (direction !== 0) {
      this.facingDirection = direction as -1 | 1;
    }
    if (!moving) {
      // Smoothly return walk phase to rest
      this.walkPhase = 0;
    }
  }

  /**
   * Switch era visual style.
   */
  setEra(era: EraId): void {
    if (era === this.currentEra) return;
    this.currentEra = era;
    this.style = ERA_STYLES[era] ?? DEFAULT_STYLE;
    this.drawCharacter(0, 0, 0, 0, 0, 0);
  }

  /**
   * Called each frame. Advances animations and redraws.
   * @param dt Delta time in seconds.
   */
  update(dt: number): void {
    // Breathing animation
    this.breathPhase += this.breathSpeed * dt;
    if (this.breathPhase > Math.PI * 2) {
      this.breathPhase -= Math.PI * 2;
    }
    const breathOffset = Math.sin(this.breathPhase) * this.breathAmount;

    // Head turn (idle only)
    if (!this.isMoving) {
      this.headTurnTimer += dt;
      if (this.headTurnTimer >= this.headTurnInterval) {
        this.headTurnTimer = 0;
        // Pick a new random subtle head turn target
        this.headTurnTarget = (Math.random() - 0.5) * 4;
      }
      // Ease toward target
      this.headTurnAngle += (this.headTurnTarget - this.headTurnAngle) * dt * 2;
    } else {
      this.headTurnAngle += (0 - this.headTurnAngle) * dt * 5;
    }

    // Walk animation
    let leftLegSwing = 0;
    let rightLegSwing = 0;
    let leftArmSwing = 0;
    let rightArmSwing = 0;
    let bodySway = 0;

    if (this.isMoving) {
      this.walkPhase += this.walkCycleSpeed * dt;
      if (this.walkPhase > Math.PI * 2) {
        this.walkPhase -= Math.PI * 2;
      }
      const swing = Math.sin(this.walkPhase);
      leftLegSwing = swing * 18;
      rightLegSwing = -swing * 18;
      leftArmSwing = -swing * 14;
      rightArmSwing = swing * 14;
      bodySway = Math.sin(this.walkPhase * 2) * 1.0;
    }

    this.drawCharacter(
      breathOffset,
      leftLegSwing,
      rightLegSwing,
      leftArmSwing,
      rightArmSwing,
      bodySway,
    );
  }

  /**
   * Redraw the full character with animation parameters.
   */
  private drawCharacter(
    breathOffset: number,
    leftLegAngleDeg: number,
    rightLegAngleDeg: number,
    leftArmAngleDeg: number,
    rightArmAngleDeg: number,
    bodySway: number,
  ): void {
    const g = this.graphics;
    const s = this.style;
    g.clear();

    const dir = this.facingDirection;
    const cx = bodySway * dir;

    // All positions relative to feet (0,0)
    const feetY = 0;
    const hipY = feetY - LEG_LENGTH;
    const waistY = hipY;
    const shoulderY = hipY - TORSO_HEIGHT - breathOffset;
    const neckY = shoulderY - NECK_LENGTH;
    const headCenterY = neckY - HEAD_RADIUS;

    // ========== SHADOW ==========
    this.drawShadow(feetY);

    // ========== LEGS (behind torso) ==========
    this.drawLeg(g, s, cx - HIP_WIDTH * 0.35, hipY, leftLegAngleDeg, feetY, false);
    this.drawLeg(g, s, cx + HIP_WIDTH * 0.35, hipY, rightLegAngleDeg, feetY, true);

    // ========== BACK ARM ==========
    const backArmDir = dir === 1 ? -1 : 1;
    const backArmAngle = backArmDir === -1 ? leftArmAngleDeg : rightArmAngleDeg;
    this.drawArm(g, s, cx + (SHOULDER_WIDTH * 0.5) * backArmDir, shoulderY, backArmAngle, dir, true);

    // ========== TORSO ==========
    this.drawTorso(g, s, cx, shoulderY, waistY, breathOffset);

    // ========== CLOTHING ==========
    this.drawClothing(g, s, cx, shoulderY, waistY, hipY, breathOffset);

    // ========== FRONT ARM (with tool if applicable) ==========
    const frontArmDir = dir === 1 ? 1 : -1;
    const frontArmAngle = frontArmDir === 1 ? rightArmAngleDeg : leftArmAngleDeg;
    this.drawArm(g, s, cx + (SHOULDER_WIDTH * 0.5) * frontArmDir, shoulderY, frontArmAngle, dir, false);

    // ========== TOOL ==========
    if (s.toolType) {
      this.drawTool(g, s, cx + (SHOULDER_WIDTH * 0.5) * frontArmDir, shoulderY, frontArmAngle, dir);
    }

    // ========== NECK ==========
    g.rect(cx - 3, neckY, 6, NECK_LENGTH + 2).fill(s.skinTone);

    // ========== HEAD ==========
    this.drawHead(g, s, cx + this.headTurnAngle, headCenterY, dir);
  }

  /**
   * Draw the ground shadow under the character's feet.
   */
  private drawShadow(feetY: number): void {
    const sg = this.shadowGraphics;
    sg.clear();
    sg.ellipse(0, feetY + 1, 18, 5).fill({ color: 0x000000, alpha: 0.25 });
  }

  /**
   * Draw one leg with angular swing for walk animation.
   */
  private drawLeg(
    g: Graphics,
    s: CharacterStyle,
    hipX: number,
    hipY: number,
    angleDeg: number,
    _feetY: number,
    isRight: boolean,
  ): void {
    const angleRad = (angleDeg * Math.PI) / 180;
    const thighLen = LEG_LENGTH * 0.52;
    const shinLen = LEG_LENGTH * 0.48;

    // Thigh: swings from hip
    const kneeX = hipX + Math.sin(angleRad) * thighLen;
    const kneeY = hipY + Math.cos(angleRad) * thighLen;

    // Shin: secondary swing (opposite direction for natural bend)
    const shinAngle = angleRad * 0.5 + (angleDeg > 0 ? -0.2 : 0.2);
    const ankleX = kneeX + Math.sin(shinAngle) * shinLen;
    const ankleY = kneeY + Math.cos(shinAngle) * shinLen;

    // --- Thigh ---
    // Shadow edge
    g.moveTo(hipX - 0.5, hipY);
    g.lineTo(kneeX - 0.5, kneeY);
    g.stroke({ width: LIMB_THICKNESS + 2, color: s.skinShadow });
    // Main
    g.moveTo(hipX, hipY);
    g.lineTo(kneeX, kneeY);
    g.stroke({ width: LIMB_THICKNESS, color: s.skinTone });
    // Highlight
    g.moveTo(hipX + 0.5, hipY);
    g.lineTo(kneeX + 0.5, kneeY);
    g.stroke({ width: LIMB_THICKNESS - 2, color: s.skinHighlight });

    // --- Shin ---
    g.moveTo(kneeX - 0.5, kneeY);
    g.lineTo(ankleX - 0.5, ankleY);
    g.stroke({ width: LIMB_THICKNESS + 1, color: s.skinShadow });
    g.moveTo(kneeX, kneeY);
    g.lineTo(ankleX, ankleY);
    g.stroke({ width: LIMB_THICKNESS - 1, color: s.skinTone });

    // --- Foot ---
    const footDir = isRight ? 1 : -1;
    g.moveTo(ankleX, ankleY);
    g.lineTo(ankleX + FOOT_LENGTH * footDir * 0.5, ankleY + FOOT_HEIGHT);
    g.lineTo(ankleX - FOOT_LENGTH * footDir * 0.2, ankleY + FOOT_HEIGHT);
    g.closePath();
    g.fill(s.clothingSecondary);
  }

  /**
   * Draw one arm with angular swing.
   */
  private drawArm(
    g: Graphics,
    s: CharacterStyle,
    shoulderX: number,
    shoulderY: number,
    angleDeg: number,
    _dir: number,
    isBack: boolean,
  ): void {
    const angleRad = (angleDeg * Math.PI) / 180;
    const upperLen = ARM_LENGTH * 0.5;
    const lowerLen = ARM_LENGTH * 0.5;

    // Upper arm
    const elbowX = shoulderX + Math.sin(angleRad) * upperLen;
    const elbowY = shoulderY + Math.cos(angleRad) * upperLen;

    // Lower arm: slight secondary swing
    const forearmAngle = angleRad * 0.6;
    const handX = elbowX + Math.sin(forearmAngle) * lowerLen;
    const handY = elbowY + Math.cos(forearmAngle) * lowerLen;

    const thickness = isBack ? LIMB_THICKNESS - 1 : LIMB_THICKNESS;
    const tone = isBack ? s.skinShadow : s.skinTone;
    const highlight = isBack ? s.skinTone : s.skinHighlight;

    // Upper arm shadow
    g.moveTo(shoulderX, shoulderY);
    g.lineTo(elbowX, elbowY);
    g.stroke({ width: thickness + 2, color: s.skinShadow });
    // Upper arm main
    g.moveTo(shoulderX, shoulderY);
    g.lineTo(elbowX, elbowY);
    g.stroke({ width: thickness, color: tone });

    // Lower arm
    g.moveTo(elbowX, elbowY);
    g.lineTo(handX, handY);
    g.stroke({ width: thickness + 1, color: s.skinShadow });
    g.moveTo(elbowX, elbowY);
    g.lineTo(handX, handY);
    g.stroke({ width: thickness - 1, color: highlight });

    // Hand
    g.circle(handX, handY, HAND_RADIUS).fill(tone);
  }

  /**
   * Draw the character's torso with shading layers.
   */
  private drawTorso(
    g: Graphics,
    s: CharacterStyle,
    cx: number,
    shoulderY: number,
    waistY: number,
    _breathOffset: number,
  ): void {
    const build = s.bodyBuild;
    const chestExtra = build === 'muscular' ? 3 : build === 'lean' ? -1 : 0;
    const halfShoulder = SHOULDER_WIDTH / 2 + chestExtra;
    const halfHip = HIP_WIDTH / 2;

    // Shadow layer (dark edge on left side)
    g.moveTo(cx - halfShoulder - 1, shoulderY);
    g.lineTo(cx + halfShoulder, shoulderY);
    g.lineTo(cx + halfHip, waistY);
    g.lineTo(cx - halfHip - 1, waistY);
    g.closePath();
    g.fill(s.skinShadow);

    // Main torso shape (trapezoid: wider shoulders, narrower waist)
    g.moveTo(cx - halfShoulder + 1, shoulderY);
    g.lineTo(cx + halfShoulder - 1, shoulderY);
    g.lineTo(cx + halfHip - 1, waistY);
    g.lineTo(cx - halfHip + 1, waistY);
    g.closePath();
    g.fill(s.skinTone);

    // Highlight stripe down center for roundness
    const highlightW = TORSO_WIDTH * 0.2;
    g.moveTo(cx - highlightW / 2, shoulderY + 3);
    g.lineTo(cx + highlightW / 2, shoulderY + 3);
    g.lineTo(cx + highlightW / 3, waistY - 3);
    g.lineTo(cx - highlightW / 3, waistY - 3);
    g.closePath();
    g.fill({ color: s.skinHighlight, alpha: 0.4 });

    // Pectoral / chest definition for muscular build
    if (build === 'muscular') {
      const pecY = shoulderY + TORSO_HEIGHT * 0.2;
      g.ellipse(cx - halfShoulder * 0.35, pecY, halfShoulder * 0.35, TORSO_HEIGHT * 0.15)
        .fill({ color: s.skinShadow, alpha: 0.2 });
      g.ellipse(cx + halfShoulder * 0.35, pecY, halfShoulder * 0.35, TORSO_HEIGHT * 0.15)
        .fill({ color: s.skinShadow, alpha: 0.2 });
    }
  }

  /**
   * Draw era-specific clothing over the torso.
   */
  private drawClothing(
    g: Graphics,
    s: CharacterStyle,
    cx: number,
    shoulderY: number,
    waistY: number,
    hipY: number,
    _breathOffset: number,
  ): void {
    const halfShoulder = SHOULDER_WIDTH / 2;
    const halfHip = HIP_WIDTH / 2;

    if (this.currentEra === 'dawn') {
      // Animal skin loincloth
      const loinY = waistY - 4;
      const loinBottom = hipY + LEG_LENGTH * 0.22;
      g.moveTo(cx - halfHip * 1.1, loinY);
      g.lineTo(cx + halfHip * 1.1, loinY);
      g.lineTo(cx + halfHip * 0.8, loinBottom);
      g.lineTo(cx - halfHip * 0.8, loinBottom);
      g.closePath();
      g.fill(s.clothingPrimary);

      // Ragged edge detail
      const ragSegments = 6;
      g.moveTo(cx - halfHip * 0.8, loinBottom);
      for (let i = 0; i <= ragSegments; i++) {
        const t = i / ragSegments;
        const rx = cx - halfHip * 0.8 + t * halfHip * 1.6;
        const ry = loinBottom + Math.sin(i * 2.7) * 3 + 2;
        g.lineTo(rx, ry);
      }
      g.lineTo(cx + halfHip * 0.8, loinBottom);
      g.closePath();
      g.fill(s.clothingSecondary);

      // Belt / tie
      g.rect(cx - halfHip * 1.1, loinY - 2, halfHip * 2.2, 3).fill(s.clothingAccent);

      // Shoulder fur
      if (s.hasShoulderFur) {
        // Left shoulder fur drape
        g.moveTo(cx - halfShoulder - 2, shoulderY - 2);
        g.lineTo(cx - halfShoulder + 6, shoulderY - 4);
        g.lineTo(cx - halfShoulder + 8, shoulderY + 12);
        g.lineTo(cx - halfShoulder - 4, shoulderY + 15);
        g.lineTo(cx - halfShoulder - 6, shoulderY + 8);
        g.closePath();
        g.fill(s.clothingSecondary);

        // Fur texture lines
        for (let i = 0; i < 4; i++) {
          const fy = shoulderY + i * 3;
          g.moveTo(cx - halfShoulder - 3 + i, fy);
          g.lineTo(cx - halfShoulder - 1 + i, fy + 4);
          g.stroke({ width: 0.5, color: s.clothingAccent });
        }
      }
    } else if (this.currentEra === 'awakening') {
      // Woven tunic
      const tunicTop = shoulderY + 2;
      const tunicBottom = hipY + LEG_LENGTH * 0.25;
      g.moveTo(cx - halfShoulder * 0.9, tunicTop);
      g.lineTo(cx + halfShoulder * 0.9, tunicTop);
      g.lineTo(cx + halfHip * 1.0, tunicBottom);
      g.lineTo(cx - halfHip * 1.0, tunicBottom);
      g.closePath();
      g.fill(s.clothingPrimary);

      // Tunic shadow fold
      g.moveTo(cx - 2, tunicTop + 4);
      g.lineTo(cx, tunicBottom);
      g.lineTo(cx + 2, tunicTop + 4);
      g.closePath();
      g.fill({ color: s.clothingSecondary, alpha: 0.5 });

      // Neckline V
      g.moveTo(cx - 4, tunicTop);
      g.lineTo(cx, tunicTop + 8);
      g.lineTo(cx + 4, tunicTop);
      g.stroke({ width: 1, color: s.clothingAccent });

      // Woven texture (horizontal lines)
      for (let i = 0; i < 5; i++) {
        const ty = tunicTop + 6 + i * ((tunicBottom - tunicTop - 6) / 5);
        const tw = halfHip * 0.8 + (halfShoulder * 0.9 - halfHip * 0.8) * (1 - (ty - tunicTop) / (tunicBottom - tunicTop));
        g.moveTo(cx - tw, ty);
        g.lineTo(cx + tw, ty);
        g.stroke({ width: 0.5, color: s.clothingSecondary });
      }

      // Belt
      if (s.hasBelt) {
        g.rect(cx - halfHip * 1.0, waistY - 2, halfHip * 2.0, 4).fill(s.clothingAccent);
        // Buckle
        g.rect(cx - 2, waistY - 2, 4, 4).fill(0xccaa44);
      }

      // Headband
      if (s.hasHeadband) {
        // Drawn later in drawHead
      }
    } else {
      // Default / roots: leather vest + pants
      const vestTop = shoulderY + 1;
      const vestBottom = waistY + 4;
      g.moveTo(cx - halfShoulder * 0.85, vestTop);
      g.lineTo(cx + halfShoulder * 0.85, vestTop);
      g.lineTo(cx + halfHip * 0.95, vestBottom);
      g.lineTo(cx - halfHip * 0.95, vestBottom);
      g.closePath();
      g.fill(s.clothingPrimary);

      // Vest opening
      g.moveTo(cx, vestTop);
      g.lineTo(cx, vestBottom);
      g.stroke({ width: 1.5, color: s.clothingSecondary });

      // Trousers
      const pantsTop = waistY - 2;
      const pantsBottom = hipY + LEG_LENGTH * 0.4;
      g.moveTo(cx - halfHip * 0.9, pantsTop);
      g.lineTo(cx + halfHip * 0.9, pantsTop);
      g.lineTo(cx + halfHip * 0.7, pantsBottom);
      g.lineTo(cx - halfHip * 0.7, pantsBottom);
      g.closePath();
      g.fill(s.clothingSecondary);

      if (s.hasBelt) {
        g.rect(cx - halfHip * 0.95, pantsTop, halfHip * 1.9, 3).fill(s.clothingAccent);
      }
    }
  }

  /**
   * Draw the head with face features, hair, and optional headband.
   */
  private drawHead(
    g: Graphics,
    s: CharacterStyle,
    headX: number,
    headCenterY: number,
    dir: number,
  ): void {
    const r = HEAD_RADIUS;

    // Head shadow
    g.circle(headX - 0.5, headCenterY + 0.5, r + 1).fill({ color: s.skinShadow, alpha: 0.6 });

    // Head base
    g.circle(headX, headCenterY, r).fill(s.skinTone);

    // Head highlight (upper-left crescent)
    g.circle(headX + 1, headCenterY - 1, r * 0.8).fill({ color: s.skinHighlight, alpha: 0.35 });

    // --- Jaw / chin definition ---
    g.ellipse(headX, headCenterY + r * 0.55, r * 0.6, r * 0.5).fill({ color: s.skinShadow, alpha: 0.12 });

    // --- Eyes ---
    const eyeSpacing = r * 0.38;
    const eyeY = headCenterY - r * 0.1;
    const eyeShiftX = dir * r * 0.08; // Slight shift based on facing

    // Eye whites
    g.ellipse(headX - eyeSpacing + eyeShiftX, eyeY, 2.5, 1.8).fill(0xfafafa);
    g.ellipse(headX + eyeSpacing + eyeShiftX, eyeY, 2.5, 1.8).fill(0xfafafa);

    // Iris
    g.circle(headX - eyeSpacing + eyeShiftX + dir * 0.5, eyeY, 1.3).fill(s.eyeColor);
    g.circle(headX + eyeSpacing + eyeShiftX + dir * 0.5, eyeY, 1.3).fill(s.eyeColor);

    // Pupil
    g.circle(headX - eyeSpacing + eyeShiftX + dir * 0.7, eyeY, 0.6).fill(0x111111);
    g.circle(headX + eyeSpacing + eyeShiftX + dir * 0.7, eyeY, 0.6).fill(0x111111);

    // Eyebrows
    const browY = eyeY - 3;
    g.moveTo(headX - eyeSpacing - 2 + eyeShiftX, browY + 0.5);
    g.lineTo(headX - eyeSpacing + 3 + eyeShiftX, browY - 0.5);
    g.stroke({ width: 1.2, color: s.hairColor });
    g.moveTo(headX + eyeSpacing - 3 + eyeShiftX, browY - 0.5);
    g.lineTo(headX + eyeSpacing + 2 + eyeShiftX, browY + 0.5);
    g.stroke({ width: 1.2, color: s.hairColor });

    // --- Nose ---
    const noseY = headCenterY + r * 0.15;
    g.moveTo(headX + dir * 0.5, eyeY + 1);
    g.lineTo(headX + dir * 1.5, noseY);
    g.lineTo(headX + dir * 0, noseY + 1);
    g.stroke({ width: 0.8, color: s.skinShadow });

    // --- Mouth ---
    const mouthY = headCenterY + r * 0.45;
    g.moveTo(headX - 2.5, mouthY);
    g.lineTo(headX - 0.5, mouthY + 1);
    g.lineTo(headX + 1.5, mouthY);
    g.stroke({ width: 0.8, color: s.skinShadow });

    // --- Ears ---
    const earY = headCenterY;
    g.ellipse(headX - r - 1, earY, 2, 3).fill(s.skinTone);
    g.ellipse(headX + r + 1, earY, 2, 3).fill(s.skinTone);

    // --- Hair ---
    this.drawHair(g, s, headX, headCenterY, r, dir);

    // --- Headband (awakening) ---
    if (s.hasHeadband) {
      const bandY = headCenterY - r * 0.4;
      g.moveTo(headX - r - 1, bandY);
      g.lineTo(headX + r + 1, bandY);
      g.lineTo(headX + r + 1, bandY + 2.5);
      g.lineTo(headX - r - 1, bandY + 2.5);
      g.closePath();
      g.fill(s.clothingAccent);
    }
  }

  /**
   * Draw era-specific hair style.
   */
  private drawHair(
    g: Graphics,
    s: CharacterStyle,
    headX: number,
    headCenterY: number,
    r: number,
    _dir: number,
  ): void {
    const hairTop = headCenterY - r;
    const darkHair = this.darkenColor(s.hairColor, 0.2);

    switch (s.hairStyle) {
      case 'wild': {
        // Wild, messy long hair flowing outward
        // Base hair cap
        g.moveTo(headX - r - 3, headCenterY - r * 0.1);
        g.lineTo(headX - r - 1, hairTop - 2);
        g.lineTo(headX - r * 0.5, hairTop - 5);
        g.lineTo(headX, hairTop - 6);
        g.lineTo(headX + r * 0.5, hairTop - 5);
        g.lineTo(headX + r + 1, hairTop - 2);
        g.lineTo(headX + r + 3, headCenterY - r * 0.1);
        g.lineTo(headX + r + 1, headCenterY);
        g.lineTo(headX + r, headCenterY - r * 0.3);
        g.lineTo(headX - r, headCenterY - r * 0.3);
        g.lineTo(headX - r - 1, headCenterY);
        g.closePath();
        g.fill(s.hairColor);

        // Wild strands hanging down
        for (let i = 0; i < 5; i++) {
          const strandX = headX - r - 2 + i * ((r * 2 + 4) / 4);
          const strandLen = 8 + Math.sin(i * 2.1) * 5;
          g.moveTo(strandX, headCenterY - r * 0.1);
          g.lineTo(strandX - 1 + Math.sin(i * 1.5) * 3, headCenterY - r * 0.1 + strandLen);
          g.lineTo(strandX + 1, headCenterY - r * 0.1 + strandLen - 1);
          g.closePath();
          g.fill(darkHair);
        }
        break;
      }
      case 'tied': {
        // Pulled back and tied
        g.moveTo(headX - r, headCenterY - r * 0.2);
        g.lineTo(headX - r + 1, hairTop - 3);
        g.lineTo(headX, hairTop - 4);
        g.lineTo(headX + r - 1, hairTop - 3);
        g.lineTo(headX + r, headCenterY - r * 0.2);
        g.lineTo(headX + r - 1, headCenterY - r * 0.35);
        g.lineTo(headX - r + 1, headCenterY - r * 0.35);
        g.closePath();
        g.fill(s.hairColor);

        // Ponytail / tie at back
        const tieX = headX + r + 2;
        const tieY = headCenterY - r * 0.3;
        g.moveTo(headX + r, headCenterY - r * 0.3);
        g.lineTo(tieX, tieY);
        g.lineTo(tieX + 3, tieY + 8);
        g.lineTo(tieX + 1, tieY + 12);
        g.lineTo(tieX - 1, tieY + 10);
        g.lineTo(headX + r - 1, tieY + 2);
        g.closePath();
        g.fill(s.hairColor);
        // Tie
        g.rect(tieX - 1, tieY - 1, 3, 2).fill(s.clothingAccent);
        break;
      }
      case 'short': {
        // Short cropped hair
        g.moveTo(headX - r - 0.5, headCenterY - r * 0.25);
        g.lineTo(headX - r + 1, hairTop - 2);
        g.lineTo(headX - r * 0.3, hairTop - 3);
        g.lineTo(headX + r * 0.3, hairTop - 3);
        g.lineTo(headX + r - 1, hairTop - 2);
        g.lineTo(headX + r + 0.5, headCenterY - r * 0.25);
        g.lineTo(headX + r - 0.5, headCenterY - r * 0.35);
        g.lineTo(headX - r + 0.5, headCenterY - r * 0.35);
        g.closePath();
        g.fill(s.hairColor);
        break;
      }
      case 'braided': {
        // Base cap
        g.moveTo(headX - r, headCenterY - r * 0.15);
        g.lineTo(headX - r + 1, hairTop - 3);
        g.lineTo(headX, hairTop - 5);
        g.lineTo(headX + r - 1, hairTop - 3);
        g.lineTo(headX + r, headCenterY - r * 0.15);
        g.lineTo(headX + r - 1, headCenterY - r * 0.3);
        g.lineTo(headX - r + 1, headCenterY - r * 0.3);
        g.closePath();
        g.fill(s.hairColor);

        // Braid
        const braidX = headX - r - 1;
        for (let i = 0; i < 4; i++) {
          const by = headCenterY + i * 4;
          const bx = braidX + (i % 2 === 0 ? -1 : 1);
          g.circle(bx, by, 1.8).fill(i % 2 === 0 ? s.hairColor : darkHair);
        }
        break;
      }
    }
  }

  /**
   * Draw the tool held by the character's front hand.
   */
  private drawTool(
    g: Graphics,
    s: CharacterStyle,
    shoulderX: number,
    shoulderY: number,
    armAngleDeg: number,
    dir: number,
  ): void {
    const angleRad = (armAngleDeg * Math.PI) / 180;
    const upperLen = ARM_LENGTH * 0.5;
    const lowerLen = ARM_LENGTH * 0.5;
    const elbowX = shoulderX + Math.sin(angleRad) * upperLen;
    const elbowY = shoulderY + Math.cos(angleRad) * upperLen;
    const forearmAngle = angleRad * 0.6;
    const handX = elbowX + Math.sin(forearmAngle) * lowerLen;
    const handY = elbowY + Math.cos(forearmAngle) * lowerLen;

    switch (s.toolType) {
      case 'spear': {
        // Long shaft
        const tipX = handX + dir * 5;
        const tipY = handY - 35;
        g.moveTo(handX, handY);
        g.lineTo(tipX, tipY);
        g.stroke({ width: 2, color: s.toolColor });
        // Spearhead
        g.moveTo(tipX - 2, tipY + 4);
        g.lineTo(tipX, tipY - 4);
        g.lineTo(tipX + 2, tipY + 4);
        g.closePath();
        g.fill(0x888888);
        break;
      }
      case 'staff': {
        // Wooden staff
        const staffTopX = handX + dir * 2;
        const staffTopY = handY - 30;
        const staffBottomX = handX - dir * 2;
        const staffBottomY = handY + 10;
        g.moveTo(staffTopX, staffTopY);
        g.lineTo(staffBottomX, staffBottomY);
        g.stroke({ width: 2.5, color: s.toolColor });
        // Knob at top
        g.circle(staffTopX, staffTopY, 3).fill(this.lightenColor(s.toolColor, 0.3));
        break;
      }
      case 'axe': {
        // Handle
        const handleTopX = handX + dir * 3;
        const handleTopY = handY - 24;
        g.moveTo(handX, handY);
        g.lineTo(handleTopX, handleTopY);
        g.stroke({ width: 2, color: s.toolColor });
        // Axe head
        g.moveTo(handleTopX, handleTopY - 3);
        g.lineTo(handleTopX + dir * 8, handleTopY);
        g.lineTo(handleTopX + dir * 7, handleTopY + 6);
        g.lineTo(handleTopX, handleTopY + 3);
        g.closePath();
        g.fill(0x999999);
        // Edge highlight
        g.moveTo(handleTopX + dir * 7.5, handleTopY);
        g.lineTo(handleTopX + dir * 6.5, handleTopY + 5);
        g.stroke({ width: 0.8, color: 0xcccccc });
        break;
      }
    }
  }

  /**
   * Apply a new style and redraw.
   */
  private applyStyle(style: CharacterStyle): void {
    this.style = style;
    this.drawCharacter(0, 0, 0, 0, 0, 0);
  }

  /**
   * Get the overall height of the drawn character.
   */
  getHeight(): number {
    return BASE_HEIGHT;
  }

  /**
   * Clean up.
   */
  dispose(): void {
    this.container.destroy({ children: true });
  }

  // --- Color utility helpers ---

  private darkenColor(color: number, amount: number): number {
    const r = Math.max(0, Math.round(((color >> 16) & 0xff) * (1 - amount)));
    const gr = Math.max(0, Math.round(((color >> 8) & 0xff) * (1 - amount)));
    const b = Math.max(0, Math.round((color & 0xff) * (1 - amount)));
    return (r << 16) | (gr << 8) | b;
  }

  private lightenColor(color: number, amount: number): number {
    const r = Math.min(255, Math.round(((color >> 16) & 0xff) + (255 - ((color >> 16) & 0xff)) * amount));
    const gr = Math.min(255, Math.round(((color >> 8) & 0xff) + (255 - ((color >> 8) & 0xff)) * amount));
    const b = Math.min(255, Math.round((color & 0xff) + (255 - (color & 0xff)) * amount));
    return (r << 16) | (gr << 8) | b;
  }
}
