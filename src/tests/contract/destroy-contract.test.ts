import { describe, it, expect } from 'vitest';
import ts from 'typescript';

/**
 * `CLAUDE.md` and the `sdk-structure` skill both state a rule: "Call `super.destroy()`
 * first when overriding `destroy()`." Nothing enforced it, and that is how
 * `UpsellEnhancer.destroy()` shipped clearing `this.state.actionButtons` — the array
 * `cleanupEventListeners` iterates — *before* calling `super.destroy()`, which is what
 * invokes that cleanup. The array was already empty by the time it ran, so the click
 * listener was never removed. See finding 98 in `docs/code-findings.md`.
 *
 * This test finds every class in `src/` that extends one of the four base enhancers
 * and declares its own `destroy()`, then asserts the method's first statement is
 * `super.destroy();`. Comments and blank lines before it are fine — those do not
 * appear as statements in the AST — but any other statement (a guard clause, a
 * cleanup call, a field write) ahead of `super.destroy()` fails.
 *
 * Scanning is by `extends Base\w*Enhancer`, not by filename: several DOM-activated
 * classes live outside `*.enhancer.ts` (e.g. `CartDisplayEnhancer` in
 * `cart-summary.display.ts`), so a filename-based scan would miss them.
 *
 * This is a ratchet, not a red test: 18 of the 22 classes found today violate the
 * rule (see ALLOWLIST below), each with a one-line reason. It fails on any violation
 * that is *not* already named there, so no new violator can land silently, and the
 * list is meant to shrink as each entry gets fixed — never to grow.
 */

// Eager + raw so every source file's text is available synchronously for the
// TypeScript compiler to parse. Same pattern as src/tests/docs/sourceReferences.test.ts.
const modules = import.meta.glob<string>('../../**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const BASE_ENHANCER_NAMES = new Set([
  'BaseEnhancer',
  'BaseCartEnhancer',
  'BaseActionEnhancer',
  'BaseDisplayEnhancer',
]);

interface DestroyOverride {
  /** Path relative to `src/`, e.g. `features/order/upsell/upsell.enhancer.ts`. */
  file: string;
  className: string;
  /** True when the first statement is exactly `super.destroy();`. */
  compliant: boolean;
  /** Source text of the first statement, for failure messages. Empty when the body has none. */
  firstStatement: string;
}

/**
 * Every class in `src/` (excluding test files) that extends one of the base
 * enhancers and overrides `destroy()`, with whether its first statement calls
 * `super.destroy()`.
 */
