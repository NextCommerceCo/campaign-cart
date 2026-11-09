import { describe, expect, it } from 'vitest';
import { fill, fillTemplate } from '../../src/bindings/dom';
import { fillTokens } from '../../src/bindings/tokens';

describe('template tokens', () => {
  it('fills a copy’s text and attributes, dropping keys it does not know', () => {
    const root = document.createElement('div');
    root.innerHTML = '<a href="/p/{item.packageId}" title="{missing}">{item.name} × {quantity}</a>';
    fillTokens(root, { 'item.packageId': '7', 'item.name': 'Earbuds', quantity: '2' });
    expect(root.innerHTML).toBe('<a href="/p/7" title="">Earbuds × 2</a>');
  });

  it('keeps unknown keys in an HTML template and escapes the values it fills', () => {
    const html = '<b>{discount.name}</b> {slot.index} {item.price}';
    expect(fillTemplate(html, { 'discount.name': '<10% & more>' })).toBe(
      '<b>&lt;10% &amp; more&gt;</b> {slot.index} {item.price}',
    );
    expect(fillTemplate('{item.name}', { name: 'Tee' }, /\{item\.(\w+)\}/g)).toBe('Tee');
  });

  it('reads a key with dots and leaves braces that hold no key', () => {
    expect(fill('{a.b.c} {"x":1} {}', { 'a.b.c': 'yes' })).toBe('yes {"x":1} {}');
  });
});
