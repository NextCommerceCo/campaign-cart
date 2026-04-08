/**
 * Local condition evaluator for CartSummary line and discount templates.
 *
 * Supports `data-next-show` and `data-next-hide` attributes inside per-line and
 * per-discount templates. Conditions are evaluated synchronously at render time
 * against the same SummaryLine / DiscountItem data used by the token replacer.
 *
 * Reuses `AttributeParser.parseCondition` for AST parsing — only the evaluator
 * is local. Conditions referencing namespaces outside `item.*` / `discount.*`
 * are passed through untouched so the global ConditionalDisplayEnhancer can
 * still handle them.
 */

import { AttributeParser } from '@/enhancers/base/AttributeParser';
import type { SummaryLine } from '@/types/api';
import type { DiscountItem } from './CartSummaryEnhancer.types';

// Local copy of computeFrequency to avoid a circular import with the renderer.
// Kept in sync with CartSummaryEnhancer.renderer.ts.
function computeFrequency(
  interval: 'day' | 'month' | null | undefined,
  count: number | null | undefined
): string {
  if (!interval) return '';
  const n = count ?? 1;
  if (interval === 'day') return n === 1 ? 'Daily' : `Every ${n} days`;
  if (interval === 'month') return n === 1 ? 'Monthly' : `Every ${n} months`;
  return '';
}

// ─── Context shapes ──────────────────────────────────────────────────────────

export interface ItemContext {
  packageId: number;
  name: string;
  image: string;
  quantity: number;
  productName: string;
  variantName: string;
  sku: string;
  isRecurring: boolean;
  interval: 'day' | 'month' | null;
  intervalCount: number | null;
  recurringPrice: number | null;
  originalRecurringPrice: number | null;
  price: number;
  originalPrice: number;
  unitPrice: number;
  originalUnitPrice: number;
  discountAmount: number;
  discountPercentage: number;
  hasDiscount: boolean;
  currency: string;
  frequency: string;
}

export interface DiscountContext {
  name: string;
  amount: number;
  amountFormatted: string;
  description: string;
}

export interface LocalContext {
  item?: ItemContext;
  discount?: DiscountContext;
}

const KNOWN_NAMESPACES = new Set(['item', 'discount']);

// ─── Context builders ────────────────────────────────────────────────────────

