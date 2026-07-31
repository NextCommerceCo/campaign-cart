import { defineFeature } from '@/docs/schema/feature-manifest';

const CONTAINER = 'Container — pick one mode';
const OFFER = 'Offer configuration';
const OPTIONS = 'Options (selector mode)';
const BUTTONS = 'Action buttons';
const QUANTITY = 'Quantity controls';
const LINKED = 'Linked external selectors';
const PROPS = 'Line item properties';

export default defineFeature({
  id: 'upsell',
  category: 'order',
  status: 'core',
  summary:
    'Presents a post-purchase offer on the order the visitor already paid for, and adds it without asking for payment again.',
  activates: '[data-next-upsell]',
  // Selector mode and the dropdown form are separate entry points to the same feature.
  alsoActivates: ['[data-next-upsell-selector]', '[data-next-upsell-select]'],
  logPrefix: 'UpsellEnhancer',
  // Keeps its When / Meaning / Action prose; the drift test checks coverage
  // instead of overwriting. See FeatureManifest.pages.
  pages: { logs: 'hand-written', errors: 'hand-written', relations: 'hand-written', getStarted: 'hand-written' },

  attributes: [
    {
      group: CONTAINER,
      name: 'data-next-upsell',
      type: 'boolean (presence)',
      required: false,
      description:
        '**Direct mode**: the container offers one fixed package. Any value is ignored — only presence counts. Pair it with `data-next-package-id`.',
    },
    {
      group: CONTAINER,
      name: 'data-next-upsell-selector',
      type: 'boolean (presence)',
      required: false,
      description:
        '**Selector mode**: the visitor chooses between options first. Pair it with `data-next-selector-id` plus either option cards or a dropdown.',
    },

    {
      group: OFFER,
      name: 'data-next-package-id',
      type: 'number',
      required: false,
      description:
        'The package being offered. In direct mode it goes on the container; in selector mode on each option card.',
      notes:
        'Missing or non-numeric in direct mode, initialization fails and the offer never appears.',
    },
    {
      group: OFFER,
      name: 'data-next-selector-id',
      type: 'string',
      required: false,
      description:
        'Names the selector so its quantity and selection can be tracked — and stay in step across duplicate containers, as when the same offer renders for mobile and desktop.',
    },
    {
      group: OFFER,
      name: 'data-next-quantity',
      type: 'number',
      required: false,
      default: '1',
      description: 'Starting quantity for the offer.',
      notes: 'Runtime changes are clamped to 1–10 regardless of what the controls request.',
    },

    {
      group: OPTIONS,
      name: 'data-next-upsell-option',
      type: 'boolean (presence)',
      required: false,
      description:
        'Marks a selectable option card. Give each one a `data-next-package-id`, and `data-next-selected="true"` on the one that should start chosen.',
    },
    {
      group: OPTIONS,
      name: 'data-next-selected',
      type: "'true'",
      required: false,
      description: 'Pre-selects this option on load.',
    },
    {
      group: OPTIONS,
      name: 'data-next-upsell-select',
      type: 'string (selector id)',
      required: false,
      description:
        'Marks a `<select>` as the option source for the selector named in its value, for offers with too many choices to show as cards. Each `<option value>` is a package id.',
    },

    {
      group: BUTTONS,
      name: 'data-next-upsell-action',
      type: 'string',
      required: false,
      description: 'What the button does.',
      values: [
        { value: 'add', description: 'Add the offer to the order.' },
        { value: 'accept', description: 'Same as `add`.' },
        { value: 'skip', description: 'Decline and move on.' },
        { value: 'decline', description: 'Same as `skip`.' },
      ],
      notes: 'An unrecognised value logs a warning and the button does nothing.',
    },
    {
      group: BUTTONS,
      name: 'data-next-url',
      type: 'string',
      required: false,
      description:
        "Where to send the visitor after this button's action — usually the next offer, or the receipt. The order reference is appended and existing query parameters are preserved.",
      notes:
        'Also accepted: `data-next-next-url`, `data-os-next-url`. With none of them, the `next-upsell-accept-url` / `next-upsell-decline-url` meta tags are used. With neither, the funnel stops here.',
    },

    {
      group: QUANTITY,
      name: 'data-next-upsell-quantity',
      type: 'string',
      required: false,
      description: 'Marks a quantity control inside the offer.',
      values: [
        { value: 'increase', description: 'Button that adds one.' },
        { value: 'decrease', description: 'Button that subtracts one.' },
        { value: 'display', description: 'Element whose text shows the current quantity.' },
      ],
    },
    {
      group: QUANTITY,
      name: 'data-next-upsell-quantity-toggle',
      type: 'number',
      required: false,
      description:
        'A button that jumps straight to a quantity — "Buy 3" beside "Buy 1". The active one gets the `next-selected` class.',
    },
    {
      group: QUANTITY,
      name: 'data-next-quantity-selector-id',
      type: 'string',
      required: false,
      description:
        'Scopes a quantity control to one selector, for a page with more than one offer.',
    },

    {
      group: LINKED,
      name: 'data-next-package-selector-id',
      type: 'string',
      required: false,
      description:
        'Read the offer from an external package selector by id, instead of local option cards. The selection is read at click time.',
      notes:
        'Omit it and a matching selector inside the container is detected automatically.',
    },
    {
      group: LINKED,
      name: 'data-next-bundle-selector-id',
      type: 'string',
      required: false,
      description: 'The same, for an external bundle selector.',
    },

    {
      group: PROPS,
      name: 'data-next-property',
      type: 'string (key)',
      required: false,
      description:
        'On an input inside the offer: its value is attached to the added line under this key. Wins over a document-wide default with the same key.',
    },
    {
      group: PROPS,
      name: 'data-next-default-property',
      type: 'string (key)',
      required: false,
      description:
        'On an input anywhere in the page: collected for every offer, no container needed.',
    },
  ],

  classes: [
    {
      name: 'next-selected',
      description:
        'On the chosen option card and the active quantity toggle. Style selection from this rather than tracking clicks yourself.',
    },
  ],

  readsElsewhere: [
    {
      name: 'data-next-next-url',
      description:
        'Legacy spelling of `data-next-url` on an action button, still read as a fallback. Prefer `data-next-url` in new markup; `data-os-next-url` is read after this one for older pages.',
    },
  ],

  emits: [
    'upsell:initialized',
    'upsell:option-selected',
    'upsell:quantity-changed',
    'upsell-selector:item-selected',
  ],

  sections: [
    {
      title: 'Direct vs selector mode',
      body: `
\`\`\`html
<!-- Direct: one fixed offer -->
<div data-next-upsell data-next-package-id="77" data-next-quantity="1">
  <button data-next-upsell-action="add" data-next-url="/receipt">Yes, add it</button>
  <button data-next-upsell-action="skip" data-next-url="/receipt">No thanks</button>
</div>

<!-- Selector: the visitor chooses first -->
<div data-next-upsell-selector data-next-selector-id="offer-1">
  <div data-next-upsell-option data-next-package-id="77" data-next-selected="true">1 bottle</div>
  <div data-next-upsell-option data-next-package-id="78">3 bottles</div>

  <button data-next-upsell-action="add" data-next-url="/receipt">Add to my order</button>
</div>
\`\`\`

**The add button emits \`upsell:accepted\` through the accept-upsell feature, not
this one.** This feature reports selection and quantity; the accept action and its
revenue event belong to
[accept-upsell](../../../../cart/accept-upsell/guide/reference/events.md). Track
post-purchase revenue there.
`,
    },
  ],

  conflicts: [
    {
      feature: 'accept-upsell',
      because:
        'they are two different accept patterns for two different stages — the cart versus a completed order. On the same element both try to own the click.',
    },
  ],
});
