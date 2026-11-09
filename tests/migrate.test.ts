import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrate, migrateCss } from '../scripts/migrate.mjs';
import { boot } from '../src/boot';
import { fakeApi } from './fixtures/api';
import { campaign } from './fixtures/campaign';
import { fakeRules } from './fixtures/rules';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-next-ready');
  sessionStorage.clear();
  localStorage.clear();
});

describe('migrate', () => {
  it('rewrites a selector, its cards and what reads them, leaving every other character alone', () => {
    const page = `<div class="x" data-next-bundle-selector data-next-selector-id="main">
  <div data-next-bundle-card data-next-bundle-id="three" data-next-selected="true"
       data-next-bundle-items='[{"packageId":1,"quantity":3},{"packageId":5}]' data-next-bundle-vouchers='["TRIO10","X"]'>
    <span data-next-bundle-display="unitPrice"></span><i data-next-bundle-display="hasDiscount">%</i>
  </div>
</div>`;
    expect(migrate(page).html).toBe(`<div class="x" data-next-selector="main">
  <div data-next-option="three" data-next-selected
       data-next-items='1x3, 5' data-next-vouchers='TRIO10, X'>
    <span data-next-query="selector.main.options.three.price"></span><i data-next-show="selector.main.options.three.total_discount > 0">%</i>
  </div>
</div>`);
  });

  it('rewrites display paths and conditions, and keeps those with no v2 field', () => {
    const { html, notes } = migrate(`<span data-next-display="cart.total"></span>
<span data-next-display="package.42.price_total"></span>
<span data-next-display="order.customer.firstName"></span>
<b data-next-display="cart.hasCoupon"></b>
<p data-next-hide="cart.isEmpty"></p>
<p data-next-show="param.banner == 'off'"></p>
<span data-next-display="cart.totalSavingsAmount"></span>
<p data-next-show="cart.total_discount > 0"></p>`);
    expect(html).toBe(`<span data-next-query="cart.total"></span>
<span data-next-query="package.42.total"></span>
<span data-next-query="order.user.first_name"></span>
<b data-next-show="cart.coupons"></b>
<p data-next-hide="!cart.lines"></p>
<p data-next-show="param.banner == off"></p>
<span data-next-display="cart.totalSavingsAmount"></span>
<p data-next-show="cart.total_discount > 0"></p>`);
    expect(notes).toEqual(['data-next-display="cart.totalSavingsAmount" stays as it is (no v2 field)']);
  });

  it('rewrites buttons, an order bump, an offer and checkout fields', () => {
    const { html } = migrate(`<meta name="next-upsell-accept-url" content="u2.html">
<div data-next-package-id="7"><button data-next-quantity="increase" data-step="2" data-max="5">+</button><a data-next-remove-item>x</a></div>
<button data-next-action="add-to-cart" data-next-package-id="1" data-next-clear-cart="true" data-next-url="/c">Buy</button>
<div data-next-toggle-card data-next-package-id="9" data-next-quantity="2"><img data-next-toggle-image></div>
<section data-next-upsell="offer" data-next-package-id="7"><button data-next-upsell-action="add">Yes</button><a data-next-upsell-action="skip" data-next-url="r.html">No</a></section>
<form data-next-checkout data-next-checkout-step="ship.html"><input data-next-checkout-field="fname"><input data-next-checkout-field="phone_number" data-next-required="true"></form>`);
    expect(html).toBe(`<meta name="next-upsell-accept-url" content="u2.html">
<div data-next-package-id="7"><button data-next-quantity="+2" data-next-max-quantity="5" data-next-action="setQuantity" data-next-package-id="7">+</button><a data-next-action="removeItem" data-next-package-id="7">x</a></div>
<button data-next-action="addItem" data-next-package-id="1" data-next-replace data-next-go="/c">Buy</button>
<div data-next-option="bump-9" data-next-items="9x2"><img data-next-query="selector.bump-9.lines.0.image"></div>
<section data-next-option="offer-7" data-next-items="7"><button data-next-action="acceptUpsell" data-next-go="u2.html">Yes</button><a data-next-go="r.html" data-next-action="skipUpsell">No</a></section>
<form data-next-checkout data-next-step data-next-go="ship.html"><input data-next-field="first_name"><input data-next-field="phone" required></form>`);
  });

  it('leaves a selector with variant slots, and what reads it, as it is', () => {
    const page = `<div data-next-bundle-selector data-next-selector-id="main">
  <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":1}]'><b data-next-bundle-display="price"></b></div>
</div>
<div data-next-bundle-slots-for="main"></div>
<span data-next-display="bundle.one.price"></span>`;
    const { html, notes } = migrate(page);
    expect(html).toBe(page);
    expect(notes[0]).toContain('selector "main"');
  });

  it('renames attribute selectors in a stylesheet', () => {
    expect(migrateCss('[data-next-bundle-card].next-selected, [data-next-toggle-card] {}')).toBe(
      '[data-next-option].next-selected, [data-next-option] {}',
    );
  });
});

