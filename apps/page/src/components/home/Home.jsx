import { useReducer } from 'react';
import SlTerminal, { TrainType } from '../slTerminal.jsx';
import Embed from './Embed.jsx';
import Form from './Form.jsx';
import Installation from './Installation.jsx';
import Piping from './Piping.jsx';
import Usage from './Usage.jsx';

const initialState = {
  accident: true,
  fly: false,
  smoke: true,
  trainType: TrainType.D51,
  messages: ['hello', 'world'],
  fontColor: '#0f0',
  backgroundColor: '#000'
};

const slReducer = (state, action) => {
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

const Home = () => {
  const [state, dispatch] = useReducer(slReducer, initialState);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <h1>Welcome to the SL Project</h1>
      <p>
        SL (Steam Locomotive) runs across your terminal when you type "sl" as you meant to type "ls". It's just a joke
        command.
      </p>
      <p>
        Visit our <a href="https://github.com/scaryrawr/sl">GitHub repository</a> for more information.
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
    </div>
  );
};

export default Home;
