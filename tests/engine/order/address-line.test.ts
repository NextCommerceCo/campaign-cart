import { describe, expect, it } from 'vitest';
import { display } from '../../../src/attributes/value';
import { formatAddress, LINE_LAYOUT, ORDER_LAYOUT, REVIEW_LAYOUT } from '../../../src/engine/order/address-line';
import { makeEngine } from '../../fixtures/engine';

const ADDRESS = { line1: '1 Main St', city: 'Austin', state: 'TX', postcode: '73301', country: 'US' };

describe('address lines', () => {
  it('writes each page format by its own layout', () => {
    expect(formatAddress(ADDRESS, LINE_LAYOUT)).toBe('1 Main St, Austin, TX 73301, US');
    expect(formatAddress(ADDRESS, REVIEW_LAYOUT)).toBe('1 Main St, Austin TX 73301, US');
    expect(formatAddress({ ...ADDRESS, line4: 'Austin' }, ORDER_LAYOUT)).toBe('1 Main St, Austin, TX, 73301, US');
  });

  it('shows an address value of attributes v2 with state and postcode together, without empty parts', () => {
    const { engine } = makeEngine();
    expect(display('shipping_address', ADDRESS, engine)).toBe('1 Main St, Austin, TX 73301, US');
    expect(display('shipping_address', { line1: '1 Main St', country: 'US' }, engine)).toBe('1 Main St, US');
  });
});