const htmlIn = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(path).isDirectory() ? htmlIn(path) : name.endsWith('.html') ? [path] : [];
  });

const PAGES = (process.env.MIGRATE_PAGES ?? '')
  .split(',')
  .filter(Boolean)
  .flatMap((p) => (p.endsWith('.html') ? [p] : htmlIn(p)));

async function rendered(source: string, orderPage: boolean) {
  sessionStorage.clear();
  localStorage.clear();
  document.documentElement.removeAttribute('data-next-ready');
  const doc = new DOMParser().parseFromString(source, 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
  history.replaceState(null, '', orderPage ? '/page/?ref_id=R1' : '/page/');
  const api = fakeApi().fetch;
  const rules = fakeRules({ geo: 'US' }).send;
  vi.stubGlobal('fetch', (url: string, init: RequestInit) =>
    String(url).includes('i18n-rules') ? rules(String(url), init) : api(url, init),
  );
  vi.stubGlobal('IntersectionObserver', undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  boot(
    { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: '', debug: false, reset: false },
    Promise.resolve(campaign),
  );
  await vi.waitFor(() => expect(document.documentElement.hasAttribute('data-next-ready')).toBe(true));
  let last = '';
  for (let i = 0, still = 0; i < 200 && still < 5; i++) {
    await new Promise((r) => setTimeout(r, 1));
    still = document.body.innerHTML === last ? still + 1 : 0;
    last = document.body.innerHTML;
  }
  const shown = (el: Element) => !el.closest('[hidden], [style*="display: none"]');
  return new Map(
    [...document.body.querySelectorAll('[data-mig]')].map((el) => [
      el.getAttribute('data-mig')!,
      {
        text: el.children.length ? '' : (el.textContent ?? '').trim(),
        shown: shown(el),
        src: el.getAttribute('src') ?? '',
      },
    ]),
  );
}

/** Numbers every element of the page's own markup, so the same element is found before and after. */
const mark = (html: string) => {
  let n = 0;
  return html.replace(
    /<(script|style)\b[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->|<([a-zA-Z][\w-]*)(?=[\s>/])/g,
    (whole, block, tag) => (tag ? `<${tag} data-mig="${n++}"` : whole),
  );
};

describe.skipIf(!PAGES.length)('migrated real pages show what the original showed', () => {
  it.each(PAGES)('%s', async (path) => {
    const source = mark(readFileSync(path, 'utf8'));
    const orderPage = /data-next-upsell|data-next-order-items|="order\./.test(source);
    const before = await rendered(source, orderPage);
    const after = await rendered(migrate(source).html, orderPage);
    const differences = [...before]
      .map(([id, b]) => ({ id, b, a: after.get(id) }))
      .filter(({ b, a }) => !a || b.text !== a.text || b.shown !== a.shown || b.src !== a.src)
      .map(({ id, b, a }) => `#${id}: ${JSON.stringify(b)} → ${JSON.stringify(a)}`);
    expect(differences).toEqual([]);
  });
});
