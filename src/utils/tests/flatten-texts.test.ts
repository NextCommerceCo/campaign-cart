import { describe, expect, it } from 'vitest';

import { flattenTexts } from '@/utils/flatten-texts';

describe('flattenTexts', () => {
  it('reads i18next JSON as one text per dotted key', () => {
    expect(
      flattenTexts({
        fields: {
          email: { label: 'Email', errors: { blank: 'Enter an email' } },
        },
        checkout: { contact: { title: 'Contact' } },
      })
    ).toEqual({
      'fields.email.label': 'Email',
      'fields.email.errors.blank': 'Enter an email',
      'checkout.contact.title': 'Contact',
    });
  });

  it('keeps keys that are already flat', () => {
    expect(flattenTexts({ 'fields.email.label': 'Email' })).toEqual({
      'fields.email.label': 'Email',
    });
  });

  it('drops what is neither a string nor an object', () => {
    expect(flattenTexts({ a: 3, b: null, c: ['x'], d: 'kept' })).toEqual({
      d: 'kept',
    });
    expect(flattenTexts(null)).toEqual({});
    expect(flattenTexts('text')).toEqual({});
  });
});
