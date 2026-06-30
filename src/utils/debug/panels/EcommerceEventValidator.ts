/**
 * Ecommerce Event Validator
 *
 * Pure validation for ecommerce dataLayer events (dl_purchase,
 * dl_upsell_purchase, dl_add_to_cart, …). Flags the data-accuracy defects that
 * break downstream tags but are easy to miss by eye:
 *
 * - Unresolved package: `item_id: "undefined"`, `item_name: "Package undefined"`,
 *   `upsell_metadata.package_id: "0"` / `package_name: "Package 0"` (issues #51, #54).
 * - Quantity collapse / price mismatch: `items[].price × quantity` does not
 *   reconcile to `ecommerce.value` — tax and shipping aware (issue #54).
 * - Missing transaction_id on a purchase event (breaks GA4 purchase dedup).
 * - Missing currency, missing/negative value, empty items.
 * - Missing `value` on events GA4 expects it (view_item, add_to_cart, …).
 * - Missing `shipping_tier` / `payment_type` on add_shipping_info /
 *   add_payment_info (GA4-recommended params).
 *
 * The validator works as a **checklist**: {@link auditEcommerceEvent} runs every
 * topic and reports a pass / warning / error / skipped result for each, so the
 * debug overlay can show exactly what was verified rather than a single
 * "looks valid" line. {@link validateEcommerceEvent} is the issues-only view of
 * that same checklist (failing topics only), kept for badges and filters.
 *
 * This module is intentionally free of DOM/store access so it can be unit
 * tested and reused outside the debug overlay.
 */

import { reconcileValue } from '@/utils/analytics/validation/reconcileValue';

export interface EventValidationIssue {
  level: 'error' | 'warning';
  /** Dot-path of the offending field, e.g. `ecommerce.items[0].item_id`. */
  field: string;
  message: string;
}

/** Outcome of a single checklist topic. */
export type CheckStatus = 'pass' | 'warning' | 'error' | 'skipped';

export interface EventCheck {
  /** Short topic label shown in the checklist, e.g. `Package ID resolved`. */
  label: string;
  status: CheckStatus;
  /** Dot-path of the field this topic concerns. */
  field: string;
  /** One line: why it passed, what is wrong, or why it was skipped. */
  detail: string;
}

/** Events that represent a completed transaction and require a transaction_id. */
const PURCHASE_EVENTS = ['dl_purchase', 'dl_upsell_purchase'];

/**
 * Events where an empty `items` array is normal — cart/list snapshots that can
 * legitimately be empty (e.g. `dl_user_data` on a page with no cart). All other
 * ecommerce events are expected to carry at least one item.
 */
const ITEMS_OPTIONAL_EVENTS = [
  'dl_user_data',
  'dl_view_cart',
  'dl_view_item_list',
  'dl_view_search_results',
];

/**
 * Events where GA4 expects a monetary `value` alongside `currency`. Missing it
 * here is a warning (recommended), except on purchase events where it is an
 * error (no revenue is reported). List/selection events (view_item_list,
 * select_item) carry no `value` by design and are intentionally absent.
 */
const VALUE_REQUIRED_EVENTS = [
  'dl_view_item',
  'dl_add_to_cart',
  'dl_remove_from_cart',
  'dl_view_cart',
  'dl_begin_checkout',
  'dl_add_shipping_info',
  'dl_add_payment_info',
  'dl_purchase',
  'dl_upsell_purchase',
];

/** Events where a shipping cost is meaningful and surfaced in the checklist. */
const SHIPPING_RELEVANT_EVENTS = [
  'dl_add_shipping_info',
  'dl_purchase',
  'dl_upsell_purchase',
];

/** Strings that mean "the package never resolved". */
const UNRESOLVED_TOKENS = ['', 'undefined', 'null', 'nan'];

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  return NaN;
}

/** Like {@link toNumber} but treats a missing value as 0 (for optional tax/shipping). */
function toNumberOrZero(value: unknown): number {
  if (value == null || value === '') return 0;
  const n = toNumber(value);
  return Number.isFinite(n) ? n : 0;
}

