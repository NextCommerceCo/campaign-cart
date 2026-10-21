import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright-core';

process.env.DEV_CAMPAIGNS ??= join(import.meta.dirname, 'e2e');
const { startDev } = await import('./server');

function chrome(): string {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), '.cache/ms-playwright');
  const found = existsSync(cache)
    ? readdirSync(cache)
        .filter((d) => /^chromium-\d+$/.test(d))
        .sort()
        .reverse()
        .map((d) => join(cache, d, 'chrome-linux64/chrome'))
        .find(existsSync)
    : undefined;
  if (!found)
    throw new Error('No Chromium found. Run `bunx playwright-core install chromium` or set CHROME=/path/to/chrome');
  return found;
}

const steps: string[] = [];
const fail = (message: string): never => {
  throw new Error(message);
};
const check = (ok: unknown, message: string) => {
  if (!ok) fail(message);
  steps.push(`ok  ${message}`);
};

async function funnel(page: Page, origin: string) {
  const ready = () => page.waitForSelector('html[data-next-ready]', { state: 'attached', timeout: 15000 });
  const field = (name: string) => `[data-next-checkout-field="${name}"]`;

  await page.goto(`${origin}/olympus/checkout/`);
  await ready();
  await page.waitForFunction(
    (s) => (document.querySelector(s) as HTMLSelectElement)?.options.length > 1,
    field('province'),
  );
  const shopper = {
    email: 'e2e@example.com',
    fname: 'Jane',
    lname: 'Doe',
    address1: '1 Main St',
    city: 'Austin',
    postal: '73301',
  };
  for (const [name, value] of Object.entries(shopper)) await page.fill(field(name), value);
  await page.selectOption(field('province'), 'TX');
  await page.fill('#spreedly-number input', '4242424242424242');
  await page.fill('#spreedly-cvv input', '123');
  await page.selectOption(field('exp-month'), '12');
  await page.selectOption(field('exp-year'), String(new Date().getFullYear() + 2));
  await Promise.all([page.waitForURL(/upsell-bundle-stepper\/\?ref_id=DEV/), page.click('button[type="submit"]')]);
  check(true, 'checkout places a card order and opens the first upsell with ref_id');

  await ready();
  check((await page.getAttribute('[data-next-upsell]', 'class'))?.includes('next-available'), 'the offer is available');
  await page.click('[data-next-quantity-increase]', { force: true });
  await page.waitForFunction(() => document.querySelector('[data-next-quantity-display]')?.textContent === '2');
  await Promise.all([
    page.waitForURL(/tier-pills\/\?ref_id=DEV/),
    page.click('[data-next-upsell-action="add"]', { force: true }),
  ]);
  check(true, 'the stepped offer is added and the next upsell opens');

  await ready();
  await Promise.all([
    page.waitForURL(/tier-cards\/\?ref_id=DEV/),
    page.click('[data-next-upsell-action="skip"]', { force: true }),
  ]);
  check(true, 'skipping moves on with ref_id');

  await ready();
  await page.click('[data-next-bundle-id="upsell-bundle-3x"]', { force: true });
  await Promise.all([
    page.waitForURL(/receipt\/\?ref_id=DEV/),
    page.click('[data-next-upsell-action="add"]', { force: true }),
  ]);
  check(true, 'the 3x tier is added and the receipt opens');

  await ready();
  const receipt = await page.evaluate(() => ({
    total: document.querySelector('[data-next-display="order.total"]')?.textContent?.trim(),
    name: document.querySelector('[data-next-display="order.customer.name"]')?.textContent?.trim(),
    items: document.querySelector('[data-next-order-items]')?.querySelectorAll('.cart-item__title').length,
  }));
  check(receipt.total === '$249.00', `receipt total is $249.00 (got ${receipt.total})`);
  check(receipt.name === 'Jane Doe', 'receipt shows the customer');
  check(receipt.items === 3, `receipt lists the order and both upsells (got ${receipt.items})`);
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('[data-next-skeleton]')!).opacity === '0',
    null,
    { timeout: 2000 },
  );
  check(true, 'the receipt skeleton is lifted');
}

const { origin, close } = await startDev({ quiet: true });
const browser = await chromium.launch({ executablePath: chrome(), args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const problems: string[] = [];
await page.route(/29next\.store/, (route) => route.abort());
await page.route(/29next\.com|nextcommerce\.com|spreedly\.com/, (route) => {
  problems.push(`production request blocked: ${route.request().url()}`);
  return route.abort();
});
page.on('console', (m) => m.type() === 'error' && problems.push(`console error: ${m.text()}`));
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));

let code = 0;
try {
  await funnel(page, origin);
  if (problems.length) fail(problems.join('\n'));
} catch (err) {
  code = 1;
  steps.push(`FAIL ${err instanceof Error ? err.message.split('\n')[0] : err}`);
  await page.screenshot({ path: 'e2e-failure.png' }).catch(() => {});
} finally {
  console.log(steps.join('\n'));
  await browser.close();
  await close();
}
process.exit(code);
