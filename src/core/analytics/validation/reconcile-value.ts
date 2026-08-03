/**
 * Revenue reconciliation — single source of truth.
 *
 * Verifies that `ecommerce.value` follows the GA4 rule, shared by the runtime
 * EventValidator and the debug EcommerceEventValidator so it can never drift.
 *
 * GA4 spec (recommended events, online sales) is unambiguous and applies to
 * EVERY event, purchase included:
 *
 *   "Set `value` to the sum of `(price * quantity)` for all items in `items`.
 *    Don't include `shipping` or `tax`."
 *
 * So the rule is simply: value === Σ(item.price × item.quantity). `tax` and
 * `shipping` are reported in their own fields and are NEVER part of `value`.
 *
 * When reconciliation fails, we diagnose the most common cause — a `value` that
 * wrongly folds in shipping and/or tax (the grand-total mistake) — so the fix is
 * obvious rather than just "numbers don't match".
 */

/** Absolute floor for the tolerance, in currency units. */
export const RECONCILE_TOLERANCE_ABS = 0.01;
/** Relative tolerance, so large orders aren't flagged for sub-cent rounding. */
export const RECONCILE_TOLERANCE_REL = 0.005; // 0.5%

export interface ReconcileResult {
  /** True when Σ(price × quantity) equals `value` within tolerance. */
  reconciles: boolean;
  /** Gap between itemsTotal and value — 0 when they match exactly. */
  diff: number;
  /** Tolerance the gap was compared against (absolute currency units). */
  tolerance: number;
  /** What `value` should be: the items total. */
  expected: string;
  /**
   * When it fails, the likely cause in plain language (e.g. "value includes
   * shipping"). Undefined when it reconciles or the gap is unexplained.
   */
  diagnosis?: string;
}

/**
 * Reconcile an items total against `ecommerce.value`.
 *
 * @param itemsTotal Σ(item.price × item.quantity), computed by the caller.
 * @param value      The numeric `ecommerce.value` (assumed finite).
 * @param tax        `ecommerce.tax` as a number (0 when absent) — used only to
 *                   diagnose a wrongly-inflated value, never to accept one.
 * @param shipping   `ecommerce.shipping` as a number (0 when absent) — same.
 */
export function reconcileValue(
  itemsTotal: number,
  value: number,
  tax = 0,
  shipping = 0
): ReconcileResult {
  const tolerance = Math.max(
    RECONCILE_TOLERANCE_ABS,
    Math.abs(value) * RECONCILE_TOLERANCE_REL
  );
  const diff = Math.abs(itemsTotal - value);
  const reconciles = diff <= tolerance;
  const expected = itemsTotal.toFixed(2);

  let diagnosis: string | undefined;
  if (!reconciles) {
    const near = (target: number) => Math.abs(itemsTotal - target) <= tolerance;
    // Does the gap match a value that wrongly includes shipping and/or tax?
    if (tax && shipping && near(value - tax - shipping)) {
      diagnosis = `value includes tax (${tax.toFixed(2)}) and shipping (${shipping.toFixed(
        2
      )}). GA4 value must be item revenue only — report tax and shipping in their own fields.`;
    } else if (shipping && near(value - shipping)) {
      diagnosis = `value includes shipping (${shipping.toFixed(
        2
      )}). GA4 value must be item revenue only — report shipping in the \`shipping\` field.`;
    } else if (tax && near(value - tax)) {
      diagnosis = `value includes tax (${tax.toFixed(
        2
      )}). GA4 value must be item revenue only — report tax in the \`tax\` field.`;
    }
  }

  return { reconciles, diff, tolerance, expected, diagnosis };
}
