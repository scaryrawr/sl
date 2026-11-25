import { renderToString } from 'preact-render-to-string';

import template from './index.html' with { type: 'text' };
import Home from './src/components/home/Home';

const HOME_MARKER = '<!-- HOME -->';

const writeHomePage = async () => {
  if (!template.includes(HOME_MARKER)) {
    throw new Error(`Missing ${HOME_MARKER} in index.html`);
  }

  await Bun.write(
    new URL('./lib/index.html', import.meta.url),
    template.replace(HOME_MARKER, () => renderToString(<Home />))
  );
};

if (import.meta.main) {
  await writeHomePage();
}

export { writeHomePage };
