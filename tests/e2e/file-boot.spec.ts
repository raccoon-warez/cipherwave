import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Proves the production build works opened directly via file:// (no server):
// the single self-contained www/index.html boots, mounts, runs in a secure
// context, and WebCrypto (ECDH P-256) is available. Run `npm run build:client`
// first; the test skips if www/index.html hasn't been built.
const built = resolve(process.cwd(), 'www/index.html');

test('built www/index.html boots and runs WebCrypto from file://', async ({ browser }) => {
  test.skip(!existsSync(built), 'www/index.html not built — run `npm run build:client` first');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('file://' + built);
  // App mounts and shows the registration screen.
  await expect(page.locator('#app')).not.toBeEmpty();
  await expect(page.locator('h1.title')).toContainText('CipherWave');
  await expect(page.locator('#username-input')).toBeVisible();

  const probe = await page.evaluate(async () => {
    const ok = { secure: window.isSecureContext, subtle: !!window.crypto?.subtle, crypto: false };
    try {
      const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
      ok.crypto = !!kp.privateKey;
    } catch {
      /* leave false */
    }
    return ok;
  });

  expect(probe.secure).toBe(true);
  expect(probe.subtle).toBe(true);
  expect(probe.crypto).toBe(true);
  expect(errors).toEqual([]);
  await ctx.close();
});
