/**
 * Tax basis detection for purchase / upsell analytics.
 *
 * GA4 item `price` (and therefore `value`) must match the price the customer
 * actually saw in the funnel — the campaign's *displayed* price. Whether that
 * displayed price includes tax depends on the store's tax model:
 *
 *   - Tax-exclusive (US-style): displayed price excludes tax; tax is added at
 *     checkout → use the order line's `price_excl_tax`.
 *   - Tax-inclusive (VAT): displayed price already includes tax → use
 *     `price_incl_tax`.
 *
 * The model isn't carried as a flag, but every order line exposes its
 * PRE-discount prices (`price_*_tax_excl_discounts`). Those line up exactly with
 * the catalog price the customer saw, so matching them against the campaign
 * package price tells us which basis is the displayed one — deterministically,
 * and unaffected by discounts. Falls back to `'excl'` (the common default) when
 * there is no tax or no confident match.
 *
 * Pure — takes the order and packages as arguments, no store/DOM access.
 */

export type TaxBasis = 'incl' | 'excl';

/** Match tolerance in currency units (covers rounding / minor catalog drift). */
const MATCH_EPS = 0.02;

function num(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  return NaN;
}

interface TaxBasisLine {
  package?: number | string;
  quantity?: number | string;
  price_incl_tax_excl_discounts?: string | number;
  price_excl_tax_excl_discounts?: string | number;
}

interface TaxBasisPackage {
  ref_id?: number | string;
  price?: string | number;
}

/**
 * Determine whether an order's displayed prices include tax.
 *
 * @param order    The order (or `{ lines }`) being reported.
 * @param packages Campaign packages, used to read the displayed catalog price.
 * @returns `'incl'` when displayed prices include tax, else `'excl'`.
 */
export function resolveOrderTaxBasis(
  order: { lines?: TaxBasisLine[] } | null | undefined,
  packages: TaxBasisPackage[] = []
): TaxBasis {
  const lines = Array.isArray(order?.lines) ? order!.lines! : [];

  for (const line of lines) {
    const pkg = packages.find(p => String(p.ref_id) === String(line.package));
    const catalogUnit = num(pkg?.price);
    if (!Number.isFinite(catalogUnit) || catalogUnit <= 0) continue;

    const qty = parseInt(String(line.quantity ?? 1), 10) || 1;
    const inclUnit = num(line.price_incl_tax_excl_discounts) / qty;
    const exclUnit = num(line.price_excl_tax_excl_discounts) / qty;
    if (!Number.isFinite(inclUnit) || !Number.isFinite(exclUnit)) continue;

    // No tax on this line — incl == excl, so it tells us nothing. Skip.
    if (Math.abs(inclUnit - exclUnit) <= MATCH_EPS) continue;

    const inclGap = Math.abs(inclUnit - catalogUnit);
    const exclGap = Math.abs(exclUnit - catalogUnit);
    return inclGap < exclGap ? 'incl' : 'excl';
  }

  // No tax anywhere, or no line could be matched to a catalog price.
  return 'excl';
}
