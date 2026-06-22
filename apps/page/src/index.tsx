/**
 * Main entry point for the SL web page (`index.html`).
 *
 * Renders the {@link App} component and registers the service worker for offline support.
 *
 * @module index
 */
import { render } from 'preact';
import App from './components/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

render(<App />, container);

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
