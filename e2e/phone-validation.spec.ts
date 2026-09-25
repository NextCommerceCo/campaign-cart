import { test, expect, type Page, type Request } from '@playwright/test';
import { TEST_ORDER } from './fixtures/order';
import { blockLiveNetwork, bootSdk } from './fixtures/routes';
import { CHECKOUT_KEY } from './fixtures/storage-keys';
import {
  CARD_CHECKOUT,
  addOnePackage,
  stubCardCheckout,
  submitCard,
} from './fixtures/card-checkout';

/**
 * The checkout's phone field: what the shopper sees as they type, and what the order
 * receives — [issue #58](https://github.com/NextCommerceCo/campaign-cart/issues/58).
 *
 * The SDK formats, checks and converts the number from the one phone rule the
 * address-rules service sends per country (`spec.phone`: calling code, national prefix,
 * mask, loose pattern). Proved here, and nowhere else:
 *
 * - **the field is the page's own input.** The SDK puts a flag before it and classes on
 *   it and its parent, and leaves it, and the label after it, where the page wrote them.
 * - **the shopper sees the mask, the order gets E.164.** `(415) 555-2671` in the field,
 *   `+14155552671` in the checkout store and the order. A number typed with `+` is kept
 *   as typed, and a country whose rule has no calling code is sent as typed.
 * - **the flag is the address country's.** It follows the country select, then the
 *   detected country, and a `+44` typed into it does not move it.
 * - **the rule's verdict reaches the shopper.** A number it refuses is shown on the field
 *   and blocks the submit. A service that sends no rules gets a plain field and a
 *   checkout that still goes through.
 *
 * Why not a unit test: `formatPhone`, `isPlausiblePhone` and `toE164` are pure and
 * `country-service.phone.test.ts` proves them. What it cannot prove is the wiring — the
 * rule travelling from the service response into a live field, the field rewritten under
 * the shopper's keystrokes one at a time, the flag fetched and laid out inside the field
 * (happy-dom neither loads images nor does layout), and the number that leaves in the
 * order POST.
 *
 * The rules served are the service's own, written out in `fixtures/routes.ts`. The
 * Spreedly tokenizer is the shared card harness's stand-in, which is what lets the form
 * submit at all. Anything no stub answers is aborted and fails the test — see
 * {@link blockLiveNetwork}.
 */

const CHECKOUT = CARD_CHECKOUT;
const PHONE = '[data-next-checkout-field="phone"]';
const FLAG = 'img.next-phone-flag';
const COUNTRY = '[data-next-checkout-field="country"]';

let escaped: string[] = [];
let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  // First, so every stub registered after it answers ahead of it.
  escaped = await blockLiveNetwork(page);

  errors = [];
  const collect = (text: string): void => {
    // The dev server's own hot-reload socket is not the SDK. It fails loudly whenever
    // Vite is served on a port other than the one `vite.config.ts` names for the HMR
    // client, which is nothing to do with what this spec is watching for.
    if (/\[vite\]|WebSocket/i.test(text)) return;
    errors.push(text);
  };
  page.on('console', m => m.type() === 'error' && collect(m.text()));
  page.on('pageerror', e => collect(e.message));
});

test.afterEach(() => {
  expect(escaped, 'requests no stub answered').toEqual([]);
  // A caught error is invisible to every other assertion: the cart, the order and the
  // country lookups all swallow their own failures.
  expect(errors, 'console errors and page errors').toEqual([]);
});

/** Answers the orders endpoint and hands back every POST it saw. */
async function recordOrders(page: Page): Promise<Request[]> {
  const posts: Request[] = [];
  await page.route('**/api/v1/orders/**', route => {
    if (route.request().method() === 'POST') posts.push(route.request());
    return route.fulfill({ json: TEST_ORDER });
  });
  return posts;
}

/** The shipping phone the checkout store holds, read from its persisted copy. */
function storedPhone(page: Page): Promise<string | undefined> {
  return page.evaluate(key => {
    const raw = sessionStorage.getItem(key);
    if (!raw) return undefined;
    const persisted = JSON.parse(raw) as {
      state?: { formData?: { phone?: string } };
    };
    return persisted.state?.formData?.phone;
  }, CHECKOUT_KEY);
}

