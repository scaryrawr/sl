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

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}
