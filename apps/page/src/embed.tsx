import { render } from 'preact';
import EmbedTerminal from './components/EmbedTerminal';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

render(<EmbedTerminal />, container);
