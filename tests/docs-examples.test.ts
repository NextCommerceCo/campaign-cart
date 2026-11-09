import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../src/boot';
import { fakeApi } from './fixtures/api';
import { campaign } from './fixtures/campaign';
import { fakeRules } from './fixtures/rules';

const RECIPES = 'docs/guides/recipes';
const PAGES = [
  'docs/guides/quickstart.md',
  ...(existsSync(RECIPES) ? readdirSync(RECIPES) : [])
    .filter((name) => name.endsWith('.md'))
    .map((name) => join(RECIPES, name)),
];
const config = { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: '', debug: false, reset: false };

/** Every ```html block of a page, the way a reader copies it, with the page's ```js blocks run after the SDK starts. */
const examples = PAGES.flatMap((page) => {
  const text = readFileSync(page, 'utf8');
  const scripts = [...text.matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1]!);
  return [...text.matchAll(/```html\n([\s\S]*?)```/g)].map((m, i) => ({
    name: `${page} #${i + 1}`,
    html: m[1]!,
    scripts,
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-next-ready');
  sessionStorage.clear();
  localStorage.clear();
});

/** Renders an example as its page would: an order page when it reads the order or offers an upsell. */
async function render(html: string, scripts: string[] = []) {
  const doc = new DOMParser().parseFromString(html.replace(/<script[\s\S]*?<\/script>/g, ''), 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
  const orderPage = /\border\.|acceptUpsell|skipUpsell/.test(html);
  history.replaceState(null, '', orderPage ? '/upsell/?ref_id=R1' : '/landing/');
  const api = fakeApi().fetch;
  const rules = fakeRules({ geo: 'US' }).send;
  vi.stubGlobal('fetch', (url: string, init: RequestInit) =>
    String(url).includes('i18n-rules') ? rules(String(url), init) : api(url, init),
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const next = boot(config, Promise.resolve(campaign));
  for (const script of scripts) new Function('next', script)(next);
  await vi.waitFor(() => expect(document.documentElement.hasAttribute('data-next-ready')).toBe(true));
  await vi.waitFor(() => expect(document.querySelector('[data-next-loading]')).toBeNull());
  return next;
}

/** Every key that occurs anywhere in the objects the page can read, and the ids the page names. */
async function knownNames(next: Awaited<ReturnType<typeof render>>, scripts: string[]) {
  const names = new Set([
    'cart',
    'selector',
    'checkout',
    'order',
    'campaign',
    'param',
    'package',
    'options',
    'true',
    'false',
  ]);
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object')
      for (const [key, child] of Object.entries(value)) {
        names.add(key);
        walk(child);
      }
  };
  walk(next.snapshot());
  for (const root of ['cart', 'selector', 'checkout', 'order', 'campaign']) walk(await next.query(root));
  for (const script of scripts)
    for (const [, name] of script.matchAll(/next\.define\(\s*'\w+',\s*'(\w+)'/g)) names.add(name!);
  for (const pkg of campaign.packages) walk(await next.query(`package.${pkg.ref_id}`));
  for (const el of document.querySelectorAll('[data-next-selector], [data-next-option]'))
    names.add(el.getAttribute('data-next-selector') || el.getAttribute('data-next-option') || '');
  return names;
}

const PATHS = ['data-next-query', 'data-next-show', 'data-next-hide', 'data-next-each', 'data-next-for'];

/** The field names an attribute reads: its path, or each path of a condition. */
const namesIn = (value: string) =>
  (value.replace(/(['"]).*?\1/g, '').match(/[A-Za-z_][\w.]*/g) ?? []).flatMap((path) =>
    path.startsWith('errors.') ? [] : path.split('.').filter((part) => part && !/^\d+$/.test(part)),
  );

describe('every example in the guides runs as written', () => {
  it.each(examples)('$name', async ({ html, scripts }) => {
    const next = await render(html, scripts);
    expect(next.log.entries().filter((e) => e.level === 'warn' || e.level === 'error')).toEqual([]);
    const known = await knownNames(next, scripts);
    const unknown = [...document.querySelectorAll(PATHS.map((a) => `[${a}]`).join(','))].flatMap((el) =>
      PATHS.flatMap((attr) => namesIn(el.getAttribute(attr) ?? '').filter((name) => !known.has(name))),
    );
    expect(unknown).toEqual([]);
    const unwritten = [...document.querySelectorAll<HTMLElement>('[data-next-query]')].filter(
      (el) =>
        !el.closest('[hidden]') &&
        !el.matches('img, a, input, select, textarea') &&
        (el.textContent === '' || el.textContent === el.getAttribute('data-next-empty')),
    );
    expect(unwritten.map((el) => el.outerHTML)).toEqual([]);
    const bumps = [...document.querySelectorAll<HTMLElement>('[data-next-option]')].filter(
      (el) => !el.closest('[data-next-selector]'),
    );
    for (const bump of bumps) {
      const before = bump.hasAttribute('data-next-selected');
      bump.click();
      await vi.waitFor(() => expect(bump.hasAttribute('data-next-selected')).toBe(!before));
    }
  });
});

const guides = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? guides(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : [],
  );

/** Pages `scripts/docs-events.mjs` writes into the staged site: one per destination. */
const GENERATED = ['gtm', 'ga4', 'meta', 'rudderstack'].map(
  (d) => `docs/guides/analytics-reference/destinations/${d}.md`,
);

describe('links between the guides', () => {
  it('every relative .md link reaches a page', () => {
    const broken = guides('docs/guides').flatMap((page) =>
      [...readFileSync(page, 'utf8').matchAll(/\]\(([^)\s#]+\.md)(#[^)]*)?\)/g)]
        .map((m) => m[1]!)
        .filter((target) => {
          const path = join(dirname(page), target);
          return !/^[a-z]+:/.test(target) && !existsSync(path) && !GENERATED.includes(path);
        })
        .map((target) => `${page} → ${target}`),
    );
    expect(broken).toEqual([]);
  });
});