function findDestroyOverrides(): DestroyOverride[] {
  const found: DestroyOverride[] = [];

  for (const [path, text] of Object.entries(modules)) {
    // import.meta.glob keys are relative to this file (src/tests/contract/).
    if (path.endsWith('.test.ts') || path.endsWith('.d.ts')) continue;
    if (path.includes('/tests/')) continue;

    // Path relative to src/, for stable identifiers in the allowlist and messages.
    const file = path.replace(/^\.\.\/\.\.\//, '');

    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

    ts.forEachChild(sf, node => {
      if (!ts.isClassDeclaration(node) || !node.name) return;

      const extendsClause = node.heritageClauses?.find(
        h => h.token === ts.SyntaxKind.ExtendsKeyword
      );
      const superExpr = extendsClause?.types[0]?.expression;
      if (
        !superExpr ||
        !ts.isIdentifier(superExpr) ||
        !BASE_ENHANCER_NAMES.has(superExpr.text)
      ) {
        return;
      }

      const destroyMethod = node.members.find(
        (m): m is ts.MethodDeclaration =>
          ts.isMethodDeclaration(m) &&
          ts.isIdentifier(m.name) &&
          m.name.text === 'destroy'
      );
      if (!destroyMethod?.body) return;

      const statements = destroyMethod.body.statements;
      const first = statements[0];

      const isSuperDestroyCall =
        first !== undefined &&
        ts.isExpressionStatement(first) &&
        ts.isCallExpression(first.expression) &&
        ts.isPropertyAccessExpression(first.expression.expression) &&
        first.expression.expression.expression.kind ===
          ts.SyntaxKind.SuperKeyword &&
        first.expression.expression.name.text === 'destroy';

      found.push({
        file,
        className: node.name.text,
        compliant: isSuperDestroyCall,
        firstStatement: first
          ? first.getText(sf).replace(/\s+/g, ' ').trim()
          : '',
      });
    });
  }

  return found;
}

/**
 * Known violations of the rule, frozen the way `docs-coverage.baseline.json`
 * freezes known documentation gaps: recorded and tolerated, rather than invisible.
 * Each entry needs a reason. Remove an entry once its `destroy()` is fixed to call
 * `super.destroy()` first — the test then requires the fix to stay, since a
 * regression is no longer in this list.
 */
const ALLOWLIST: { file: string; className: string; reason: string }[] = [
  {
    file: 'features/behavior/fomo-popup/fomo-popup.enhancer.ts',
    className: 'FomoPopupEnhancer',
    reason:
      'Calls this.cleanupEventListeners() manually before super.destroy(), which ' +
      'calls it again — same listener removal runs twice.',
  },
  {
    file: 'features/behavior/simple-exit-intent/simple-exit-intent.enhancer.ts',
    className: 'ExitIntentEnhancer',
    reason:
      'Calls this.cleanupEventListeners() manually before super.destroy(), which ' +
      'calls it again — same listener removal runs twice.',
  },
  {
    file: 'features/cart/accept-upsell/accept-upsell.enhancer.ts',
    className: 'AcceptUpsellEnhancer',
    reason:
      'Removes its click/pageshow/eventBus listeners before super.destroy() — the ' +
      'base subscription cleanup runs after, not before, this hand-rolled teardown.',
  },
  {
    file: 'features/cart/add-to-cart/add-to-cart.enhancer.ts',
    className: 'AddToCartEnhancer',
    reason:
      'Clears propertyListenerCleanups and removes its click/eventBus listeners ' +
      'before super.destroy() runs the base cleanup.',
  },
  {
    file: 'features/cart/bundle-selector/bundle-selector.enhancer.ts',
    className: 'BundleSelectorEnhancer',
    reason:
      'First statement is BundleSelectorEnhancer._instances.delete(this); ' +
      'super.destroy() is second, and card class-list cleanup runs after that.',
  },
  {
    file: 'features/cart/coupon/coupon.enhancer.ts',
    className: 'CouponEnhancer',
    reason:
      'Logs and unsubscribes from the cart store before calling super.destroy().',
  },
  {
    file: 'features/cart/package-selector/package-selector.enhancer.ts',
    className: 'PackageSelectorEnhancer',
    reason:
      'Calls this.cleanupEventListeners() and clears this.items before ' +
      'super.destroy() runs the base cleanup.',
  },
  {
    file: 'features/cart/package-toggle/package-toggle.enhancer.ts',
    className: 'PackageToggleEnhancer',
    reason:
      'First statement is PackageToggleEnhancer._instances.delete(this); ' +
      'super.destroy() is second, and cleanupEventListeners/card cleanup runs after.',
  },
  {
    file: 'features/checkout/checkout-form/checkout-form.enhancer.ts',
    className: 'CheckoutFormEnhancer',
    reason:
      'Tears down its own timers, validator, credit-card service, prospect-cart ' +
      'enhancer and phone inputs before calling super.destroy(). Out of scope for ' +
      'this change (src/features/checkout is being edited by another session).',
  },
  {
    file: 'features/checkout/checkout-review/checkout-review.enhancer.ts',
    className: 'CheckoutReviewEnhancer',
    reason:
      'Unsubscribes from its store subscription before calling super.destroy(). ' +
      'Out of scope for this change (src/features/checkout is being edited by ' +
      'another session).',
  },
  {
    file: 'features/checkout/express-checkout-container/express-checkout-container.enhancer.ts',
    className: 'ExpressCheckoutContainerEnhancer',
    reason:
      'Calls this.clearButtons() before super.destroy(). Out of scope for this ' +
      'change (src/features/checkout is being edited by another session).',
  },
  {
    file: 'features/display/conditional-display/conditional-display.enhancer.ts',
    className: 'ConditionalDisplayEnhancer',
    reason:
      'Removes its selection-change listeners before calling super.destroy().',
  },
  {
    file: 'features/display/selection-display/selection-display.enhancer.ts',
    className: 'SelectionDisplayEnhancer',
    reason:
      'Removes its selection-change listeners before calling super.destroy().',
  },
  {
    file: 'features/display/timer/timer.enhancer.ts',
    className: 'TimerEnhancer',
    reason: 'Clears its countdown interval before calling super.destroy().',
  },
  {
    file: 'features/ui/accordion/accordion.enhancer.ts',
    className: 'AccordionEnhancer',
    reason: 'Clears this.accordions before calling super.destroy().',
  },
  {
    file: 'features/ui/scroll-hint/scroll-hint.enhancer.ts',
    className: 'ScrollHintEnhancer',
    reason:
      'Removes its scroll/resize listeners, disconnects its MutationObserver and ' +
      'cancels a pending animation frame before calling super.destroy().',
  },
  {
    file: 'features/ui/tooltip/tooltip.enhancer.ts',
    className: 'TooltipEnhancer',
    reason:
      'Calls this.hide() and clears its timers before calling super.destroy().',
  },
];

const allowlistKey = (file: string, className: string): string =>
  `${file}::${className}`;
const allowlistMap = new Map(
  ALLOWLIST.map(entry => [allowlistKey(entry.file, entry.className), entry])
);

describe('destroy() calls super.destroy() first', () => {
  const overrides = findDestroyOverrides();

  it('finds destroy() overrides, so an empty list cannot pass by accident', () => {
    // Without this, a glob or AST change that silently stopped matching anything
    // would turn every check below into `[] vs []` — green, and checking nothing.
    expect(overrides.length).toBeGreaterThan(10);
  });

  it('has no allowlist entries left for classes that no longer exist', () => {
    const found = new Set(
      overrides.map(o => allowlistKey(o.file, o.className))
    );
    const stale = ALLOWLIST.filter(
      e => !found.has(allowlistKey(e.file, e.className))
    );
    expect(
      stale.map(e => `${e.file} › ${e.className}`),
      'allowlisted but no longer found overriding destroy() — remove the entry ' +
        '(class renamed, moved, or no longer overrides destroy())'
    ).toEqual([]);
  });

  it('calls super.destroy() as the first statement, unless allowlisted', () => {
    const violations = overrides.filter(
      o => !o.compliant && !allowlistMap.has(allowlistKey(o.file, o.className))
    );

    const messages = violations.map(
      o =>
        `${o.file} › ${o.className}.destroy() — first statement is ` +
        `\`${o.firstStatement || '(empty body)'}\`, not \`super.destroy();\``
    );

    expect(
      messages,
      'destroy() must call super.destroy() as its first statement (see ' +
        '.claude/rules/typescript.md and CLAUDE.md). If this is a newly discovered, ' +
        'pre-existing violation rather than a regression, add it to ALLOWLIST in ' +
        'this file with a one-line reason instead of fixing it here.'
    ).toEqual([]);
  });
});