/** Asserts the flag shows `country` and the field is set to it. */
async function expectCountry(page: Page, country: string): Promise<void> {
  await expect(page.locator(FLAG)).toHaveAttribute(
    'src',
    new RegExp(`/v1/flags/${country.toLowerCase()}\\.svg$`)
  );
  await expect(page.locator(PHONE)).toHaveAttribute(
    'data-next-phone-country',
    country
  );
}

/**
 * Whether the flag's whole box lies within the input's, which is where the shopper
 * has to see it: a flag that overhangs the field's edge reads as a stray image.
 */
async function flagInsideField(page: Page): Promise<boolean> {
  const [f, i] = await Promise.all([
    page.locator(FLAG).boundingBox(),
    page.locator(PHONE).boundingBox(),
  ]);
  if (!f || !i) return false;
  return (
    f.x >= i.x &&
    f.x + f.width <= i.x + i.width &&
    f.y >= i.y &&
    f.y + f.height <= i.y + i.height
  );
}

/**
 * Whether the flag is drawn over the input rather than under it. The flag ignores the
 * pointer, which hit-testing would skip, so it is let through for the one lookup.
 */
async function flagOnTop(page: Page): Promise<boolean> {
  return page.locator(FLAG).evaluate(flag => {
    const img = flag as HTMLImageElement;
    const box = img.getBoundingClientRect();
    const before = img.style.pointerEvents;
    img.style.pointerEvents = 'auto';
    const hit = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2
    );
    img.style.pointerEvents = before;
    return hit === img;
  });
}

type PhonePost = {
  shipping_address: { phone_number: string };
  user: { phone_number: string };
};

/** The one order POST, once the SDK has redirected to the success page. */
async function placedOrder(page: Page, posts: Request[]): Promise<PhonePost> {
  await page.waitForURL(url => url.searchParams.has('ref_id'));
  expect(posts).toHaveLength(1);
  return posts[0]?.postDataJSON() as PhonePost;
}

test('the field keeps the page’s input and shows the shopper’s flag inside it', async ({
  page,
}) => {
  await stubCardCheckout(page);
  await bootSdk(page, CHECKOUT);

  const input = page.locator(PHONE);
  const flag = page.locator(FLAG);

  await expect(input).toHaveClass(/\bnext-phone-input\b/);
  await expectCountry(page, 'US');
  await expect(page.locator('#phone-row')).toHaveClass(/\bnext-phone-field\b/);

  await expect(flag).toHaveCount(1);
  await expect(flag).toHaveAttribute('alt', '');
  await expect(flag).toHaveAttribute('aria-hidden', 'true');
  await expect(flag).toHaveAttribute('width', '20');
  await expect(flag).toHaveAttribute('height', '15');
  await expect(flag).not.toHaveAttribute('hidden');

  // Not wrapped: the flag directly before the input, the page's label still directly
  // after it (an `input + label` floating label keeps working), and the parent the
  // page wrote.
  expect(
    await input.evaluate(el => ({
      before: el.previousElementSibling?.matches('img.next-phone-flag'),
      after: el.nextElementSibling?.matches('label[for="phone"]'),
      parent: el.parentElement?.id,
    }))
  ).toEqual({ before: true, after: true, parent: 'phone-row' });

  // Seen, not only written: the image loaded, and it sits inside the field's box.
  await expect
    .poll(() =>
      flag.evaluate(img => (img as HTMLImageElement).naturalWidth > 0)
    )
    .toBe(true);
  await expect.poll(() => flagInsideField(page)).toBe(true);
  await expect.poll(() => flagOnTop(page)).toBe(true);
});

/**
 * The SDK writes its error message into the field's parent, which is also what the flag
 * is placed against. A flag centred on the parent moves down as the message grows it.
 */
test('the flag stays inside the field when the field shows an error', async ({
  page,
}) => {
  await stubCardCheckout(page);
  await recordOrders(page);

  await bootSdk(page, CHECKOUT);
  await addOnePackage(page);
  await expect.poll(() => flagInsideField(page)).toBe(true);

  await submitCard(page, '415555267');
  await expect(page.locator(`${PHONE}.next-error-field`)).toHaveCount(1);
  await expect(page.locator('#phone-row .next-error-label')).toBeVisible();

  await expect.poll(() => flagInsideField(page)).toBe(true);
});

