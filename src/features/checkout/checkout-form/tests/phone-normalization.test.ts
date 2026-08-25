import { describe, it, expect, beforeEach } from 'vitest';

import { useCheckoutStore } from '@/state/checkout';

import { normalizeStoredPhones } from '../phone-normalization';
import type { PhoneNumberSource } from '../../validation/phone-validation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A widget that has its utils script and speaks for the number it is given. */
function loadedWidget(e164: string): PhoneNumberSource {
  return { getNumber: () => e164, isValidNumber: () => true };
}

/** A widget whose utils script has not landed: it can neither format nor judge. */
function loadingWidget(): PhoneNumberSource {
  return { getNumber: () => '', isValidNumber: () => null };
}

function widgets(
  entries: Array<[string, PhoneNumberSource]>
): ReadonlyMap<string, PhoneNumberSource> {
  return new Map(entries);
}

beforeEach(() => {
  useCheckoutStore.getState().reset?.();
  useCheckoutStore.setState({ formData: {}, billingAddress: null } as never);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('normalizeStoredPhones', () => {
  it('rewrites a national shipping number as E.164', () => {
    useCheckoutStore.setState({
      formData: { phone: '(555) 123-4567' },
    } as never);

    normalizeStoredPhones(
      widgets([['shipping', loadedWidget('+15551234567')]])
    );

    expect(useCheckoutStore.getState().formData.phone).toBe('+15551234567');
  });

  it('rewrites the billing number from its own widget, not the shipping one', () => {
    useCheckoutStore.setState({
      formData: { phone: '(555) 123-4567' },
      billingAddress: { phone: '020 7946 0958' },
    } as never);

    normalizeStoredPhones(
      widgets([
        ['shipping', loadedWidget('+15551234567')],
        ['billing', loadedWidget('+442079460958')],
      ])
    );

    const state = useCheckoutStore.getState();
    expect(state.formData.phone).toBe('+15551234567');
    expect(state.billingAddress?.phone).toBe('+442079460958');
  });

  /**
   * The reason this runs at all: before the utils script lands there is nothing to convert
   * with, and blanking a number the shopper has already typed would be worse than leaving
   * it national for the API to convert.
   */
  it('leaves a number alone rather than blanking it mid-load', () => {
    useCheckoutStore.setState({
      formData: { phone: '(555) 123-4567' },
    } as never);

    normalizeStoredPhones(widgets([['shipping', loadingWidget()]]));

    expect(useCheckoutStore.getState().formData.phone).toBe('(555) 123-4567');
  });

  it('leaves the store untouched when there is no number to normalise', () => {
    useCheckoutStore.setState({ formData: {} } as never);

    normalizeStoredPhones(
      widgets([['shipping', loadedWidget('+15551234567')]])
    );

    expect(useCheckoutStore.getState().formData.phone).toBeUndefined();
  });

  /** A no-op write would replace the whole billing address and wake every subscriber. */
  it('does not rewrite a number that is already E.164', () => {
    useCheckoutStore.setState({
      billingAddress: { phone: '+442079460958', city: 'London' },
    } as never);
    const before = useCheckoutStore.getState().billingAddress;

    normalizeStoredPhones(
      widgets([['billing', loadedWidget('+442079460958')]])
    );

    expect(useCheckoutStore.getState().billingAddress).toBe(before);
  });
});
