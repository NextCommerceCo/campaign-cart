import { describe, it, expect } from 'vitest';
import {
  validateEcommerceEvent,
  isEcommerceEvent,
  worstLevel,
} from '@/utils/debug/panels/EcommerceEventValidator';

// The validator targets the issue #51 / #54 class of bug: item-level data
// that is wrong while ecommerce.value stays correct.

/** The exact broken dl_upsell_purchase payload captured in issue #54. */
const brokenUpsell = {
  event: 'dl_upsell_purchase',
  ecommerce: {
    currency: 'CAD',
    transaction_id: 'ORD1-US1',
    value: 42,
    items: [
      {
        item_id: 'undefined',
        item_name: 'Package undefined',
        price: 42,
        quantity: 1,
        currency: 'CAD',
      },
    ],
  },
  upsell_metadata: { package_id: '0', package_name: 'Package 0' },
};

/** The same accept after the fix: resolved package, real quantity, per-unit price. */
const fixedUpsell = {
  event: 'dl_upsell_purchase',
  ecommerce: {
    currency: 'CAD',
    transaction_id: 'ORD1-US1',
    value: 42,
    items: [
      {
        item_id: 'DRONE-3',
        item_name: 'Drone Hawk',
        price: 14,
        quantity: 3,
        currency: 'CAD',
      },
    ],
  },
  upsell_metadata: { package_id: '3', package_name: 'Drone Hawk x1' },
};

describe('EcommerceEventValidator', () => {
  describe('isEcommerceEvent', () => {
    it('matches dl_ events that carry an ecommerce payload', () => {
      expect(isEcommerceEvent(brokenUpsell)).toBe(true);
    });

    it('ignores non-ecommerce and internal events', () => {
      expect(isEcommerceEvent({ event: 'dl_user_data' })).toBe(false);
      expect(isEcommerceEvent({ event: 'cart:updated', ecommerce: {} })).toBe(false);
      expect(isEcommerceEvent(null)).toBe(false);
      expect(isEcommerceEvent('nope')).toBe(false);
    });
  });

  describe('validateEcommerceEvent', () => {
    it('flags the unresolved package and quantity/price mismatch (issue #54)', () => {
      const issues = validateEcommerceEvent(brokenUpsell);
      const fields = issues.map(i => i.field);

      expect(worstLevel(issues)).toBe('error');
      expect(fields).toContain('ecommerce.items[0].item_id');
      expect(fields).toContain('ecommerce.items[0].item_name');
      expect(fields).toContain('upsell_metadata.package_id');
      expect(fields).toContain('upsell_metadata.package_name');
      // 42 × 1 = 42 reconciles, so no value mismatch is reported here — the
      // defect is the unresolved package, which is what we assert above.
    });

    it('reports a clean bill of health for the fixed payload', () => {
      const issues = validateEcommerceEvent(fixedUpsell);
      expect(issues).toEqual([]);
      expect(worstLevel(issues)).toBeNull();
    });

    it('flags price × quantity that does not reconcile to value', () => {
      const mismatch = {
        event: 'dl_purchase',
        ecommerce: {
          currency: 'USD',
          transaction_id: 'ORD-9',
          value: 70,
          items: [{ item_id: 'SKU', item_name: 'Thing', price: 70, quantity: 5 }],
        },
      };
      const issues = validateEcommerceEvent(mismatch);
      expect(issues.some(i => i.field === 'ecommerce.value')).toBe(true);
      expect(worstLevel(issues)).toBe('warning');
    });

    it('accepts discounted bundles where per-unit price reconciles', () => {
      const discounted = {
        event: 'dl_upsell_purchase',
        ecommerce: {
          currency: 'USD',
          transaction_id: 'ORD1-US1',
          value: 25.2,
          items: [{ item_id: 'SKU', item_name: 'Thing', price: 8.4, quantity: 3 }],
        },
        upsell_metadata: { package_id: '3', package_name: 'Thing' },
      };
      expect(validateEcommerceEvent(discounted)).toEqual([]);
    });

    it('reconciles a purchase value that includes tax and shipping', () => {
      const purchase = {
        event: 'dl_purchase',
        ecommerce: {
          currency: 'USD',
          transaction_id: 'ORD-10',
          value: 115, // 100 items + 10 tax + 5 shipping
          tax: 10,
          shipping: 5,
          items: [{ item_id: 'SKU', item_name: 'Thing', price: 50, quantity: 2 }],
        },
      };
      // Σ(items) = 100 reconciles to value − tax − shipping, so no value warning.
      expect(validateEcommerceEvent(purchase)).toEqual([]);
    });

    it('flags a missing transaction_id on a purchase event', () => {
      const noTxn = {
        event: 'dl_purchase',
        ecommerce: {
          currency: 'USD',
          value: 50,
          items: [{ item_id: 'SKU', item_name: 'Thing', price: 50, quantity: 1 }],
        },
      };
      const issues = validateEcommerceEvent(noTxn);
      expect(issues.some(i => i.field === 'ecommerce.transaction_id')).toBe(true);
      expect(worstLevel(issues)).toBe('error');
    });

    it('warns on a missing currency', () => {
      const noCurrency = {
        event: 'dl_add_to_cart',
        ecommerce: {
          value: 10,
          items: [{ item_id: 'SKU', item_name: 'Thing', price: 10, quantity: 1 }],
        },
      };
      const issues = validateEcommerceEvent(noCurrency);
      expect(issues.some(i => i.field === 'ecommerce.currency')).toBe(true);
    });

    it('warns on an empty items array for an item-required event', () => {
      const noItems = {
        event: 'dl_add_to_cart',
        ecommerce: { currency: 'USD', value: 0, items: [] },
      };
      const issues = validateEcommerceEvent(noItems);
      expect(issues.some(i => i.field === 'ecommerce.items')).toBe(true);
    });

    it('accepts an empty cart snapshot (dl_user_data) without an items warning', () => {
      const emptyCart = {
        event: 'dl_user_data',
        user_properties: { visitor_type: 'guest' },
        ecommerce: { currency: 'USD', value: 0, items: [] },
      };
      const issues = validateEcommerceEvent(emptyCart);
      expect(issues).toEqual([]);
    });

    it('flags invalid quantity', () => {
      const badQty = {
        event: 'dl_add_to_cart',
        ecommerce: {
          currency: 'USD',
          value: 10,
          items: [{ item_id: 'SKU', item_name: 'Thing', price: 10, quantity: 0 }],
        },
      };
      const issues = validateEcommerceEvent(badQty);
      expect(issues.some(i => i.field === 'ecommerce.items[0].quantity')).toBe(true);
    });

    it('returns no issues for non-ecommerce events', () => {
      expect(validateEcommerceEvent({ event: 'dl_user_data' })).toEqual([]);
    });
  });
});