function num(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function nullableNum(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export function buildItemContext(line: SummaryLine): ItemContext {
  const unitPrice = num(line.unit_price);
  const originalUnitPrice = num(line.original_unit_price);
  const discountAmount = num(line.total_discount);
  const discountPercentage =
    originalUnitPrice > 0 && originalUnitPrice > unitPrice
      ? Math.round(((originalUnitPrice - unitPrice) / originalUnitPrice) * 100)
      : 0;

  return {
    packageId: line.package_id,
    name: line.name ?? '',
    image: line.image ?? '',
    quantity: line.quantity,
    productName: line.product_name ?? '',
    variantName: line.product_variant_name ?? '',
    sku: line.product_sku ?? '',
    isRecurring: line.is_recurring === true,
    interval: line.interval ?? null,
    intervalCount: line.interval_count ?? null,
    recurringPrice: nullableNum(line.price_recurring),
    originalRecurringPrice: nullableNum(line.original_recurring_price),
    price: num(line.package_price),
    originalPrice: num(line.original_package_price),
    unitPrice,
    originalUnitPrice,
    discountAmount,
    discountPercentage,
    hasDiscount: discountAmount > 0,
    currency: line.currency ?? '',
    frequency: computeFrequency(line.interval, line.interval_count),
  };
}

export function buildDiscountContext(d: DiscountItem): DiscountContext {
  // The renderer always passes a formatted amount string. Strip any non-numeric
  // characters (currency symbols, separators) to recover a comparable number.
  const amountFormatted = d.amount ?? '';
  const stripped = amountFormatted.replace(/[^0-9.\-]/g, '');
  const amount = stripped ? parseFloat(stripped) : 0;
  return {
    name: d.name ?? '',
    amount: Number.isFinite(amount) ? amount : 0,
    amountFormatted,
    description: d.description ?? '',
  };
}

// ─── Evaluator ───────────────────────────────────────────────────────────────

type EvalResult = { handled: true; visible: boolean } | { handled: false };

/**
 * Recursive evaluator over the AST returned by AttributeParser.parseCondition.
 *
 * Returns `{ handled: false }` when the condition references a namespace that
 * is not present in `ctx` (e.g. `cart.hasItems` inside a line template). The
 * caller is expected to leave the attribute alone in that case so the global
 * ConditionalDisplayEnhancer can still process it.
 */
export function evaluateLocalCondition(
  parsed: unknown,
  ctx: LocalContext
): EvalResult {
  if (!parsed || typeof parsed !== 'object') {
    return { handled: false };
  }
  const node = parsed as { type?: string; [k: string]: any };

  switch (node.type) {
    case 'logical': {
      const op = node.operator as '&&' | '||';
      const subs: unknown[] = Array.isArray(node.conditions)
        ? node.conditions
        : [];
      let acc = op === '&&';
      for (const sub of subs) {
        const r = evaluateLocalCondition(sub, ctx);
        if (!r.handled) return { handled: false };
        if (op === '&&') {
          acc = acc && r.visible;
          if (!acc) break;
        } else {
          acc = acc || r.visible;
          if (acc) break;
        }
      }
      return { handled: true, visible: acc };
    }

    case 'not': {
      const r = evaluateLocalCondition(node.condition, ctx);
      if (!r.handled) return { handled: false };
      return { handled: true, visible: !r.visible };
    }

    case 'comparison': {
      const left = node.left as { object: string; property: string };
      if (!isLocallyResolvable(left.object, ctx)) {
        return { handled: false };
      }
      const leftVal = resolveContextValue(left.object, left.property, ctx);
      const rightVal = node.right;
      return {
        handled: true,
        visible: compare(leftVal, node.operator, rightVal),
      };
    }

    case 'property': {
      const object = node.object as string;
      const property = node.property as string;
      if (!isLocallyResolvable(object, ctx)) {
        return { handled: false };
      }
      const value = resolveContextValue(object, property, ctx);
      return { handled: true, visible: Boolean(value) };
    }

    case 'function':
    default:
      return { handled: false };
  }
}

function isLocallyResolvable(object: string, ctx: LocalContext): boolean {
  if (!KNOWN_NAMESPACES.has(object)) return false;
  if (object === 'item' && !ctx.item) return false;
  if (object === 'discount' && !ctx.discount) return false;
  return true;
}

function resolveContextValue(
  object: string,
  property: string,
  ctx: LocalContext
): unknown {
  const root = (ctx as Record<string, unknown>)[object];
  if (!root || typeof root !== 'object') return undefined;
  // Properties on ItemContext / DiscountContext are flat — single-level lookup.
  return (root as Record<string, unknown>)[property];
}

function compare(left: unknown, operator: string, right: unknown): boolean {
  switch (operator) {
    case '>':
      return Number(left) > Number(right);
    case '>=':
      return Number(left) >= Number(right);
    case '<':
      return Number(left) < Number(right);
    case '<=':
      return Number(left) <= Number(right);
    case '==':
    case '===':
      return looseEqual(left, right);
    case '!=':
    case '!==':
      return !looseEqual(left, right);
    default:
      return false;
  }
}

function looseEqual(left: unknown, right: unknown): boolean {
  if (typeof left === 'number' || typeof right === 'number') {
    return Number(left) === Number(right);
  }
  if (typeof left === 'boolean' || typeof right === 'boolean') {
    // Coerce 'true'/'false' strings to booleans for symmetry.
    const lb = typeof left === 'string' ? left === 'true' : Boolean(left);
    const rb = typeof right === 'string' ? right === 'true' : Boolean(right);
    return lb === rb;
  }
  return String(left ?? '') === String(right ?? '');
}

// ─── DOM application ─────────────────────────────────────────────────────────

const CONDITION_SELECTOR = '[data-next-show], [data-next-hide]';

/**
 * Walks `rootEl` (and its descendants, excluding inert <template> content) for
 * elements bearing `data-next-show` / `data-next-hide`, evaluates each against
 * `ctx`, removes hidden descendants, and strips the attribute on processed
 * elements so the global DOMObserver does not double-handle them.
 *
 * Elements with conditions referencing unknown namespaces are left alone — the
 * global ConditionalDisplayEnhancer flow handles them.
 *
 * Invalid expressions are caught: the element is left visible and a warning
 * is forwarded via the optional `warn` callback.
 *
 * Returns `false` if the *root* element itself was determined to be hidden by
 * a local condition (in which case the caller should not append it to its
 * intended parent). Returns `true` otherwise.
 */
export function applyLocalConditions(
  rootEl: Element,
  ctx: LocalContext,
  warn?: (msg: string) => void
): boolean {
  // Process descendants first. querySelectorAll does not descend into
  // <template> content (it lives in a separate DocumentFragment), so per-line
  // discount templates are naturally skipped.
  for (const el of Array.from(rootEl.querySelectorAll(CONDITION_SELECTOR))) {
    processConditionElement(el, ctx, warn);
  }

  // Then evaluate the root itself. The root has no parent at the time this is
  // called (it was just created by htmlToElement), so removeChild is a no-op
  // for the hide case — we signal via the return value instead.
  const matchesSelf =
    typeof rootEl.matches === 'function' && rootEl.matches(CONDITION_SELECTOR);
  if (!matchesSelf) return true;

  const showExpr = rootEl.getAttribute('data-next-show');
  const hideExpr = rootEl.getAttribute('data-next-hide');
  const expr = showExpr ?? hideExpr;
  if (expr == null || expr.trim() === '') {
    if (showExpr != null) rootEl.removeAttribute('data-next-show');
    if (hideExpr != null) rootEl.removeAttribute('data-next-hide');
    return true;
  }

  const result = safeEvaluate(expr, ctx, warn);
  if (result == null) return true; // parse/eval error — leave visible
  if (!result.handled) return true; // unknown namespace — leave for global flow

  const visible = showExpr != null ? result.visible : !result.visible;
  rootEl.removeAttribute('data-next-show');
  rootEl.removeAttribute('data-next-hide');
  return visible;
}

function processConditionElement(
  el: Element,
  ctx: LocalContext,
  warn?: (msg: string) => void
): void {
  const showExpr = el.getAttribute('data-next-show');
  const hideExpr = el.getAttribute('data-next-hide');
  const expr = showExpr ?? hideExpr;
  if (expr == null || expr.trim() === '') {
    if (showExpr != null) el.removeAttribute('data-next-show');
    if (hideExpr != null) el.removeAttribute('data-next-hide');
    return;
  }

  const result = safeEvaluate(expr, ctx, warn);
  if (result == null) return; // parse/eval error — leave visible
  if (!result.handled) return; // unknown namespace — leave for global flow

  const visible = showExpr != null ? result.visible : !result.visible;
  el.removeAttribute('data-next-show');
  el.removeAttribute('data-next-hide');

  if (!visible) {
    el.parentNode?.removeChild(el);
  }
}

function safeEvaluate(
  expr: string,
  ctx: LocalContext,
  warn?: (msg: string) => void
): EvalResult | null {
  try {
    const parsed = AttributeParser.parseCondition(expr);
    return evaluateLocalCondition(parsed, ctx);
  } catch (err) {
    warn?.(`Failed to evaluate condition "${expr}": ${(err as Error).message}`);
    return null;
  }
}
