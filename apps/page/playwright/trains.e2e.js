import { expect, test } from '@playwright/test';

const TERMINAL_ROLE = { name: 'Animated ASCII art train moving across terminal screen' };

/** A sprite fragment that only this train draws, proving the section runs its own locomotive. */
const TRAIN_DEMOS = [
  { name: 'D51', trainType: 'd51', sprite: '(_)---' },
  { name: 'C51', trainType: 'c51', sprite: 'oOo' },
  { name: 'Logo', trainType: 'logo', sprite: '|+-+ |' }
];

test('shows a live demo for every supported train', async ({ page }) => {
  await page.goto('/sl/', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'Trains' })).toBeVisible();

  for (const demo of TRAIN_DEMOS) {
    const section = page.getByRole('region', { name: demo.name });

    await expect(section.getByRole('heading', { level: 3, name: demo.name })).toBeVisible();

    const embedLink = section.getByRole('link', { name: `${demo.name} full-screen demo (opens in new tab)` });

    await expect(embedLink).toHaveAttribute('href', new RegExp(`embed\\.html\\?trainType=${demo.trainType}`));

    const terminal = section.getByRole('img', TERMINAL_ROLE);

    await expect(terminal).toBeVisible();
    await expect(terminal).not.toContainText('Failed to load animation');
    await expect.poll(() => terminal.textContent(), { timeout: 30_000 }).toContain(demo.sprite);
  }
});

test('renders each static train and its status on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/sl/');

  for (const demo of TRAIN_DEMOS) {
    const terminal = page.getByRole('region', { name: demo.name }).getByRole('img', TERMINAL_ROLE);

    await expect(terminal).toContainText(demo.sprite);
    await expect(terminal).toContainText('Static view - Animation disabled');
  }
});
