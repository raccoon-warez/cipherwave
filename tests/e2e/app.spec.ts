import { test, expect } from '@playwright/test';

test.describe('CipherWave UI', () => {
  test('loads the identity screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1.title')).toContainText('CipherWave');
    await expect(page.locator('#username-input')).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Identity/i })).toBeVisible();
  });

  test('rejects an invalid handle', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username-input').fill('a'); // too short
    await page.getByRole('button', { name: /Create Identity/i }).click();
    await expect(page.locator('.msg-err')).toBeVisible();
    await expect(page.locator('#username-input')).toBeVisible();
  });

  test('registers and auto-generates a channel code with a capacity suffix', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username-input').fill('nightjar');
    await page.getByRole('button', { name: /Create Identity/i }).click();

    await expect(page.locator('#room-id-input')).toBeVisible();
    await expect(page.locator('.callsign-id')).toHaveText(/^CW-[A-Z0-9]{8}$/);

    const code = await page.locator('#room-id-input').inputValue();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{16}~8$/);
  });

  test('the capacity slider re-stamps the channel code', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username-input').fill('nightjar');
    await page.getByRole('button', { name: /Create Identity/i }).click();

    await page.locator('#room-size-input').fill('16');
    await expect(page.locator('#room-id-input')).toHaveValue(/~16$/);
    await expect(page.locator('label[for="room-size-input"]')).toContainText('16');
  });

  test('generates a fresh channel code on demand', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username-input').fill('nightjar');
    await page.getByRole('button', { name: /Create Identity/i }).click();

    const first = await page.locator('#room-id-input').inputValue();
    await page.getByRole('button', { name: /New code/i }).click(); // RefreshCw button (title)
    const second = await page.locator('#room-id-input').inputValue();
    expect(second).toMatch(/^[A-HJ-NP-Z2-9]{16}~\d+$/);
    expect(second).not.toBe(first);
  });
});
