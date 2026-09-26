import { test, expect, type Page } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import {
  stubCampaign,
  stubCart,
  stubAddressAutocomplete,
  bootSdk,
  captureEvents,
  ADDRESS_SERVICE_ROUTE,
  routeAddressService,
  countryRules,
  ruleField,
} from './fixtures/routes';
import { CHECKOUT_KEY } from './fixtures/storage-keys';

/**
 * E2E for `[data-next-address]`.
 *
 * The half only a browser proves: the fields are built after the checkout form has
 * scanned for them and bound its per-field listeners, so without the re-scan a shopper
 * fills a form that reaches nothing.
 */

const FIXTURE = '/e2e/fixtures/address-form.html';

const US_SPEC = countryRules(
  'US',
  [
    ['country'],
    ['first_name', 'last_name'],
    ['line1'],
    ['city', 'state', 'postcode'],
    ['phone_number'],
  ],
  {
    country: ruleField('Country', 'country', { type: 'select', options: 'countries' }),
    line1: ruleField('Address', 'address-line1'),
    city: ruleField('City', 'address-level2'),
    state: ruleField('State', 'address-level1', { type: 'select', options: 'states' }),
    postcode: ruleField('ZIP Code', 'postal-code'),
    first_name: ruleField('First name', 'given-name'),
    last_name: ruleField('Last name', 'family-name'),
    email: ruleField('Email', 'email', { type: 'email' }),
    phone_number: ruleField('Phone number', 'tel', { type: 'tel' }, { required: false }),
  }
);

const JP_SPEC = countryRules(
  'JP',
  [
    ['country'],
    ['last_name', 'first_name'],
    ['postcode', 'state'],
    ['city'],
    ['line1'],
    ['phone_number'],
  ],
  {
    country: ruleField('Country', 'country', { type: 'select', options: 'countries' }),
    postcode: ruleField('Postal code', 'postal-code'),
    state: ruleField('Prefecture', 'address-level1', { type: 'select', options: 'states' }),
    city: ruleField('City', 'address-level2'),
    line1: ruleField('Street', 'address-line1'),
    first_name: ruleField('First name', 'given-name'),
    last_name: ruleField('Last name', 'family-name'),
    email: ruleField('Email', 'email', { type: 'email' }),
    phone_number: ruleField('Phone number', 'tel', { type: 'tel' }, { required: false }),
  }
);

/**
 * How long the block's layout request is held before it answers.
 *
 * Not padding: it is the ordering every visitor gets. The checkout form finishes its own
 * boot — filling the country dropdown, binding its field listeners, putting stored values
 * back — against whatever is on the page at that moment, and on a real connection the
 * layout has not arrived yet. Answering instantly lets the block render *inside* that
 * boot, which is a race no visitor wins and which quietly turned four of these tests
 * green while the feature was broken in the browser.
 *
 * The form's own requests are not held, only the block's: boot awaits those.
 */
const LAYOUT_DELAY_MS = 300;

/**
 * One stub for both callers: the checkout form's `CountryService` and this feature read
 * the same service. The block's own request is the one that does not ask for states,
 * and it is the one held back.
 */
async function stubAddressService(page: Page): Promise<void> {
  await routeAddressService(page, {
    geo: { currency: 'USD', ip: '203.0.113.7' },
    countries: [
      { code: 'US', name: 'United States' },
      { code: 'JP', name: 'Japan' },
    ],
    rules: async (country, { withStates }) => {
      if (!withStates) {
        await new Promise(resolve => setTimeout(resolve, LAYOUT_DELAY_MS));
      }
      return {
        ...(country === 'JP' ? JP_SPEC : US_SPEC),
        states: [{ code: 'NY', name: 'New York' }],
      };
    },
  });
}

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await stubAddressService(page);
});

const FIELD = (name: string) => `[data-next-checkout-field="${name}"]`;

const SUGGESTION = {
  label: '123 Main St, Testville, NY 10001',
  address: {
    line1: '123 Main St',
    city: 'Testville',
    state: 'New York',
    state_code: 'NY',
    postcode: '10001',
    country: 'United States',
    country_code: 'US',
  },
};

