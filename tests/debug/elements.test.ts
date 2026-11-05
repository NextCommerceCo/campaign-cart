import { afterEach, describe, expect, it } from 'vitest';
import { explain } from '../../src/debug/elements';
import { makeEngine } from '../fixtures/engine';

const ready = async () => {
  const { engine } = makeEngine();
  await engine.start();
  await engine.cart.addItem(1);
  return engine;
};

const notes = (engine: Awaited<ReturnType<typeof ready>>, selector: string) =>
  explain(engine, document.querySelector(selector)!).map(({ attr, note, bad }) => ({ attr, note, bad }));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('explain', () => {
  it('shows what a display path renders and why a show or hide condition holds', async () => {
    const engine = await ready();
    document.body.innerHTML = `
      <span id="total" data-next-display="cart.total"></span>
      <p id="show" data-next-show="cart.total"></p>
      <p id="hide" data-next-hide="cart.total"></p>
      <p id="compare" data-next-show="campaign.currency == 'EUR'"></p>`;
    expect(notes(engine, '#total')).toEqual([
      { attr: 'data-next-display', note: expect.stringMatching(/^"\$[\d.]+"$/), bad: undefined },
    ]);
    expect(notes(engine, '#show')[0]!.note).toMatch(/^[\d.]+ → shown$/);
    expect(notes(engine, '#hide')[0]!.note).toMatch(/^[\d.]+ → hidden$/);
    expect(notes(engine, '#compare')[0]!.note).toBe('"USD" → hidden');
  });

  it('names the attributes v2 replacement of each earlier attribute, and none for a current one', async () => {
    const engine = await ready();
    document.body.innerHTML = `
      <button id="old" data-next-action="add-to-cart" data-next-package-id="1" data-next-url="/c"></button>
      <button id="new" data-next-action="addItem" data-next-package-id="1" data-next-go="/c"></button>`;
    const legacy = (selector: string) =>
      explain(engine, document.querySelector(selector)!).map((n) => [n.attr, n.legacy]);
    expect(legacy('#old')).toEqual([
      ['data-next-action', 'data-next-action="addItem"'],
      ['data-next-package-id', undefined],
      ['data-next-url', 'data-next-go'],
    ]);
    expect(legacy('#new').every(([, l]) => l === undefined)).toBe(true);
  });

  it('flags unknown paths, unreadable conditions and packages the campaign lacks', async () => {
    const engine = await ready();
    document.body.innerHTML = `
      <span id="path" data-next-display="cart.nope"></span>
      <p id="condition" data-next-show="cart.total >"></p>
      <button id="missing" data-next-package-id="999"></button>
      <button id="known" data-next-package-id="1" data-next-action="add-to-cart"></button>`;
    expect(notes(engine, '#path')).toEqual([{ attr: 'data-next-display', note: 'unknown path', bad: true }]);
    expect(notes(engine, '#condition')).toEqual([{ attr: 'data-next-show', note: 'cannot read', bad: true }]);
    expect(notes(engine, '#missing')).toEqual([
      { attr: 'data-next-package-id', note: 'not in this campaign', bad: true },
    ]);
    expect(notes(engine, '#known')).toEqual([
      { attr: 'data-next-package-id', note: 'Earbuds ×1 · 49.00', bad: undefined },
      { attr: 'data-next-action', note: undefined, bad: undefined },
    ]);
  });

  it('resolves inside a package like the page does, and leaves card values to the card', async () => {
    const engine = await ready();
    document.body.innerHTML = `
      <div data-next-package-id="2"><span id="name" data-next-display="package.name"></span></div>
      <div data-next-bundle-card><span id="card" data-next-display="price"></span></div>`;
    expect(notes(engine, '#name')[0]!.note).toBe('"Earbuds ×2"');
    expect(notes(engine, '#card')).toEqual([{ attr: 'data-next-display', note: undefined, bad: undefined }]);
  });
});
