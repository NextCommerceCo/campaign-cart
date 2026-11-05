import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../src/boot';
import { fakeApi } from './fixtures/api';
import { campaign } from './fixtures/campaign';
import { fakeRules } from './fixtures/rules';

const FIXTURES = 'tests/fixtures/pages';
const config = { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: '', debug: false, reset: false };

const htmlIn = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(path).isDirectory() ? htmlIn(path) : name.endsWith('.html') ? [path] : [];
  });

const committed = htmlIn(FIXTURES).map((path) => ({
  path,
  snapshot: `./golden/${relative(FIXTURES, path).replace(/\//g, '__')}`,
}));

const external = (process.env.GOLDEN_PAGES ?? '')
  .split(',')
  .filter(Boolean)
  .flatMap((dir) =>
    htmlIn(dir).map((path) => ({
      path,
      snapshot: `../.golden/${relative(join(dir, '..'), path).replace(/[/\\]/g, '__')}`,
    })),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-next-ready');
  document.documentElement.removeAttribute('data-next-error');
  document.documentElement.className = '';
  sessionStorage.clear();
  localStorage.clear();
});

/** Waits until the page and its events stop changing for a few ticks, so a slow run snapshots the same page. */
const settle = async (events: string[]) => {
  let last = '';
  let still = 0;
  for (let i = 0; i < 200 && still < 5; i++) {
    await new Promise((r) => setTimeout(r, 1));
    const now = `${events.length}|${document.body.innerHTML}`;
    still = now === last ? still + 1 : 0;
    last = now;
  }
};

const VOLATILE = [/\b(id|for)="spreedly-[^"]*"/g, /\bdata-next-phone-e164="[^"]*"/g];

async function render(path: string) {
  const doc = new DOMParser().parseFromString(readFileSync(path, 'utf8'), 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
  history.replaceState(null, '', `/${basename(path, '.html')}/?ref_id=R1`);
  const api = fakeApi().fetch;
  const rules = fakeRules({ geo: 'US' }).send;
  vi.stubGlobal('fetch', (url: string, init: RequestInit) =>
    String(url).includes('i18n-rules') ? rules(String(url), init) : api(url, init),
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  const events: string[] = [];
  const next = boot(config, Promise.resolve(campaign));
  next.on('*', (_, e) => void events.push(e.event_type));
  await vi.waitFor(() => expect(document.documentElement.hasAttribute('data-next-ready')).toBe(true));
  await settle(events);
  const counts = Object.entries(
    events.reduce<Record<string, number>>((n, name) => ({ ...n, [name]: (n[name] ?? 0) + 1 }), {}),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, n]) => `${name} ×${n}`);
  let body = document.body.innerHTML;
  for (const pattern of VOLATILE) body = body.replace(pattern, '');
  return [
    `<!-- html class: ${document.documentElement.className} -->`,
    `<!-- events: ${counts.join(', ')} -->`,
    body,
  ].join('\n');
}

describe('legacy pages render the same', () => {
  it.each([...committed, ...external])('$path', async ({ path, snapshot }) => {
    await expect(await render(path)).toMatchFileSnapshot(snapshot);
  });
});
