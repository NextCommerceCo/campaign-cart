import { describe, it, expect, beforeEach } from 'vitest';
import {
  collectDefaultProperties,
  mergeWithDefaults,
} from '@/enhancers/cart/BundleSelector/BundleSelectorEnhancer.handlers';

// ─── helpers ──────────────────────────────────────────────────────────────────

function addDefaultInput(key: string, value: string): HTMLInputElement {
  const el = document.createElement('input');
  el.setAttribute('data-next-default-property', key);
  el.value = value;
  document.body.appendChild(el);
  return el;
}

function addDefaultTextarea(key: string, value: string): HTMLTextAreaElement {
  const el = document.createElement('textarea');
  el.setAttribute('data-next-default-property', key);
  el.value = value;
  document.body.appendChild(el);
  return el;
}

function addDefaultSelect(
  key: string,
  value: string,
): HTMLSelectElement {
  const el = document.createElement('select');
  el.setAttribute('data-next-default-property', key);
  const option = document.createElement('option');
  option.value = value;
  option.selected = true;
  el.appendChild(option);
  document.body.appendChild(el);
  return el;
}

// ─── collectDefaultProperties ─────────────────────────────────────────────────

describe('collectDefaultProperties', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns empty object when no inputs on page', () => {
    expect(collectDefaultProperties()).toEqual({});
  });

  it('collects a single input by its attribute key', () => {
    addDefaultInput('name', 'Alice');
    expect(collectDefaultProperties()).toEqual({ name: 'Alice' });
  });

  it('collects multiple inputs', () => {
    addDefaultInput('name', 'Alice');
    addDefaultInput('team', 'Red');
    expect(collectDefaultProperties()).toEqual({ name: 'Alice', team: 'Red' });
  });

  it('collects textarea values', () => {
    addDefaultTextarea('message', 'Hello world');
    expect(collectDefaultProperties()).toEqual({ message: 'Hello world' });
  });

  it('collects select values', () => {
    addDefaultSelect('size', 'XL');
    expect(collectDefaultProperties()).toEqual({ size: 'XL' });
  });

  it('skips inputs with empty value', () => {
    addDefaultInput('name', '');
    expect(collectDefaultProperties()).toEqual({});
  });

  it('skips inputs without the attribute', () => {
    const el = document.createElement('input');
    el.value = 'ghost';
    document.body.appendChild(el);
    expect(collectDefaultProperties()).toEqual({});
  });

  it('skips elements with the attribute but no value', () => {
    const el = document.createElement('input');
    el.setAttribute('data-next-default-property', 'key');
    // value intentionally left empty (default '')
    document.body.appendChild(el);
    expect(collectDefaultProperties()).toEqual({});
  });

  it('last input with same key wins (standard querySelectorAll order)', () => {
    addDefaultInput('color', 'red');
    addDefaultInput('color', 'blue');
    const result = collectDefaultProperties();
    // Both run through forEach — last one overwrites
    expect(result['color']).toBe('blue');
  });

  it('mixes input, textarea, select on the same page', () => {
    addDefaultInput('first', 'John');
    addDefaultTextarea('note', 'Some note');
    addDefaultSelect('size', 'M');
    expect(collectDefaultProperties()).toEqual({
      first: 'John',
      note: 'Some note',
      size: 'M',
    });
  });
});

// ─── mergeWithDefaults ────────────────────────────────────────────────────────

describe('mergeWithDefaults', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns undefined when no defaults and no slot props', () => {
    expect(mergeWithDefaults(undefined)).toBeUndefined();
  });

  it('returns undefined when defaults empty and slot props undefined', () => {
    addDefaultInput('key', ''); // empty → skipped
    expect(mergeWithDefaults(undefined)).toBeUndefined();
  });

  it('returns default properties when slot has none', () => {
    addDefaultInput('name', 'Alice');
    expect(mergeWithDefaults(undefined)).toEqual({ name: 'Alice' });
  });

  it('returns slot properties when no defaults on page', () => {
    expect(mergeWithDefaults({ color: 'red' })).toEqual({ color: 'red' });
  });

  it('slot property overrides default with same key', () => {
    addDefaultInput('color', 'red');
    expect(mergeWithDefaults({ color: 'blue' })).toEqual({ color: 'blue' });
  });

  it('merges slot and default properties — slot wins on conflict', () => {
    addDefaultInput('name', 'Alice');
    addDefaultInput('team', 'Red');
    const result = mergeWithDefaults({ team: 'Blue', size: 'XL' });
    expect(result).toEqual({ name: 'Alice', team: 'Blue', size: 'XL' });
  });

  it('returns undefined when merged result is empty', () => {
    // No defaults, empty slot props
    expect(mergeWithDefaults({})).toBeUndefined();
  });

  it('includes default-only keys not present in slot props', () => {
    addDefaultInput('back_text', 'HELLO');
    const result = mergeWithDefaults({ front_text: 'WORLD' });
    expect(result).toEqual({ back_text: 'HELLO', front_text: 'WORLD' });
  });

  it('handles multiple defaults and multiple slot props', () => {
    addDefaultInput('a', '1');
    addDefaultInput('b', '2');
    const result = mergeWithDefaults({ b: 'override', c: '3' });
    expect(result).toEqual({ a: '1', b: 'override', c: '3' });
  });

  it('returns undefined when slot props is empty object and no defaults', () => {
    expect(mergeWithDefaults({})).toBeUndefined();
  });

  it('does not mutate the original slot properties object', () => {
    addDefaultInput('extra', 'X');
    const original = { slot_key: 'val' };
    mergeWithDefaults(original);
    expect(original).toEqual({ slot_key: 'val' });
  });
});