test('a US number fills the US mask as it is typed, and is stored in E.164', async ({
  page,
}) => {
  await stubCardCheckout(page);
  await bootSdk(page, CHECKOUT);
  await expectCountry(page, 'US');

  const input = page.locator(PHONE);
  // The mask is cut after the last digit typed.
  await input.pressSequentially('41555');
  await expect(input).toHaveValue('(415) 55');

  await input.pressSequentially('52671');
  await expect(input).toHaveValue('(415) 555-2671');
  await expect.poll(() => storedPhone(page)).toBe('+14155552671');
});

/**
 * The US mask holds ten digits and no `1`, so a number dialled with the national prefix
 * shows the prefix before the mask, and E.164 drops it rather than doubling the code.
 */
test('a US number typed with its leading 1 shows the 1 before the mask', async ({
  page,
}) => {
  await stubCardCheckout(page);
  await bootSdk(page, CHECKOUT);
  await expectCountry(page, 'US');

  const input = page.locator(PHONE);
  await input.pressSequentially('14155552671');

  await expect(input).toHaveValue('1 (415) 555-2671');
  await expect.poll(() => storedPhone(page)).toBe('+14155552671');
});

test('a Thai shopper’s number is written the Thai way and stored in E.164', async ({
  page,
}) => {
  await stubCardCheckout(page, { country: 'TH' });
  await bootSdk(page, CHECKOUT);
  await expectCountry(page, 'TH');

  const input = page.locator(PHONE);
  await input.pressSequentially('0812345678');

  await expect(input).toHaveValue('081 234 5678');
  // The national prefix is dialled inside Thailand and dropped from E.164.
  await expect.poll(() => storedPhone(page)).toBe('+66812345678');
});

test('a Bangkok landline is grouped differently from a mobile', async ({
  page,
}) => {
  await stubCardCheckout(page, { country: 'TH' });
  await bootSdk(page, CHECKOUT);
  await expectCountry(page, 'TH');

  const input = page.locator(PHONE);
  await input.pressSequentially('020176091');

  await expect(input).toHaveValue('02 017 6091');
  await expect.poll(() => storedPhone(page)).toBe('+6620176091');
});

/** `00` is how most countries dial abroad, so it is the shopper's `+`. */
test('a number dialled with 00 is read as +', async ({ page }) => {
  await stubCardCheckout(page, { country: 'TH' });
  await bootSdk(page, CHECKOUT);
  await expectCountry(page, 'TH');

  const input = page.locator(PHONE);
  await input.pressSequentially('0066 81 234 5678');

  await expect(input).toHaveValue('+66812345678');
  await expect.poll(() => storedPhone(page)).toBe('+66812345678');
});

/**
 * Thai digits that start with Thailand's calling code and not its national prefix may be
 * a number pasted without its `+`. Adding `+66` again would send `+6666812345678`, a
 * number that is not the shopper's, so the SDK leaves it for the order API to convert.
 */
test('Thai digits that already start with 66 are sent as typed', async ({
  page,
}) => {
  await stubCardCheckout(page, { country: 'TH' });
  const posts = await recordOrders(page);

  await bootSdk(page, CHECKOUT);
  await addOnePackage(page);
  await expectCountry(page, 'TH');

  // Ten digits fill the Thai mask, which shows the rule is in force; the eleventh does
  // not fit it, so the digits are shown as typed.
  const input = page.locator(PHONE);
  await input.pressSequentially('6681234567');
  await expect(input).toHaveValue('668 123 4567');
  await input.pressSequentially('8');
  await expect(input).toHaveValue('66812345678');
  await expect.poll(() => storedPhone(page)).toBe('66812345678');

  await submitCard(page, '66812345678', { country: 'TH', province: '10' });
  const body = await placedOrder(page, posts);
  expect(body.shipping_address.phone_number).toBe('66812345678');
});

/**
 * A shopper shipping to the US with a UK phone. The flag is the address country's, not
 * the calling code's, and a number with another country's code only has to be the
 * length of an E.164 number, so it is kept as typed and goes through.
 */
