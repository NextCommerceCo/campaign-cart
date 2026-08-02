import { defineFeature } from '@/docs/schema/feature-manifest';

/**
 * The display system's shared contract. `data-next-display` is one attribute that
 * dispatches to eight feature-specific display enhancers by the namespace at the
 * front of its value, and every one of them accepts the same formatting
 * modifiers. Those modifiers are documented here, once — the per-namespace pages
 * link here rather than repeating them.
 */
export default defineFeature({
  id: 'display-core',
  category: 'display',
  status: 'core',
  summary:
    'Binds any element to a live value from the cart, campaign, order, or a selector — and formats it.',
  activates: '[data-next-display]',
  logPrefix: 'DisplayEnhancer',
  // The base class and its routing table live in `core/base/` (sdk-structure §2):
  // four `features/cart/**` display files extend `BaseDisplayEnhancer` too, and a
  // feature reaching into another feature's folder is the cross-feature import that
  // section forbids. The attributes documented here are read there, so they are
  // claimed with the `src/`-relative form.
  //
  // Context resolution and the price maths need no entry — they sit inside this
  // folder, which the manifest owns outright now that it lives here too.
  extraSource: [
    'src/core/base/base-display-enhancer.ts',
    'src/core/base/display-types.ts',
  ],

  attributes: [
    {
      name: 'data-next-display',
      type: 'string (namespaced path)',
      required: true,
      description:
        "The value to show, written as `{namespace}.{path}` — for example `cart.total` or `package.101.price`. The namespace decides which part of the SDK answers; see **Namespaces** below. The element's text is replaced whenever that value changes, so you write no JavaScript to keep it current.",
      notes:
        'An unknown namespace means no feature is instantiated and the element never updates. Check the namespace table below if an element stays blank.',
    },
    {
      name: 'data-next-format',
      type: 'string',
      required: false,
      default: 'auto',
      description:
        'How to render the value. `auto` infers from the value and the path — money paths format as currency, booleans as yes/no — so set this only when the inference is wrong.',
      values: [
        { value: 'currency', description: "Money, in the campaign's currency and locale." },
        { value: 'number', description: 'A plain number with locale grouping.' },
        { value: 'percentage', description: 'A percentage.' },
        { value: 'boolean', description: 'A true/false value.' },
        { value: 'date', description: 'A date.' },
        { value: 'text', description: 'Verbatim, no formatting.' },
        { value: 'auto', description: 'Infer from the value and the path.' },
      ],
      notes: '`data-format` is accepted as an alias for backward compatibility.',
    },
    {
      name: 'data-hide-if-zero',
      type: "'true'",
      required: false,
      description:
        'Hides the element when the value is zero. Use it for a savings or discount row that should disappear rather than read "$0.00".',
    },
    {
      name: 'data-hide-if-false',
      type: "'true'",
      required: false,
      description:
        'Hides the element when the value is false, for a badge that should be absent rather than showing "No".',
    },
    {
      name: 'data-hide-zero-cents',
      type: "'true'",
      required: false,
      description:
        'Renders a whole amount as `$49` instead of `$49.00`, while amounts with cents keep them.',
    },
    {
      name: 'data-multiply-by',
      type: 'number',
      required: false,
      description:
        'Multiplies the value before formatting — for showing a per-unit price as a pack total, or a rate as a percentage.',
    },
    {
      name: 'data-divide-by',
      type: 'number',
      required: false,
      description:
        'Divides the value before formatting — most often to show a per-unit price from a pack total.',
    },
  ],

  readsElsewhere: [
    {
      name: 'data-next-package',
      description:
        'Accepted as an alias of `data-next-package-id` when resolving which package an ancestor element stands for. Both this and `data-package-id` work; `data-next-package-id` is the spelling to use.',
    },
    {
      name: 'data-next-cart-item-id',
      description:
        'Read from an enclosing element to resolve which cart line a binding is about, alongside `data-next-package-id`, `data-next-shipping-id`, and `data-next-selector-id`.',
      notes:
        'The cart item list renders rows with `data-cart-item-id` — **without** the `next` segment — so this context does not currently resolve inside its rows. Use `data-next-package-id`, which the same rows do carry, until the two names agree.',
    },
  ],

  sets: [
    {
      name: 'data-format-debug',
      description:
        'A JSON snapshot of how the value was resolved and formatted, written when formatting could not produce a sensible result. Read it in devtools when an element shows the wrong thing.',
    },
  ],

  emits: [],

  errors: [
    {
      message: '{name}: data-next-display attribute is required',
      kind: 'fatal',
      cause:
        'A display enhancer was attached to an element with an empty or missing `data-next-display`. `{name}` is the enhancer class that reported it.',
      fix:
        'Give the element a path — `data-next-display="cart.total"`. An empty value is the common case, left behind when a binding is removed but the attribute is not.',
    },
  ],

  requires: [
    {
      name: 'campaignStore',
      because:
        'package and product values come from campaign data; before it loads a binding renders its placeholder.',
    },
  ],
  sections: [
    {
      title: 'Namespaces',
      body: `
The first segment of \`data-next-display\` selects which feature resolves the rest
of the path. The modifiers above work with all of them.

Each **Paths** link is the complete list of what can follow that namespace, read out
of the code that resolves it rather than transcribed — so a path that is not on the
page is one the SDK does not answer.

| Namespace | Resolves against | Paths |
|---|---|---|
| \`cart.\` / \`cart-summary.\` | The cart: totals, counts, shipping, discounts | [cart-summary](../../../../cart/cart-summary/guide/reference/display-paths.md) |
| \`package.\` / \`campaign.\` | A campaign package's own fields and prices | [product-display](../../../../display/product-display/guide/reference/display-paths.md) |
| \`selection.\` | What a selector currently has selected | [selection-display](../../../../display/selection-display/guide/reference/display-paths.md) |
| \`order.\` | A completed order, on receipt and upsell pages | [order-display](../../../../display/order-display/guide/reference/display-paths.md) |
| \`shipping.\` | A shipping method's name and cost | [shipping-display](../../../../display/shipping-display/guide/reference/display-paths.md) |
| \`selector.\` | One card inside a package selector | [package-selector](../../../../cart/package-selector/guide/reference/display-paths.md) |
| \`bundle.\` | A bundle selector's current bundle | [bundle-selector](../../../../cart/bundle-selector/guide/reference/display-paths.md) |
| \`toggle.\` | One package toggle's state and price | [package-toggle](../../../../cart/package-toggle/guide/reference/display-paths.md) |

\`\`\`html
<span data-next-display="cart.total"></span>
<span data-next-display="cart.savingsAmount" data-hide-if-zero="true"></span>
<span data-next-display="package.101.price" data-divide-by="3"></span>
<span data-next-display="order.number"></span>
\`\`\`
`,
    },
  ],
});
