import { TrainType } from '../slTerminal.jsx';

const Form = ({
  accident,
  setAccident,
  fly,
  setFly,
  smoke,
  setSmoke,
  trainType,
  setTrainType,
  messages,
  setMessages
}) => {
  const handleMessagesChange = (e) => {
    setMessages(e.target.value.split('\n'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <label>
        <input type="checkbox" checked={accident} onChange={(e) => setAccident(e.target.checked)} />
        Accident
      </label>
      <label>
        <input type="checkbox" checked={fly} onChange={(e) => setFly(e.target.checked)} />
        Fly
      </label>
      <label>
        <input type="checkbox" checked={smoke} onChange={(e) => setSmoke(e.target.checked)} />
        Smoke
      </label>
      <label>
        Train Type
        <select value={trainType} onChange={(e) => setTrainType(e.target.value)}>
          <option value={TrainType.D51}>D51</option>
          <option value={TrainType.LOGO}>LOGO</option>
          <option value={TrainType.C51}>C51</option>
        </select>
      </label>
      <label>
        Messages
        <textarea rows="3" value={messages.join('\n')} onChange={(e) => handleMessagesChange(e)} />
      </label>
    </div>
  );
};

export default Form;
