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

/**
 * The gate above only ever inspects classes that *override* `destroy()` — which is
 * exactly the blind spot finding 139 fell through: `ProspectCartEnhancer` had **no**
 * `destroy()` or `cleanupEventListeners()` override at all, so it never appeared in
 * `findDestroyOverrides()`, and every listener its sibling module `triggers.ts`
 * registered (email/phone/name `blur`+`change`, plus a `focus`+`input` pair on every
 * form field in `formStart` mode) outlived the enhancer with nothing to catch it.
 *
 * **The rule this section enforces:** a class extending one of the four base
 * enhancers, whose own file or a same-folder sibling it imports registers a raw
 * `addEventListener(...)` call, must override `destroy()` or
 * `cleanupEventListeners()` — otherwise base `cleanupEventListeners()` (a no-op) is
 * the only teardown that ever runs, and the listener can never be removed.
 *
 * This does not check that the override actually removes what was registered (that
 * would require tracing which listener the override's body targets) — only that a
 * teardown path exists at all, which is the one thing a class that overrides
 * nothing cannot dodge. `this.on()` / `this.subscribe()` calls are out of scope
 * here: those are auto-cleaned by base `destroy()` already (finding 103), so a raw
 * `addEventListener` reachable from the class is the only shape this needs to catch.
 *
 * Scoped to `.addEventListener(` (not `eventBus.on(`/`this.on(`) because the DOM
 * listener path is the one with no built-in cleanup — see `BaseEnhancer.on()`'s own
 * doc comment for why event-bus listeners already record their unsubscribe.
 *
 * This is a ratchet, like the allowlist above: it fails today on more than
 * `ProspectCartEnhancer` (see NO_TEARDOWN_ALLOWLIST below), each with a reason. Fix
 * finding 139 shrinks it by one; the other entries are separate decisions for
 * whoever owns that file, not something this change makes for them.
 */
