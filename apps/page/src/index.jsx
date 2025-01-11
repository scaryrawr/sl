import { createRoot } from 'react-dom/client';
import SlTerminal, { TrainType } from './components/slTerminal.jsx';

const runWasm = async () => {
  const sl = await import('websl');

  createRoot(document.getElementById('root')).render(
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      <SlTerminal title="SL" accident={true} fly={false} trainType={TrainType.D51} messages={['oops', 'world']} />
    </div>
  );
};

runWasm();
