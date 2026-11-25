import { TrainType, type TrainTypeValue } from '../trainType';

const DEMO_ID = 'demo-controls';
const SHOWCASE_HEIGHT = '480px';
const SHOWCASE_MESSAGES = ['steam', 'locomotive'];

const SHOWCASES = [
  { trainType: TrainType.D51, command: 'sl' },
  { trainType: TrainType.C51, command: 'sl -c' },
  { trainType: TrainType.LOGO, command: 'sl -l' }
] as const;

const showcaseId = (trainType: TrainTypeValue) => `train-terminal-${trainType}`;

export { DEMO_ID, SHOWCASES, SHOWCASE_HEIGHT, SHOWCASE_MESSAGES, showcaseId };
