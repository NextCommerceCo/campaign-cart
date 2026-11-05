import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindAll } from '../../src/bindings';
import { makeEngine } from '../fixtures/engine';
import { FakeObserver, visible } from './observer';

async function page(html: string) {
  document.body.innerHTML = html;
  const { engine } = makeEngine();
  await engine.start();
  const seen: Array<[string, unknown]> = [];
  engine.events.on('*', (e) => {
    if (e.name.startsWith('promotion.')) seen.push([e.name, e.data]);
  });
  const bindings = bindAll(document, engine, vi.fn());
  return { engine, seen, bindings };
}

beforeEach(() => {
  FakeObserver.all = [];
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('data-next-promotion', () => {
  it('sends promotion.viewed once half of it is visible, and promotion.clicked on each click', async () => {
    const { seen } = await page(
      `<a id="spring" href="#" data-next-promotion="spring" data-next-promotion-name="Spring sale" data-next-promotion-creative="hero.png">Shop</a>`,
    );
    const banner = document.getElementById('spring')!;
    const promotion = { id: 'spring', type: 'banner', name: 'Spring sale', creative: 'hero.png' };
    expect(FakeObserver.all.map((o) => o.options)).toEqual([{ threshold: 0.5 }]);

    visible(banner, 0.3);
    expect(seen).toEqual([]);
    visible(banner, 0.6);
    visible(banner, 1);
    banner.click();
    banner.click();

    expect(seen).toEqual([
      ['promotion.viewed', promotion],
      ['promotion.clicked', promotion],
      ['promotion.clicked', promotion],
    ]);
  });

  it('sends promotion.viewed when bound where IntersectionObserver is missing, and only the fields the element has', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { engine, seen } = await page(`<div data-next-promotion="sale"></div><div data-next-promotion=""></div>`);
    expect(seen).toEqual([['promotion.viewed', { id: 'sale', type: 'banner' }]]);
    expect(engine.log.entries()).toContainEqual(
      expect.objectContaining({ message: 'data-next-promotion needs an id' }),
    );
  });

  it('watches promotions added after the page was bound', async () => {
    const { seen, bindings } = await page('');
    const late = Object.assign(document.createElement('div'), { id: 'late' });
    late.setAttribute('data-next-promotion', 'late');
    document.body.append(late);
    bindings.bind(document.body);
    bindings.bind(document.body);
    visible(late, 0.5);
    expect(seen).toEqual([['promotion.viewed', { id: 'late', type: 'banner' }]]);
  });
});