describe('a class that registers a raw addEventListener has a teardown path', () => {
  interface ListenerRegisteringClass {
    file: string;
    className: string;
    /** True when the class itself overrides `destroy()` or `cleanupEventListeners()`. */
    hasTeardown: boolean;
    /** Where the raw `addEventListener(` call was found: the class's own file, or a
     *  same-folder sibling file reached through a relative `import`. */
    listenerSource: string;
  }

  /** `import.meta.glob` keys are POSIX-style relative paths (`../../foo/bar.ts`).
   *  Resolves a relative import specifier from `fromKey` to another glob key,
   *  trying `spec.ts` then `spec/index.ts` — the two shapes this repo's relative
   *  imports use. */
  function resolveRelativeImport(
    fromKey: string,
    spec: string
  ): string | undefined {
    const fromParts = fromKey.split('/').slice(0, -1);
    const specParts = spec.split('/');
    const parts = [...fromParts];
    for (const part of specParts) {
      if (part === '.' || part === '') continue;
      if (part === '..') parts.pop();
      else parts.push(part);
    }
    const joined = parts.join('/');
    return [`${joined}.ts`, `${joined}/index.ts`].find(k => k in modules);
  }

  const RAW_LISTENER = /\.addEventListener\(/;

  function findListenerRegisteringClasses(): ListenerRegisteringClass[] {
    const found: ListenerRegisteringClass[] = [];

    for (const [path, text] of Object.entries(modules)) {
      if (path.endsWith('.test.ts') || path.endsWith('.d.ts')) continue;
      if (path.includes('/tests/')) continue;

      const file = path.replace(/^\.\.\/\.\.\//, '');
      const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

      const relativeImportSpecs: string[] = [];
      sf.forEachChild(node => {
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          node.moduleSpecifier.text.startsWith('.')
        ) {
          relativeImportSpecs.push(node.moduleSpecifier.text);
        }
      });

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

        const hasTeardown = node.members.some(
          m =>
            ts.isMethodDeclaration(m) &&
            ts.isIdentifier(m.name) &&
            (m.name.text === 'destroy' ||
              m.name.text === 'cleanupEventListeners')
        );

        let listenerSource: string | undefined;
        if (RAW_LISTENER.test(text)) {
          listenerSource = file;
        } else {
          for (const spec of relativeImportSpecs) {
            const resolved = resolveRelativeImport(path, spec);
            if (!resolved || resolved === path) continue;
            const siblingText = modules[resolved];
            if (siblingText && RAW_LISTENER.test(siblingText)) {
              listenerSource = resolved.replace(/^\.\.\/\.\.\//, '');
              break;
            }
          }
        }

        if (!listenerSource) return;

        found.push({
          file,
          className: node.name.text,
          hasTeardown,
          listenerSource,
        });
      });
    }

    return found;
  }

  /**
   * Known violations, frozen the same way the ALLOWLIST above and
   * `docs-coverage.baseline.json` freeze known gaps: recorded and tolerated rather
   * than invisible, each with a reason.
   *
   * **It is empty, and that is the point** — every class that reaches a raw
   * `addEventListener` now has a teardown path, so this check is a plain red gate
   * rather than a ratchet. The last two entries were `BaseDisplayEnhancer` and
   * `ProductDisplayEnhancer` (finding 149), which between them leaked one permanent
   * `document` listener per `data-next-display` element on the page; both now register
   * through `BaseDisplayEnhancer.listen()` and are aborted by its
   * `cleanupEventListeners()`. Nothing may be added back here without the same
   * scrutiny: an entry is a leak someone chose to keep.
   */
  const NO_TEARDOWN_ALLOWLIST: {
    file: string;
    className: string;
    reason: string;
  }[] = [];

  const noTeardownKey = (file: string, className: string): string =>
    `${file}::${className}`;
  const noTeardownMap = new Map(
    NO_TEARDOWN_ALLOWLIST.map(e => [noTeardownKey(e.file, e.className), e])
  );

  const classes = findListenerRegisteringClasses();

  it('finds classes that register a raw addEventListener, so an empty list cannot pass by accident', () => {
    expect(classes.length).toBeGreaterThan(0);
  });

  it('has no allowlist entries left for classes that no longer register a raw listener without teardown', () => {
    const found = new Set(
      classes
        .filter(c => !c.hasTeardown)
        .map(c => noTeardownKey(c.file, c.className))
    );
    const stale = NO_TEARDOWN_ALLOWLIST.filter(
      e => !found.has(noTeardownKey(e.file, e.className))
    );
    expect(
      stale.map(e => `${e.file} › ${e.className}`),
      'allowlisted but no longer a violation — remove the entry (class renamed, ' +
        'moved, gained a destroy()/cleanupEventListeners() override, or no longer ' +
        'reaches a raw addEventListener)'
    ).toEqual([]);
  });

  it('overrides destroy() or cleanupEventListeners(), unless allowlisted', () => {
    const violations = classes.filter(
      c =>
        !c.hasTeardown && !noTeardownMap.has(noTeardownKey(c.file, c.className))
    );

    const messages = violations.map(
      c =>
        `${c.file} › ${c.className} — registers a raw addEventListener via ` +
        `${c.listenerSource} but overrides neither destroy() nor ` +
        `cleanupEventListeners(), so it can never be removed`
    );

    expect(
      messages,
      'a class reaching a raw addEventListener must override destroy() or ' +
        'cleanupEventListeners() so it has somewhere to remove it. If this is a ' +
        'newly discovered, pre-existing violation rather than a regression, add it ' +
        'to NO_TEARDOWN_ALLOWLIST in this file with a one-line reason instead of ' +
        'fixing it here.'
    ).toEqual([]);
  });
});

