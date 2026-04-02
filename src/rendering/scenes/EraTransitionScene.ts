import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { easeInOutCubic, easeOutCubic } from '@/utils/easing';
import { ParticleEffects } from '@/rendering/components/ParticleEffects';

/**
 * Cinematic full-screen scene displayed when the player advances to a new era.
 *
 * The cinematic is deliberately slow and dramatic. By the time it plays, the
 * world has already been visually blending toward the new era for a while, so
 * this acts as a ceremonial punctuation mark rather than a jarring switch.
 *
 * Sequence:
 *  1. Slow fade to black        (0.0s  -- 1.5s)
 *  2. Show narration line        (1.5s  -- 2.5s fade in)
 *  3. Show era name              (3.0s  -- 4.0s fade in, scale from large)
 *  4. Show era subtitle          (4.0s  -- 5.0s fade in)
 *  5. Particle burst             (4.5s)
 *  6. Hold                       (5.0s  -- 7.5s)
 *  7. Fade out                   (7.5s  -- 9.5s)
 *  8. Callback fires             (9.5s)
 *
 * Total duration: ~9.5 seconds.
 */

const PHASE_FADE_IN_END = 1.5;
const PHASE_NARRATION_FADE_END = 2.5;
const PHASE_NAME_START = 3.0;
const PHASE_NAME_FADE_END = 4.0;
const PHASE_SUBTITLE_FADE_END = 5.0;
const PHASE_PARTICLES_START = 4.5;
const PHASE_HOLD_END = 7.5;
const PHASE_FADE_OUT_END = 9.5;

export class EraTransitionScene {
  public readonly container: Container;

  private width = 0;
  private height = 0;

  /** Full-screen black overlay used for fading. */
  private overlay: Graphics;

  /** Narration line (e.g., "Generations have passed..."). Appears before era name. */
  private narrationText: Text;
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

    // --- Narration ---
    this.narrationText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 20,
        fontStyle: 'italic',
        fill: 0x998877,
        letterSpacing: 2,
        align: 'center',
      }),
    });
    this.narrationText.anchor.set(0.5, 0.5);
    this.narrationText.alpha = 0;
    this.container.addChild(this.narrationText);

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
    this.narrationText.x = width / 2;
    this.narrationText.y = height * 0.33;
    this.nameText.x = width / 2;
    this.nameText.y = height * 0.44;
    this.subtitleText.x = width / 2;
    this.subtitleText.y = height * 0.44 + 60;
  }

  /**
   * Start playing the transition cinematic.
   *
   * @param eraName    Display name for the new era (e.g., "The Dawn").
   * @param subtitle   Subtitle line (e.g., "200,000 BC - The First Sparks").
   * @param onComplete Called when the entire sequence finishes.
   * @param narration  Optional narration line shown before the era name.
   *                   Defaults to "Generations have passed..." if omitted.
   */
  play(eraName: string, subtitle: string, onComplete?: () => void, narration?: string): void {
    this.narrationText.text = narration ?? 'Generations have passed...';
    this.nameText.text = eraName;
    this.subtitleText.text = subtitle;
    this.narrationText.alpha = 0;
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

    // Phase 1: Slow fade to black (0 .. PHASE_FADE_IN_END)
    if (t < PHASE_FADE_IN_END) {
      this.overlay.alpha = easeInOutCubic(t / PHASE_FADE_IN_END);
    } else {
      this.overlay.alpha = 1;
    }

    // Phase 2: Narration line fade-in (PHASE_FADE_IN_END .. PHASE_NARRATION_FADE_END)
    if (t >= PHASE_FADE_IN_END && t < PHASE_NARRATION_FADE_END) {
      const narT = (t - PHASE_FADE_IN_END) / (PHASE_NARRATION_FADE_END - PHASE_FADE_IN_END);
      this.narrationText.alpha = easeOutCubic(narT);
    } else if (t >= PHASE_NARRATION_FADE_END && t < PHASE_NAME_START) {
      // Hold narration visible, then slowly fade it as the era name appears
      this.narrationText.alpha = 1;
    } else if (t >= PHASE_NAME_START && t < PHASE_NAME_FADE_END) {
      // Crossfade: narration fades out as name fades in
      const crossT = (t - PHASE_NAME_START) / (PHASE_NAME_FADE_END - PHASE_NAME_START);
      this.narrationText.alpha = 1 - easeOutCubic(crossT);
    } else if (t >= PHASE_NAME_FADE_END) {
      this.narrationText.alpha = 0;
    }

    // Phase 3: Era name fade-in (PHASE_NAME_START .. PHASE_NAME_FADE_END)
    if (t >= PHASE_NAME_START && t < PHASE_NAME_FADE_END) {
      const nameT = (t - PHASE_NAME_START) / (PHASE_NAME_FADE_END - PHASE_NAME_START);
      this.nameText.alpha = easeOutCubic(nameT);
      // Scale in from large
      const s = 1 + (1 - easeOutCubic(nameT)) * 0.3;
      this.nameText.scale.set(s, s);
    } else if (t >= PHASE_NAME_FADE_END) {
      this.nameText.alpha = 1;
      this.nameText.scale.set(1, 1);
    }

    // Phase 4: Subtitle fade-in (PHASE_NAME_FADE_END .. PHASE_SUBTITLE_FADE_END)
    if (t >= PHASE_NAME_FADE_END && t < PHASE_SUBTITLE_FADE_END) {
      const subT = (t - PHASE_NAME_FADE_END) / (PHASE_SUBTITLE_FADE_END - PHASE_NAME_FADE_END);
      this.subtitleText.alpha = easeOutCubic(subT);
    } else if (t >= PHASE_SUBTITLE_FADE_END) {
      this.subtitleText.alpha = 1;
    }

    // Phase 5: Particle burst
    if (t >= PHASE_PARTICLES_START && !this.burstFired) {
      this.burstFired = true;
      this.particles.play(
        'eraTransition',
        this.width / 2,
        this.height * 0.45,
        2.0,
      );
    }

    // Phase 6: Fade out everything (PHASE_HOLD_END .. PHASE_FADE_OUT_END)
    if (t >= PHASE_HOLD_END && t < PHASE_FADE_OUT_END) {
      const fadeT = (t - PHASE_HOLD_END) / (PHASE_FADE_OUT_END - PHASE_HOLD_END);
      const alpha = 1 - easeInOutCubic(fadeT);
      this.narrationText.alpha = 0; // already gone
      this.nameText.alpha = alpha;
      this.subtitleText.alpha = alpha;
      this.overlay.alpha = alpha;
    }

    // Phase 7: Complete
    if (t >= PHASE_FADE_OUT_END) {
      this.playing = false;
      this.container.visible = false;
      this.narrationText.alpha = 0;
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
    this.narrationText.alpha = 0;
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
