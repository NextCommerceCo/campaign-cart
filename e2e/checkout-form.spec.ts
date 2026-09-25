import { test, expect, type Page } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import {
  stubCampaign,
  stubCart,
  bootSdk,
  routeAddressService,
} from './fixtures/routes';

/**
 * E2E for the checkout-form enhancer (`form[data-next-checkout]`).
 *
 * Real payment/tokenization can't run headless, so this covers what is
 * observable without a gateway: the init event, and field-validation classes
 * on blur and on submit. `checkout:form-initialized` fires during the DOM scan
 * before window.next exists, so the fixture buffers it from the shared EventBus.
 *
 * The form's CountryService fetches country/state data from an external CDN;
 * we stub it so the form initializes deterministically offline.
 */

const FIXTURE = '/e2e/fixtures/checkout-form.html';

/**
 * The service's wording and field names in Thai, a language the SDK's fallback is not
 * in. Any other `?lang=` is answered in English, as the service answers one it lacks.
 */
const THAI = {
  lang: 'th',
  messages: { 'error.emoji': 'ห้ามใส่อีโมจิใน{label}' },
  labels: { first_name: 'ชื่อ', email: 'อีเมล' },
};
const ENGLISH = {
  lang: 'en',
  messages: { 'error.emoji': '{label} can’t contain emojis' },
  labels: { first_name: 'First name', email: 'Email' },
};

/** Sets `window.nextConfig` before the SDK reads it. */
async function configure(page: Page, config: object): Promise<void> {
  await page.addInitScript(c => {
    (window as any).nextConfig = c;
  }, config);
}

/** Stub the country/states CDN the checkout form's CountryService calls. */
async function stubCountryService(page: Page): Promise<void> {
  const spec = {
    country: 'US',
    layout: [['country'], ['line1'], ['city', 'state', 'postcode']],
    fields: {
      state: { label: 'State', required: true },
      postcode: { label: 'ZIP Code', required: true },
    },
  };
  const answerIn = (lang: string) => (lang.startsWith('th') ? THAI : ENGLISH);
  await routeAddressService(page, {
    countries: [
      { code: 'US', name: 'United States' },
      { code: 'CA', name: 'Canada' },
    ],
    rules: (_, { lang }) => {
      const answer = answerIn(lang);
      return { lang: answer.lang, spec, labels: answer.labels };
    },
    locale: lang => answerIn(lang).messages,
  });
}

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await stubCountryService(page);
});

test('emits checkout:form-initialized {form} on boot', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  const events = await page.evaluate(
    () => (window as any).__capturedEvents['checkout:form-initialized']
  );
  expect(events.length).toBeGreaterThan(0);
  expect(events[0].hasForm).toBe(true);
});

test('an invalid email gets has-error / next-error-field on blur', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const email = page.locator('[data-next-checkout-field="email"]');
  await email.fill('notanemail');
  await email.blur();

  await expect(email).toHaveClass(/has-error/);
  await expect(email).toHaveClass(/next-error-field/);
});

test('a valid email gets no-error on blur', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  const email = page.locator('[data-next-checkout-field="email"]');
  await email.fill('shopper@example.com');
  await email.blur();

  await expect(email).toHaveClass(/no-error/);
  await expect(email).not.toHaveClass(/has-error/);
});

test('an emoji in any field is refused on blur, in the service’s wording', async ({
  page,
}) => {
  await configure(page, { locale: 'th-TH' });
  await bootSdk(page, FIXTURE);

  for (const [field, value, message] of [
    ['fname', 'Ada 😀', 'ห้ามใส่อีโมจิในชื่อ'],
    // The emoji's message, not the one an invalid address gets.
    ['email', 'ada🎉@example.com', 'ห้ามใส่อีโมจิในอีเมล'],
  ]) {
    const input = page.locator(`[data-next-checkout-field="${field}"]`);
    await input.fill(value);
    await input.blur();

    await expect(input).toHaveClass(/has-error/);
    await expect(
      page.locator('.form-group', { has: input }).locator('.next-error-label')
    ).toHaveText(message);
  }
});

test('a page’s own translation replaces the service’s wording', async ({
  page,
}) => {
  await configure(page, {
    locale: 'th-TH',
    translations: { th: { 'error.emoji': 'อย่าใส่อีโมจิใน{label}' } },
  });
  await bootSdk(page, FIXTURE);

  const fname = page.locator('[data-next-checkout-field="fname"]');
  await fname.fill('Ada 😀');
  await fname.blur();

  await expect(
    page.locator('.form-group', { has: fname }).locator('.next-error-label')
  ).toHaveText('อย่าใส่อีโมจิในชื่อ');
});

/** The negative control: an accented letter is not an emoji. */
test('a name with an accent is accepted on blur', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  const lname = page.locator('[data-next-checkout-field="lname"]');
  await lname.fill('du Pré');
  await lname.blur();

  await expect(lname).toHaveClass(/no-error/);
  await expect(page.locator('.next-error-label')).toHaveCount(0);
});

test('submitting with empty required fields flags them', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await page.click('button[type="submit"]');

  // Required fields present in the DOM get error classes; a valid field would
  // not. fname/lname/email are all empty required fields here.
  for (const field of ['email', 'fname', 'lname']) {
    const el = page.locator(`[data-next-checkout-field="${field}"]`);
    await expect(el).toHaveClass(/has-error/);
    await expect(el).toHaveClass(/next-error-field/);
  }
});
