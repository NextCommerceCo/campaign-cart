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
 *
 * Context shapes and builders (`ItemContext`, `DiscountContext`, `LocalContext`,
 * `buildItemContext`, `buildDiscountContext`) live in
 * `./cart-summary.condition-context` and are re-exported here so existing
 * imports of this module keep working unchanged.
 */

import { AttributeParser } from '@/core/base/attribute-parser';
import type { LocalContext } from './cart-summary.condition-context';

export {
  buildItemContext,
  buildDiscountContext,
} from './cart-summary.condition-context';
export type {
  ItemContext,
  DiscountContext,
  LocalContext,
} from './cart-summary.condition-context';

const KNOWN_NAMESPACES = new Set(['item', 'line', 'discount']);

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
  if (object === 'line' && !ctx.line) return false;
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
