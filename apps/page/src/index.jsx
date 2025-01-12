import { createRoot } from 'react-dom/client';
import SlTerminal, { TrainType } from './components/slTerminal.jsx';

createRoot(document.getElementById('root')).render(
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
    <SlTerminal
      title="SL"
      accident={true}
      fly={false}
      smoke={true}
      trainType={TrainType.D51}
      messages={['oops', 'world']}
    />
    <SlTerminal title="SL" accident={true} fly={false} trainType={TrainType.LOGO} messages={['oops', 'world']} />
    <SlTerminal title="SL" accident={true} fly={false} trainType={TrainType.C51} messages={['oops', 'world']} />
  </div>
);
