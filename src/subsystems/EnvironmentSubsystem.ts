import { SubsystemBase } from '@/core/SubsystemBase';
import type { EventBus } from '@/core/EventBus';
import type { EnvironmentState, Season, WeatherType } from '@/types';
import { clamp, chance } from '@/utils/math';

/**
 * EnvironmentSubsystem
 * Simulates a simple day/night cycle, seasonal rotation, weather, and
 * environmental modifiers that affect resource gathering and population.
 */

// ── Constants ────────────────────────────────────────────────────────

/** Ticks for one full day/night cycle. */
const DAY_CYCLE_TICKS = 200;

/** Ticks per season. Four seasons = 10,000 ticks (~16.7 min at 10 tps). */
const SEASON_TICKS = 2500;

/** Probability of a weather change per tick. */
const WEATHER_CHANGE_CHANCE = 0.002;

const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** Weather probability weights per season. Higher = more likely. */
const WEATHER_BY_SEASON: Record<Season, Partial<Record<WeatherType, number>>> = {
  spring: { clear: 4, rain: 4, fog: 2 },
  summer: { clear: 6, rain: 2, drought: 1, storm: 1 },
  autumn: { clear: 3, rain: 4, fog: 2, storm: 1 },
  winter: { clear: 2, snow: 5, storm: 2, fog: 1 },
};

/** Seasonal temperature baselines (Celsius) for a temperate biome. */
const SEASON_TEMPERATURE: Record<Season, number> = {
  spring: 14,
  summer: 24,
  autumn: 12,
  winter: 2,
};

/** Gather rate multipliers per season (applied externally via events). */
export const SEASON_GATHER_MODIFIERS: Record<Season, Record<string, number>> = {
  spring: { berries: 0.1, wood: 0, meat: 0, hides: 0, flint: 0 },
  summer: { berries: 0.2, wood: 0.1, meat: 0.1, hides: 0, flint: 0 },
  autumn: { berries: -0.1, wood: 0, meat: 0.1, hides: 0.05, flint: 0 },
  winter: { berries: -0.3, wood: -0.1, meat: -0.1, hides: 0, flint: 0 },
};

export class EnvironmentSubsystem extends SubsystemBase<EnvironmentState> {
  private unsubscribers: (() => void)[] = [];
  private seasonTickCounter = 0;
  private previousIsDay = true;

  constructor(eventBus: EventBus) {
    super(eventBus, {
      biome: 'temperate',
      season: 'summer',
      temperature: 20,
      weather: 'clear',
      dayProgress: 0.5,
      pollution: 0,
      biodiversity: 80,
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  initialize(): void {
    // Emit initial state so other systems can react.
    this.eventBus.emit('environment:seasonChanged', { season: this.state.season });
    this.eventBus.emit('environment:weatherChanged', { weather: this.state.weather });
  }

  update(tickCount: number): void {
    this.advanceDayNight(tickCount);
    this.advanceSeason();
    this.maybeChangeWeather();
    this.updateTemperature();
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
  }

  // ── Public API ────────────────────────────────────────────────────

  /** Returns true if it is currently daytime (dayProgress 0.25 – 0.75). */
  isDay(): boolean {
    return this.state.dayProgress >= 0.25 && this.state.dayProgress < 0.75;
  }

  /** Get the gather-rate modifier map for the current season. */
  getSeasonModifiers(): Record<string, number> {
    return SEASON_GATHER_MODIFIERS[this.state.season];
  }

  /** Modify pollution (clamped 0–100). */
  modifyPollution(delta: number): void {
    this.state.pollution = clamp(this.state.pollution + delta, 0, 100);
  }

  /** Modify biodiversity (clamped 0–100). */
  modifyBiodiversity(delta: number): void {
    this.state.biodiversity = clamp(this.state.biodiversity + delta, 0, 100);
  }

  // ── Internals ─────────────────────────────────────────────────────

  private advanceDayNight(_tickCount: number): void {
    this.state.dayProgress += 1 / DAY_CYCLE_TICKS;
    if (this.state.dayProgress >= 1) {
      this.state.dayProgress -= 1;
    }

    const currentlyDay = this.isDay();
    if (currentlyDay !== this.previousIsDay) {
      this.previousIsDay = currentlyDay;
      this.eventBus.emit('environment:dayNightChanged', { isDay: currentlyDay });
    }
  }

  private advanceSeason(): void {
    this.seasonTickCounter += 1;
    if (this.seasonTickCounter < SEASON_TICKS) return;

    this.seasonTickCounter = 0;
    const currentIndex = SEASON_ORDER.indexOf(this.state.season);
    const nextIndex = (currentIndex + 1) % SEASON_ORDER.length;
    this.state.season = SEASON_ORDER[nextIndex];

    this.eventBus.emit('environment:seasonChanged', { season: this.state.season });
    this.emitStateChange();
  }

  private maybeChangeWeather(): void {
    if (!chance(WEATHER_CHANGE_CHANCE)) return;

    const weights = WEATHER_BY_SEASON[this.state.season];
    const newWeather = this.weightedSelect(weights);
    if (newWeather && newWeather !== this.state.weather) {
      this.state.weather = newWeather;
      this.eventBus.emit('environment:weatherChanged', { weather: newWeather });
    }
  }

  private updateTemperature(): void {
    const base = SEASON_TEMPERATURE[this.state.season];
    // Day is warmer than night.
    const dayOffset = this.isDay() ? 4 : -4;
    // Weather affects temperature.
    let weatherOffset = 0;
    switch (this.state.weather) {
      case 'rain': weatherOffset = -2; break;
      case 'snow': weatherOffset = -6; break;
      case 'storm': weatherOffset = -4; break;
      case 'drought': weatherOffset = 5; break;
      case 'fog': weatherOffset = -1; break;
      default: break;
    }
    this.state.temperature = base + dayOffset + weatherOffset;
  }

  /**
   * Select a key from a weight map using weighted random selection.
   */
  private weightedSelect(weights: Partial<Record<WeatherType, number>>): WeatherType | null {
    const entries = Object.entries(weights) as [WeatherType, number][];
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (total === 0) return null;

    let roll = Math.random() * total;
    for (const [weather, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return weather;
    }
    return entries[entries.length - 1]?.[0] ?? null;
  }
}