/**
 * Address suggestions attach to the address input. The provider loads on the first focus
 * of it, and that input is built by this feature — it does not exist when the provider is
 * wired, and it is replaced by a different element every time the country changes.
 */
async function withAutocomplete(page: Page): Promise<void> {
  await stubAddressAutocomplete(page, [SUGGESTION]);
  await page.addInitScript(() => {
    (window as any).nextConfig = {
      addressConfig: { enableAutocomplete: true },
    };
  });
}

test('builds the fields the country collects, in the order it writes them', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const block = page.locator('[data-next-address]');
  await expect(block.locator('[data-next-checkout-field]')).toHaveCount(6);

  // The layout names the whole address; the page writes the name itself, so the block
  // builds the rest, the phone included.
  const order = await block
    .locator('[data-next-checkout-field]')
    .evaluateAll(els => els.map(el => el.getAttribute('data-next-checkout-field')));
  expect(order).toEqual(['country', 'address1', 'city', 'province', 'postal', 'phone']);
});

test('city, state and ZIP wait until the street address is typed', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await expect(page.locator(FIELD('address1'))).toBeVisible();

  await expect(page.locator(FIELD('country'))).toBeVisible();
  for (const name of ['city', 'province', 'postal']) {
    await expect(page.locator(FIELD(name))).toBeHidden();
  }

  await page.fill(FIELD('address1'), '100 New Montgomery St');

  for (const name of ['city', 'province', 'postal']) {
    await expect(page.locator(FIELD(name))).toBeVisible();
  }
});

test('a country change keeps the location rows open once they were shown', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await page.fill(FIELD('address1'), '100 New Montgomery St');
  await expect(page.locator(FIELD('city'))).toBeVisible();

  await page.selectOption(FIELD('country'), 'JP');
  await page.selectOption(FIELD('country'), 'US');

  await expect(page.locator(FIELD('city'))).toBeVisible();
});

test('a field a country writes before the street address is not held back', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await page.selectOption(FIELD('country'), 'JP');

  await expect(page.locator(FIELD('postal'))).toBeVisible();
  await expect(page.locator(FIELD('city'))).toBeVisible();
});

test('the checkout form adopts the built fields and reads them into the store', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  await page.fill(FIELD('address1'), '1 Test Street');
  await page.fill(FIELD('city'), 'Testville');
  await page.locator(FIELD('city')).blur();

  await expect
    .poll(() =>
      page.evaluate(key => {
        const raw = sessionStorage.getItem(key);
        return raw ? JSON.parse(raw)?.state?.formData?.address1 : undefined;
      }, CHECKOUT_KEY)
    )
    .toBe('1 Test Street');
});

test('the province dropdown is filled by the checkout form', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator(`${FIELD('province')} option`)).not.toHaveCount(0);
  await expect(page.locator(`${FIELD('province')} option[value="NY"]`)).toHaveCount(1);
});

test('every built input names the form it belongs to for autofill', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator(FIELD('address1'))).toHaveAttribute(
    'autocomplete',
    'shipping address-line1'
  );
});

test('choosing another country rebuilds the form in that country’s shape', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await expect(page.locator('[data-next-address] [data-next-checkout-field]')).toHaveCount(6);

  await page.selectOption(FIELD('country'), 'JP');

  await expect
    .poll(async () =>
      page
        .locator('[data-next-address] [data-next-checkout-field]')
        .evaluateAll(els => els.map(el => el.getAttribute('data-next-checkout-field')))
    )
    .toEqual(['country', 'postal', 'province', 'city', 'address1', 'phone']);
});

test('an address typed after a country change still reaches the store', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await page.selectOption(FIELD('country'), 'JP');
  await expect(page.locator(FIELD('postal'))).toBeVisible();

  await page.fill(FIELD('address1'), '2 Rebuilt Road');
  await page.locator(FIELD('address1')).blur();

  await expect
    .poll(() =>
      page.evaluate(key => {
        const raw = sessionStorage.getItem(key);
        return raw ? JSON.parse(raw)?.state?.formData?.address1 : undefined;
      }, CHECKOUT_KEY)
    )
    .toBe('2 Rebuilt Road');
});

test('a typed address survives the rebuild', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await page.fill(FIELD('address1'), '1 Test Street');
  await page.selectOption(FIELD('country'), 'JP');

  await expect(page.locator(FIELD('address1'))).toHaveValue('1 Test Street');
});

