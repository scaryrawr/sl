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
      <label htmlFor="accident-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <input id="accident-checkbox" type="checkbox" checked={state.accident} onChange={handleAccidentChange} />
        <span>Accident</span>
      </label>
      <label htmlFor="fly-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <input id="fly-checkbox" type="checkbox" checked={state.fly} onChange={handleFlyChange} />
        <span>Fly</span>
      </label>
      <label htmlFor="smoke-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <input id="smoke-checkbox" type="checkbox" checked={state.smoke} onChange={handleSmokeChange} />
        <span>Smoke</span>
      </label>
      <label htmlFor="train-type-select">
        Train Type
        <select id="train-type-select" value={state.trainType} onChange={handleTrainTypeChange}>
          <option value={TrainType.D51}>D51</option>
          <option value={TrainType.LOGO}>LOGO</option>
          <option value={TrainType.C51}>C51</option>
        </select>
      </label>
      <label htmlFor="messages-textarea">
        Messages
        <textarea id="messages-textarea" rows={3} value={state.messages.join('\n')} onChange={handleMessagesChange} />
      </label>
      <label htmlFor="font-color-input">
        <div>Font Color</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input id="font-color-input" type="color" value={state.fontColor} onChange={handleFontColorChange} />
          <span aria-live="polite" aria-atomic="true">Font color: {state.fontColor}</span>
        </div>
      </label>
      <label htmlFor="background-color-input">
        <div>Background Color</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input id="background-color-input" type="color" value={state.backgroundColor} onChange={handleBackgroundColorChange} />
          <span aria-live="polite" aria-atomic="true">Background color: {state.backgroundColor}</span>
        </div>
      </label>
    </div>
  );
};

export default Form;
