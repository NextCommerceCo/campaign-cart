import { afterEach, describe, expect, it, vi } from 'vitest';
import { benchmarkView } from '../../src/debug/benchmark';
import { nodes } from '../../src/debug/view';
import { makeEngine } from '../fixtures/engine';

const resource = (name: string, startTime: number, responseEnd: number, extra: object = {}) => ({
  name,
  entryType: 'resource',
  initiatorType: 'script',
  startTime,
  responseEnd,
  duration: responseEnd - startTime,
  transferSize: 0,
  encodedBodySize: 0,
  ...extra,
});

function setup(entries: Record<string, object[]>) {
  vi.spyOn(performance, 'getEntriesByType').mockImplementation((type) => (entries[type] ?? []) as PerformanceEntryList);
  document.head.innerHTML = '<script src="https://cdn.test/sdk/loader.js"></script>';
  const { engine } = makeEngine();
  const root = document.createElement('div');
  const bench = benchmarkView(engine);
  const paint = () => root.replaceChildren(...nodes(bench.view()));
  const tiles = (nth = 0) =>
    [...root.querySelectorAll(':scope > .bmtiles')[nth]!.children].map((t) =>
      [...t.children].map((c) => c.textContent).join(' | '),
    );
  const rows = () => {
    const cells = [...root.querySelectorAll(':scope > .bmwf > *')].map((c) => c.textContent);
    return Array.from({ length: cells.length / 3 }, (_, i) => `${cells[i * 3]} | ${cells[i * 3 + 2]}`);
  };
  const calls = () =>
    [...root.querySelectorAll('.bmcalls tr')]
      .slice(1)
      .map((tr) => [...tr.children].map((c) => c.textContent).join(' | '));
  return { engine, root, paint, tiles, rows, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = '';
});

describe('benchmark tab', () => {
  it('times this page load from the browser: the SDK files, its calls and milestones', () => {
    const { engine, root, paint, tiles, rows, calls } = setup({
      navigation: [{ responseEnd: 96, domContentLoadedEventStart: 300, loadEventStart: 602 }],
      resource: [
        resource('https://cdn.test/sdk/loader.js', 100, 128, { transferSize: 2048 }),
        resource('https://cdn.test/sdk/boot-abc.js', 130, 191, { transferSize: 24 * 1024 }),
        resource('https://api.test/api/v1/campaigns/', 130, 312, { initiatorType: 'fetch', responseStatus: 200 }),
        resource('https://api.test/api/v1/carts/calculate/', 400, 540, { initiatorType: 'fetch', responseStatus: 200 }),
        resource('https://other.test/pixel.js', 50, 80),
        resource('https://api.test/api/v1/carts/calculate/', 9000, 9100, {
          initiatorType: 'fetch',
          responseStatus: 200,
        }),
      ],
      mark: [{ name: 'next:ready', startTime: 438 }],
    });
    vi.spyOn(performance, 'timeOrigin', 'get').mockReturnValue(Date.now() - 400);
    engine.events.emit('sdk.ready', engine.snapshot());
    paint();
    const ready = tiles()[0]!.split(' | ')[1]!;
    expect(ready).toMatch(/^\d+ ms$/);
    expect(tiles().slice(1)).toEqual([
      'Page shown | 438 ms',
      'Campaign API | 182 ms',
      'SDK JS | 26 KB | 2 files, as sent',
    ]);
    expect(rows()).toEqual([
      'HTML | 96 ms',
      'loader.js | 28 ms',
      'boot-abc.js | 61 ms',
      'api.test/api/v1/campaigns/ | 182 ms',
      'api.test/api/v1/carts/calculate/ | 140 ms',
      `sdk.ready | ${ready}`,
      'Page shown | 438 ms',
      'DOMContentLoaded | 300 ms',
      'window load | 602 ms',
    ]);
    expect(calls()).toEqual([
      'api.test/api/v1/campaigns/ | 200 | 182 ms',
      'api.test/api/v1/carts/calculate/ | 200 | 140 ms',
      'api.test/api/v1/carts/calculate/ | 200 | 100 ms',
    ]);
    expect(root.textContent).toContain('Calls after the page loaded are in the table below.');
  });

  it('says what it could not measure', () => {
    const { paint, tiles, root } = setup({});
    paint();
    expect(tiles()[2]).toBe('Campaign API | — | cached or not timed');
    expect(root.textContent).toContain('No API call on this page yet.');
    expect(tiles(1)).toEqual([
      'LCP | — | not measured yet',
      'CLS | — | not measured yet',
      'INP | — | not measured yet',
    ]);
  });
});