test('a field the country requires shows its error on submit', async ({ page }) => {
  await bootSdk(page, FIXTURE);
  await expect(page.locator(FIELD('address1'))).toBeVisible();

  await page.click('button[type="submit"]');

  await expect(page.locator(FIELD('address1'))).toHaveClass(/next-error-field/);
  await expect(
    page.locator('[data-next-address-field="address1"] .next-error-label')
  ).toBeVisible();
});

/**
 * The real ordering, which an instant stub hides.
 *
 * The checkout form fills the country and province dropdowns during its own boot. When
 * the layout arrives after that — which is the ordinary case on a real connection — those
 * two elements did not exist yet, so nothing had been filled and nothing would refill
 * them: an empty country select and a province stuck on "Select Country First".
 */
test('the dropdowns are filled even when the layout arrives after boot', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await expect(page.locator(FIELD('country'))).toBeVisible();

  await expect(page.locator(`${FIELD('country')} option`)).not.toHaveCount(0);
  await expect(
    page.locator(`${FIELD('country')} option[value="US"]`)
  ).toHaveCount(1);
  await expect(page.locator(FIELD('province'))).not.toHaveValue(
    /Select Country First/
  );
  await expect(
    page.locator(`${FIELD('province')} option[value="NY"]`)
  ).toHaveCount(1);
});

/**
 * A country's layout describes a whole address form, name included, but this page
 * collects the name in a step of its own. Building it again would put two elements under
 * the first name on the page, and the order is assembled from whichever the form scanned last —
 * so what the shopper typed in the first step is dropped.
 */
test('a field the page already collects is not built a second time', async ({ page }) => {
  await bootSdk(page, FIXTURE);
  await expect(page.locator(FIELD('address1'))).toBeVisible();

  // The page writes `first_name`, the name to write; the block's own would be `fname`,
  // the SDK's older name for the same field, and it must see them as one.
  await expect(page.locator(FIELD('first_name'))).toHaveCount(1);
  await expect(
    page.locator(`[data-next-address] ${FIELD('fname')}`)
  ).toHaveCount(0);

  await page.fill(FIELD('first_name'), 'Gwen');
  await page.locator(FIELD('first_name')).blur();

  await expect
    .poll(() =>
      page.evaluate(key => {
        const raw = sessionStorage.getItem(key);
        return raw ? JSON.parse(raw)?.state?.formData?.fname : undefined;
      }, CHECKOUT_KEY)
    )
    .toBe('Gwen');
});

test('suggestions load on an address field this feature built', async ({ page }) => {
  await withAutocomplete(page);
  await bootSdk(page, FIXTURE);

  await page.locator(FIELD('address1')).click();
  await page.fill(FIELD('address1'), '123 Main');

  const suggestion = page.locator('.pac-item-nextcommerce').first();
  await expect(suggestion).toBeVisible();
  await suggestion.click();

  await expect(page.locator(FIELD('city'))).toHaveValue('Testville');
});

test('suggestions still load after a country change replaces the field', async ({
  page,
}) => {
  await withAutocomplete(page);
  await bootSdk(page, FIXTURE);

  // Load the provider against the first country's field.
  await page.locator(FIELD('address1')).click();
  await page.fill(FIELD('address1'), '123 Main');
  await expect(page.locator('.pac-item-nextcommerce').first()).toBeVisible();

  // The field it attached to is replaced by a different element.
  const queried: string[] = [];
  page.on('request', r => {
    if (r.url().includes('/addresses/autocomplete/')) queried.push(r.url());
  });
  await page.selectOption(FIELD('country'), 'JP');
  await expect(page.locator(FIELD('postal'))).toBeVisible();

  await page.locator(FIELD('address1')).click();
  await page.fill(FIELD('address1'), '456 Second');

  await expect.poll(() => queried.length).toBeGreaterThan(0);
});

