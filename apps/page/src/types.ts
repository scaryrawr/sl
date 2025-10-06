export const TrainType = {
  C51: 'c51',
  D51: 'd51',
  LOGO: 'logo'
} as const;

export type TrainTypeValue = (typeof TrainType)[keyof typeof TrainType];

export interface SlState {
  accident: boolean;
  fly: boolean;
  smoke: boolean;
  trainType: TrainTypeValue;
  messages: string[];
  fontColor: string;
  backgroundColor: string;
}

export type SlAction =
  | { type: 'SET_ACCIDENT'; payload: boolean }
  | { type: 'SET_FLY'; payload: boolean }
  | { type: 'SET_SMOKE'; payload: boolean }
  | { type: 'SET_TRAIN_TYPE'; payload: TrainTypeValue }
  | { type: 'SET_MESSAGES'; payload: string[] }
  | { type: 'SET_FONT_COLOR'; payload: string }
  | { type: 'SET_BACKGROUND_COLOR'; payload: string };
