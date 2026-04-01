import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'bun:test';

const SERVICE_WORKER_PATH = path.join(import.meta.dir, 'service-worker.ts');
const WASM_PLACEHOLDER = '// WASM_PLACEHOLDER - will be replaced at build time';

describe('service worker build integration', () => {
  test('keeps the asset list valid when injecting the wasm filename', async () => {
    const serviceWorkerContent = await readFile(SERVICE_WORKER_PATH, 'utf8');
    const builtServiceWorkerContent = serviceWorkerContent.replace(WASM_PLACEHOLDER, '`${BASE_PATH}/websl_bg.wasm`,');

    expect(builtServiceWorkerContent).toMatch(/`\$\{BASE_PATH\}\/manifest\.json`,\s+`\$\{BASE_PATH\}\/websl_bg\.wasm`,/);
  });
});
