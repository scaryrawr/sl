import { render } from 'preact';
import App from './components/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

render(<App />, container);
