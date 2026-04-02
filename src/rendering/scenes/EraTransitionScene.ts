import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { easeInOutCubic, easeOutCubic } from '@/utils/easing';
import { ParticleEffects } from '@/rendering/components/ParticleEffects';

/**
 * Cinematic full-screen scene displayed when the player advances to a new era.
 *
 * Sequence:
 *  1. Fade to black          (0.0s  -- 1.0s)
 *  2. Show era name           (1.0s  -- 1.5s fade in)
 *  3. Show era subtitle       (1.5s  -- 2.0s fade in)
 *  4. Particle burst           (1.8s)
 *  5. Hold                    (2.0s  -- 4.0s)
 *  6. Fade out                (4.0s  -- 5.0s)
 *  7. Callback fires          (5.0s)
 *
 * Total duration: ~5 seconds.
 */

const PHASE_FADE_IN_END = 1.0;
const PHASE_NAME_FADE_END = 1.5;
const PHASE_SUBTITLE_FADE_END = 2.0;
const PHASE_PARTICLES_START = 1.8;
const PHASE_HOLD_END = 4.0;
const PHASE_FADE_OUT_END = 5.0;

export class EraTransitionScene {
  public readonly container: Container;

  private width = 0;
  private height = 0;

  /** Full-screen black overlay used for fading. */
  private overlay: Graphics;

  /** Era name text (large). */
  private nameText: Text;
  /** Era subtitle text (smaller, below name). */
  private subtitleText: Text;

  /** Particle burst effect. */
  private particles: ParticleEffects;

  /** Elapsed time since the transition started (seconds). */
  private elapsed = 0;
  /** Whether the transition is actively playing. */
  private playing = false;
  /** Callback invoked when the transition completes. */
  private onComplete: (() => void) | null = null;
  /** Whether the particle burst has been triggered for this play. */
  private burstFired = false;

