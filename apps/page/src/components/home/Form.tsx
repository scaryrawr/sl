import type { JSX } from 'preact';
import { useCallback } from 'preact/hooks';
import { TrainType, type TrainTypeValue } from '../slTerminal';
import type { Action, State } from './Home';

type FormProps = {
  state: State;
  dispatch: (action: Action) => void;
};

const Form = ({ state, dispatch }: FormProps) => {
  const handleAccidentChange = useCallback(
    (e: JSX.TargetedEvent<HTMLInputElement>) => {
      dispatch({ type: 'SET_ACCIDENT', payload: e.currentTarget.checked });
    },
    [dispatch]
  );

  const handleFlyChange = useCallback(
    (e: JSX.TargetedEvent<HTMLInputElement>) => {
      dispatch({ type: 'SET_FLY', payload: e.currentTarget.checked });
    },
    [dispatch]
  );

  const handleSmokeChange = useCallback(
    (e: JSX.TargetedEvent<HTMLInputElement>) => {
      dispatch({ type: 'SET_SMOKE', payload: e.currentTarget.checked });
    },
    [dispatch]
  );

  const handleTrainTypeChange = useCallback(
    (e: JSX.TargetedEvent<HTMLSelectElement>) => {
      dispatch({ type: 'SET_TRAIN_TYPE', payload: e.currentTarget.value as TrainTypeValue });
    },
    [dispatch]
  );

  const handleMessagesChange = useCallback(
    (e: JSX.TargetedEvent<HTMLTextAreaElement>) => {
      dispatch({ type: 'SET_MESSAGES', payload: e.currentTarget.value.split('\n') });
    },
    [dispatch]
  );

  const handleFontColorChange = useCallback(
    (e: JSX.TargetedEvent<HTMLInputElement>) => {
      dispatch({ type: 'SET_FONT_COLOR', payload: e.currentTarget.value });
    },
    [dispatch]
  );

  const handleBackgroundColorChange = useCallback(
    (e: JSX.TargetedEvent<HTMLInputElement>) => {
      dispatch({ type: 'SET_BACKGROUND_COLOR', payload: e.currentTarget.value });
    },
    [dispatch]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <label>
        <input type="checkbox" checked={state.accident} onChange={handleAccidentChange} />
        Accident
      </label>
      <label>
        <input type="checkbox" checked={state.fly} onChange={handleFlyChange} />
        Fly
      </label>
      <label>
        <input type="checkbox" checked={state.smoke} onChange={handleSmokeChange} />
        Smoke
      </label>
      <label>
        Train Type
        <select value={state.trainType} onChange={handleTrainTypeChange}>
          <option value={TrainType.D51}>D51</option>
          <option value={TrainType.LOGO}>LOGO</option>
          <option value={TrainType.C51}>C51</option>
        </select>
      </label>
      <label>
        Messages
        <textarea rows={3} value={state.messages.join('\n')} onChange={handleMessagesChange} />
      </label>
      <label>
        Font Color
        <input type="color" value={state.fontColor} onChange={handleFontColorChange} />
      </label>
      <label>
        Background Color
        <input type="color" value={state.backgroundColor} onChange={handleBackgroundColorChange} />
      </label>
    </div>
  );
};

export default Form;
