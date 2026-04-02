export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Biome = 'tundra' | 'temperate' | 'arid' | 'tropical' | 'urban' | 'orbital';
export type WeatherType = 'clear' | 'rain' | 'snow' | 'storm' | 'drought' | 'fog';

export interface EnvironmentState {
  season: Season;
  biome: Biome;
  temperature: number;
  weather: WeatherType;
  dayProgress: number;
  pollution: number;
  biodiversity: number;
}