function isUnresolvedId(value: unknown): boolean {
  return (
    value == null ||
    UNRESOLVED_TOKENS.includes(String(value).trim().toLowerCase())
  );
}

function looksUnresolvedName(value: unknown): boolean {
  if (value == null) return true;
  const name = String(value).trim();
  return /undefined|\bnull\b/i.test(name) || /^package\s+0$/i.test(name);
}

/**
 * True when this event carries an ecommerce payload worth validating.
 * Non-ecommerce events (dl_user_data, gtm.*, internal SDK events) are skipped.
 */
export function isEcommerceEvent(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  const hasEcommerce = data.ecommerce && typeof data.ecommerce === 'object';
  const isDlEvent =
    typeof data.event === 'string' && data.event.startsWith('dl_');
  return Boolean(hasEcommerce && isDlEvent);
}

/**
 * Run the full validation checklist for a single ecommerce dataLayer event.
 * Returns one {@link EventCheck} per topic — including the ones that passed or
 * were not applicable — so callers can render the complete picture. Returns an
 * empty array for non-ecommerce events.
 */
export function auditEcommerceEvent(data: any): EventCheck[] {
  if (!isEcommerceEvent(data)) return [];

  const checks: EventCheck[] = [];
  const ecommerce = data.ecommerce ?? {};
  const eventName = String(data.event);
  const isPurchase = PURCHASE_EVENTS.includes(eventName);
  const items: any[] = Array.isArray(ecommerce.items) ? ecommerce.items : [];
  const multiItem = items.length > 1;

  // ── Transaction ID ─────────────────────────────────────────────────────────
  if (!isPurchase) {
    checks.push({
      label: 'Transaction ID',
      status: 'skipped',
      field: 'ecommerce.transaction_id',
      detail: `Not applicable — only purchase events require a transaction_id.`,
    });
  } else if (isUnresolvedId(ecommerce.transaction_id)) {
    checks.push({
      label: 'Transaction ID',
      status: 'error',
      field: 'ecommerce.transaction_id',
      detail:
        `Missing transaction_id on ${eventName} — GA4 cannot de-duplicate the ` +
        `purchase, so revenue may be double-counted.`,
    });
  } else {
    checks.push({
      label: 'Transaction ID',
      status: 'pass',
      field: 'ecommerce.transaction_id',
      detail: `Present: "${ecommerce.transaction_id}".`,
    });
  }

  // ── Currency ───────────────────────────────────────────────────────────────
  if (isUnresolvedId(ecommerce.currency)) {
    checks.push({
      label: 'Currency',
      status: 'warning',
      field: 'ecommerce.currency',
      detail: `Missing currency "${ecommerce.currency}" — some platforms reject the event.`,
    });
  } else {
    checks.push({
      label: 'Currency',
      status: 'pass',
      field: 'ecommerce.currency',
      detail: `Present: "${ecommerce.currency}".`,
    });
  }

  // ── Items present ──────────────────────────────────────────────────────────
  if (items.length > 0) {
    checks.push({
      label: 'Items present',
      status: 'pass',
      field: 'ecommerce.items',
      detail: `${items.length} item${items.length === 1 ? '' : 's'} in the payload.`,
    });
  } else if (ITEMS_OPTIONAL_EVENTS.includes(eventName)) {
    checks.push({
      label: 'Items present',
      status: 'skipped',
      field: 'ecommerce.items',
      detail: `Empty items is allowed for ${eventName} (cart/list snapshot).`,
    });
  } else {
    checks.push({
      label: 'Items present',
      status: 'warning',
      field: 'ecommerce.items',
      detail: `No items in the ecommerce payload for ${eventName}.`,
    });
  }

  // ── Item-level checks ──────────────────────────────────────────────────────
  let itemsTotal = 0;
  let itemsTotalComputable = items.length > 0;

  items.forEach((item, i) => {
    const base = `ecommerce.items[${i}]`;
    const prefix = multiItem ? `Item ${i + 1} · ` : '';

    // Package id resolved
    if (isUnresolvedId(item?.item_id)) {
      checks.push({
        label: `${prefix}Package ID resolved`,
        status: 'error',
        field: `${base}.item_id`,
        detail: `Unresolved item_id "${item?.item_id}" — the package was not resolved.`,
      });
    } else {
      checks.push({
        label: `${prefix}Package ID resolved`,
        status: 'pass',
        field: `${base}.item_id`,
        detail: `item_id "${item?.item_id}".`,
      });
    }

    // Package name resolved
    if (looksUnresolvedName(item?.item_name)) {
      checks.push({
        label: `${prefix}Package name resolved`,
        status: 'error',
        field: `${base}.item_name`,
        detail: `Unresolved item_name "${item?.item_name}" — the package was not resolved.`,
      });
    } else {
      checks.push({
        label: `${prefix}Package name resolved`,
        status: 'pass',
        field: `${base}.item_name`,
        detail: `item_name "${item?.item_name}".`,
      });
    }

    const price = toNumber(item?.price);
    const quantity = toNumber(item?.quantity);

    // Price valid
    if (!Number.isFinite(price) || price < 0) {
      checks.push({
        label: `${prefix}Price valid`,
        status: 'warning',
        field: `${base}.price`,
        detail: `Invalid price "${item?.price}".`,
      });
      itemsTotalComputable = false;
    } else {
      checks.push({
        label: `${prefix}Price valid`,
        status: 'pass',
        field: `${base}.price`,
        detail: `Per-unit price ${price}.`,
      });
    }

    // Quantity valid
    if (!Number.isFinite(quantity) || quantity < 1) {
      checks.push({
        label: `${prefix}Quantity valid`,
        status: 'warning',
        field: `${base}.quantity`,
        detail: `Invalid quantity "${item?.quantity}" (expected ≥ 1).`,
      });
      itemsTotalComputable = false;
    } else {
      checks.push({
        label: `${prefix}Quantity valid`,
        status: 'pass',
        field: `${base}.quantity`,
        detail: `Quantity ${quantity}.`,
      });
    }

    if (Number.isFinite(price) && Number.isFinite(quantity)) {
      itemsTotal += price * quantity;
    }
  });

  // ── Revenue value ──────────────────────────────────────────────────────────
  const value = toNumber(ecommerce.value);
  const hasValue = ecommerce.value != null && ecommerce.value !== '';
  const valueRequired = isPurchase || VALUE_REQUIRED_EVENTS.includes(eventName);
  if (hasValue && (!Number.isFinite(value) || value < 0)) {
    checks.push({
      label: 'Revenue value',
      status: 'warning',
      field: 'ecommerce.value',
      detail: `Invalid ecommerce.value "${ecommerce.value}".`,
    });
  } else if (!hasValue && isPurchase) {
    checks.push({
      label: 'Revenue value',
      status: 'error',
      field: 'ecommerce.value',
      detail: `Missing ecommerce.value on ${eventName} — no revenue is reported.`,
    });
  } else if (!hasValue && valueRequired) {
    checks.push({
      label: 'Revenue value',
      status: 'warning',
      field: 'ecommerce.value',
      detail: `Missing ecommerce.value on ${eventName} — GA4 expects value (item revenue) alongside currency.`,
    });
  } else if (hasValue) {
    checks.push({
      label: 'Revenue value',
      status: 'pass',
      field: 'ecommerce.value',
      detail: `value ${value}.`,
    });
  } else {
    checks.push({
      label: 'Revenue value',
      status: 'skipped',
      field: 'ecommerce.value',
      detail: `No value on ${eventName} — not required for this event.`,
    });
  }

  // ── Revenue reconciliation: Σ(price × quantity) ≈ value ────────────────────
  // The convention (item revenue vs. grand total) and tax handling live in
  // reconcileValue() — shared with the runtime EventValidator so the rule can't
  // drift between the two.
  if (!itemsTotalComputable) {
    checks.push({
      label: 'Revenue reconciles',
      status: 'skipped',
      field: 'ecommerce.value',
      detail: `Not checked — no items or an invalid item price/quantity.`,
    });
  } else if (!hasValue || !Number.isFinite(value)) {
    checks.push({
      label: 'Revenue reconciles',
      status: 'skipped',
      field: 'ecommerce.value',
      detail: `Not checked — no revenue value to reconcile against.`,
    });
  } else {
    const { reconciles, diagnosis } = reconcileValue(
      itemsTotal,
      value,
      toNumberOrZero(ecommerce.tax),
      toNumberOrZero(ecommerce.shipping)
    );
    checks.push({
      label: 'Revenue reconciles',
      status: reconciles ? 'pass' : 'warning',
      field: 'ecommerce.value',
      detail: reconciles
        ? `Items total ${itemsTotal.toFixed(2)} = ecommerce.value ${value.toFixed(2)} (Σ price × quantity).`
        : `ecommerce.value ${value.toFixed(2)} ≠ items total ${itemsTotal.toFixed(2)} (value must equal Σ price × quantity)` +
          (diagnosis ? ` — ${diagnosis}` : '.'),
    });
  }

  // ── Shipping cost ──────────────────────────────────────────────────────────
  // GA4 reads `shipping` (the cost) on purchase; we also report it on
  // add_shipping_info once a method is selected. Surfaced here so the amount is
  // visible at a glance. Absent is informational (free shipping, or no method
  // selected yet) — never an error.
  if (SHIPPING_RELEVANT_EVENTS.includes(eventName)) {
    const hasShipping = ecommerce.shipping != null && ecommerce.shipping !== '';
    const shippingNum = toNumber(ecommerce.shipping);
    if (!hasShipping) {
      checks.push({
        label: 'Shipping cost',
        status: 'skipped',
        field: 'ecommerce.shipping',
        detail: `No shipping in payload — free shipping, or a method is not selected yet.`,
      });
    } else if (!Number.isFinite(shippingNum) || shippingNum < 0) {
      checks.push({
        label: 'Shipping cost',
        status: 'warning',
        field: 'ecommerce.shipping',
        detail: `Invalid shipping "${ecommerce.shipping}".`,
      });
    } else {
      checks.push({
        label: 'Shipping cost',
        status: 'pass',
        field: 'ecommerce.shipping',
        detail: `Shipping ${shippingNum.toFixed(2)}.`,
      });
    }
  }

  // ── Shipping tier (add_shipping_info) ──────────────────────────────────────
  // GA4 recommends `shipping_tier` (the chosen method, e.g. "Ground") on
  // add_shipping_info. The amount itself is reported only at purchase, so it is
  // not checked here. `data.shipping_tier` is the Elevar-side mirror.
  if (eventName === 'dl_add_shipping_info') {
    const tier = ecommerce.shipping_tier ?? data.shipping_tier;
    if (isUnresolvedId(tier)) {
      checks.push({
        label: 'Shipping tier',
        status: 'warning',
        field: 'ecommerce.shipping_tier',
        detail: `Missing shipping_tier — GA4 recommends the chosen shipping method (e.g. "Ground").`,
      });
    } else {
      checks.push({
        label: 'Shipping tier',
        status: 'pass',
        field: 'ecommerce.shipping_tier',
        detail: `"${tier}".`,
      });
    }
  }

  // ── Payment type (add_payment_info) ────────────────────────────────────────
  if (eventName === 'dl_add_payment_info') {
    const paymentType = ecommerce.payment_type ?? data.payment_type;
    if (isUnresolvedId(paymentType)) {
      checks.push({
        label: 'Payment type',
        status: 'warning',
        field: 'ecommerce.payment_type',
        detail: `Missing payment_type — GA4 recommends the chosen payment method (e.g. "Credit Card").`,
      });
    } else {
      checks.push({
        label: 'Payment type',
        status: 'pass',
        field: 'ecommerce.payment_type',
        detail: `"${paymentType}".`,
      });
    }
  }

  // ── Upsell metadata checks ─────────────────────────────────────────────────
  const meta = data.upsell_metadata;
  if (meta && typeof meta === 'object') {
    if (isUnresolvedId(meta.package_id) || String(meta.package_id) === '0') {
      checks.push({
        label: 'Upsell package ID resolved',
        status: 'error',
        field: 'upsell_metadata.package_id',
        detail: `Unresolved package_id "${meta.package_id}".`,
      });
    } else {
      checks.push({
        label: 'Upsell package ID resolved',
        status: 'pass',
        field: 'upsell_metadata.package_id',
        detail: `package_id "${meta.package_id}".`,
      });
    }

    if (looksUnresolvedName(meta.package_name)) {
      checks.push({
        label: 'Upsell package name resolved',
        status: 'error',
        field: 'upsell_metadata.package_name',
        detail: `Unresolved package_name "${meta.package_name}".`,
      });
    } else {
      checks.push({
        label: 'Upsell package name resolved',
        status: 'pass',
        field: 'upsell_metadata.package_name',
        detail: `package_name "${meta.package_name}".`,
      });
    }
  }

  return checks;
}

