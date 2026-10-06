import { describe, it, expect, vi } from 'vitest';
import {
  affectsPostcodeState,
  checkPostcodeState,
  type PostcodeStateContext,
} from '../postcode-state-check';
import type { PostcodeResult } from '@/core/i18n-rules';

const NOT_IN_STATE: PostcodeResult = {
  valid: false,
  error: {
    code: 'not_in_state',
    message: 'Enter a valid ZIP Code for California',
  },
  state: 'NY',
};

function input(value: string): HTMLInputElement {
  const element = document.createElement('input');
  element.value = value;
  return element;
}

function select(value: string): HTMLSelectElement {
  const element = document.createElement('select');
  element.innerHTML = `<option value="">Choose…</option><option value="${value}">${value}</option>`;
  element.value = value;
  return element;
}

/** An address with these values, and a service that answers `answer`. */
function form(
  values: { postal?: string; province?: string; country?: string },
  answer: (postcode: string) => Promise<PostcodeResult | undefined> = () =>
    Promise.resolve(NOT_IN_STATE),
  prefix = ''
) {
  const fields = new Map<string, HTMLElement>([
    [`${prefix}postal`, input(values.postal ?? '')],
    [`${prefix}province`, select(values.province ?? '')],
    [`${prefix}country`, select(values.country ?? '')],
  ]);
  const ctx: PostcodeStateContext = {
    readPostcode: vi.fn(answer),
    getField: name => fields.get(name),
    passesPattern: (postcode, country) =>
      country !== 'US' || /^\d{5}(\d{4})?$/.test(postcode.replace('-', '')),
    showError: vi.fn(),
    clearError: vi.fn(),
  };
  const set = (name: string, value: string) => {
    const field = fields.get(`${prefix}${name}`);
    if (field instanceof HTMLSelectElement) {
      field.innerHTML += `<option value="${value}">${value}</option>`;
    }
    (field as HTMLInputElement | HTMLSelectElement).value = value;
  };
  return { ctx, set };
}

describe('affectsPostcodeState', () => {
  it('watches the postcode, the state and the country, shipping and billing', () => {
    expect(
      [
        'postal',
        'province',
        'country',
        'billing-postal',
        'billing-province',
      ].every(affectsPostcodeState)
    ).toBe(true);
    expect(affectsPostcodeState('city')).toBe(false);
    expect(affectsPostcodeState('billing-address1')).toBe(false);
  });
});

describe('checkPostcodeState', () => {
  it('shows the service’s message under the postcode when the state does not use it', async () => {
    const { ctx } = form({ postal: '10001', province: 'CA', country: 'US' });
    await checkPostcodeState(ctx, 'postal');
    expect(ctx.readPostcode).toHaveBeenCalledWith('10001', 'US', 'CA');
    expect(ctx.showError).toHaveBeenCalledWith(
      'postal',
      'Enter a valid ZIP Code for California'
    );
  });

  it('asks about the billing address for a billing field', async () => {
    const { ctx } = form(
      { postal: '10001', province: 'CA', country: 'US' },
      undefined,
      'billing-'
    );
    await checkPostcodeState(ctx, 'billing-province');
    expect(ctx.showError).toHaveBeenCalledWith(
      'billing-postal',
      'Enter a valid ZIP Code for California'
    );
  });

  it('takes its message away once the state uses the postcode', async () => {
    const answers: Record<string, PostcodeResult> = {
      CA: NOT_IN_STATE,
      NY: { valid: true, value: '10001', state: 'NY' },
    };
    const { ctx, set } = form(
      { postal: '10001', province: 'CA', country: 'US' },
      () => Promise.resolve(answers[state])
    );
    let state = 'CA';
    await checkPostcodeState(ctx, 'postal');
    state = 'NY';
    set('province', 'NY');
    await checkPostcodeState(ctx, 'province');
    expect(ctx.clearError).toHaveBeenCalledWith('postal');
  });

  it('clears nothing it did not show', async () => {
    const { ctx } = form(
      { postal: '94103', province: 'CA', country: 'US' },
      () => Promise.resolve({ valid: true, value: '94103', state: 'CA' })
    );
    await checkPostcodeState(ctx, 'postal');
    expect(ctx.showError).not.toHaveBeenCalled();
    expect(ctx.clearError).not.toHaveBeenCalled();
  });

  it('asks nothing until there is a postcode its country takes, a country and a state', async () => {
    for (const values of [
      { postal: '', province: 'CA', country: 'US' },
      { postal: '10001', province: '', country: 'US' },
      { postal: '10001', province: 'CA', country: '' },
      { postal: '1000', province: 'CA', country: 'US' },
    ]) {
      const { ctx } = form(values);
      await checkPostcodeState(ctx, 'postal');
      expect(ctx.readPostcode).not.toHaveBeenCalled();
    }
  });

  it('shows nothing when the service cannot answer', async () => {
    const { ctx } = form(
      { postal: '10001', province: 'CA', country: 'US' },
      () => Promise.resolve(undefined)
    );
    await checkPostcodeState(ctx, 'postal');
    expect(ctx.showError).not.toHaveBeenCalled();
  });

  it('drops an answer about a postcode the shopper has since changed', async () => {
    let answerFirst: (result: PostcodeResult) => void = () => {};
    const first = new Promise<PostcodeResult>(resolve => {
      answerFirst = resolve;
    });
    const { ctx, set } = form(
      { postal: '10001', province: 'CA', country: 'US' },
      postcode =>
        postcode === '10001'
          ? first
          : Promise.resolve({ valid: true, value: postcode, state: 'CA' })
    );
    const stale = checkPostcodeState(ctx, 'postal');
    set('postal', '94103');
    await checkPostcodeState(ctx, 'postal');
    answerFirst(NOT_IN_STATE);
    await stale;
    expect(ctx.showError).not.toHaveBeenCalled();
  });
});
