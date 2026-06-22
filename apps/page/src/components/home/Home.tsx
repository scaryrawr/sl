import { useReducer } from 'preact/hooks';
import SlTerminal, { TrainType, type TrainTypeValue } from '../slTerminal';
import Embed from './Embed';
import Form from './Form';
import Installation from './Installation';
import Piping from './Piping';
import Usage from './Usage';

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
  fontColor: '#0f0',
  backgroundColor: '#000'
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

/**
 * Main home page component.
 *
 * Renders the SL demo with an interactive control form, usage documentation,
 * piping examples, embed instructions, and installation guides.
 *
 * @returns The complete home page layout.
 */
const Home = () => {
  const [state, dispatch] = useReducer(slReducer, initialState);

  return (
    <main id="main-content" style={{ display: 'flex', flexDirection: 'column', padding: '20px' }}>
      <h1>Welcome to the SL Project</h1>
      <p>
        SL (Steam Locomotive) runs across your terminal when you type &ldquo;sl&rdquo; as you meant to type
        &ldquo;ls&rdquo;. It&rsquo;s just a joke command.
      </p>
      <p>
        Visit our{' '}
        <a
          href="https://github.com/scaryrawr/sl"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub repository (opens in new tab)"
        >
          GitHub repository
        </a>{' '}
        for more information.
      </p>
      <hr />
      <h2>Demo</h2>
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
      <Usage />
      <Piping />
      <Embed />
      <Installation />
    </main>
  );
};

export type { Action, State };
export default Home;