/**
 * True when this event is a dataLayer event we validate — i.e. its `event` name
 * starts with `dl_`. GTM-internal pushes (`gtm.js`, `gtm.dom`) and nameless
 * pushes carry no contract worth checking and are skipped.
 */
export function isDataLayerEvent(data: any): boolean {
  return (
    Boolean(data) &&
    typeof data === 'object' &&
    typeof data.event === 'string' &&
    data.event.startsWith('dl_')
  );
}

/**
 * Run the full validation checklist for any `dl_` dataLayer event. Every `dl_`
 * event gets the generic dataLayer checks (event name, event_id for delivery
 * correlation); events that also carry an `ecommerce` payload get the richer
 * ecommerce checks layered on top. Returns an empty array for non-`dl_` events
 * (GTM internals, DOM/performance/SDK-internal timeline entries).
 */
export function auditDataLayerEvent(data: any): EventCheck[] {
  if (!isDataLayerEvent(data)) return [];

  const checks: EventCheck[] = [];
  const eventName = String(data.event);

  // ── Event name ─────────────────────────────────────────────────────────────
  checks.push({
    label: 'Event name',
    status: 'pass',
    field: 'event',
    detail: `"${eventName}".`,
  });

  // ── Event ID (delivery correlation) ─────────────────────────────────────────
  if (isUnresolvedId(data.event_id)) {
    checks.push({
      label: 'Event ID',
      status: 'warning',
      field: 'event_id',
      detail: `Missing event_id — this event cannot be matched to a provider delivery record.`,
    });
  } else {
    checks.push({
      label: 'Event ID',
      status: 'pass',
      field: 'event_id',
      detail: `"${data.event_id}" — used to correlate provider delivery.`,
    });
  }

  // ── Ecommerce checks, when this event carries a payload ──────────────────────
  checks.push(...auditEcommerceEvent(data));

  return checks;
}

