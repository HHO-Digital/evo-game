import { Container, Graphics } from 'pixi.js';
import type { EraId } from '@/types';
import { lerp } from '@/utils/math';

/**
 * Color palette for each parallax layer, keyed by era.
 * Each era defines 5 layers: sky, distant, mid, ground, foreground.
 */
interface EraLayerColors {
  skyTop: string;
  skyBottom: string;
  distant: string;
  mid: string;
  ground: string;
  foreground: string;
}

const ERA_PALETTES: Record<string, EraLayerColors> = {
  dawn: {
    skyTop: '#1a0a2e',
    skyBottom: '#cc7722',
    distant: '#36454F',
    mid: '#2d5a27',
    ground: '#5c4033',
    foreground: '#3a2a1a',
  },
  awakening: {
    skyTop: '#1a1a3e',
    skyBottom: '#d4a55a',
    distant: '#4a6050',
    mid: '#3a7a37',
    ground: '#6a5043',
    foreground: '#4a3a2a',
  },
  roots: {
    skyTop: '#1e2a4e',
    skyBottom: '#e0b060',
    distant: '#5a7060',
    mid: '#4a8a47',
    ground: '#7a6053',
    foreground: '#5a4a3a',
  },
};

/** Describes one parallax layer: its graphics, scroll speed, and vertical position. */
interface ParallaxLayer {
  container: Container;
  graphics: Graphics;
  /** Parallax speed multiplier. 0 = static, 1 = full camera speed. */
  speed: number;
  /** Base Y offset as a fraction of screen height (0 = top, 1 = bottom). */
  yFraction: number;
  /** Height as a fraction of screen height. */
  heightFraction: number;
}

/**
 * Multi-layer parallax background with procedurally-drawn terrain silhouettes.
 *
 * Layers (back to front):
 *  0 - Sky gradient
 *  1 - Distant mountains
 *  2 - Mid trees / hills
 *  3 - Ground terrain
 *  4 - Foreground particles / vegetation
 */
export class ParallaxBackground {
  public readonly container: Container;

  private layers: ParallaxLayer[] = [];
  private currentEra: EraId = 'dawn';
  private width = 0;
  private height = 0;
  private scrollX = 0;

  constructor() {
    this.container = new Container();
  }

  /**
   * Build (or rebuild) all layers for the given screen dimensions and era.
   */
  init(width: number, height: number, era: EraId = 'dawn'): void {
    this.width = width;
    this.height = height;
    this.currentEra = era;

    // Tear down existing layers
    this.container.removeChildren();
    this.layers = [];

    const palette = ERA_PALETTES[era] ?? ERA_PALETTES['dawn'];

    // Layer 0 -- sky
    this.addLayer(0, 0, 1.0, palette, 'sky');
    // Layer 1 -- distant mountains
    this.addLayer(0.1, 0.45, 0.55, palette, 'distant');
    // Layer 2 -- mid trees
    this.addLayer(0.25, 0.55, 0.45, palette, 'mid');
    // Layer 3 -- ground
    this.addLayer(0.5, 0.72, 0.28, palette, 'ground');
    // Layer 4 -- foreground
    this.addLayer(0.75, 0.88, 0.12, palette, 'foreground');
  }

  /**
   * Internal: create one parallax layer, draw its procedural content, and add to the stage.
   */
  private addLayer(
    speed: number,
    yFraction: number,
    heightFraction: number,
    palette: EraLayerColors,
    role: string,
  ): void {
    const layerContainer = new Container();
    const g = new Graphics();
    layerContainer.addChild(g);
    this.container.addChild(layerContainer);

    const layer: ParallaxLayer = {
      container: layerContainer,
      graphics: g,
      speed,
      yFraction,
      heightFraction,
    };
    this.layers.push(layer);

    this.drawLayer(layer, palette, role);
  }

  /**
   * Procedurally draw the contents of a single layer.
   */
  private drawLayer(layer: ParallaxLayer, palette: EraLayerColors, role: string): void {
    const g = layer.graphics;
    g.clear();

    const y = layer.yFraction * this.height;
    const h = layer.heightFraction * this.height;
    // Draw wider than the screen so we have room for parallax scrolling
    const drawWidth = this.width * 2;

    switch (role) {
      case 'sky':
        this.drawSky(g, drawWidth, this.height, palette);
        break;
      case 'distant':
        this.drawMountains(g, drawWidth, y, h, palette.distant);
        break;
      case 'mid':
        this.drawTrees(g, drawWidth, y, h, palette.mid);
        break;
      case 'ground':
        this.drawGround(g, drawWidth, y, h, palette.ground);
        break;
      case 'foreground':
        this.drawForeground(g, drawWidth, y, h, palette.foreground);
        break;
    }
  }