/**
 * `BaseEnhancer.cleanupEventListeners()` is an empty no-op, so for most enhancers an
 * override that never calls `super` costs nothing. `BaseDisplayEnhancer`'s is **not**
 * a no-op — it aborts the controller that holds the `next:currency-changed` listener
 * every display enhancer inherits (finding 149). A display subclass that overrides
 * `cleanupEventListeners()` and forgets `super.cleanupEventListeners()` therefore
 * silently re-opens the leak for itself, with every other gate in this file still
 * green: it *has* a teardown path, it just skips the one that matters.
 *
 * No subclass overrides it today. This exists so the first one that does cannot get it
 * wrong quietly.
 */
describe('a display enhancer overriding cleanupEventListeners() calls super', () => {
  /** `className -> superclass name`, for every class declared in `src/`. */
  function collectHeritage(): Map<string, string> {
    const heritage = new Map<string, string>();
    for (const [path, text] of Object.entries(modules)) {
      if (path.endsWith('.test.ts') || path.endsWith('.d.ts')) continue;
      if (path.includes('/tests/')) continue;
      const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
      ts.forEachChild(sf, node => {
        if (!ts.isClassDeclaration(node) || !node.name) return;
        const superExpr = node.heritageClauses?.find(
          h => h.token === ts.SyntaxKind.ExtendsKeyword
        )?.types[0]?.expression;
        if (superExpr && ts.isIdentifier(superExpr)) {
          heritage.set(node.name.text, superExpr.text);
        }
      });
    }
    return heritage;
  }

  const heritage = collectHeritage();

  /** Walks the `extends` chain, so an indirect subclass counts too. */
  function isDisplayEnhancer(className: string): boolean {
    const seen = new Set<string>();
    let current: string | undefined = heritage.get(className);
    while (current && !seen.has(current)) {
      if (current === 'BaseDisplayEnhancer') return true;
      seen.add(current);
      current = heritage.get(current);
    }
    return false;
  }

  interface Override {
    file: string;
    className: string;
    callsSuper: boolean;
  }

  function findOverrides(): Override[] {
    const found: Override[] = [];
    for (const [path, text] of Object.entries(modules)) {
      if (path.endsWith('.test.ts') || path.endsWith('.d.ts')) continue;
      if (path.includes('/tests/')) continue;

      const file = path.replace(/^\.\.\/\.\.\//, '');
      const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

      ts.forEachChild(sf, node => {
        if (!ts.isClassDeclaration(node) || !node.name) return;
        if (!isDisplayEnhancer(node.name.text)) return;

        const method = node.members.find(
          (m): m is ts.MethodDeclaration =>
            ts.isMethodDeclaration(m) &&
            ts.isIdentifier(m.name) &&
            m.name.text === 'cleanupEventListeners'
        );
        if (!method?.body) return;

        let callsSuper = false;
        const visit = (n: ts.Node): void => {
          if (
            ts.isCallExpression(n) &&
            ts.isPropertyAccessExpression(n.expression) &&
            n.expression.expression.kind === ts.SyntaxKind.SuperKeyword &&
            n.expression.name.text === 'cleanupEventListeners'
          ) {
            callsSuper = true;
          }
          ts.forEachChild(n, visit);
        };
        visit(method.body);

        found.push({ file, className: node.name.text, callsSuper });
      });
    }
    return found;
  }

  it('resolves the display-enhancer hierarchy, so an empty result cannot pass by accident', () => {
    // Guards the heritage walk itself: if it stopped resolving, every check below
    // would inspect nothing and still be green.
    const displayClasses = [...heritage.keys()].filter(isDisplayEnhancer);
    expect(displayClasses.length).toBeGreaterThan(5);
  });

  it('calls super.cleanupEventListeners() somewhere in the override', () => {
    const messages = findOverrides()
      .filter(o => !o.callsSuper)
      .map(
        o =>
          `${o.file} › ${o.className}.cleanupEventListeners() never calls ` +
          `super.cleanupEventListeners(), so BaseDisplayEnhancer's ` +
          `next:currency-changed listener is never aborted for this class`
      );

    expect(
      messages,
      "a display enhancer's cleanupEventListeners() override must call " +
        'super.cleanupEventListeners() — the base implementation is not a no-op, ' +
        'it aborts the AbortController holding the inherited document listener.'
    ).toEqual([]);
  });
});

/**
 * The gate above asks whether a *teardown path exists*. The accordion answered yes
 * and removed nothing: it registered `click` and `keydown` on its triggers as inline
 * arrows, and its `destroy()` cleared a `Map`. A destroyed accordion went on toggling
 * whenever someone clicked its header (finding 165 in `docs/code-findings.md`).
 *
 * That was the **second** escape from the same gate in two waves — the first was
 * `ProspectCartEnhancer`, which overrode nothing at all (finding 139). Two escapes in
 * two waves is a pattern, and the pattern has a name: *a rule that checks shape gets
 * satisfied by shape*. Both classes could be made green by adding a method. Neither
 * fix had to remove a listener.
 *
 * **So this rule does not look at the class at all — it looks at the registration.**
 * For every `addEventListener` in the enhancer layer it asks the one question a
 * teardown method cannot answer on the listener's behalf: *is there any way to take
 * this listener back?*
 *
 * A registration is removable when it is one of exactly two shapes:
 *
 * 1. it passes `signal:` in its options — teardown aborts the controller and the
 *    listener goes with it, no reference needed; or
 * 2. its handler is a **stable stored reference** — a field (`this.boundHandleClick`),
 *    or a local that is also stored somewhere (`clickHandlers.set(el, handler)`) —
 *    which `removeEventListener` can be handed back.
 *
 * Everything else is unremovable *by construction*, and no `destroy()`, however
 * diligent, can fix it:
 *
 * - an **inline arrow or `function` expression**: nothing anywhere holds the
 *   reference, so `removeEventListener` has nothing to be given (the accordion);
 * - a **freshly built function** — `handler.bind(this)`, `makeHandler()` — which
 *   returns a different object on every call, so removal silently no-ops;
 * - a **local used nowhere but this one call**, which is an inline arrow with a name:
 *   hoisting the arrow to `const h = () => …` satisfies shape 2's *look* while leaving
 *   the reference just as unreachable. That clause is here because it is the obvious
 *   way to satisfy this rule without fixing anything, and writing it down beforehand
 *   is cheaper than another finding 165 next wave. It is not theoretical — it is what
 *   caught `floating-labels.ts`.
 *
 * And because `signal:` would otherwise become its own shape to satisfy — declare a
 * controller, pass its signal, never abort it — every `AbortController` constructed
 * in the enhancer layer must be `.abort()`ed in the file that constructs it.
 *
 * **Scope: `src/features/` and `src/core/base/`** — the enhancer layer, stated as a
 * directory rather than an import graph. The wave-5 rule followed relative imports out
 * of an enhancer file to find its helpers, which made the answer depend on how a
 * feature happened to be split and let a listener move out of range by moving file; a
 * rule about *call sites* has no reason to care where the call sits. `src/core/`
 * outside `base/` is deliberately out: those are page-lifetime singletons and dev
 * tooling with no per-element `destroy()` for a listener to outlive.
 *
 * This is a ratchet like the two above, with one difference that matters: each entry
 * freezes a **count**. An allowlisted file may keep the unremovable listeners it has;
 * it may not gain one. Without the count, allowlisting a file would hand it a
 * permanent exemption — which is how a gate stops being a gate.
 */
describe('every listener registered in the enhancer layer is removable', () => {
  /** Which registrations this rule can prove unremovable, and why. */
  type Unremovable =
    | 'inline-handler'
    | 'fresh-function-handler'
    | 'write-only-local-handler'
    | 'controller-never-aborted';

  interface Finding {
    file: string;
    /** Line of the call. A line number is wrong in a *generated page* and right in a
     *  failure message — this is a developer being pointed at a call site. */
    line: number;
    kind: Unremovable;
    source: string;
  }

  const EXPLANATIONS: Record<Unremovable, string> = {
    'inline-handler':
      'the handler is an inline arrow/function, so no reference to it exists and ' +
      'removeEventListener can never be given one — pass { signal } or store the handler',
    'fresh-function-handler':
      'the handler is built at the call (.bind(...) or a factory call), so it is a ' +
      'different function object every time and removal would silently no-op — ' +
      'bind once into a field, or pass { signal }',
    'write-only-local-handler':
      'the handler is a local used nowhere but this call, which is an inline arrow ' +
      'with a name — store it somewhere teardown can reach, or pass { signal }',
    'controller-never-aborted':
      'this AbortController is never .abort()ed in this file, so every listener ' +
      'registered with its signal outlives the enhancer',
  };

  /** Strips `!`, `(…)` and `as T` so the handler underneath is what gets classified. */
  function unwrap(expr: ts.Expression): ts.Expression {
    let current: ts.Expression = expr;
    for (;;) {
      if (
        ts.isNonNullExpression(current) ||
        ts.isParenthesizedExpression(current) ||
        ts.isAsExpression(current)
      ) {
        current = current.expression;
      } else {
        return current;
      }
    }
  }

  /** True when the options argument carries a `signal:` property. */
  function passesSignal(options: ts.Expression | undefined): boolean {
    return (
      options !== undefined &&
      ts.isObjectLiteralExpression(options) &&
      options.properties.some(
        p => p.name && ts.isIdentifier(p.name) && p.name.text === 'signal'
      )
    );
  }

  /** How many times an identifier of this name appears anywhere in the file. Two —
   *  the declaration and the registration — means nothing else can reach it. */
  function countIdentifierUses(sf: ts.SourceFile, name: string): number {
    let count = 0;
    const visit = (n: ts.Node): void => {
      if (ts.isIdentifier(n) && n.text === name) count++;
      ts.forEachChild(n, visit);
    };
    visit(sf);
    return count;
  }

  /**
   * Names bound by a parameter or an import in this file.
   *
   * Both are stable references someone outside this file holds — a callback passed
   * in, a shared handler imported — so `removeEventListener` can be given one even
   * though it appears just twice here. Only a **local declaration** used nowhere but
   * the registration is an inline arrow wearing a name, so those are exempt from that
   * clause and this is what keeps its wording true.
   */
  function collectStableNames(sf: ts.SourceFile): Set<string> {
    const names = new Set<string>();
    const visit = (n: ts.Node): void => {
      if (ts.isParameter(n) && ts.isIdentifier(n.name)) names.add(n.name.text);
      if (ts.isImportSpecifier(n) || ts.isImportClause(n)) {
        const bound = ts.isImportSpecifier(n) ? n.name : n.name;
        if (bound && ts.isIdentifier(bound)) names.add(bound.text);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    return names;
  }

  const inEnhancerLayer = (file: string): boolean =>
    file.startsWith('features/') || file.startsWith('core/base/');

  function findUnremovable(): Finding[] {
    const found: Finding[] = [];

    for (const [path, text] of Object.entries(modules)) {
      if (path.endsWith('.test.ts') || path.endsWith('.d.ts')) continue;
      if (path.includes('/tests/')) continue;

      const file = path.replace(/^\.\.\/\.\.\//, '');
      if (!inEnhancerLayer(file)) continue;
      if (
        !text.includes('addEventListener') &&
        !text.includes('AbortController')
      ) {
        continue;
      }

      const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      const abortsSomething = /\.abort\(\)/.test(text);
      const stableNames = collectStableNames(sf);

      const record = (node: ts.Node, kind: Unremovable): void => {
        found.push({
          file,
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          kind,
          source: node.getText(sf).replace(/\s+/g, ' ').slice(0, 100),
        });
      };

      const visit = (node: ts.Node): void => {
        if (
          ts.isNewExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'AbortController' &&
          !abortsSomething
        ) {
          record(node, 'controller-never-aborted');
        }

        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'addEventListener' &&
          !passesSignal(node.arguments[2])
        ) {
          const handlerArg = node.arguments[1];
          const handler = handlerArg ? unwrap(handlerArg) : undefined;

          if (
            handler &&
            (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler))
          ) {
            record(node, 'inline-handler');
          } else if (handler && ts.isCallExpression(handler)) {
            record(node, 'fresh-function-handler');
          } else if (
            handler &&
            ts.isIdentifier(handler) &&
            !stableNames.has(handler.text) &&
            countIdentifierUses(sf, handler.text) <= 2
          ) {
            record(node, 'write-only-local-handler');
          }
        }

        ts.forEachChild(node, visit);
      };

      visit(sf);
    }

    return found;
  }

  /**
   * Files that register listeners nothing can remove, frozen with the count they had
   * when this rule was written. Each entry is a judgement, not a shrug: *why* is it
   * acceptable that these particular listeners are never removed?
   *
   * Two judgements remain, and **no entry here is a leak any more**:
   *
   * - **Dies with its element** — the listener sits on a node this module created and
   *   later discards. When the node goes, the listener is collected with it, so there
   *   is nothing to leak. This is legitimate; it is also the excuse a real leak wears,
   *   which is why each entry names the element.
   * - **Page-lifetime by design** — a one-shot boot listener, or dev tooling compiled
   *   out of production. Nothing owns a teardown for it.
   *
   * A third group, **REAL LEAK**, is gone as of 2026-08-03: the eight files that held
   * enhancer-lifetime listeners on author DOM — coupon, the shared property fields, both
   * address-autocomplete providers, the phone fields, the credit-card service, the
   * floating labels and the upsell options — now register with `{ signal }` (or, for the
   * upsell, through the `bind` helper that was already in the file) and are torn down
   * with their owner. Do not add that group back: a listener on markup the SDK did not
   * create, outliving the thing that created it, is the shape this whole rule exists to
   * catch.
   *
   * `count` is the number of unremovable registrations in the file. Gaining one fails
   * the gate; fixing one fails it too, with a message saying to lower the count. An
   * entry without a count would be a permanent exemption for the file.
   */
  const UNREMOVABLE_ALLOWLIST: {
    file: string;
    count: number;
    reason: string;
  }[] = [
    {
      file: 'features/behavior/fomo-popup/fomo-popup.enhancer.ts',
      count: 1,
      reason:
        'Page-lifetime by design: a one-shot DOMContentLoaded awaited in ' +
        'initialize(), registered only while document.readyState is "loading" and ' +
        'fired at most once per page. `{ once: true }` would say so in code.',
    },
    {
      file: 'features/behavior/simple-exit-intent/simple-exit-intent.enhancer.ts',
      count: 1,
      reason:
        'Page-lifetime by design: the same one-shot DOMContentLoaded await as ' +
        'fomo-popup.',
    },
    {
      file: 'features/behavior/simple-exit-intent/simple-exit-intent.renderer.ts',
      count: 11,
      reason:
        'Dies with its element: all eleven are on the popup, overlay and close ' +
        'button this module creates. hidePopup() -> hidePopupElements() calls ' +
        '.remove() on both and nulls the references, so the listeners are collected ' +
        'with the nodes.',
    },
    {
      file: 'features/cart/bundle-selector/bundle-selector.slot-renderer.ts',
      count: 2,
      reason:
        'Dies with its element: input/blur on the data-next-property fields inside a ' +
        'slot card the renderer just built, which is replaced wholesale on re-render. ' +
        'If a slot is ever reused rather than rebuilt, these stack.',
    },
    {
      file: 'features/cart/package-toggle/package-toggle.handlers.ts',
      count: 1,
      reason:
        'Page-lifetime by design: a module-scope beforeunload clearing a ' +
        'module-scope Set. One per page load, and the page is going away.',
    },
    {
      file: 'features/checkout/utils/create-close-button.ts',
      count: 2,
      reason:
        'Dies with its element: the mouseenter/mouseleave pair is on the button this ' +
        'function creates and returns, and the caller removes it along with its PAC ' +
        'container. Its third listener, click -> the onClose parameter, is a stable ' +
        'reference the caller holds and so is not counted here.',
    },
    {
      file: 'features/display/display-core/display-debug-panel.ts',
      count: 3,
      reason:
        'Page-lifetime by design, dev only: init() returns early unless ' +
        'NODE_ENV === "development", so this is dead code in the production bundle, ' +
        'and DisplayDebugPanel is static-only — no instance, nothing to destroy. ' +
        'Worth knowing in dev: the mouseover/mouseout pair keeps running after the ' +
        'panel is toggled off, gated only by an isEnabled flag.',
    },
    {
      file: 'features/display/index.ts',
      count: 1,
      reason:
        'Page-lifetime by design, dev only: module-scope, NODE_ENV-guarded, one-shot ' +
        'DOMContentLoaded that dynamically imports the debug panel.',
    },
    {
      file: 'features/ui/tooltip/tooltip.renderer.ts',
      count: 2,
      reason:
        'Dies with its element: mouseenter/mouseleave on the tooltip node this ' +
        'renderer creates; the enhancer calls removeTooltipNow() on hide and on ' +
        'destroy.',
    },
  ];

  const findings = findUnremovable();

  const countsByFile = new Map<string, number>();
  for (const f of findings) {
    countsByFile.set(f.file, (countsByFile.get(f.file) ?? 0) + 1);
  }

  it('finds addEventListener calls in the enhancer layer, so an empty result cannot pass by accident', () => {
    // Without this, a glob or AST change that stopped matching anything would make
    // every check below `[] vs []` — green, and checking nothing.
    const scanned = Object.entries(modules).filter(
      ([p, text]) =>
        inEnhancerLayer(p.replace(/^\.\.\/\.\.\//, '')) &&
        !p.includes('/tests/') &&
        text.includes('.addEventListener(')
    );
    expect(scanned.length).toBeGreaterThan(20);
  });

  it('registers no listener that nothing can remove, unless the file is allowlisted', () => {
    const allowed = new Map(UNREMOVABLE_ALLOWLIST.map(e => [e.file, e.count]));

    const messages = findings
      .filter(f => (countsByFile.get(f.file) ?? 0) > (allowed.get(f.file) ?? 0))
      .map(
        f => `${f.file}:${f.line} — ${EXPLANATIONS[f.kind]}\n      ${f.source}`
      );

    expect(
      messages,
      'a listener registered in src/features/ or src/core/base/ must be removable: ' +
        'pass { signal: <controller>.signal } and abort that controller from ' +
        'cleanupEventListeners(), or hand addEventListener a stored handler ' +
        'reference. See listen() in base-display-enhancer.ts, ' +
        'checkout-form.enhancer.ts or accordion.enhancer.ts for the worked pattern. ' +
        'If this is a pre-existing registration rather than a new one, add its file ' +
        'to UNREMOVABLE_ALLOWLIST with a count and a judgement — do not fix a file ' +
        'you do not own.'
    ).toEqual([]);
  });

  it('has no allowlist entry whose count is now too high', () => {
    const slack = UNREMOVABLE_ALLOWLIST.filter(
      e => (countsByFile.get(e.file) ?? 0) < e.count
    ).map(
      e =>
        `${e.file} — allowlisted for ${e.count} unremovable listener(s), found ` +
        `${countsByFile.get(e.file) ?? 0}. Lower the count (or delete the entry at ` +
        `0) so the fix cannot be undone silently.`
    );

    expect(
      slack,
      'the allowlist is a ratchet: it may only shrink. An entry with slack in it ' +
        'lets a removed listener come back for free.'
    ).toEqual([]);
  });
});