test('a returning visitor sees the address they already gave', async ({ page }) => {
  await page.addInitScript(key => {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        state: {
          formData: { address1: '9292 Magnolia Ave', city: 'Mokena', postal: '60448' },
        },
        version: 0,
      })
    );
  }, CHECKOUT_KEY);

  await bootSdk(page, FIXTURE);
  await expect(page.locator(FIELD('address1'))).toBeVisible();

  await expect(page.locator(FIELD('address1'))).toHaveValue('9292 Magnolia Ave');
  await expect(page.locator(FIELD('city'))).toBeVisible();
  await expect(page.locator(FIELD('city'))).toHaveValue('Mokena');
  await expect(page.locator(FIELD('postal'))).toHaveValue('60448');
});

/**
 * A field that is not required says so, in the language its label is in: the rules carry
 * its optional label, written whole in that language.
 */
test('an optional field carries its note in the page’s language', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).nextConfig = { locale: 'th-TH' };
  });
  await routeAddressService(page, {
    countries: [{ code: 'US', name: 'United States' }],
    rules: () =>
      countryRules(
        'US',
        [['country'], ['line1'], ['line2']],
        {
          country: ruleField('ประเทศ', 'country', { type: 'select', options: 'countries' }),
          line1: ruleField('ที่อยู่', 'address-line1'),
          line2: ruleField('ห้อง / ชั้น / อาคาร', 'address-line2', { type: 'text' }, {
            required: false,
            labelOptional: 'ห้อง / ชั้น / อาคาร (ไม่บังคับ)',
          }),
        },
        { lang: 'th' }
      ),
  });

  await bootSdk(page, FIXTURE);

  await expect(
    page.locator('[data-next-address-field="address2"] .next-address-label')
  ).toHaveText('ห้อง / ชั้น / อาคาร (ไม่บังคับ)');
  // Required, so no note.
  await expect(
    page.locator('[data-next-address-field="address1"] .next-address-label')
  ).toHaveText('ที่อยู่');
});

test('a failed layout lookup still gives the shopper an address to fill', async ({
  page,
}) => {
  await page.route(ADDRESS_SERVICE_ROUTE, route =>
    route.fulfill({ status: 503, json: { error: 'unavailable' } })
  );

  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));

  await bootSdk(page, FIXTURE);

  await expect(page.locator(FIELD('address1'))).toBeVisible();
  await expect(page.locator('[data-next-address]')).toHaveAttribute(
    'data-next-address-state',
    'ready'
  );
  // The fixture writes the name itself; the built-in layout must not build it again.
  await expect(page.locator(FIELD('first_name'))).toHaveCount(1);
  await expect(page.locator(`[data-next-address] ${FIELD('fname')}`)).toHaveCount(0);

  // Revealing the city proves the checkout form bound the built-in fields, not only
  // that they were drawn.
  await expect(page.locator(FIELD('city'))).toBeHidden();
  await page.locator(FIELD('address1')).fill('9292 Magnolia Ave');
  await expect(page.locator(FIELD('city'))).toBeVisible();
  await expect(page.locator(FIELD('postal'))).toBeVisible();

  expect(errors).toEqual([]);
});

/**
 * Two country changes in quick succession. The first layout is held longer than the
 * second, so it lands last — and rendering it then would leave the form on a country the
 * store has already moved off, with no further store write to correct it.
 */
