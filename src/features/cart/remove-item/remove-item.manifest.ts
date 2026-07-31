import { defineFeature } from '@/core/docs/feature-manifest';

export default defineFeature({
  id: 'remove-item',
  category: 'cart',
  status: 'core',
  summary: 'Removes a line from the cart, optionally asking the visitor to confirm first.',
  activates: '[data-next-remove-item]',
  logPrefix: 'RemoveItemEnhancer',
  // Keeps its When / Meaning / Action prose; the drift test checks coverage
  // instead of overwriting. See FeatureManifest.pages.
  pages: { logs: 'hand-written', errors: 'hand-written', relations: 'hand-written', getStarted: 'hand-written' },

  attributes: [
    {
      name: 'data-next-remove-item',
      type: 'boolean (presence)',
      required: true,
      description:
        'Turns the element into a remove button. Presence is enough — it takes no value.',
    },
    {
      name: 'data-package-id',
      type: 'number',
      required: true,
      description:
        'The package `ref_id` to remove when clicked. Inside a cart item list template this is stamped for you from `{item.packageId}`.',
      notes:
        'Note the name: `data-package-id`, without the `next` segment most attributes use.',
    },
    {
      name: 'data-next-confirm',
      type: "'true'",
      required: false,
      description:
        "Shows a native browser confirmation dialog before removing. Any other value, or leaving it off, removes immediately.",
      values: [
        { value: 'true', description: 'Ask before removing.' },
      ],
    },
    {
      name: 'data-next-confirm-message',
      type: 'string',
      required: false,
      default: 'Are you sure you want to remove this item?',
      description:
        'The wording of the confirmation dialog. Only used when `data-next-confirm="true"` is also present.',
    },
  ],

  sets: [
    {
      name: 'data-quantity',
      description:
        "The line's current quantity, refreshed on every cart change. Use it in CSS attribute selectors, e.g. `[data-quantity=\"0\"]`.",
      values: 'integer',
    },
    {
      name: 'data-in-cart',
      description: 'Whether this package currently has a line in the cart.',
      values: '`true` / `false`',
    },
    {
      name: 'data-original-content',
      description:
        "Snapshot of the button's initial `innerHTML`, taken on first render and used as the source for the `{quantity}` token below.",
      notes:
        'Do not set or edit this yourself — overwriting it makes the token substitution render stale content.',
    },
  ],

  classes: [
    { name: 'has-item', description: 'The package has a line in the cart.' },
    { name: 'empty', description: 'The package has no line in the cart.' },
    {
      name: 'processing',
      description: 'A cart write triggered by this button is in flight.',
    },
    {
      name: 'removing',
      description:
        'The removal is underway. Use it to fade the row out before it disappears.',
    },
    {
      name: 'item-removed',
      description: 'The removal finished, for a brief post-removal state.',
    },
    {
      name: 'disabled',
      description: 'The button cannot act — there is nothing in the cart to remove.',
    },
  ],

  tokens: [
    {
      name: '{quantity}',
      description:
        "Replaced with the line's current quantity anywhere it appears in the button's content.",
    },
  ],

  emits: ['cart:item-removed'],

  // Not a conflict: the list is where a remove button normally lives. The caveat is
  // about wiring your own listeners, not about combining the two.
  pairsWith: [
    {
      feature: 'cart-item-list',
      because:
        'the list renders each cart row and instantiates this feature on every `[data-next-remove-item]` inside it, so rows get a working remove button with no extra wiring.',
      caution:
        'The list replaces its `innerHTML` on every cart update, so a listener attached directly to a rendered remove button is lost. Put the attributes in the list template and let the feature re-bind itself.',
    },
  ],
});
