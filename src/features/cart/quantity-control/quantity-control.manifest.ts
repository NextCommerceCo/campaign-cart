import { defineFeature } from '@/core/docs/feature-manifest';

export default defineFeature({
  id: 'quantity-control',
  category: 'cart',
  status: 'core',
  summary:
    'Steps a cart line up or down, or sets it to an exact quantity from an input.',
  activates: '[data-next-quantity="increase"]',
  logPrefix: 'QuantityControlEnhancer',
  // Keeps its When / Meaning / Action prose; the drift test checks coverage
  // instead of overwriting. See FeatureManifest.pages.
  pages: { logs: 'hand-written', errors: 'hand-written', relations: 'hand-written', getStarted: 'hand-written' },

  attributes: [
    {
      name: 'data-next-quantity',
      type: 'string',
      required: true,
      description:
        'Declares the mode of this control. Determines which DOM event is listened to and which cart store action is called.',
      values: [
        {
          value: 'increase',
          description:
            'Button that adds `step` to the current quantity. Listens to `click`.',
        },
        {
          value: 'decrease',
          description:
            'Button that subtracts `step` from the current quantity. Listens to `click`.',
        },
        {
          value: 'set',
          description:
            'Input or select element that accepts a quantity value directly. Listens to `change` and `blur`. Number inputs also listen to `input` for real-time clamping.',
        },
      ],
      notes:
        'Any other value throws `Invalid value for data-next-quantity` and the control does not initialize.',
    },
    {
      name: 'data-package-id',
      type: 'number',
      required: true,
      description:
        'The numeric `ref_id` of the campaign package this control targets. Used to identify the matching cart item in the store.\n\nWhen the element is rendered by `CartItemListEnhancer`, this attribute is set automatically from the item template. When used standalone, supply the `ref_id` directly.',
      notes:
        'Note the name: this one is `data-package-id`, without the `next` segment other attributes use.',
    },
    {
      name: 'data-step',
      type: 'number',
      required: false,
      default: '1',
      description:
        'How much to increase or decrease the quantity per click (for `increase`/`decrease` modes). Has no effect on `set` mode except for the `{step}` template token in button content.',
      values: 'positive integer greater than 0',
    },
    {
      name: 'data-min',
      type: 'number',
      required: false,
      default: '0',
      description:
        'Minimum allowed quantity. The `decrease` button is disabled when the current quantity equals this value. For `set` mode, values below this are clamped to `min` on `change`/`blur`.',
      notes:
        '`data-min="0"` (the default) means quantity 0 is reachable, which removes the item from the cart. `data-min="1"` prevents removal through this control.',
    },
    {
      name: 'data-max',
      type: 'number',
      required: false,
      default: '99',
      description:
        'Maximum allowed quantity. The `increase` button is disabled when the current quantity equals this value. For `set` mode, values above this are clamped to `max` on `change`/`blur`.',
    },
  ],

  sets: [
    {
      name: 'data-quantity',
      description:
        "The line's current quantity in the cart, refreshed on every cart update. Read it in CSS or tests instead of parsing the button text.",
      values: 'integer, `0` when the line is not in the cart',
    },
    {
      name: 'data-in-cart',
      description: 'Whether this package currently has a line in the cart.',
      values: '`true` / `false`',
    },
    {
      name: 'disabled',
      description:
        'Present when the control cannot move further — at `data-max` for `increase`, at `data-min` for `decrease`. Not set in `set` mode.',
    },
    {
      name: 'aria-disabled',
      description:
        'Mirrors `disabled` for assistive technology, so a disabled step button is announced rather than silently inert.',
      values: '`true` / `false`',
    },
    {
      name: 'data-original-content',
      description:
        "Snapshot of the element's initial `innerHTML`, captured once on first render. The template tokens below are re-substituted from this snapshot on every cart update, so the original markup is never lost.",
      notes:
        'Do not set or edit this yourself — overwriting it makes the token substitution render stale content.',
    },
    {
      name: 'min / max / step',
      description:
        'On `set` mode inputs, the native input constraints are set from `data-min` / `data-max` / `data-step` so the browser stepper agrees with the enhancer.',
    },
  ],

  classes: [
    {
      name: 'disabled',
      description:
        'Toggled alongside the `disabled` attribute, for styling the dead-end state.',
    },
    {
      name: 'has-item',
      description: 'The package has a line in the cart.',
    },
    {
      name: 'empty',
      description: 'The package has no line in the cart.',
    },
    {
      name: 'processing',
      description:
        'A cart write triggered by this control is in flight. Use it to show a spinner or block double clicks.',
    },
  ],

  tokens: [
    {
      name: '{quantity}',
      description:
        "Replaced with the line's current quantity everywhere it appears in the element's content.",
    },
    {
      name: '{step}',
      description: 'Replaced with the resolved `data-step` value.',
    },
  ],

  emits: ['cart:quantity-changed'],

  // Not a conflict: this is the standard cart-row pairing. The list instantiates the
  // stepper on every `[data-next-quantity]` it renders, so the caveat is about how you
  // wire your own listeners, not about whether to use them together.
  pairsWith: [
    {
      feature: 'cart-item-list',
      because:
        'the list renders each cart row and instantiates a stepper on every `[data-next-quantity]` inside it, so a row gets working quantity controls with no extra wiring.',
      caution:
        'The list replaces its `innerHTML` on every cart update, so a listener you attach directly to a rendered button is lost on the next change. Use the attributes and let the list re-initialise them, or bind on the list container.',
    },
  ],
});
