export type EraId =
  | 'dawn'
  | 'awakening'
  | 'roots'
  | 'forge'
  | 'empire'
  | 'convergence'
  | 'enlightenment'
  | 'revolution'
  | 'modern'
  | 'horizon';

export interface EraDefinition {
  id: EraId;
  name: string;
  subtitle: string;
  period: string;
  description: string;
  order: number;
  colors: EraColors;
  milestones: Milestone[];
  uiTheme: EraUITheme;
}

export interface EraColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface EraUITheme {
  panelBackground: string;
  panelBorder: string;
  borderRadius: string;
  fontFamily: string;
  cssClass: string;
}

export interface Milestone {
  id: string;
  description: string;
  completed: boolean;
  required: boolean;
  requirement: MilestoneRequirement;
}

export interface MilestoneRequirement {
  type: 'population' | 'technology' | 'resource' | 'building' | 'event' | 'composite';
  target?: string;
  value?: number;
  children?: MilestoneRequirement[];
}

export interface EraProgression {
  currentEra: EraId;
  milestones: Milestone[];
  canAdvance: boolean;
  completedEras: EraId[];
  /** 0.0 = fully current era, 1.0 = visually ready for next era. Drives gradual blending. */
  eraBlendProgress: number;
}
