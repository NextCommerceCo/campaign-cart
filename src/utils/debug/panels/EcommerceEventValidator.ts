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
 *
 * This module is intentionally free of DOM/store access so it can be unit
 * tested and reused outside the debug overlay.
 */

export interface EventValidationIssue {
  level: 'error' | 'warning';
  /** Dot-path of the offending field, e.g. `ecommerce.items[0].item_id`. */
  field: string;
  message: string;
}

/** Absolute floor for the reconciliation tolerance, in currency units. */
const RECONCILE_TOLERANCE_ABS = 0.01;
/** Relative tolerance, so large orders aren't flagged for sub-cent rounding. */
const RECONCILE_TOLERANCE_REL = 0.005; // 0.5%

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
  return value == null || UNRESOLVED_TOKENS.includes(String(value).trim().toLowerCase());
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
  const isDlEvent = typeof data.event === 'string' && data.event.startsWith('dl_');
  return Boolean(hasEcommerce && isDlEvent);
}

/**
 * Validate a single ecommerce dataLayer event payload.
 * Returns an empty array for healthy events or non-ecommerce events.
 */
export function validateEcommerceEvent(data: any): EventValidationIssue[] {
  if (!isEcommerceEvent(data)) return [];

  const issues: EventValidationIssue[] = [];
  const ecommerce = data.ecommerce ?? {};
  const eventName = String(data.event);
  const isPurchase = PURCHASE_EVENTS.includes(eventName);
  const items: any[] = Array.isArray(ecommerce.items) ? ecommerce.items : [];

  // ── Transaction-level checks ──────────────────────────────────────────────
  if (isPurchase && isUnresolvedId(ecommerce.transaction_id)) {
    issues.push({
      level: 'error',
      field: 'ecommerce.transaction_id',
      message:
        `Missing transaction_id on ${eventName} — GA4 cannot de-duplicate the ` +
        `purchase, so revenue may be double-counted.`,
    });
  }

  if (isUnresolvedId(ecommerce.currency)) {
    issues.push({
      level: 'warning',
      field: 'ecommerce.currency',
      message: `Missing currency "${ecommerce.currency}" — some platforms reject the event.`,
    });
  }

  if (items.length === 0 && !ITEMS_OPTIONAL_EVENTS.includes(eventName)) {
    issues.push({
      level: 'warning',
      field: 'ecommerce.items',
      message: `No items in the ecommerce payload for ${eventName}.`,
    });
  }

  // ── Item-level checks ─────────────────────────────────────────────────────
  let itemsTotal = 0;
  let itemsTotalComputable = items.length > 0;

  items.forEach((item, i) => {
    const base = `ecommerce.items[${i}]`;

    if (isUnresolvedId(item?.item_id)) {
      issues.push({
        level: 'error',
        field: `${base}.item_id`,
        message: `Unresolved item_id "${item?.item_id}" — the package was not resolved.`,
      });
    }

    if (looksUnresolvedName(item?.item_name)) {
      issues.push({
        level: 'error',
        field: `${base}.item_name`,
        message: `Unresolved item_name "${item?.item_name}" — the package was not resolved.`,
      });
    }

    const price = toNumber(item?.price);
    const quantity = toNumber(item?.quantity);

    if (!Number.isFinite(price) || price < 0) {
      issues.push({
        level: 'warning',
        field: `${base}.price`,
        message: `Invalid price "${item?.price}".`,
      });
      itemsTotalComputable = false;
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      issues.push({
        level: 'warning',
        field: `${base}.quantity`,
        message: `Invalid quantity "${item?.quantity}" (expected ≥ 1).`,
      });
      itemsTotalComputable = false;
    }

    if (Number.isFinite(price) && Number.isFinite(quantity)) {
      itemsTotal += price * quantity;
    }
  });

  // ── Value sanity ──────────────────────────────────────────────────────────
  const value = toNumber(ecommerce.value);
  const hasValue = ecommerce.value != null && ecommerce.value !== '';
  if (hasValue && (!Number.isFinite(value) || value < 0)) {
    issues.push({
      level: 'warning',
      field: 'ecommerce.value',
      message: `Invalid ecommerce.value "${ecommerce.value}".`,
    });
  } else if (isPurchase && !hasValue) {
    issues.push({
      level: 'error',
      field: 'ecommerce.value',
      message: `Missing ecommerce.value on ${eventName} — no revenue is reported.`,
    });
  }

  // ── Revenue reconciliation: Σ(price × quantity) ≈ value ───────────────────
  // `value` follows one of two conventions depending on the event: item revenue
  // only (add_to_cart, view_cart) or the full order total incl. tax + shipping
  // (purchase). Accept whichever the event used by reconciling against both
  // `value` and `value − tax − shipping`, so neither convention false-flags.
  if (itemsTotalComputable && hasValue && Number.isFinite(value)) {
    const tax = toNumberOrZero(ecommerce.tax);
    const shipping = toNumberOrZero(ecommerce.shipping);
    const netValue = value - tax - shipping;
    const diff = Math.min(
      Math.abs(itemsTotal - value),
      Math.abs(itemsTotal - netValue)
    );
    const tolerance = Math.max(
      RECONCILE_TOLERANCE_ABS,
      Math.abs(value) * RECONCILE_TOLERANCE_REL
    );
    if (diff > tolerance) {
      const expected =
        tax || shipping
          ? `${value.toFixed(2)} (or ${netValue.toFixed(2)} net of tax/shipping)`
          : value.toFixed(2);
      issues.push({
        level: 'warning',
        field: 'ecommerce.value',
        message:
          `Items total ${itemsTotal.toFixed(2)} ≠ ecommerce.value ${expected} ` +
          `— item price × quantity does not reconcile to revenue.`,
      });
    }
  }

  // ── Upsell metadata checks ────────────────────────────────────────────────
  const meta = data.upsell_metadata;
  if (meta && typeof meta === 'object') {
    if (isUnresolvedId(meta.package_id) || String(meta.package_id) === '0') {
      issues.push({
        level: 'error',
        field: 'upsell_metadata.package_id',
        message: `Unresolved package_id "${meta.package_id}".`,
      });
    }
    if (looksUnresolvedName(meta.package_name)) {
      issues.push({
        level: 'error',
        field: 'upsell_metadata.package_name',
        message: `Unresolved package_name "${meta.package_name}".`,
      });
    }
  }

  return issues;
}

/** Highest severity present in a set of issues, or null when clean. */
export function worstLevel(issues: EventValidationIssue[]): 'error' | 'warning' | null {
  if (issues.some(i => i.level === 'error')) return 'error';
  if (issues.length > 0) return 'warning';
  return null;
}
