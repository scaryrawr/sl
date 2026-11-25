import { render } from 'preact';

import Demo from './components/home/Demo';
import { DEMO_ID, SHOWCASE_HEIGHT, SHOWCASE_MESSAGES, showcaseId, SHOWCASES } from './components/home/showcases';
import SlTerminal from './components/slTerminal';

const mountPoint = (id: string) => {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Home page mount point #${id} not found`);
  }

  return element;
};

render(<Demo />, mountPoint(DEMO_ID));

for (const { trainType, command } of SHOWCASES) {
  render(
    <SlTerminal
      title={command}
      accident={false}
      fly={false}
      smoke
      trainType={trainType}
      messages={SHOWCASE_MESSAGES}
      height={SHOWCASE_HEIGHT}
    />,
    mountPoint(showcaseId(trainType))
  );
}

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
