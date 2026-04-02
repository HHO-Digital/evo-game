import { Container, Graphics } from 'pixi.js';
import type { EraId } from '@/types';
import { lerp, clamp } from '@/utils/math';

/**
 * Full color palette for a single era, covering all parallax layers
 * and atmospheric effects.
 */
interface EraLayerPalette {
  // Sky
  skyTopDay: number;
  skyBottomDay: number;
  skyTopNight: number;
  skyBottomNight: number;
  cloudColor: number;
  cloudShadow: number;
  // Stars / moon
  starColor: number;
  moonColor: number;
  // Distant mountains
  distantBase: number;
  distantHaze: number;
  distantSnow: number;
  distantDark: number;
  // Mid layer (hills, trees)
  midGround: number;
  midDark: number;
  midLight: number;
  treeTrunk: number;
  treeConifer: number;
  treeDeciduous: number;
  treeDead: number;
  // Ground layer
  groundDirt: number;
  groundPath: number;
  groundGrass: number;
  groundGrassDark: number;
  groundRock: number;
  groundRockLight: number;
  flowerColors: number[];
  // Water
  waterBase: number;
  waterHighlight: number;
  // Foreground
  foregroundDark: number;
  foregroundLeaf: number;
  foregroundBranch: number;
  // Atmospheric
  hazeColor: number;
  warmGlow: number;
}

