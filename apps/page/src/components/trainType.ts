type TrainTypeValue = 'c51' | 'd51' | 'logo';

const TrainType = {
  C51: 'c51',
  D51: 'd51',
  LOGO: 'logo'
} as const satisfies Record<string, TrainTypeValue>;

const parseTrainType = (raw: string | null): TrainTypeValue =>
  Object.values(TrainType).find((type) => type === raw) ?? TrainType.D51;

export { TrainType, parseTrainType };

export type { TrainTypeValue };
