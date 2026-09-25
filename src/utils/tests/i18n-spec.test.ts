import { describe, expect, it } from 'vitest';

import { parseI18n, translatesAttribute } from '@/utils/i18n-spec';

describe('parseI18n', () => {
  it('reads a bare key as the text, and [attribute]key as that attribute', () => {
    expect(parseI18n('checkout.submit;[title]checkout.submit.hint')).toEqual({
      targets: [
        { attribute: null, key: 'checkout.submit' },
        { attribute: 'title', key: 'checkout.submit.hint' },
      ],
      refused: [],
    });
  });

  it('reads every translatable attribute, in any case, with space around the parts', () => {
    const { targets } = parseI18n(
      ' [Placeholder]a ; [aria-label]b;[title]c;[alt]d '
    );
    expect(targets.map(t => t.attribute)).toEqual([
      'placeholder',
      'aria-label',
      'title',
      'alt',
    ]);
  });

  it('refuses an attribute a translation may not write, and a misspelt one', () => {
    expect(parseI18n('[href]a;[onclick]b;[placholder]c;[html]d')).toEqual({
      targets: [],
      refused: ['href', 'onclick', 'placholder', 'html'],
    });
  });

  it('skips an empty part and an attribute with no key', () => {
    expect(parseI18n(';;[title];').targets).toEqual([]);
  });
});

describe('translatesAttribute', () => {
  it('says whether data-next-i18n writes the attribute', () => {
    const input = document.createElement('input');
    expect(translatesAttribute(input, 'placeholder')).toBe(false);
    input.setAttribute('data-next-i18n', '[placeholder]checkout.email.example');
    expect(translatesAttribute(input, 'placeholder')).toBe(true);
    expect(translatesAttribute(input, 'aria-label')).toBe(false);
  });
});