const ERA_PALETTES: Record<string, EraLayerPalette> = {
  dawn: {
    skyTopDay: 0x1a0a2e,
    skyBottomDay: 0xcc7722,
    skyTopNight: 0x050510,
    skyBottomNight: 0x1a0a2e,
    cloudColor: 0xdd9944,
    cloudShadow: 0x995522,
    starColor: 0xffeedd,
    moonColor: 0xeeeecc,
    distantBase: 0x36454f,
    distantHaze: 0x5a6a7a,
    distantSnow: 0xccccdd,
    distantDark: 0x253545,
    midGround: 0x2d5a27,
    midDark: 0x1e3e1a,
    midLight: 0x3a7a33,
    treeTrunk: 0x4a3020,
    treeConifer: 0x1e4422,
    treeDeciduous: 0x2d5a27,
    treeDead: 0x5a4a3a,
    groundDirt: 0x5c4033,
    groundPath: 0x7a6050,
    groundGrass: 0x4a7a34,
    groundGrassDark: 0x2e5a20,
    groundRock: 0x6a6a6a,
    groundRockLight: 0x8a8a8a,
    flowerColors: [0xddaa44, 0xcc6633, 0xbb8855],
    waterBase: 0x2a4a6a,
    waterHighlight: 0x4a7aaa,
    foregroundDark: 0x1a1a0a,
    foregroundLeaf: 0x1e3e1a,
    foregroundBranch: 0x3a2a1a,
    hazeColor: 0x5a6a7a,
    warmGlow: 0xff8833,
  },
  awakening: {
    skyTopDay: 0x1a1a3e,
    skyBottomDay: 0xd4a55a,
    skyTopNight: 0x060615,
    skyBottomNight: 0x1a1a3e,
    cloudColor: 0xccbb88,
    cloudShadow: 0x887744,
    starColor: 0xffeedd,
    moonColor: 0xeeeedd,
    distantBase: 0x4a6050,
    distantHaze: 0x6a8070,
    distantSnow: 0xddddee,
    distantDark: 0x354a3a,
    midGround: 0x3a7a37,
    midDark: 0x265a22,
    midLight: 0x4a9a44,
    treeTrunk: 0x5a3a20,
    treeConifer: 0x2a5530,
    treeDeciduous: 0x3a7a37,
    treeDead: 0x6a5a4a,
    groundDirt: 0x6a5043,
    groundPath: 0x8a7060,
    groundGrass: 0x5a8a44,
    groundGrassDark: 0x3a6a28,
    groundRock: 0x7a7a7a,
    groundRockLight: 0x9a9a9a,
    flowerColors: [0xeecc55, 0xdd7744, 0xcc99aa, 0x88aadd],
    waterBase: 0x3a5a7a,
    waterHighlight: 0x5a8abb,
    foregroundDark: 0x2a2a15,
    foregroundLeaf: 0x265a22,
    foregroundBranch: 0x4a3a2a,
    hazeColor: 0x6a8070,
    warmGlow: 0xffaa44,
  },
  roots: {
    skyTopDay: 0x1e2a4e,
    skyBottomDay: 0xe0b060,
    skyTopNight: 0x080818,
    skyBottomNight: 0x1e2a4e,
    cloudColor: 0xddcc99,
    cloudShadow: 0x998855,
    starColor: 0xffeedd,
    moonColor: 0xeeeedd,
    distantBase: 0x5a7060,
    distantHaze: 0x7a9080,
    distantSnow: 0xeeeeee,
    distantDark: 0x405a48,
    midGround: 0x4a8a47,
    midDark: 0x306a2c,
    midLight: 0x5aaa54,
    treeTrunk: 0x6a4a28,
    treeConifer: 0x336633,
    treeDeciduous: 0x4a8a47,
    treeDead: 0x7a6a5a,
    groundDirt: 0x7a6053,
    groundPath: 0x9a8070,
    groundGrass: 0x6a9a54,
    groundGrassDark: 0x4a7a38,
    groundRock: 0x8a8a8a,
    groundRockLight: 0xaaaaaa,
    flowerColors: [0xffdd66, 0xee8855, 0xddaacc, 0x99bbee, 0xff9999],
    waterBase: 0x4a6a8a,
    waterHighlight: 0x6a9acc,
    foregroundDark: 0x3a3a20,
    foregroundLeaf: 0x306a2c,
    foregroundBranch: 0x5a4a3a,
    hazeColor: 0x7a9080,
    warmGlow: 0xffbb55,
  },
  forge: {
    skyTopDay: 0x2a1a1a,
    skyBottomDay: 0xc86030,
    skyTopNight: 0x080505,
    skyBottomNight: 0x2a1a1a,
    cloudColor: 0xbb7744,
    cloudShadow: 0x884422,
    starColor: 0xffddcc,
    moonColor: 0xddccaa,
    distantBase: 0x5a4a40,
    distantHaze: 0x7a6a5a,
    distantSnow: 0xccbbaa,
    distantDark: 0x3a2a20,
    midGround: 0x6a5040,
    midDark: 0x4a3828,
    midLight: 0x8a6a50,
    treeTrunk: 0x4a3020,
    treeConifer: 0x3a4a22,
    treeDeciduous: 0x5a5030,
    treeDead: 0x6a5a48,
    groundDirt: 0x8a6a50,
    groundPath: 0x9a7a60,
    groundGrass: 0x5a6a34,
    groundGrassDark: 0x3a4a20,
    groundRock: 0x7a7070,
    groundRockLight: 0x9a8a80,
    flowerColors: [0xcc8833, 0xaa5522],
    waterBase: 0x3a4a5a,
    waterHighlight: 0x5a6a7a,
    foregroundDark: 0x2a1a10,
    foregroundLeaf: 0x3a3a18,
    foregroundBranch: 0x4a3020,
    hazeColor: 0x7a6a5a,
    warmGlow: 0xff6622,
  },
  empire: {
    skyTopDay: 0x141430,
    skyBottomDay: 0xb89050,
    skyTopNight: 0x050510,
    skyBottomNight: 0x141430,
    cloudColor: 0xccaa77,
    cloudShadow: 0x887744,
    starColor: 0xffeedd,
    moonColor: 0xeeeedd,
    distantBase: 0x506050,
    distantHaze: 0x708070,
    distantSnow: 0xdddddd,
    distantDark: 0x354535,
    midGround: 0x4a7050,
    midDark: 0x2e5030,
    midLight: 0x5a9060,
    treeTrunk: 0x5a4028,
    treeConifer: 0x2a5530,
    treeDeciduous: 0x4a7050,
    treeDead: 0x6a6050,
    groundDirt: 0x7a7060,
    groundPath: 0x8a8070,
    groundGrass: 0x5a8050,
    groundGrassDark: 0x3a6030,
    groundRock: 0x808080,
    groundRockLight: 0xa0a0a0,
    flowerColors: [0xddbb55, 0xcc8844, 0xbb99aa],
    waterBase: 0x3a5a7a,
    waterHighlight: 0x5a8abb,
    foregroundDark: 0x2a2a1a,
    foregroundLeaf: 0x2e5030,
    foregroundBranch: 0x4a3a2a,
    hazeColor: 0x708070,
    warmGlow: 0xffaa44,
  },
  convergence: {
    skyTopDay: 0x1a2040,
    skyBottomDay: 0x90a0c0,
    skyTopNight: 0x060815,
    skyBottomNight: 0x1a2040,
    cloudColor: 0xaabbcc,
    cloudShadow: 0x667788,
    starColor: 0xeeeeff,
    moonColor: 0xddddee,
    distantBase: 0x506878,
    distantHaze: 0x708898,
    distantSnow: 0xddddee,
    distantDark: 0x354858,
    midGround: 0x3a6a5a,
    midDark: 0x224a3a,
    midLight: 0x4a8a6a,
    treeTrunk: 0x4a3828,
    treeConifer: 0x2a5540,
    treeDeciduous: 0x3a6a5a,
    treeDead: 0x5a6060,
    groundDirt: 0x607060,
    groundPath: 0x708070,
    groundGrass: 0x4a7a5a,
    groundGrassDark: 0x2a5a3a,
    groundRock: 0x787878,
    groundRockLight: 0x989898,
    flowerColors: [0x88aadd, 0x99bbcc, 0xaaccdd],
    waterBase: 0x3a6a8a,
    waterHighlight: 0x5a9abb,
    foregroundDark: 0x1a2a1a,
    foregroundLeaf: 0x224a3a,
    foregroundBranch: 0x3a4a3a,
    hazeColor: 0x708898,
    warmGlow: 0xaabbcc,
  },
  enlightenment: {
    skyTopDay: 0x1a2848,
    skyBottomDay: 0xc0b080,
    skyTopNight: 0x060a18,
    skyBottomNight: 0x1a2848,
    cloudColor: 0xcccc99,
    cloudShadow: 0x888866,
    starColor: 0xffeedd,
    moonColor: 0xeeeedd,
    distantBase: 0x607868,
    distantHaze: 0x809888,
    distantSnow: 0xeeeeee,
    distantDark: 0x405848,
    midGround: 0x507050,
    midDark: 0x305030,
    midLight: 0x609060,
    treeTrunk: 0x5a4830,
    treeConifer: 0x336638,
    treeDeciduous: 0x507050,
    treeDead: 0x6a6858,
    groundDirt: 0x706858,
    groundPath: 0x807868,
    groundGrass: 0x5a8050,
    groundGrassDark: 0x3a6030,
    groundRock: 0x888888,
    groundRockLight: 0xa8a8a8,
    flowerColors: [0xddcc66, 0xccaa55, 0xbb99aa, 0x99aadd],
    waterBase: 0x4a6a8a,
    waterHighlight: 0x6a9acc,
    foregroundDark: 0x2a2a20,
    foregroundLeaf: 0x305030,
    foregroundBranch: 0x4a4a38,
    hazeColor: 0x809888,
    warmGlow: 0xddcc88,
  },
  revolution: {
    skyTopDay: 0x1a1820,
    skyBottomDay: 0x908070,
    skyTopNight: 0x050508,
    skyBottomNight: 0x1a1820,
    cloudColor: 0x999088,
    cloudShadow: 0x666058,
    starColor: 0xdddddd,
    moonColor: 0xcccccc,
    distantBase: 0x585858,
    distantHaze: 0x787878,
    distantSnow: 0xcccccc,
    distantDark: 0x383838,
    midGround: 0x505848,
    midDark: 0x303828,
    midLight: 0x607858,
    treeTrunk: 0x4a4038,
    treeConifer: 0x384838,
    treeDeciduous: 0x505848,
    treeDead: 0x686058,
    groundDirt: 0x686058,
    groundPath: 0x787068,
    groundGrass: 0x4a6840,
    groundGrassDark: 0x2a4820,
    groundRock: 0x808080,
    groundRockLight: 0xa0a0a0,
    flowerColors: [0xaa9955, 0x998844],
    waterBase: 0x3a4a5a,
    waterHighlight: 0x5a6a7a,
    foregroundDark: 0x1a1810,
    foregroundLeaf: 0x303828,
    foregroundBranch: 0x3a3830,
    hazeColor: 0x787878,
    warmGlow: 0xaa9966,
  },
  modern: {
    skyTopDay: 0x0a1020,
    skyBottomDay: 0x607890,
    skyTopNight: 0x030508,
    skyBottomNight: 0x0a1020,
    cloudColor: 0x8899aa,
    cloudShadow: 0x556677,
    starColor: 0xddeeff,
    moonColor: 0xccddee,
    distantBase: 0x485868,
    distantHaze: 0x687888,
    distantSnow: 0xddddee,
    distantDark: 0x283848,
    midGround: 0x406050,
    midDark: 0x204030,
    midLight: 0x508060,
    treeTrunk: 0x4a4040,
    treeConifer: 0x2a5038,
    treeDeciduous: 0x406050,
    treeDead: 0x585858,
    groundDirt: 0x586058,
    groundPath: 0x687068,
    groundGrass: 0x4a7848,
    groundGrassDark: 0x2a5828,
    groundRock: 0x787878,
    groundRockLight: 0x989898,
    flowerColors: [0x88aacc, 0x77aadd, 0x99bbcc],
    waterBase: 0x3a5a7a,
    waterHighlight: 0x5a8abb,
    foregroundDark: 0x181818,
    foregroundLeaf: 0x204030,
    foregroundBranch: 0x383838,
    hazeColor: 0x687888,
    warmGlow: 0x7788aa,
  },
  horizon: {
    skyTopDay: 0x060818,
    skyBottomDay: 0x4060a0,
    skyTopNight: 0x020308,
    skyBottomNight: 0x060818,
    cloudColor: 0x7088aa,
    cloudShadow: 0x405878,
    starColor: 0xccddff,
    moonColor: 0xbbccee,
    distantBase: 0x384868,
    distantHaze: 0x586888,
    distantSnow: 0xccccee,
    distantDark: 0x202838,
    midGround: 0x306858,
    midDark: 0x184838,
    midLight: 0x408868,
    treeTrunk: 0x3a3838,
    treeConifer: 0x204838,
    treeDeciduous: 0x306858,
    treeDead: 0x484848,
    groundDirt: 0x486058,
    groundPath: 0x587068,
    groundGrass: 0x3a7a50,
    groundGrassDark: 0x1a5a30,
    groundRock: 0x686868,
    groundRockLight: 0x888888,
    flowerColors: [0x66aadd, 0x55bbcc, 0x88ccee],
    waterBase: 0x305a8a,
    waterHighlight: 0x508acc,
    foregroundDark: 0x101010,
    foregroundLeaf: 0x184838,
    foregroundBranch: 0x303030,
    hazeColor: 0x586888,
    warmGlow: 0x5577aa,
  },
};

