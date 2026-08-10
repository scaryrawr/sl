import { expect, test } from '@playwright/test';

const waitForServiceWorkerControl = async (page) => {
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers are not supported in this browser');
    }

    await navigator.serviceWorker.ready;

    if (navigator.serviceWorker.controller) {
      return;
    }

    await new Promise((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
    });
  });
};

test('loads the home page offline from the bare project path', async ({ context, page }) => {
  const requestedOutsideProjectPath = [];
  let origin = '';

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (origin && url.origin === origin && url.pathname !== '/sl' && !url.pathname.startsWith('/sl/')) {
      requestedOutsideProjectPath.push(url.pathname);
    }
  });

  await page.goto('/sl/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Welcome to the SL Project' })).toBeVisible();

  origin = new URL(page.url()).origin;
  await waitForServiceWorkerControl(page);

  await context.setOffline(true);

  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.id = 'offline-frame';
    iframe.src = '/sl';
    document.body.appendChild(iframe);
  });

  await expect
    .poll(() => page.frames().find((frame) => frame !== page.mainFrame() && frame.url() === `${origin}/sl/`)?.url() ?? '')
    .toBe(`${origin}/sl/`);

  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url() === `${origin}/sl/`);
  if (!frame) {
    throw new Error('Offline navigation frame did not load the canonical /sl/ URL');
  }

  await expect(frame.getByRole('heading', { name: 'Welcome to the SL Project' })).toBeVisible();
  expect(requestedOutsideProjectPath).not.toContain('/index.js');
  expect(requestedOutsideProjectPath).not.toContain('/manifest.json');
});

test('loads and runs the embed page offline', async ({ context, page }) => {
  await page.goto('/sl/', { waitUntil: 'networkidle' });
  await waitForServiceWorkerControl(page);

  await context.setOffline(true);
  await page.goto('/sl/embed.html?trainType=d51&smoke=true', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'SL Steam Locomotive Animation' })).toBeAttached();
  const terminal = page.getByRole('img', { name: 'Animated ASCII art train moving across terminal screen' });
  await expect(terminal).toBeVisible();
  await expect.poll(() => terminal.textContent()).toMatch(/[^\s\u00a0]/);
  await expect(terminal).not.toContainText('Failed to load animation');
});
