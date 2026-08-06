import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * The built bundle loads, in a real engine, through the real loader.
 *
 * Every other spec here loads `/src/index.ts` — the source, served by Vite as one
 * module per file. Customers load something else entirely: `public/loader.js`
 * fetches `dist/index.js`, which imports the `dist/chunks/*` that `manualChunks`
 * carved out of the same source. Those chunk boundaries exist only in the built
 * artifact, and they are what broke in v0.4.31: a chunk cycle made `state`
 * initialise before the chunk holding `createLogger`, so evaluating the graph threw
 * `ReferenceError: Cannot access 'l' before initialization`
 * ([#77](https://github.com/NextCommerceCo/campaign-cart/issues/77)).
 *
 * Nothing caught it, and the reason is the loader: its `catch` logs
 * `Failed to load SDK:` and loads `dist/index.umd.js` instead, so `window.next`
 * still appears, the page still works, and every assertion in every other spec
 * still passes. The only visible symptoms are a console error and a second bundle
 * download — which is why this spec asserts on exactly those two things rather than
 * on any shopper-visible behaviour.
 *
 * `src/tests/contract/es-bundle-init.test.ts` covers the same property in CI, which
 * does not run Playwright. It evaluates the graph under Node's ES-module semantics;
 * this spec is the half that proves five real engines agree, and that the loader
 * stayed on the module path.
 *
 * **It tests the committed `dist/`, not your working tree.** Run `npm run build`
 * first, or you are re-testing the last artifact someone committed.
 *
 * The fixture loads `/public/loader.js`, not `/loader.js`, and Vite logs
 * `Instead of /public/loader.js, use /loader.js.` for it. Keep the longer path: the
 * loader looks for exactly that substring to decide it is running locally and to
 * point `PROD_HOST` at `/dist`. Served from `/loader.js` that branch misses and the
 * path falls out of a `substring(0, -1)`, which happens to work — a different code
 * path from the one this spec means to exercise.
 */

const FIXTURE = '/e2e/fixtures/es-bundle.html';
const DIST_ENTRY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../dist/index.js'
);

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test.describe('built ES bundle', () => {
  test.skip(
    () => !existsSync(DIST_ENTRY),
    'no dist/index.js — run `npm run build` first'
  );

  test('boots from the ES chunks, never the UMD fallback', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', e => errors.push(String(e)));

    // The fallback is a *request*, so watch the network rather than the log line:
    // `onload` fires too late to be a reliable signal, and the UMD is the one file
    // a healthy page must never fetch.
    const umdRequests: string[] = [];
    page.on('request', r => {
      if (r.url().includes('index.umd.js')) umdRequests.push(r.url());
    });

    await bootSdk(page, FIXTURE);

    // Boot far enough that the enhancers have bound and the cart has synced —
    // module init is only the first of the things that can throw.
    await page.click('[data-next-action="add-to-cart"]');
    await expect(page.locator('#qty')).toHaveText('1');

    expect(
      umdRequests,
      'the loader fell back to the UMD bundle, so evaluating dist/index.js threw'
    ).toEqual([]);
    expect(
      errors,
      'the built bundle logged errors a source-served spec cannot see'
    ).toEqual([]);
  });

  test('the console watch above can see a real error', async ({ page }) => {
    // Without this, `errors` staying empty would be equally consistent with the
    // listener never having been wired — the failure mode §4b of the e2e skill
    // describes. Prove the channel works on the same page under the same setup.
    const errors: string[] = [];
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', e => errors.push(String(e)));

    await bootSdk(page, FIXTURE);
    await page.evaluate(() => console.error('sentinel'));

    await expect.poll(() => errors.join('\n')).toContain('sentinel');
  });
});