/** Describes one parallax layer. */
interface ParallaxLayer {
  container: Container;
  graphics: Graphics;
  /** Parallax speed multiplier. 0 = static, 1 = full camera speed. */
  speed: number;
  /** Role identifier for drawing logic. */
  role: string;
}

/**
 * Seeded pseudo-random number generator for deterministic procedural content.
 * Uses a simple LCG so that the same seed produces the same terrain.
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * Multi-layer parallax background with richly detailed procedural terrain,
 * atmospheric perspective, celestial bodies, varied vegetation, water features,
 * and dynamic day/night sky shifts.
 *
 * Layers (back to front):
 *  0 - Sky: gradient + clouds + stars/moon
 *  1 - Far: distant mountain ranges with atmospheric haze and snow caps
 *  2 - Mid: rolling hills with forests (conifers, deciduous, dead trees)
 *  3 - Ground: dirt path, rocks, grass clusters, flowers, stream
 *  4 - Near: foreground foliage, large rocks, overhanging branches
 */
export class ParallaxBackground {
  public readonly container: Container;

  private layers: ParallaxLayer[] = [];
  private currentEra: EraId = 'dawn';
  private palette: EraLayerPalette = ERA_PALETTES['dawn'];
  private width = 0;
  private height = 0;
  private scrollX = 0;

  /** Day progress: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 1 = midnight. */
  private dayProgress = 0.35;

  /** Cached sky layer reference for dynamic redraws. */
  private skyLayer: ParallaxLayer | null = null;

  /** Current blend progress (0.0 = fully current era, 1.0 = fully next era). */
  private blendProgress = 0;
  /** The next era we are blending toward, or null if not blending. */
  private blendTargetEra: EraId | null = null;

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
    this.palette = ERA_PALETTES[era] ?? ERA_PALETTES['dawn'];

    // Tear down existing layers
    this.container.removeChildren();
    this.layers = [];
    this.skyLayer = null;