/** Failing topics (errors + warnings) from a checklist, as issues. */
function checksToIssues(checks: EventCheck[]): EventValidationIssue[] {
  return checks
    .filter(
      (c): c is EventCheck & { status: 'error' | 'warning' } =>
        c.status === 'error' || c.status === 'warning'
    )
    .map(c => ({ level: c.status, field: c.field, message: c.detail }));
}

/**
 * Validate a single ecommerce dataLayer event payload.
 * Returns only the failing topics (the issues-only view of the checklist) —
 * an empty array for healthy events or non-ecommerce events.
 */
export function validateEcommerceEvent(data: any): EventValidationIssue[] {
  return checksToIssues(auditEcommerceEvent(data));
}

/**
 * Validate any `dl_` dataLayer event (generic + ecommerce checks).
 * Returns only the failing topics — an empty array for a clean or non-`dl_` event.
 */
export function validateDataLayerEvent(data: any): EventValidationIssue[] {
  return checksToIssues(auditDataLayerEvent(data));
}

/** Highest severity present in a set of issues, or null when clean. */
export function worstLevel(
  issues: EventValidationIssue[]
): 'error' | 'warning' | null {
  if (issues.some(i => i.level === 'error')) return 'error';
  if (issues.length > 0) return 'warning';
  return null;
}
