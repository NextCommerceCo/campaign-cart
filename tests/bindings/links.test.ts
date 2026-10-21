import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindAll } from '../../src/bindings';
import { makeEngine } from '../fixtures/engine';

async function ready(html = '', params: Record<string, string> = {}) {
  document.body.innerHTML = html;
  const { engine } = makeEngine({
    params,
    visit: { landingPage: 'https://shop.test/lp', referrer: '', device: 'UA', deviceType: 'desktop' },
  });
  engine.restore();
  await engine.load();
  return engine;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('links', () => {
  it('carries session params on same-site links only', async () => {
    const engine = await ready(`<a id="in" href="/checkout">go</a><a id="out" href="https://other.test/x">out</a>`, {
      utm_source: 'fb',
      reset: '1',
    });
    bindAll(document, engine, vi.fn());
    const click = (id: string) =>
      document.getElementById(id)!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    document.addEventListener('click', (e) => e.preventDefault(), { once: false });
    click('in');
    click('out');
    expect(document.querySelector<HTMLAnchorElement>('#in')!.href).toBe(`${location.origin}/checkout?utm_source=fb`);
    expect(document.querySelector<HTMLAnchorElement>('#out')!.href).toBe('https://other.test/x');
  });
});