    // Layer 0 -- sky (static, full screen)
    this.skyLayer = this.addLayer(0, 'sky');
    // Layer 1 -- distant mountains
    this.addLayer(0.1, 'distant');
    // Layer 2 -- mid hills + trees
    this.addLayer(0.3, 'mid');
    // Layer 3 -- ground terrain
    this.addLayer(0.5, 'ground');
    // Layer 4 -- foreground
    this.addLayer(0.8, 'near');
  }

  /**
   * Create one parallax layer, draw its procedural content, and add it.
   */
  private addLayer(speed: number, role: string): ParallaxLayer {
    const layerContainer = new Container();
    const g = new Graphics();
    layerContainer.addChild(g);
    this.container.addChild(layerContainer);

    const layer: ParallaxLayer = { container: layerContainer, graphics: g, speed, role };
    this.layers.push(layer);
    this.drawLayer(layer);
    return layer;
  }

  /**
   * Route drawing to the appropriate method based on layer role.
   */
  private drawLayer(layer: ParallaxLayer): void {
    const g = layer.graphics;
    g.clear();

    switch (layer.role) {
      case 'sky':
        this.drawSky(g);
        break;
      case 'distant':
        this.drawDistantMountains(g);
        break;
      case 'mid':
        this.drawMidHills(g);
        break;
      case 'ground':
        this.drawGroundTerrain(g);
        break;
      case 'near':
        this.drawForeground(g);
        break;
    }
  }

  // ==================== SKY LAYER ====================

  private drawSky(g: Graphics): void {
    const p = this.palette;
    const w = this.width + 200;
    const h = this.height;

    // Compute day/night interpolation factor (0 = full night, 1 = full day)
    const dayFactor = this.getDayFactor();

    const skyTopR = this.lerpChannel(p.skyTopNight, p.skyTopDay, dayFactor, 'r');
    const skyTopG = this.lerpChannel(p.skyTopNight, p.skyTopDay, dayFactor, 'g');
    const skyTopB = this.lerpChannel(p.skyTopNight, p.skyTopDay, dayFactor, 'b');
    const skyBotR = this.lerpChannel(p.skyBottomNight, p.skyBottomDay, dayFactor, 'r');
    const skyBotG = this.lerpChannel(p.skyBottomNight, p.skyBottomDay, dayFactor, 'g');
    const skyBotB = this.lerpChannel(p.skyBottomNight, p.skyBottomDay, dayFactor, 'b');

    // Gradient sky with 48 strips for smooth transition
    const steps = 48;
    const stripH = Math.ceil(h / steps);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = Math.round(lerp(skyTopR, skyBotR, t));
      const gr = Math.round(lerp(skyTopG, skyBotG, t));
      const b = Math.round(lerp(skyTopB, skyBotB, t));
      const color = (r << 16) | (gr << 8) | b;
      g.rect(-100, i * stripH, w, stripH + 1).fill(color);
    }

    // Warm glow near horizon (bottom 30%)
    const glowY = h * 0.6;
    const glowH = h * 0.4;
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const alpha = (1 - t) * 0.08 * dayFactor;
      g.rect(-100, glowY + t * glowH, w, glowH / 8 + 1).fill({ color: p.warmGlow, alpha });
    }

    // Stars (visible at night)
    const nightFactor = 1 - dayFactor;
    if (nightFactor > 0.15) {
      const starAlpha = clamp((nightFactor - 0.15) / 0.5, 0, 1);
      const rand = seededRandom(42);
      const starCount = 80;
      for (let i = 0; i < starCount; i++) {
        const sx = rand() * w - 100;
        const sy = rand() * h * 0.6;
        const sr = 0.5 + rand() * 1.2;
        const twinkle = 0.5 + 0.5 * Math.sin(i * 1.7 + this.dayProgress * Math.PI * 20);
        g.circle(sx, sy, sr).fill({ color: p.starColor, alpha: starAlpha * twinkle });
      }

      // Moon
      if (nightFactor > 0.3) {
        const moonAlpha = clamp((nightFactor - 0.3) / 0.4, 0, 1);
        const moonX = w * 0.75;
        const moonY = h * 0.12;
        const moonR = 18;
        // Glow
        g.circle(moonX, moonY, moonR + 8).fill({ color: p.moonColor, alpha: moonAlpha * 0.1 });
        g.circle(moonX, moonY, moonR + 4).fill({ color: p.moonColor, alpha: moonAlpha * 0.15 });
        // Body
        g.circle(moonX, moonY, moonR).fill({ color: p.moonColor, alpha: moonAlpha * 0.9 });
        // Crescent shadow
        const skyBg = (skyTopR << 16) | (skyTopG << 8) | skyTopB;
        g.circle(moonX + 6, moonY - 2, moonR - 2).fill({ color: skyBg, alpha: moonAlpha * 0.7 });
      }
    }

    // Clouds
    this.drawClouds(g, w, h, dayFactor);
  }

  /**
   * Draw wispy, semi-transparent cloud formations.
   */
  private drawClouds(g: Graphics, w: number, h: number, dayFactor: number): void {
    const p = this.palette;
    const rand = seededRandom(137);
    const cloudCount = 8;
    const baseAlpha = 0.15 + dayFactor * 0.2;

    for (let i = 0; i < cloudCount; i++) {
      const cx = rand() * w - 50;
      const cy = h * 0.05 + rand() * h * 0.35;
      const cloudWidth = 60 + rand() * 120;
      const cloudHeight = 10 + rand() * 20;

      // Build cloud from overlapping ellipses
      const puffs = 3 + Math.floor(rand() * 4);
      for (let j = 0; j < puffs; j++) {
        const px = cx + (rand() - 0.5) * cloudWidth * 0.8;
        const py = cy + (rand() - 0.5) * cloudHeight * 0.5;
        const pr = cloudHeight * (0.4 + rand() * 0.6);

        // Shadow beneath
        g.ellipse(px, py + 2, pr * 1.5, pr * 0.7).fill({ color: p.cloudShadow, alpha: baseAlpha * 0.4 });
        // Main cloud body
        g.ellipse(px, py, pr * 1.5, pr * 0.6).fill({ color: p.cloudColor, alpha: baseAlpha });
      }
    }
  }

  // ==================== DISTANT MOUNTAINS ====================

  private drawDistantMountains(g: Graphics): void {
    const p = this.palette;
    const w = this.width * 3;
    const baseY = this.height * 0.45;
    const h = this.height * 0.55;

    // Back range (hazier, bluer)
    this.drawMountainRange(g, w, baseY + h * 0.1, h * 0.6, p.distantHaze, 0.35, 73, true);

    // Front range (more defined)
    this.drawMountainRange(g, w, baseY + h * 0.15, h * 0.75, p.distantBase, 0.2, 29, true);

    // Atmospheric haze overlay at the bottom
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const hy = baseY + h * 0.5 + t * h * 0.5;
      g.rect(-50, hy, w + 100, h * 0.12).fill({ color: p.hazeColor, alpha: 0.04 + t * 0.06 });
    }
  }

  /**
   * Draw a single mountain range silhouette with snow caps.
   */
  private drawMountainRange(
    g: Graphics,
    w: number,
    baseY: number,
    maxPeakH: number,
    color: number,
    hazeAlpha: number,
    seed: number,
    drawSnow: boolean,
  ): void {
    const p = this.palette;
    const rand = seededRandom(seed);
    const peakCount = Math.ceil(w / 100);
    const points: Array<{ x: number; y: number }> = [];

    for (let i = 0; i <= peakCount; i++) {
      const x = (i / peakCount) * w;
      const isPeak = rand() > 0.4;
      const height = isPeak
        ? maxPeakH * (0.4 + rand() * 0.6)
        : maxPeakH * (0.1 + rand() * 0.25);
      points.push({ x, y: baseY - height });
    }

    // Mountain fill
    g.moveTo(0, this.height);
    for (const pt of points) {
      g.lineTo(pt.x, pt.y);
    }
    g.lineTo(w, this.height);
    g.closePath();
    g.fill(color);

    // Snow caps on tall peaks
    if (drawSnow) {
      const snowThreshold = baseY - maxPeakH * 0.45;
      for (let i = 1; i < points.length - 1; i++) {
        const pt = points[i];
        const prev = points[i - 1];
        const next = points[i + 1];
        if (pt.y < prev.y && pt.y < next.y && pt.y < snowThreshold) {
          const snowH = (snowThreshold - pt.y) * 0.6;
          const snowW = snowH * 1.5;
          g.moveTo(pt.x - snowW, pt.y + snowH);
          g.lineTo(pt.x, pt.y);
          g.lineTo(pt.x + snowW, pt.y + snowH);
          g.closePath();
          g.fill({ color: p.distantSnow, alpha: 0.7 });
        }
      }
    }

    // Haze overlay
    g.rect(-50, baseY - maxPeakH, w + 100, maxPeakH + (this.height - baseY))
      .fill({ color: p.hazeColor, alpha: hazeAlpha });
  }

  // ==================== MID LAYER (hills + trees) ====================

  private drawMidHills(g: Graphics): void {
    const p = this.palette;
    const w = this.width * 3;
    const baseY = this.height * 0.55;
    const h = this.height * 0.45;
    const rand = seededRandom(211);

    // Rolling hills silhouette
    const hillPoints: Array<{ x: number; y: number }> = [];
    const segments = Math.ceil(w / 40);
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * w;
      const hillY = baseY + Math.sin(i * 0.4 + 0.7) * h * 0.08
        + Math.sin(i * 0.15) * h * 0.12;
      hillPoints.push({ x, y: hillY });
    }

    // Fill hills
    g.moveTo(0, this.height);
    for (const pt of hillPoints) {
      g.lineTo(pt.x, pt.y);
    }
    g.lineTo(w, this.height);
    g.closePath();
    g.fill(p.midGround);

    // Darker underbelly
    g.moveTo(0, this.height);
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * w;
      const y = hillPoints[i].y + h * 0.12;
      g.lineTo(x, y);
    }
    g.lineTo(w, this.height);
    g.closePath();
    g.fill(p.midDark);

    // Trees along hill crests
    const treeCount = Math.ceil(w / 35);
    for (let i = 0; i < treeCount; i++) {
      const tx = rand() * w;
      const segIdx = clamp(Math.floor((tx / w) * segments), 0, segments - 1);
      const segT = ((tx / w) * segments) - segIdx;
      const treeBaseY = lerp(
        hillPoints[segIdx].y,
        hillPoints[Math.min(segIdx + 1, segments)].y,
        segT,
      );

      const treeType = rand();
      const treeScale = 0.6 + rand() * 0.5;

      if (treeType < 0.45) {
        this.drawConifer(g, tx, treeBaseY, treeScale, p, rand);
      } else if (treeType < 0.8) {
        this.drawDeciduous(g, tx, treeBaseY, treeScale, p, rand);
      } else {
        this.drawDeadTree(g, tx, treeBaseY, treeScale, p);
      }
    }

    // Atmospheric haze at base
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      g.rect(-50, baseY + h * 0.3 + t * h * 0.3, w + 100, h * 0.12)
        .fill({ color: p.hazeColor, alpha: 0.03 + t * 0.04 });
    }
  }

  /**
   * Draw a conifer tree with layered triangular branches.
   */
  private drawConifer(
    g: Graphics,
    x: number,
    baseY: number,
    scale: number,
    p: EraLayerPalette,
    rand: () => number,
  ): void {
    const trunkH = 12 * scale;
    const trunkW = 2.5 * scale;

    g.rect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH).fill(p.treeTrunk);

    const layers = 3 + (rand() > 0.5 ? 1 : 0);
    const totalH = 28 * scale;
    for (let i = 0; i < layers; i++) {
      const t = i / layers;
      const layerW = (10 + (1 - t) * 8) * scale;
      const layerH = totalH / layers + 4 * scale;
      const layerY = baseY - trunkH - t * (totalH - layerH * 0.3);

      // Shadow
      g.moveTo(x, layerY - layerH);
      g.lineTo(x - layerW / 2 - 1, layerY);
      g.lineTo(x + layerW / 2 + 1, layerY);
      g.closePath();
      g.fill(this.darkenColor(p.treeConifer, 0.25));

      // Foliage
      g.moveTo(x, layerY - layerH + 1);
      g.lineTo(x - layerW / 2, layerY);
      g.lineTo(x + layerW / 2, layerY);
      g.closePath();
      g.fill(p.treeConifer);
    }
  }

  /**
   * Draw a deciduous tree with a rounded crown.
   */
  private drawDeciduous(
    g: Graphics,
    x: number,
    baseY: number,
    scale: number,
    p: EraLayerPalette,
    rand: () => number,
  ): void {
    const trunkH = 14 * scale;
    const trunkW = 3 * scale;

    g.rect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH).fill(p.treeTrunk);

    const crownY = baseY - trunkH - 6 * scale;
    const crownR = (10 + rand() * 6) * scale;

    // Shadow blob
    g.circle(x + 1, crownY + 2, crownR + 1).fill(this.darkenColor(p.treeDeciduous, 0.3));
    // Main crown
    g.circle(x, crownY, crownR).fill(p.treeDeciduous);
    // Light side
    g.circle(x - crownR * 0.2, crownY - crownR * 0.2, crownR * 0.6)
      .fill({ color: p.midLight, alpha: 0.4 });

    // Extra puffs
    const puffs = 2 + Math.floor(rand() * 2);
    for (let j = 0; j < puffs; j++) {
      const px = x + (rand() - 0.5) * crownR * 1.2;
      const py = crownY + (rand() - 0.5) * crownR * 0.8;
      const pr = crownR * (0.3 + rand() * 0.3);
      g.circle(px, py, pr).fill(p.treeDeciduous);
    }
  }

  /**
   * Draw a dead/bare tree silhouette.
   */
  private drawDeadTree(
    g: Graphics,
    x: number,
    baseY: number,
    scale: number,
    p: EraLayerPalette,
  ): void {
    const trunkH = 18 * scale;
    const trunkW = 2 * scale;

    g.moveTo(x - trunkW / 2, baseY);
    g.lineTo(x - trunkW / 4, baseY - trunkH);
    g.lineTo(x + trunkW / 4, baseY - trunkH);
    g.lineTo(x + trunkW / 2, baseY);
    g.closePath();
    g.fill(p.treeDead);

    const branchY = baseY - trunkH * 0.6;
    g.moveTo(x, branchY);
    g.lineTo(x - 8 * scale, branchY - 10 * scale);
    g.stroke({ width: 1.5 * scale, color: p.treeDead });

    g.moveTo(x, branchY - trunkH * 0.15);
    g.lineTo(x + 7 * scale, branchY - 14 * scale);
    g.stroke({ width: 1.2 * scale, color: p.treeDead });

    g.moveTo(x - 8 * scale, branchY - 10 * scale);
    g.lineTo(x - 12 * scale, branchY - 14 * scale);
    g.stroke({ width: 0.8 * scale, color: p.treeDead });
  }

  // ==================== GROUND LAYER ====================

  private drawGroundTerrain(g: Graphics): void {
    const p = this.palette;
    const w = this.width * 3;
    const baseY = this.height * 0.72;
    const h = this.height * 0.28;
    const rand = seededRandom(353);

    // Main ground fill with undulation
    const groundPoints: Array<{ x: number; y: number }> = [];
    const segments = Math.ceil(w / 25);
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * w;
      const undulation = Math.sin(i * 0.5) * h * 0.03 + Math.sin(i * 0.17) * h * 0.02;
      groundPoints.push({ x, y: baseY + undulation });
    }

    // Dirt base
    g.moveTo(0, this.height);
    for (const pt of groundPoints) {
      g.lineTo(pt.x, pt.y);
    }
    g.lineTo(w, this.height);
    g.closePath();
    g.fill(p.groundDirt);

    // Dirt path
    this.drawDirtPath(g, w, baseY, groundPoints, segments, p);

    // Stream / water feature
    this.drawStream(g, w, baseY, h, p);

    // Boulders
    this.drawBoulders(g, w, baseY, h, p, rand);

    // Grass clusters
    this.drawGrassClusters(g, w, groundPoints, segments, p, rand);

    // Small flowers
    this.drawFlowers(g, w, groundPoints, segments, p, rand);
  }

  private drawDirtPath(
    g: Graphics,
    w: number,
    baseY: number,
    groundPoints: Array<{ x: number; y: number }>,
    segments: number,
    p: EraLayerPalette,
  ): void {
    const pathWidth = 30;
    const pathOffset = 5;

    g.moveTo(0, baseY + pathOffset);
    for (let i = 0; i <= segments; i++) {
      const x = groundPoints[i].x;
      const y = groundPoints[i].y + pathOffset + Math.sin(i * 0.3) * 3;
      g.lineTo(x, y);
    }
    for (let i = segments; i >= 0; i--) {
      const x = groundPoints[i].x;
      const y = groundPoints[i].y + pathOffset + pathWidth + Math.sin(i * 0.3 + 1) * 4;
      g.lineTo(x, y);
    }
    g.closePath();
    g.fill(p.groundPath);

    // Path edge
    g.moveTo(groundPoints[0].x, groundPoints[0].y + pathOffset + Math.sin(0) * 3);
    for (let i = 1; i <= segments; i++) {
      const x = groundPoints[i].x;
      const y = groundPoints[i].y + pathOffset + Math.sin(i * 0.3) * 3;
      g.lineTo(x, y);
    }
    g.stroke({ width: 1, color: this.darkenColor(p.groundPath, 0.2) });
  }

  private drawStream(
    g: Graphics,
    w: number,
    baseY: number,
    h: number,
    p: EraLayerPalette,
  ): void {
    const streamX = w * 0.4;
    const streamWidth = 40;
    const streamY = baseY + h * 0.45;
    const streamH = h * 0.15;

    g.ellipse(streamX, streamY, streamWidth, streamH).fill(p.waterBase);

    // Reflection highlights
    g.ellipse(streamX - 8, streamY - streamH * 0.2, streamWidth * 0.4, streamH * 0.3)
      .fill({ color: p.waterHighlight, alpha: 0.3 });
    g.ellipse(streamX + 12, streamY + streamH * 0.1, streamWidth * 0.25, streamH * 0.2)
      .fill({ color: p.waterHighlight, alpha: 0.2 });

    // Edge stones
    const rand = seededRandom(789);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const sx = streamX + Math.cos(angle) * (streamWidth + 3 + rand() * 5);
      const sy = streamY + Math.sin(angle) * (streamH + 2 + rand() * 3);
      const sr = 2 + rand() * 3;
      g.ellipse(sx, sy, sr, sr * 0.6).fill(p.groundRock);
    }
  }

  private drawBoulders(
    g: Graphics,
    w: number,
    baseY: number,
    h: number,
    p: EraLayerPalette,
    rand: () => number,
  ): void {
    const boulderCount = Math.ceil(w / 200);
    for (let i = 0; i < boulderCount; i++) {
      const bx = rand() * w;
      const by = baseY + h * 0.05 + rand() * h * 0.35;
      const bw = 8 + rand() * 14;
      const bh = 5 + rand() * 8;

      // Shadow
      g.ellipse(bx + 2, by + bh * 0.3, bw + 2, bh * 0.4)
        .fill({ color: 0x000000, alpha: 0.15 });
      // Body
      g.ellipse(bx, by, bw, bh).fill(p.groundRock);
      // Light cap
      g.ellipse(bx - bw * 0.15, by - bh * 0.25, bw * 0.6, bh * 0.5)
        .fill({ color: p.groundRockLight, alpha: 0.5 });
      // Crack
      g.moveTo(bx - bw * 0.3, by - bh * 0.1);
      g.lineTo(bx + bw * 0.1, by + bh * 0.2);
      g.stroke({ width: 0.5, color: this.darkenColor(p.groundRock, 0.3) });
    }
  }

  private drawGrassClusters(
    g: Graphics,
    w: number,
    groundPoints: Array<{ x: number; y: number }>,
    segments: number,
    p: EraLayerPalette,
    rand: () => number,
  ): void {
    const clusterCount = Math.ceil(w / 12);
    for (let i = 0; i < clusterCount; i++) {
      const gx = rand() * w;
      const segIdx = clamp(Math.floor((gx / w) * segments), 0, segments - 1);
      const segT = ((gx / w) * segments) - segIdx;
      const gy = lerp(
        groundPoints[segIdx].y,
        groundPoints[Math.min(segIdx + 1, segments)].y,
        segT,
      );

      const bladeCount = 2 + Math.floor(rand() * 4);
      const isLong = rand() > 0.6;
      const grassColor = rand() > 0.4 ? p.groundGrass : p.groundGrassDark;

      for (let j = 0; j < bladeCount; j++) {
        const bx = gx + (rand() - 0.5) * 6;
        const bladeH = isLong ? 6 + rand() * 8 : 3 + rand() * 4;
        const lean = (rand() - 0.5) * 4;

        g.moveTo(bx - 0.5, gy);
        g.lineTo(bx + lean, gy - bladeH);
        g.lineTo(bx + 0.5, gy);
        g.closePath();
        g.fill(grassColor);
      }
    }
  }

  private drawFlowers(
    g: Graphics,
    w: number,
    groundPoints: Array<{ x: number; y: number }>,
    segments: number,
    p: EraLayerPalette,
    rand: () => number,
  ): void {
    const flowerCount = Math.ceil(w / 60);
    for (let i = 0; i < flowerCount; i++) {
      const fx = rand() * w;
      const segIdx = clamp(Math.floor((fx / w) * segments), 0, segments - 1);
      const segT = ((fx / w) * segments) - segIdx;
      const fy = lerp(
        groundPoints[segIdx].y,
        groundPoints[Math.min(segIdx + 1, segments)].y,
        segT,
      ) - 2;

      const color = p.flowerColors[Math.floor(rand() * p.flowerColors.length)];

      // Stem
      g.moveTo(fx, fy + 4);
      g.lineTo(fx, fy);
      g.stroke({ width: 0.5, color: p.groundGrassDark });

      // Petals
      const petalR = 1 + rand() * 1;
      g.circle(fx, fy, petalR).fill(color);
      g.circle(fx - petalR * 0.8, fy - 0.3, petalR * 0.6).fill(color);
      g.circle(fx + petalR * 0.8, fy - 0.3, petalR * 0.6).fill(color);
      // Center
      g.circle(fx, fy, petalR * 0.4).fill(0xffee88);
    }
  }

  // ==================== FOREGROUND LAYER ====================

  private drawForeground(g: Graphics): void {
    const p = this.palette;
    const w = this.width * 3;
    const baseY = this.height * 0.88;
    const h = this.height * 0.12;
    const rand = seededRandom(499);

    // Dark undergrowth strip
    g.rect(-50, baseY, w + 100, h + 50).fill(p.foregroundDark);

    // Large foreground rocks
    const rockCount = Math.ceil(w / 300);
    for (let i = 0; i < rockCount; i++) {
      const rx = rand() * w;
      const ry = baseY + rand() * h * 0.4;
      const rw = 20 + rand() * 30;
      const rh = 15 + rand() * 20;

      g.moveTo(rx - rw / 2, ry + rh);
      g.lineTo(rx - rw / 2 + rw * 0.1, ry);
      g.lineTo(rx - rw * 0.1, ry - rh * 0.5);
      g.lineTo(rx + rw * 0.2, ry - rh * 0.3);
      g.lineTo(rx + rw / 2, ry + rh * 0.3);
      g.lineTo(rx + rw / 2, ry + rh);
      g.closePath();
      g.fill(this.darkenColor(p.foregroundDark, 0.15));
    }

    // Overhanging branches from top
    const branchCount = Math.ceil(w / 400);
    for (let i = 0; i < branchCount; i++) {
      const bx = rand() * w;
      this.drawOverhangingBranch(g, bx, 0, p, rand);
    }

    // Tall foreground grass blades
    const tallGrassCount = Math.ceil(w / 20);
    for (let i = 0; i < tallGrassCount; i++) {
      const gx = rand() * w;
      const gy = baseY - rand() * 10;
      const bladeH = 15 + rand() * 25;
      const lean = (rand() - 0.5) * 12;
      const alpha = 0.3 + rand() * 0.4;

      g.moveTo(gx - 1.5, gy);
      g.lineTo(gx + lean, gy - bladeH);
      g.lineTo(gx + 1.5, gy);
      g.closePath();
      g.fill({ color: p.foregroundLeaf, alpha });
    }

    // Leaf clusters hanging from top corners
    for (let i = 0; i < 3; i++) {
      const lx = rand() * w;
      const leafCount = 4 + Math.floor(rand() * 6);
      for (let j = 0; j < leafCount; j++) {
        const llx = lx + (rand() - 0.5) * 60;
        const lly = rand() * 30;
        const lr = 3 + rand() * 5;
        g.ellipse(llx, lly, lr, lr * 1.5)
          .fill({ color: p.foregroundLeaf, alpha: 0.25 + rand() * 0.3 });
      }
    }
  }

  private drawOverhangingBranch(
    g: Graphics,
    startX: number,
    startY: number,
    p: EraLayerPalette,
    rand: () => number,
  ): void {
    const branchLen = 40 + rand() * 60;
    const endX = startX + (rand() - 0.5) * 40;
    const endY = startY + branchLen;

    g.moveTo(startX, startY);
    g.lineTo(endX, endY);
    g.stroke({ width: 3 + rand() * 2, color: p.foregroundBranch });

    const subCount = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < subCount; i++) {
      const t = 0.3 + rand() * 0.6;
      const sx = lerp(startX, endX, t);
      const sy = lerp(startY, endY, t);
      const subEndX = sx + (rand() - 0.5) * 30;
      const subEndY = sy + 10 + rand() * 20;

      g.moveTo(sx, sy);
      g.lineTo(subEndX, subEndY);
      g.stroke({ width: 1 + rand(), color: p.foregroundBranch });

      for (let j = 0; j < 3; j++) {
        const lx = subEndX + (rand() - 0.5) * 12;
        const ly = subEndY + (rand() - 0.5) * 8;
        g.ellipse(lx, ly, 3 + rand() * 3, 4 + rand() * 4)
          .fill({ color: p.foregroundLeaf, alpha: 0.3 + rand() * 0.3 });
      }
    }
  }

  // ==================== PUBLIC API ====================

  /**
   * Update parallax scroll based on a camera X offset.
   */
  update(cameraX: number, _deltaMs: number): void {
    this.scrollX = cameraX;
    for (const layer of this.layers) {
      layer.container.x = -cameraX * layer.speed;
    }
  }

  /**
   * Set the day/night progress for sky color shifting.
   * @param progress 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 1 = midnight
   */
  setDayProgress(progress: number): void {
    const prev = this.dayProgress;
    this.dayProgress = progress;
    // Only redraw sky if change is significant
    if (Math.abs(prev - progress) > 0.005 && this.skyLayer) {
      this.drawLayer(this.skyLayer);
    }
  }

  /**
   * Switch to a new era, rebuilding all layer visuals.
   * Also resets blend state since the era change is complete.
   */
  setEra(era: EraId): void {
    if (era === this.currentEra) return;
    this.currentEra = era;
    this.palette = ERA_PALETTES[era] ?? ERA_PALETTES['dawn'];
    this.blendProgress = 0;
    this.blendTargetEra = null;
    this.init(this.width, this.height, era);
  }

  /**
   * Set the blend progress toward the next era.
   * Interpolates the full palette between the current era and the target era
   * and redraws all layers with the blended colors.
   *
   * @param progress  Blend factor (0 = current era, 1 = ready for next).
   * @param nextEra   The era we are blending toward.
   */
  setBlendProgress(progress: number, nextEra: EraId): void {
    const REDRAW_EPSILON = 0.005;
    if (
      Math.abs(progress - this.blendProgress) < REDRAW_EPSILON &&
      nextEra === this.blendTargetEra
    ) {
      return;
    }

    this.blendProgress = clamp(progress, 0, 1);
    this.blendTargetEra = nextEra;
    this.redrawBlended();
  }

  /**
   * Handle window resize.
   */
  resize(width: number, height: number): void {
    this.init(width, height, this.currentEra);
    if (this.blendProgress > 0 && this.blendTargetEra) {
      this.redrawBlended();
    }
  }

  /**
   * Get the current scroll position.
   */
  getScrollX(): number {
    return this.scrollX;
  }

  // ==================== BLEND SYSTEM ====================

  /**
   * Threshold map controlling when each layer begins to visually blend.
   * The blend flows from background to foreground.
   */
  private static readonly LAYER_BLEND_THRESHOLDS: Record<string, number> = {
    sky: 0.10,
    distant: 0.30,
    mid: 0.50,
    ground: 0.70,
    near: 0.70,
  };

  /**
   * Redraw every layer using a blended palette.
   */
  private redrawBlended(): void {
    if (this.layers.length === 0 || this.width === 0) return;

    const currentPalette = ERA_PALETTES[this.currentEra] ?? ERA_PALETTES['dawn'];
    const nextPalette = this.blendTargetEra
      ? (ERA_PALETTES[this.blendTargetEra] ?? currentPalette)
      : currentPalette;

    for (const layer of this.layers) {
      const threshold = ParallaxBackground.LAYER_BLEND_THRESHOLDS[layer.role] ?? 0.5;
      const range = 1.0 - threshold;
      const layerBlend = range > 0
        ? clamp((this.blendProgress - threshold) / range, 0, 1)
        : 0;

      // Temporarily swap palette to blended version, draw, then restore
      const savedPalette = this.palette;
      this.palette = this.interpolatePalette(currentPalette, nextPalette, layerBlend);
      this.drawLayer(layer);
      this.palette = savedPalette;
    }
  }

  /**
   * Interpolate every color in an EraLayerPalette.
   */
  private interpolatePalette(
    from: EraLayerPalette,
    to: EraLayerPalette,
    t: number,
  ): EraLayerPalette {
    if (t <= 0) return from;
    if (t >= 1) return to;

    const lc = (a: number, b: number) => this.lerpColorNum(a, b, t);

    return {
      skyTopDay: lc(from.skyTopDay, to.skyTopDay),
      skyBottomDay: lc(from.skyBottomDay, to.skyBottomDay),
      skyTopNight: lc(from.skyTopNight, to.skyTopNight),
      skyBottomNight: lc(from.skyBottomNight, to.skyBottomNight),
      cloudColor: lc(from.cloudColor, to.cloudColor),
      cloudShadow: lc(from.cloudShadow, to.cloudShadow),
      starColor: lc(from.starColor, to.starColor),
      moonColor: lc(from.moonColor, to.moonColor),
      distantBase: lc(from.distantBase, to.distantBase),
      distantHaze: lc(from.distantHaze, to.distantHaze),
      distantSnow: lc(from.distantSnow, to.distantSnow),
      distantDark: lc(from.distantDark, to.distantDark),
      midGround: lc(from.midGround, to.midGround),
      midDark: lc(from.midDark, to.midDark),
      midLight: lc(from.midLight, to.midLight),
      treeTrunk: lc(from.treeTrunk, to.treeTrunk),
      treeConifer: lc(from.treeConifer, to.treeConifer),
      treeDeciduous: lc(from.treeDeciduous, to.treeDeciduous),
      treeDead: lc(from.treeDead, to.treeDead),
      groundDirt: lc(from.groundDirt, to.groundDirt),
      groundPath: lc(from.groundPath, to.groundPath),
      groundGrass: lc(from.groundGrass, to.groundGrass),
      groundGrassDark: lc(from.groundGrassDark, to.groundGrassDark),
      groundRock: lc(from.groundRock, to.groundRock),
      groundRockLight: lc(from.groundRockLight, to.groundRockLight),
      flowerColors: from.flowerColors.map((c, i) =>
        lc(c, to.flowerColors[i % to.flowerColors.length]),
      ),
      waterBase: lc(from.waterBase, to.waterBase),
      waterHighlight: lc(from.waterHighlight, to.waterHighlight),
      foregroundDark: lc(from.foregroundDark, to.foregroundDark),
      foregroundLeaf: lc(from.foregroundLeaf, to.foregroundLeaf),
      foregroundBranch: lc(from.foregroundBranch, to.foregroundBranch),
      hazeColor: lc(from.hazeColor, to.hazeColor),
      warmGlow: lc(from.warmGlow, to.warmGlow),
    };
  }

  // ==================== COLOR HELPERS ====================

  /**
   * Compute a 0..1 day factor from dayProgress.
   */
  private getDayFactor(): number {
    const dp = this.dayProgress;
    if (dp < 0.2) {
      return (dp / 0.2) * 0.2;
    } else if (dp < 0.3) {
      return 0.2 + ((dp - 0.2) / 0.1) * 0.8;
    } else if (dp < 0.7) {
      return 1.0;
    } else if (dp < 0.8) {
      return 1.0 - ((dp - 0.7) / 0.1) * 0.8;
    } else {
      return 0.2 - ((dp - 0.8) / 0.2) * 0.2;
    }
  }

  /**
   * Lerp a single color channel between two hex-number colors.
   */
  private lerpChannel(
    colorA: number,
    colorB: number,
    t: number,
    channel: 'r' | 'g' | 'b',
  ): number {
    const shift = channel === 'r' ? 16 : channel === 'g' ? 8 : 0;
    const a = (colorA >> shift) & 0xff;
    const b = (colorB >> shift) & 0xff;
    return Math.round(lerp(a, b, t));
  }

  /**
   * Linearly interpolate between two numeric hex colors.
   */
  private lerpColorNum(a: number, b: number, t: number): number {
    const rA = (a >> 16) & 0xff, gA = (a >> 8) & 0xff, bA = a & 0xff;
    const rB = (b >> 16) & 0xff, gB = (b >> 8) & 0xff, bB = b & 0xff;
    const r = Math.round(lerp(rA, rB, t));
    const g = Math.round(lerp(gA, gB, t));
    const bl = Math.round(lerp(bA, bB, t));
    return (r << 16) | (g << 8) | bl;
  }

  private darkenColor(color: number, amount: number): number {
    const r = Math.max(0, Math.round(((color >> 16) & 0xff) * (1 - amount)));
    const gr = Math.max(0, Math.round(((color >> 8) & 0xff) * (1 - amount)));
    const b = Math.max(0, Math.round((color & 0xff) * (1 - amount)));
    return (r << 16) | (gr << 8) | b;
  }
}
