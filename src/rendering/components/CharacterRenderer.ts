import { Container, Graphics } from 'pixi.js';
import type { EraId } from '@/types';

/**
 * Era-specific visual complexity for the character.
 * In later eras the figure gets progressively more detailed.
 */
interface CharacterStyle {
  /** Overall scale multiplier. */
  scale: number;
  /** Head radius. */
  headRadius: number;
  /** Body width / height. */
  bodyWidth: number;
  bodyHeight: number;
  /** Limb thickness. */
  limbThickness: number;
  /** Skin color (hex number). */
  skinColor: number;
  /** Clothing color (hex number, or null for no clothing). */
  clothingColor: number | null;
  /** Draw a simple tool in the hand? */
  hasTool: boolean;
  /** Tool color. */
  toolColor: number;
}

const ERA_STYLES: Partial<Record<EraId, CharacterStyle>> = {
  dawn: {
    scale: 1,
    headRadius: 6,
    bodyWidth: 8,
    bodyHeight: 16,
    limbThickness: 2.5,
    skinColor: 0xc8956c,
    clothingColor: null,
    hasTool: false,
    toolColor: 0x8b6914,
  },
  awakening: {
    scale: 1.05,
    headRadius: 6,
    bodyWidth: 9,
    bodyHeight: 17,
    limbThickness: 2.5,
    skinColor: 0xc8956c,
    clothingColor: 0x8b6914,
    hasTool: true,
    toolColor: 0x8b6914,
  },
  roots: {
    scale: 1.1,
    headRadius: 6,
    bodyWidth: 10,
    bodyHeight: 18,
    limbThickness: 3,
    skinColor: 0xc8956c,
    clothingColor: 0x6b4226,
    hasTool: true,
    toolColor: 0x555555,
  },
};

const DEFAULT_STYLE: CharacterStyle = {
  scale: 1,
  headRadius: 6,
  bodyWidth: 8,
  bodyHeight: 16,
  limbThickness: 2.5,
  skinColor: 0xc8956c,
  clothingColor: null,
  hasTool: false,
  toolColor: 0x8b6914,
};

/**
 * Draws a simple procedural humanoid character using PixiJS Graphics.
 * The character has a head, body, arms, and legs, with optional
 * clothing and a held tool depending on the era.
 *
 * An idle animation produces a subtle vertical bob.
 */
export class CharacterRenderer {
  public readonly container: Container;

  private graphics: Graphics;
  private currentEra: EraId = 'dawn';
  private style: CharacterStyle = DEFAULT_STYLE;

  /** Idle animation phase accumulator (radians). */
  private idlePhase = 0;
  /** Pixels of vertical bob for idle animation. */
  private readonly idleBobAmount = 2;
  /** Idle cycle speed (radians per second). */
  private readonly idleSpeed = 2.5;

  /** Position where the character "stands" (feet). */
  private groundX = 0;
  private groundY = 0;

  constructor() {
    this.container = new Container();
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
   * Switch era visual style.
   */
  setEra(era: EraId): void {
    if (era === this.currentEra) return;
    this.currentEra = era;
    this.style = ERA_STYLES[era] ?? DEFAULT_STYLE;
    this.drawCharacter(0);
  }

  /**
   * Called each frame. Advances idle animation and redraws.
   * @param dt Delta time in seconds.
   */
  update(dt: number): void {
    this.idlePhase += this.idleSpeed * dt;
    if (this.idlePhase > Math.PI * 2) {
      this.idlePhase -= Math.PI * 2;
    }
    this.drawCharacter(Math.sin(this.idlePhase) * this.idleBobAmount);
  }

  /**
   * Redraw the character with a given vertical offset (for idle bob).
   */
  private drawCharacter(bobOffset: number): void {
    const g = this.graphics;
    const s = this.style;
    g.clear();

    const scale = s.scale;
    const cx = 0; // center x (relative to container)
    const feetY = 0; // feet at container origin
    const headCenterY = feetY - (s.bodyHeight + s.headRadius * 2 + 2) * scale + bobOffset;
    const neckY = headCenterY + s.headRadius * scale;
    const bodyTopY = neckY + 2 * scale;
    const bodyBottomY = bodyTopY + s.bodyHeight * scale;
    const halfBody = (s.bodyWidth / 2) * scale;

    // --- Legs ---
    const legLength = (feetY - bodyBottomY + bobOffset);
    // Left leg
    g.moveTo(cx - halfBody * 0.4, bodyBottomY);
    g.lineTo(cx - halfBody * 0.6, feetY + bobOffset);
    g.stroke({ width: s.limbThickness * scale, color: s.skinColor });

    // Right leg
    g.moveTo(cx + halfBody * 0.4, bodyBottomY);
    g.lineTo(cx + halfBody * 0.6, feetY + bobOffset);
    g.stroke({ width: s.limbThickness * scale, color: s.skinColor });

    // --- Body ---
    if (s.clothingColor !== null) {
      // Clothing: a slightly wider rectangle
      g.roundRect(
        cx - halfBody * 0.7,
        bodyTopY,
        halfBody * 1.4,
        s.bodyHeight * scale,
        2,
      ).fill(s.clothingColor);
    }
    // Torso
    g.roundRect(
      cx - halfBody * 0.5,
      bodyTopY,
      halfBody,
      s.bodyHeight * scale,
      2,
    ).fill(s.skinColor);

    // --- Arms ---
    const shoulderY = bodyTopY + 2 * scale;
    const armEndY = bodyBottomY - 2 * scale;

    // Left arm
    g.moveTo(cx - halfBody, shoulderY);
    g.lineTo(cx - halfBody * 1.3, armEndY);
    g.stroke({ width: s.limbThickness * scale, color: s.skinColor });

    // Right arm
    g.moveTo(cx + halfBody, shoulderY);
    if (s.hasTool) {
      // Arm raised slightly when holding a tool
      g.lineTo(cx + halfBody * 1.5, shoulderY - 4 * scale);
      g.stroke({ width: s.limbThickness * scale, color: s.skinColor });

      // Tool (simple stick)
      const toolBaseX = cx + halfBody * 1.5;
      const toolBaseY = shoulderY - 4 * scale;
      g.moveTo(toolBaseX, toolBaseY);
      g.lineTo(toolBaseX + 4 * scale, toolBaseY - 12 * scale);
      g.stroke({ width: 2 * scale, color: s.toolColor });
    } else {
      g.lineTo(cx + halfBody * 1.3, armEndY);
      g.stroke({ width: s.limbThickness * scale, color: s.skinColor });
    }

    // --- Head ---
    g.circle(cx, headCenterY, s.headRadius * scale).fill(s.skinColor);

    // Eyes (tiny dots)
    const eyeOffsetX = s.headRadius * 0.35 * scale;
    const eyeOffsetY = -s.headRadius * 0.15 * scale;
    g.circle(cx - eyeOffsetX, headCenterY + eyeOffsetY, 1 * scale).fill(0x222222);
    g.circle(cx + eyeOffsetX, headCenterY + eyeOffsetY, 1 * scale).fill(0x222222);
  }

  /**
   * Apply a new style and redraw.
   */
  private applyStyle(style: CharacterStyle): void {
    this.style = style;
    this.drawCharacter(0);
  }

  /**
   * Get the overall height of the drawn character (approximate, for positioning).
   */
  getHeight(): number {
    const s = this.style;
    return (s.bodyHeight + s.headRadius * 2 + 2) * s.scale + (this.container.y - this.groundY);
  }

  /**
   * Clean up.
   */
  dispose(): void {
    this.container.destroy({ children: true });
  }
}
