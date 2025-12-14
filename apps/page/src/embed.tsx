import { render } from 'preact';
import EmbedTerminal from './components/EmbedTerminal';

const EmbedPage = () => (
  <main>
    <h1 className="sr-only">SL Steam Locomotive Animation</h1>
    <EmbedTerminal />
  </main>
);

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

render(<EmbedPage />, container);
