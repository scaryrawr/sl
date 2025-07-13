import { useCallback } from 'react';
import { TrainType } from '../slTerminal.jsx';

const Form = ({ state, dispatch }) => {
  const handleAccidentChange = useCallback(
    (e) => {
      dispatch({ type: 'SET_ACCIDENT', payload: e.target.checked });
    },
    [dispatch]
  );

  const handleFlyChange = useCallback(
    (e) => {
      dispatch({ type: 'SET_FLY', payload: e.target.checked });
    },
    [dispatch]
  );

  const handleSmokeChange = useCallback(
    (e) => {
      dispatch({ type: 'SET_SMOKE', payload: e.target.checked });
    },
    [dispatch]
  );

  const handleTrainTypeChange = useCallback(
    (e) => {
      dispatch({ type: 'SET_TRAIN_TYPE', payload: e.target.value });
    },
    [dispatch]
  );

  const handleMessagesChange = useCallback(
    (e) => {
      dispatch({ type: 'SET_MESSAGES', payload: e.target.value.split('\n') });
    },
    [dispatch]
  );

  const handleFontColorChange = useCallback(
    (e) => {
      dispatch({ type: 'SET_FONT_COLOR', payload: e.target.value });
    },
    [dispatch]
  );

  const handleBackgroundColorChange = useCallback(
    (e) => {
      dispatch({ type: 'SET_BACKGROUND_COLOR', payload: e.target.value });
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
        <textarea rows="3" value={state.messages.join('\n')} onChange={handleMessagesChange} />
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