test('a +44 number in a US field keeps the US flag and goes out as typed', async ({
  page,
}) => {
  await stubCardCheckout(page);
  const posts = await recordOrders(page);

  await bootSdk(page, CHECKOUT);
  await addOnePackage(page);
  await expectCountry(page, 'US');

  const input = page.locator(PHONE);
  await input.pressSequentially('+44 7400 123456');

  await expect(input).toHaveValue('+447400123456');
  await expect.poll(() => storedPhone(page)).toBe('+447400123456');
  await expectCountry(page, 'US');

  await submitCard(page, '+44 7400 123456');
  const body = await placedOrder(page, posts);
  expect(body.shipping_address.phone_number).toBe('+447400123456');
});

test('choosing another shipping country moves the flag and the rule to it', async ({
  page,
}) => {
  await stubCardCheckout(page);
  await bootSdk(page, CHECKOUT);
  await expectCountry(page, 'US');

  await page.selectOption(COUNTRY, 'TH');
  await expectCountry(page, 'TH');

  // The US mask would show these digits as `(081) 234-5678`.
  const input = page.locator(PHONE);
  await input.pressSequentially('0812345678');
  await expect(input).toHaveValue('081 234 5678');
  await expect.poll(() => storedPhone(page)).toBe('+66812345678');

  await page.selectOption(COUNTRY, 'GB');
  await expectCountry(page, 'GB');
});

/**
 * A deployment of the service that predates phone rules, or a country it has none for.
 * The field must stay an ordinary input and must not stand between the shopper and the
 * order.
 */
test('with no phone rule the field is left plain and the order still goes out', async ({
  page,
}) => {
  await stubCardCheckout(page, { phoneRules: false });
  const posts = await recordOrders(page);

  await bootSdk(page, CHECKOUT);
  await addOnePackage(page);
  // The service has answered and the form has applied it, so "not formatted" below is
  // read after the field could have been given rules, not before.
  await expect(page.locator(`${COUNTRY} option[value="TH"]`)).toHaveCount(1);

  const input = page.locator(PHONE);
  await input.pressSequentially('4155552671');
  await expect(input).toHaveValue('4155552671');

  await submitCard(page, '4155552671');
  const body = await placedOrder(page, posts);

  await expect(page.locator(`${PHONE}.next-error-field`)).toHaveCount(0);
  expect(body.shipping_address.phone_number.replace(/\D/g, '')).toMatch(
    /4155552671$/
  );
});

/**
 * Argentina's rule has no calling code: an Argentine mobile keeps a `15` that only the
 * order API's conversion removes, so the SDK must not assemble a `+54` number itself.
 */
test('an Argentine number is sent as typed, not converted to E.164', async ({
  page,
}) => {
  await stubCardCheckout(page, { country: 'AR' });
  const posts = await recordOrders(page);

  await bootSdk(page, CHECKOUT);
  await addOnePackage(page);
  await expectCountry(page, 'AR');

  const input = page.locator(PHONE);
  await input.pressSequentially('0111523456789');
  await expect(input).toHaveValue('011 15-2345-6789');

  await submitCard(page, '011 15-2345-6789', {
    country: 'AR',
    province: 'B',
  });
  const body = await placedOrder(page, posts);

  const sent = body.shipping_address.phone_number;
  expect(sent).not.toMatch(/^\+/);
  expect(sent.replace(/\D/g, '')).toBe('0111523456789');
});

/** The negative control for every "accepted" test above. */
test('a number too short for its country is shown as wrong and never sent', async ({
  page,
}) => {
  await stubCardCheckout(page);
  const posts = await recordOrders(page);

  await bootSdk(page, CHECKOUT);
  await addOnePackage(page);
  // Nine digits where the US pattern wants ten or eleven.
  await submitCard(page, '415555267');

  await expect(page.locator(`${PHONE}.next-error-field`)).toHaveCount(1);
  await expect(page.locator('.next-error-label')).toContainText(
    'valid phone number'
  );
  await expect(page).toHaveURL(new RegExp('card-purchase'));
  expect(posts).toHaveLength(0);
});

test('a real phone is accepted and sent in E.164', async ({ page }) => {
  await stubCardCheckout(page);
  const posts = await recordOrders(page);

  await bootSdk(page, CHECKOUT);
  await addOnePackage(page);
  await submitCard(page, '4155552671');

  const body = await placedOrder(page, posts);
  // Typed nationally, sent internationally. Both places the order carries it.
  expect(body.shipping_address.phone_number).toBe('+14155552671');
  expect(body.user.phone_number).toBe('+14155552671');
});
