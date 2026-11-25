import { useReducer } from 'preact/hooks';

import SlTerminal from '../slTerminal';
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_FONT_COLOR } from '../terminal';
import { TrainType, type TrainTypeValue } from '../trainType';
import Form from './Form';

/**
 * Application state for the SL demo on the home page.
 * Tracks all animation options and terminal styling.
 */
type State = {
  accident: boolean;
  fly: boolean;
  smoke: boolean;
  trainType: TrainTypeValue;
  messages: string[];
  fontColor: string;
  backgroundColor: string;
};

/**
 * Dispatched actions that mutate the SL demo state.
 */
type Action =
  | { type: 'SET_ACCIDENT'; payload: boolean }
  | { type: 'SET_FLY'; payload: boolean }
  | { type: 'SET_SMOKE'; payload: boolean }
  | { type: 'SET_TRAIN_TYPE'; payload: TrainTypeValue }
  | { type: 'SET_MESSAGES'; payload: string[] }
  | { type: 'SET_FONT_COLOR'; payload: string }
  | { type: 'SET_BACKGROUND_COLOR'; payload: string };

/** Default state when the demo first loads. */
const initialState: State = {
  accident: true,
  fly: false,
  smoke: true,
  trainType: TrainType.D51,
  messages: ['hello', 'world'],
  fontColor: DEFAULT_FONT_COLOR,
  backgroundColor: DEFAULT_BACKGROUND_COLOR
};

/**
 * Reducer that handles SL demo state updates.
 *
 * @param state - Current demo state.
 * @param action - Action describing the state change.
 * @returns Updated state with the action applied.
 */
const slReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_ACCIDENT':
      return { ...state, accident: action.payload };
    case 'SET_FLY':
      return { ...state, fly: action.payload };
    case 'SET_SMOKE':
      return { ...state, smoke: action.payload };
    case 'SET_TRAIN_TYPE':
      return { ...state, trainType: action.payload };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'SET_FONT_COLOR':
      return { ...state, fontColor: action.payload };
    case 'SET_BACKGROUND_COLOR':
      return { ...state, backgroundColor: action.payload };
    default:
      return state;
  }
};

const Demo = () => {
  const [state, dispatch] = useReducer(slReducer, initialState);

  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      <Form state={state} dispatch={dispatch} />
      <SlTerminal
        title="SL"
        accident={state.accident}
        fly={state.fly}
        smoke={state.smoke}
        trainType={state.trainType}
        messages={state.messages}
        fontColor={state.fontColor}
        backgroundColor={state.backgroundColor}
      />
    </div>
  );
};

export type { Action, State };

export default Demo;
