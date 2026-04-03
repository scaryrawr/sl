import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

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

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  baseURL,
  serviceWorkers: 'allow',
  viewport: { width: 1280, height: 800 }
});
const page = await context.newPage();

// --- Online screenshot ---
console.log('Navigating to /sl/ (online)...');
await page.goto(`${baseURL}/sl/`, { waitUntil: 'networkidle' });

// Wait for the train animation to appear (canvas or pre element with train)
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(__dirname, 'online.png'), fullPage: false });
console.log('Online screenshot saved.');

// Wait for service worker to take control
await waitForServiceWorkerControl(page);
console.log('Service worker is in control.');

// --- Offline screenshot ---
console.log('Going offline...');
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(__dirname, 'offline.png'), fullPage: false });
console.log('Offline screenshot saved.');

// Also take offline embed screenshot
const embedPage = await context.newPage();
await embedPage.goto(`${baseURL}/sl/embed?train=D1&loop=true`, { waitUntil: 'domcontentloaded' });
await embedPage.waitForTimeout(2000);
await embedPage.screenshot({ path: path.join(__dirname, 'offline-embed.png'), fullPage: false });
console.log('Offline embed screenshot saved.');

await browser.close();
console.log('Done!');
