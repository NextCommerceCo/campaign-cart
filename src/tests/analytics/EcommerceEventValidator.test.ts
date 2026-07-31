import { describe, it, expect } from 'vitest';
import {
  validateEcommerceEvent,
  auditEcommerceEvent,
  validateDataLayerEvent,
  auditDataLayerEvent,
  isDataLayerEvent,
  isEcommerceEvent,
  worstLevel,
} from '@/core/debug/panels/EcommerceEventValidator';

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
      expect(isEcommerceEvent({ event: 'cart:updated', ecommerce: {} })).toBe(
        false
      );
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
          items: [
            { item_id: 'SKU', item_name: 'Thing', price: 70, quantity: 5 },
          ],
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
          items: [
            { item_id: 'SKU', item_name: 'Thing', price: 8.4, quantity: 3 },
          ],
        },
        upsell_metadata: { package_id: '3', package_name: 'Thing' },
      };
      expect(validateEcommerceEvent(discounted)).toEqual([]);
    });

    it('reconciles a compliant purchase: value = item revenue, tax/shipping separate', () => {
      // GA4: value = Σ(price × quantity) = 100. tax and shipping ride in their
      // own fields and are NOT part of value.
      const purchase = {
        event: 'dl_purchase',
        ecommerce: {
          currency: 'USD',
          transaction_id: 'ORD-10',
          value: 100, // item revenue only
          tax: 10,
          shipping: 5,
          items: [
            { item_id: 'SKU', item_name: 'Thing', price: 50, quantity: 2 },
          ],
        },
      };
      expect(validateEcommerceEvent(purchase)).toEqual([]);
    });

    it('flags a purchase whose value folds in tax + shipping (grand-total mistake)', () => {
      const purchase = {
        event: 'dl_purchase',
        ecommerce: {
          currency: 'USD',
          transaction_id: 'ORD-11',
          value: 115, // WRONG: 100 items + 10 tax + 5 shipping
          tax: 10,
          shipping: 5,
          items: [
            { item_id: 'SKU', item_name: 'Thing', price: 50, quantity: 2 },
          ],
        },
      };
      const issues = validateEcommerceEvent(purchase);
      const valueIssue = issues.find(i => i.field === 'ecommerce.value');
      expect(valueIssue).toBeDefined();
      expect(valueIssue?.message).toMatch(/includes tax.*and shipping/);
    });

    it('warns when a value-required event omits ecommerce.value', () => {
      const viewItem = {
        event: 'dl_view_item',
        ecommerce: {
          currency: 'USD',
          items: [
            { item_id: 'SKU', item_name: 'Thing', price: 10, quantity: 1 },
          ],
        },
      };
      const issues = validateEcommerceEvent(viewItem);
      expect(issues.some(i => i.field === 'ecommerce.value')).toBe(true);
      expect(worstLevel(issues)).toBe('warning');
    });

    it('does not require value on list/selection events', () => {
      const viewList = {
        event: 'dl_view_item_list',
        ecommerce: {
          currency: 'USD',
          item_list_id: 'L1',
          items: [
            { item_id: 'SKU', item_name: 'Thing', price: 10, quantity: 1 },
          ],
        },
      };
      expect(validateEcommerceEvent(viewList)).toEqual([]);
    });

    it('warns when add_shipping_info has no shipping_tier', () => {
      const noTier = {
        event: 'dl_add_shipping_info',
        ecommerce: {
          currency: 'USD',
          value: 10,
          items: [
            { item_id: 'SKU', item_name: 'Thing', price: 10, quantity: 1 },
          ],
        },
      };
      const issues = validateEcommerceEvent(noTier);
      expect(issues.some(i => i.field === 'ecommerce.shipping_tier')).toBe(
        true
      );
    });

    it('accepts add_shipping_info that carries a shipping_tier', () => {
      const withTier = {
        event: 'dl_add_shipping_info',
        ecommerce: {
          currency: 'USD',
          value: 10,
          shipping_tier: 'Ground',
          items: [
            { item_id: 'SKU', item_name: 'Thing', price: 10, quantity: 1 },
          ],
        },
      };
      expect(validateEcommerceEvent(withTier)).toEqual([]);
    });

    it('surfaces the shipping cost on add_shipping_info', () => {
      const withShipping = {
        event: 'dl_add_shipping_info',
        ecommerce: {
          currency: 'USD',
          value: 10,
          shipping: 5,
          shipping_tier: 'Ground',
          items: [
            { item_id: 'SKU', item_name: 'Thing', price: 10, quantity: 1 },
          ],
        },
      };
      const checks = auditEcommerceEvent(withShipping);
      const shipping = checks.find(c => c.field === 'ecommerce.shipping');
      expect(shipping?.status).toBe('pass');
      expect(shipping?.detail).toContain('5.00');
      // A reported shipping cost must not break reconciliation (value excludes it).
      expect(validateEcommerceEvent(withShipping)).toEqual([]);
    });

    it('marks shipping cost as skipped (not failed) when absent', () => {
      const noShipping = {
        event: 'dl_add_shipping_info',
        ecommerce: {
          currency: 'USD',
          value: 10,
          shipping_tier: 'Ground',
          items: [
            { item_id: 'SKU', item_name: 'Thing', price: 10, quantity: 1 },
          ],
        },
      };
      const shipping = auditEcommerceEvent(noShipping).find(
        c => c.field === 'ecommerce.shipping'
      );
      expect(shipping?.status).toBe('skipped');
    });

    it('warns when add_payment_info has no payment_type', () => {
      const noType = {
        event: 'dl_add_payment_info',
        ecommerce: {
          currency: 'USD',
          value: 10,
          items: [
            { item_id: 'SKU', item_name: 'Thing', price: 10, quantity: 1 },
          ],
        },
      };
      const issues = validateEcommerceEvent(noType);
      expect(issues.some(i => i.field === 'ecommerce.payment_type')).toBe(true);
    });

    it('flags a missing transaction_id on a purchase event', () => {
      const noTxn = {
        event: 'dl_purchase',
        ecommerce: {
          currency: 'USD',
          value: 50,
          items: [
            { item_id: 'SKU', item_name: 'Thing', price: 50, quantity: 1 },
          ],
        },
      };
      const issues = validateEcommerceEvent(noTxn);
      expect(issues.some(i => i.field === 'ecommerce.transaction_id')).toBe(
        true
      );
      expect(worstLevel(issues)).toBe('error');
    });

    it('warns on a missing currency', () => {
      const noCurrency = {
        event: 'dl_add_to_cart',
        ecommerce: {
          value: 10,
          items: [
            { item_id: 'SKU', item_name: 'Thing', price: 10, quantity: 1 },
          ],
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
          items: [
            { item_id: 'SKU', item_name: 'Thing', price: 10, quantity: 0 },
          ],
        },
      };
      const issues = validateEcommerceEvent(badQty);
      expect(issues.some(i => i.field === 'ecommerce.items[0].quantity')).toBe(
        true
      );
    });

    it('returns no issues for non-ecommerce events', () => {
      expect(validateEcommerceEvent({ event: 'dl_user_data' })).toEqual([]);
    });
  });

  describe('auditEcommerceEvent', () => {
    it('reports a pass for every topic on a healthy payload', () => {
      const checks = auditEcommerceEvent(fixedUpsell);
      expect(checks.length).toBeGreaterThan(0);
      // No topic failed, and the checklist surfaces the topics by name.
      expect(
        checks.every(c => c.status === 'pass' || c.status === 'skipped')
      ).toBe(true);
      const labels = checks.map(c => c.label);
      expect(labels).toContain('Transaction ID');
      expect(labels).toContain('Currency');
      expect(labels).toContain('Revenue reconciles');
      expect(labels).toContain('Upsell package ID resolved');
    });

    it('marks the failing topics on the broken payload (issue #54)', () => {
      const checks = auditEcommerceEvent(brokenUpsell);
      const byField = (field: string) => checks.find(c => c.field === field);

      expect(byField('ecommerce.items[0].item_id')?.status).toBe('error');
      expect(byField('ecommerce.items[0].item_name')?.status).toBe('error');
      expect(byField('upsell_metadata.package_id')?.status).toBe('error');
      // The price/quantity reconciled (42 × 1 = 42), so those topics pass.
      expect(byField('ecommerce.items[0].price')?.status).toBe('pass');
      expect(byField('ecommerce.value')?.status).toBe('pass');
    });

    it('skips inapplicable topics rather than failing them', () => {
      const addToCart = {
        event: 'dl_add_to_cart',
        ecommerce: {
          currency: 'USD',
          value: 10,
          items: [
            { item_id: 'SKU', item_name: 'Thing', price: 10, quantity: 1 },
          ],
        },
      };
      const checks = auditEcommerceEvent(addToCart);
      const txn = checks.find(c => c.field === 'ecommerce.transaction_id');
      // transaction_id is only required on purchase events.
      expect(txn?.status).toBe('skipped');
    });

    it('stays in lockstep with validateEcommerceEvent', () => {
      const issues = validateEcommerceEvent(brokenUpsell);
      const failing = auditEcommerceEvent(brokenUpsell).filter(
        c => c.status === 'error' || c.status === 'warning'
      );
      expect(failing.map(c => c.field)).toEqual(issues.map(i => i.field));
    });

    it('returns an empty checklist for non-ecommerce events', () => {
      expect(auditEcommerceEvent({ event: 'dl_user_data' })).toEqual([]);
    });
  });

  describe('isDataLayerEvent', () => {
    it('matches any dl_ event, with or without an ecommerce payload', () => {
      expect(isDataLayerEvent({ event: 'dl_login' })).toBe(true);
      expect(isDataLayerEvent(brokenUpsell)).toBe(true);
    });

    it('ignores GTM internals, nameless pushes, and non-objects', () => {
      expect(isDataLayerEvent({ event: 'gtm.js' })).toBe(false);
      expect(isDataLayerEvent({ foo: 'bar' })).toBe(false);
      expect(isDataLayerEvent(null)).toBe(false);
    });
  });

  describe('auditDataLayerEvent', () => {
    it('checks every dl_ event for event name and event_id', () => {
      const checks = auditDataLayerEvent({
        event: 'dl_login',
        event_id: 'evt-1',
      });
      const byField = (field: string) => checks.find(c => c.field === field);
      expect(byField('event')?.status).toBe('pass');
      expect(byField('event_id')?.status).toBe('pass');
    });

    it('warns when a dl_ event has no event_id (cannot correlate delivery)', () => {
      const checks = auditDataLayerEvent({ event: 'dl_login' });
      expect(checks.find(c => c.field === 'event_id')?.status).toBe('warning');
    });

    it('layers the ecommerce checks on top when a payload is present', () => {
      const checks = auditDataLayerEvent({ ...fixedUpsell, event_id: 'evt-1' });
      const fields = checks.map(c => c.field);
      // Generic tier first, ecommerce tier after.
      expect(fields).toContain('event');
      expect(fields).toContain('event_id');
      expect(fields).toContain('ecommerce.transaction_id');
      expect(fields).toContain('ecommerce.value');
    });

    it('returns an empty checklist for non-dl_ events', () => {
      expect(auditDataLayerEvent({ event: 'gtm.dom' })).toEqual([]);
      expect(auditDataLayerEvent({ foo: 'bar' })).toEqual([]);
    });
  });

  describe('validateDataLayerEvent', () => {
    it('surfaces the missing event_id as a warning issue', () => {
      const issues = validateDataLayerEvent({ event: 'dl_login' });
      expect(issues.some(i => i.field === 'event_id')).toBe(true);
      expect(worstLevel(issues)).toBe('warning');
    });

    it('reports a clean bill for a fully-formed dl_ event', () => {
      const issues = validateDataLayerEvent({
        ...fixedUpsell,
        event_id: 'evt-1',
      });
      expect(issues).toEqual([]);
    });
  });
});