  constructor() {
    this.container = new Container();
    this.container.visible = false;

    // --- Black overlay ---
    this.overlay = new Graphics();
    this.container.addChild(this.overlay);

    // --- Name ---
    this.nameText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 64,
        fontWeight: 'bold',
        fill: 0xffeedd,
        letterSpacing: 12,
        align: 'center',
        dropShadow: {
          color: 0x000000,
          blur: 10,
          distance: 0,
          alpha: 0.8,
        },
      }),
    });
    this.nameText.anchor.set(0.5, 0.5);
    this.nameText.alpha = 0;
    this.container.addChild(this.nameText);

    // --- Subtitle ---
    this.subtitleText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 24,
        fill: 0xccaa88,
        letterSpacing: 4,
        align: 'center',
      }),
    });
    this.subtitleText.anchor.set(0.5, 0.5);
    this.subtitleText.alpha = 0;
    this.container.addChild(this.subtitleText);

    // --- Particles ---
    this.particles = new ParticleEffects(200);
    this.container.addChild(this.particles.container);
  }

  /**
   * Initialize / resize.
   */
  init(width: number, height: number): void {
    this.width = width;
    this.height = height;

    // Redraw overlay
    this.overlay.clear();
    this.overlay.rect(0, 0, width, height).fill(0x000000);

    // Position text
    this.nameText.x = width / 2;
    this.nameText.y = height * 0.4;
    this.subtitleText.x = width / 2;
    this.subtitleText.y = height * 0.4 + 60;
  }

  /**
   * Start playing the transition cinematic.
   *
   * @param eraName   Display name for the new era (e.g., "The Dawn").
   * @param subtitle  Subtitle line (e.g., "200,000 BC - The First Sparks").
   * @param onComplete  Called when the entire sequence finishes.
   */
  play(eraName: string, subtitle: string, onComplete?: () => void): void {
    this.nameText.text = eraName;
    this.subtitleText.text = subtitle;
    this.nameText.alpha = 0;
    this.subtitleText.alpha = 0;
    this.overlay.alpha = 0;
    this.elapsed = 0;
    this.playing = true;
    this.burstFired = false;
    this.container.visible = true;
    this.onComplete = onComplete ?? null;

    this.particles.clear();
  }

  /**
   * Per-frame update. Drives the cinematic timeline.
   * @param dt Delta time in seconds.
   */
  update(dt: number): void {
    if (!this.playing) return;
    this.elapsed += dt;

    const t = this.elapsed;

    // Phase 1: Fade to black (0 .. PHASE_FADE_IN_END)
    if (t < PHASE_FADE_IN_END) {
      this.overlay.alpha = easeInOutCubic(t / PHASE_FADE_IN_END);
    } else {
      this.overlay.alpha = 1;
    }

    // Phase 2: Era name fade-in (PHASE_FADE_IN_END .. PHASE_NAME_FADE_END)
    if (t >= PHASE_FADE_IN_END && t < PHASE_NAME_FADE_END) {
      const nameT = (t - PHASE_FADE_IN_END) / (PHASE_NAME_FADE_END - PHASE_FADE_IN_END);
      this.nameText.alpha = easeOutCubic(nameT);
      // Scale in from large
      const s = 1 + (1 - easeOutCubic(nameT)) * 0.3;
      this.nameText.scale.set(s, s);
    } else if (t >= PHASE_NAME_FADE_END) {
      this.nameText.alpha = 1;
      this.nameText.scale.set(1, 1);
    }

    // Phase 3: Subtitle fade-in (PHASE_NAME_FADE_END .. PHASE_SUBTITLE_FADE_END)
    if (t >= PHASE_NAME_FADE_END && t < PHASE_SUBTITLE_FADE_END) {
      const subT = (t - PHASE_NAME_FADE_END) / (PHASE_SUBTITLE_FADE_END - PHASE_NAME_FADE_END);
      this.subtitleText.alpha = easeOutCubic(subT);
    } else if (t >= PHASE_SUBTITLE_FADE_END) {
      this.subtitleText.alpha = 1;
    }

    // Phase 4: Particle burst
    if (t >= PHASE_PARTICLES_START && !this.burstFired) {
      this.burstFired = true;
      this.particles.play(
        'eraTransition',
        this.width / 2,
        this.height * 0.45,
        1.5,
      );
    }

    // Phase 5: Fade out everything (PHASE_HOLD_END .. PHASE_FADE_OUT_END)
    if (t >= PHASE_HOLD_END && t < PHASE_FADE_OUT_END) {
      const fadeT = (t - PHASE_HOLD_END) / (PHASE_FADE_OUT_END - PHASE_HOLD_END);
      const alpha = 1 - easeInOutCubic(fadeT);
      this.nameText.alpha = alpha;
      this.subtitleText.alpha = alpha;
      this.overlay.alpha = alpha;
    }

    // Phase 6: Complete
    if (t >= PHASE_FADE_OUT_END) {
      this.playing = false;
      this.container.visible = false;
      this.nameText.alpha = 0;
      this.subtitleText.alpha = 0;
      this.overlay.alpha = 0;
      this.particles.clear();
      if (this.onComplete) {
        this.onComplete();
        this.onComplete = null;
      }
    }

    // Always advance particles while visible
    this.particles.update(dt);
  }

  /**
   * Whether the transition is currently playing.
   */
  isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Immediately cancel the transition (e.g., skip button).
   */
  skip(): void {
    if (!this.playing) return;
    this.playing = false;
    this.container.visible = false;
    this.nameText.alpha = 0;
    this.subtitleText.alpha = 0;
    this.overlay.alpha = 0;
    this.particles.clear();
    if (this.onComplete) {
      this.onComplete();
      this.onComplete = null;
    }
  }

  /**
   * Handle viewport resize.
   */
  resize(width: number, height: number): void {
    this.init(width, height);
  }

  /**
   * Clean up.
   */
  dispose(): void {
    this.particles.dispose();
    this.container.destroy({ children: true });
  }
}