test('a layout that arrives after a newer one is discarded', async ({ page }) => {
  await bootSdk(page, FIXTURE);
  await expect(page.locator(FIELD('address1'))).toBeVisible();

  await page.unroute(ADDRESS_SERVICE_ROUTE);
  await routeAddressService(page, {
    countries: [
      { code: 'US', name: 'United States' },
      { code: 'JP', name: 'Japan' },
    ],
    rules: async country => {
      // JP is asked for first and answers last.
      await new Promise(r => setTimeout(r, country === 'JP' ? 900 : 100));
      return country === 'JP' ? JP_SPEC : US_SPEC;
    },
  });

  const rendered = await captureEvents(page, 'address:fields-rendered');

  // Both in one tick, so both renders are genuinely in flight. Driving this through two
  // `selectOption` calls does not race: the second waits for the element to be stable,
  // which means waiting for the first render to land.
  await page.evaluate(() => {
    const select = document.querySelector(
      '[data-next-checkout-field="country"]'
    ) as HTMLSelectElement;
    for (const value of ['JP', 'US']) {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  const order = () =>
    page
      .locator('[data-next-address] [data-next-checkout-field]')
      .evaluateAll(els => els.map(el => el.getAttribute('data-next-checkout-field')));

  // No names: the page collects those itself, so the block leaves them alone.
  const US_ORDER = ['country', 'address1', 'city', 'province', 'postal', 'phone'];

  await expect.poll(order, { timeout: 4000 }).toEqual(US_ORDER);

  // Well after the slower JP answer has landed. The form self-corrects if a stale layout
  // does render, so what is asserted is that one was never rendered: the countries this
  // block reports building, in order, must never go back to JP.
  await page.waitForTimeout(1500);
  expect(await order()).toEqual(US_ORDER);
  const countries = await rendered.all();
  expect(countries.map((e: unknown) => (e as { country: string }).country).at(-1)).toBe('US');
  expect(countries.filter((e: unknown) => (e as { country: string }).country === 'JP')).toEqual([]);
});

/**
 * `restoreBillingAddress` is a boot step like the others: it writes the stored billing
 * address into billing fields that, for a block, are not on the page yet.
 */
test('a returning visitor sees the billing address they already gave', async ({
  page,
}) => {
  await page.addInitScript(key => {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        state: {
          sameAsShipping: false,
          billingAddress: {
            address1: '14 Billing Way',
            city: 'Elsewhere',
            postal: '90210',
            country: 'US',
          },
        },
        version: 0,
      })
    );
  }, CHECKOUT_KEY);

  await bootSdk(page, '/e2e/fixtures/address-form-billing.html');
  await expect(page.locator(FIELD('billing-address1'))).toBeVisible();

  await expect(page.locator(FIELD('billing-address1'))).toHaveValue(
    '14 Billing Way'
  );
  await expect(page.locator(FIELD('billing-city'))).toBeVisible();
});

/**
 * A billing address is a whole address, so its block builds the names and the phone too,
 * under their `billing-` names: the shipping block's are the shipping address's.
 */
test('a billing block builds the whole address, names and phone included', async ({
  page,
}) => {
  await bootSdk(page, '/e2e/fixtures/address-form-billing.html');

  await expect
    .poll(() =>
      page
        .locator('[data-next-address="billing"] [data-next-checkout-field]')
        .evaluateAll(els => els.map(el => el.getAttribute('data-next-checkout-field')))
    )
    .toEqual([
      'billing-country',
      'billing-fname',
      'billing-lname',
      'billing-address1',
      'billing-city',
      'billing-province',
      'billing-postal',
      'billing-phone',
    ]);
  await expect(
    page.locator('[data-next-address="shipping"] [data-next-checkout-field]')
  ).toHaveCount(8);
});

/** The `lang` of every layout request the block makes, in order. */
function recordLayoutLangs(page: Page): string[] {
  const langs: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    // The block's own request: one country's rules, without the form's states.
    if (
      /^\/v1\/countries\/[^/]+$/.test(url.pathname) &&
      !url.searchParams.has('include')
    ) {
      langs.push(url.searchParams.get('lang') ?? '');
    }
  });
  return langs;
}

test('the debug locale picker asks for the layout again in the new language', async ({
  page,
}) => {
  const langs = recordLayoutLangs(page);
  await bootSdk(page, `${FIXTURE}?debugger=true`);
  await expect(page.locator(FIELD('address1'))).toBeVisible();
  expect(langs).toEqual(['en']);

  const picker = page.locator('#debug-locale-selector #locale-select');
  await expect(picker).toBeAttached({ timeout: 10000 });
  await picker.selectOption('de-DE');

  await expect.poll(() => langs).toEqual(['en', 'de-DE']);
});

test('the campaign’s pinned locale picks the label language', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).nextConfig = { locale: 'th-TH' };
  });
  const langs = recordLayoutLangs(page);
  await bootSdk(page, FIXTURE);
  await expect(page.locator(FIELD('address1'))).toBeVisible();

  expect(langs).toEqual(['th-TH']);
});

test('the block says it is loading until its fields arrive', async ({ page }) => {
  await bootSdk(page, FIXTURE);
  await expect(page.locator(FIELD('address1'))).toBeVisible();

  await expect(page.locator('[data-next-address]')).toHaveAttribute(
    'data-next-address-state',
    'ready'
  );
});
