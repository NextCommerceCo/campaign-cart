import { defineFeature } from '@/core/docs/feature-manifest';

export default defineFeature({
  id: 'conditional-display',
  category: 'display',
  status: 'core',
  summary:
    'Shows or hides an element based on a live condition — cart contents, totals, selection state, or a URL parameter.',
  activates: '[data-next-show]',
  // Either attribute turns the feature on; `hide` is not a modifier of `show`.
  alsoActivates: ['[data-next-hide]'],
  logPrefix: 'ConditionalDisplayEnhancer',

  attributes: [
    {
      name: 'data-next-show',
      type: 'string (condition)',
      required: false,
      description:
        'Shows the element while the condition is true and hides it otherwise, re-evaluating on every relevant change. Set either this or `data-next-hide`.',
      notes:
        'A condition that fails to parse is logged and the element is left visible, so a typo does not hide content silently.',
    },
    {
      name: 'data-next-hide',
      type: 'string (condition)',
      required: false,
      description:
        'The inverse: hides the element while the condition is true. Use whichever reads more naturally — `hide="cart.isEmpty"` beats `show="!cart.isEmpty"`.',
    },
    {
      name: 'data-next-selector-id',
      type: 'string',
      required: false,
      description:
        'Which selector a `selection.*` condition refers to. Without it the feature walks up the DOM to find the nearest enclosing selector, so this is only needed when the element sits outside one.',
      notes: '`data-selector-id` is accepted as an alias.',
    },
    {
      name: 'data-next-id',
      type: 'string',
      required: false,
      description:
        "Fallback identifier read from an enclosing cart selector when it has no `data-next-selector-id`.",
    },
  ],

  readsElsewhere: [
    {
      name: 'data-next-cart-selector',
      description:
        'Read while walking up the DOM: marks the enclosing element as the cart selector whose selection a `selection.*` condition should resolve against.',
    },
    {
      name: 'data-next-shipping-id',
      description:
        'Read from an enclosing element so a condition can refer to the shipping method that element represents.',
    },
  ],

  emits: [],

  errors: [
    {
      message: 'Either data-next-show or data-next-hide is required',
      kind: 'fatal',
      cause:
        'The element activated the feature but carries neither attribute with a condition — so there is nothing to evaluate.',
      fix:
        'Give the element a condition, or remove the attribute that turned the feature on. The usual cause is a leftover `data-next-show` with an empty value after an edit:\n\n' +
        '```html\n' +
        '<!-- throws -->\n' +
        '<div data-next-show="">Free shipping</div>\n\n' +
        '<!-- works -->\n' +
        '<div data-next-show="cart.total > 50">Free shipping</div>\n' +
        '```\n\n' +
        'The element is left as authored, so content meant to be conditional is **visible** rather than hidden.',
    },
  ],

  dependsOn: [
    {
      feature: 'display-core',
      because:
        'conditions are written over the same namespaces as `data-next-display`, so what you can show is what you can test.',
    },
  ],
  pairsWith: [
    {
      feature: 'cart-summary',
      because:
        'showing a free-shipping or minimum-spend message beside the totals is the common case.',
      caution:
        'Inside a summary or bundle row template the row renderer evaluates the condition per row instead, against that row\'s data — this feature is not instantiated there, so the paths available are different.',
    },
  ],
  sections: [
    {
      title: 'URL parameter conditions',
      body: `
Alongside the SDK's own state, a condition can test a **URL query parameter** with
the \`param.\` namespace. That is how a link can drive what a page shows — a
preview mode, a variant of the copy, a banner suppressed for paid traffic.

\`\`\`html
<!-- ?preview=1 -->
<div data-next-show="param.preview">Preview mode</div>

<!-- ?mode=advanced -->
<div data-next-show="param.mode == 'advanced'">Advanced options</div>

<!-- ?banner=n  — hide for anyone arriving with it -->
<div data-next-hide="param.banner == 'n'">Free shipping over $50</div>

<!-- combined with cart state -->
<div data-next-show="param.vip && cart.total > 100">VIP bonus unlocked</div>
\`\`\`

A bare \`param.name\` with no operator is a truthy check: it fires when the
parameter is present. \`params.\` is accepted as an alias for \`param.\`.

Parameters are read once the SDK has processed the URL, which is announced by
\`sdk:url-parameters-processed\` — a condition evaluated before that sees nothing.
To read or change them from code, use \`next.getParam()\`, \`next.getAllParams()\`,
\`next.hasParam()\`, and \`next.setParam()\`; setting one re-evaluates every
conditional that depends on it.
`,
    },
    {
      title: 'Conditions',
      body: `
A condition is a path, optionally compared to a value. Paths use the same
namespaces as [\`data-next-display\`](../../../../display/display-core/guide/reference/attributes.md),
so anything you can show, you can also test.

\`\`\`html
<!-- presence and emptiness -->
<div data-next-hide="cart.isEmpty">You have items in your cart</div>
<div data-next-show="cart.hasItems">Proceed to checkout</div>

<!-- comparisons -->
<div data-next-show="cart.total > 100">Free shipping unlocked</div>
<div data-next-show="cart.hasItem(101)">Your bundle includes the starter kit</div>

<!-- selection state, scoped to a selector -->
<div data-next-show="selection.hasSelection" data-next-selector-id="main">
  Ready to add
</div>
\`\`\`

Supported operators: \`==\`, \`!=\`, \`>\`, \`>=\`, \`<\`, \`<=\`, and \`!\` for negation.
Conditions can be joined with \`&&\` and \`||\`.

**Inside a cart-summary or bundle template**, \`data-next-show\` and
\`data-next-hide\` are evaluated by that template's renderer instead, per row,
against the row's own data — this feature is not instantiated there. See
[cart-summary](../../../../cart/cart-summary/guide/reference/attributes.md).
`,
    },
  ],
});
