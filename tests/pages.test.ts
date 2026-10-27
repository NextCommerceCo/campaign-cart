import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../src/boot';
import { fakeApi } from './fixtures/api';
import { campaign } from './fixtures/campaign';
import { fakeRules } from './fixtures/rules';

const ROOT = 'tests/fixtures/pages';
const PAGES = readdirSync(ROOT).flatMap((c) => readdirSync(`${ROOT}/${c}`).map((p) => `${c}/${p}`));
const config = { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: '', debug: false, reset: false };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-next-ready');
  sessionStorage.clear();
  localStorage.clear();
});

describe('real template pages', () => {
  it.each(PAGES)('%s binds without a single SDK warning', async (page) => {
    const doc = new DOMParser().parseFromString(readFileSync(`${ROOT}/${page}`, 'utf8'), 'text/html');
    document.head.innerHTML = doc.head.innerHTML;
    document.body.innerHTML = doc.body.innerHTML;
    history.replaceState(null, '', `/${page.replace('.html', '')}/?ref_id=R1`);
    const api = fakeApi().fetch;
    const rules = fakeRules({ geo: 'US' }).send;
    vi.stubGlobal('fetch', (url: string, init: RequestInit) =>
      String(url).includes('i18n-rules') ? rules(String(url), init) : api(url, init),
    );
    const warnings: string[] = [];
    vi.spyOn(console, 'warn').mockImplementation((...args) => void warnings.push(args.join(' ')));
    boot(config, Promise.resolve(campaign));
    await vi.waitFor(() => expect(document.documentElement.hasAttribute('data-next-ready')).toBe(true));
    expect(warnings.filter((w) => w.startsWith('[next]'))).toEqual([]);
  });
});
