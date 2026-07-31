/**
 * Voucher/coupon codes are matched case- and whitespace-insensitively
 * everywhere in the SDK: `applyCoupon` stores `code.toUpperCase().trim()`, so
 * every later comparison against a stored code — dedup on apply, lookup on
 * remove — must run both sides through this same function or a code applied
 * as `'save10'` and removed as `'save10'` (or `'SAVE10'`, or `' Save10 '`)
 * silently fails to match.
 */
export function normalizeVoucherCode(code: string): string {
  return code.toUpperCase().trim();
}
