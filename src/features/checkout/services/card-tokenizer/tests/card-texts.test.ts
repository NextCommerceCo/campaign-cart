import { afterEach, describe, expect, it } from 'vitest';

import { useConfigStore } from '@/state/config';

import { cardErrorField, cardErrorKey, cardText } from '../card-texts';
import type { CardErrorField } from '../card-tokenizer.types';

afterEach(() => useConfigStore.setState({ translations: undefined }));

describe('cardErrorKey', () => {
  const FIELDS: Array<[CardErrorField, string]> = [
    ['number', 'payment.card.number'],
    ['cvv', 'payment.card.cvv'],
    ['month', 'payment.card.expiry_month'],
    ['year', 'payment.card.expiry_year'],
  ];

  it.each(FIELDS)(
    'names %s blank when empty, invalid when not',
    (field, base) => {
      expect(cardErrorKey(field, 'errors.invalid', true)).toBe(
        `${base}.errors.blank`
      );
      expect(cardErrorKey(field, 'errors.invalid', false)).toBe(
        `${base}.errors.invalid`
      );
    }
  );

  it.each([...FIELDS.map(([f]) => f), 'full_name' as const, undefined])(
    'names an expired card by its expiry whichever field (%s) it names',
    field => {
      expect(cardErrorKey(field, 'errors.expired', false)).toBe(
        'payment.card.expiry_month.errors.expired'
      );
    }
  );

  it('has one text for the cardholder name, empty or not', () => {
    expect(cardErrorKey('full_name', 'errors.invalid', false)).toBe(
      'payment.card.name.errors.blank'
    );
  });

  it('falls back to the generic text for an error about no field', () => {
    expect(cardErrorKey(undefined, 'errors.configuration', false)).toBe(
      'payment.errors.generic'
    );
  });
});

describe('cardErrorField', () => {
  it.each([
    ['number', 'number'],
    ['cvv', 'cvv'],
    ['month', 'month'],
    ['year', 'year'],
    ['full_name', 'full_name'],
    ['first_name', 'full_name'],
    ['last_name', 'full_name'],
    ['zip', undefined],
    [undefined, undefined],
  ])('reads %s as %s', (attribute, field) => {
    expect(cardErrorField(attribute)).toBe(field);
  });
});

describe('cardText', () => {
  it("prefers the page's own translation", () => {
    useConfigStore.setState({
      translations: { en: { 'payment.card.cvv.label': 'CVC' } },
    });
    expect(cardText('payment.card.cvv.label')).toBe('CVC');
  });

  it('keeps its English when nothing translates the key', () => {
    expect(cardText('payment.card.cvv.label')).toBe('Security code');
  });
});