  /** Sky: vertical gradient from skyTop to skyBottom using horizontal strips. */
  private drawSky(g: Graphics, w: number, h: number, palette: EraLayerColors): void {
    const steps = 32;
    const stripH = Math.ceil(h / steps);
    const topR = parseInt(palette.skyTop.slice(1, 3), 16);
    const topG = parseInt(palette.skyTop.slice(3, 5), 16);
    const topB = parseInt(palette.skyTop.slice(5, 7), 16);
    const botR = parseInt(palette.skyBottom.slice(1, 3), 16);
    const botG = parseInt(palette.skyBottom.slice(3, 5), 16);
    const botB = parseInt(palette.skyBottom.slice(5, 7), 16);

    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = Math.round(lerp(topR, botR, t));
      const gr = Math.round(lerp(topG, botG, t));
      const b = Math.round(lerp(topB, botB, t));
      const color = (r << 16) | (gr << 8) | b;
      g.rect(0, i * stripH, w, stripH + 1).fill(color);
    }
  }

  /** Distant mountains as jagged silhouette polygons. */
  private drawMountains(g: Graphics, w: number, baseY: number, h: number, color: string): void {
    // Seed-like deterministic pattern based on position
    const peakCount = Math.ceil(w / 120);
    g.moveTo(0, baseY + h);
    for (let i = 0; i <= peakCount; i++) {
      const x = (i / peakCount) * w;
      // Alternate peak heights for a mountain range look
      const peakHeight = (i % 2 === 0)
        ? h * 0.3 + (Math.sin(i * 1.7) * 0.5 + 0.5) * h * 0.6
        : h * 0.1 + (Math.cos(i * 2.3) * 0.5 + 0.5) * h * 0.3;
      g.lineTo(x, baseY + h - peakHeight);
    }
    g.lineTo(w, baseY + h);
    g.closePath();
    g.fill(color);
  }

  /** Mid-layer: rolling hills with simple triangular tree shapes. */
  private drawTrees(g: Graphics, w: number, baseY: number, h: number, color: string): void {
    // Rolling hill base
    g.moveTo(0, baseY + h);
    const hillSegments = Math.ceil(w / 60);
    for (let i = 0; i <= hillSegments; i++) {
      const x = (i / hillSegments) * w;
      const hillOffset = Math.sin(i * 0.8) * h * 0.15;
      g.lineTo(x, baseY + hillOffset + h * 0.3);
    }
    g.lineTo(w, baseY + h);
    g.closePath();
    g.fill(color);

    // Simple triangular trees on top
    const treeCount = Math.ceil(w / 80);
    const treeDarkColor = this.darkenColor(color, 0.25);
    for (let i = 0; i < treeCount; i++) {
      const tx = (i + 0.5) * (w / treeCount) + Math.sin(i * 3.1) * 15;
      const hillY = baseY + Math.sin(i * (hillSegments / treeCount) * 0.8) * h * 0.15 + h * 0.3;
      const treeH = h * 0.25 + Math.sin(i * 2.7) * h * 0.1;
      const treeW = treeH * 0.5;

      g.moveTo(tx, hillY - treeH);
      g.lineTo(tx - treeW / 2, hillY);
      g.lineTo(tx + treeW / 2, hillY);
      g.closePath();
      g.fill(treeDarkColor);
    }
  }

  /** Ground layer: flat terrain with slight undulation and grass tufts. */
  private drawGround(g: Graphics, w: number, baseY: number, h: number, color: string): void {
    // Main ground fill
    g.moveTo(0, baseY + h);
    const segments = Math.ceil(w / 40);
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * w;
      const undulation = Math.sin(i * 1.2) * h * 0.08;
      g.lineTo(x, baseY + undulation);
    }
    g.lineTo(w, baseY + h);
    g.closePath();
    g.fill(color);

    // Grass tufts
    const grassColor = this.lightenColor(color, 0.15);
    const tufts = Math.ceil(w / 25);
    for (let i = 0; i < tufts; i++) {
      const gx = (i / tufts) * w + Math.sin(i * 4.5) * 8;
      const gy = baseY + Math.sin(i * (segments / tufts) * 1.2) * h * 0.08;
      const tuftH = 4 + Math.sin(i * 3.3) * 2;
      g.moveTo(gx - 2, gy);
      g.lineTo(gx, gy - tuftH);
      g.lineTo(gx + 2, gy);
      g.closePath();
      g.fill(grassColor);
    }
  }

  /** Foreground: scattered rocks and dark undergrowth. */
  private drawForeground(g: Graphics, w: number, baseY: number, h: number, color: string): void {
    // Dark ground strip
    g.rect(0, baseY, w, h).fill(color);

    // Scattered rocks
    const rockCount = Math.ceil(w / 150);
    const rockColor = this.lightenColor(color, 0.1);
    for (let i = 0; i < rockCount; i++) {
      const rx = (i + 0.5) * (w / rockCount) + Math.sin(i * 5.1) * 30;
      const ry = baseY + h * 0.3 + Math.sin(i * 3.7) * h * 0.2;
      const rw = 12 + Math.sin(i * 2.1) * 6;
      const rh = 6 + Math.sin(i * 1.9) * 3;
      g.ellipse(rx, ry, rw, rh).fill(rockColor);
    }
  }

  /**
   * Update parallax scroll based on a camera X offset.
   * Call this every frame.
   */
  update(cameraX: number, _deltaMs: number): void {
    this.scrollX = cameraX;
    for (const layer of this.layers) {
      layer.container.x = -cameraX * layer.speed;
    }
  }

  /**
   * Switch to a new era, rebuilding layer visuals.
   */
  setEra(era: EraId): void {
    if (era === this.currentEra) return;
    this.currentEra = era;
    this.init(this.width, this.height, era);
  }

  /**
   * Handle window resize.
   */
  resize(width: number, height: number): void {
    this.init(width, height, this.currentEra);
  }

  /**
   * Get the current scroll position.
   */
  getScrollX(): number {
    return this.scrollX;
  }

  // --- Color helpers ---

  private darkenColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)));
    const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
    const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  private lightenColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount));
    const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount));
    const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
}
