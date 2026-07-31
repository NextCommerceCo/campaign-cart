import { defineFeature } from '@/docs/schema/feature-manifest';

export default defineFeature({
  id: 'accept-upsell',
  category: 'cart',
  status: 'core',
  summary:
    'Adds a post-purchase upsell to an order the visitor has already paid for, then sends them onward.',
  activates: '[data-next-action="accept-upsell"]',
  logPrefix: 'AcceptUpsellEnhancer',
  // Keeps its When / Meaning / Action prose; the drift test checks coverage
  // instead of overwriting. See FeatureManifest.pages.
  pages: { logs: 'hand-written', errors: 'hand-written', relations: 'hand-written', getStarted: 'hand-written' },

  attributes: [
    {
      name: 'data-next-action',
      type: 'string',
      required: true,
      description:
        'Must be `"accept-upsell"`. This is the activation attribute — without it the feature is never instantiated.',
      values: [
        {
          value: 'accept-upsell',
          description: 'Turns this element into an upsell accept button.',
        },
      ],
    },
    {
      name: 'data-next-package-id',
      type: 'number',
      required: false,
      description:
        'The package `ref_id` to add to the order. Use this when the offer is a fixed package with nothing to choose.',
      notes:
        'Set either this or one of the selector attributes below. If a linked selector has a selection, the selector wins.',
    },
    {
      name: 'data-next-selector-id',
      type: 'string',
      required: false,
      description:
        'Id of an upsell selector on the page. The button reads its current selection at click time, so the visitor can pick a size or tier before accepting.',
      notes:
        'The selector must carry `data-next-upsell-context`, or it will write to the cart instead of leaving the choice to this button. Treat the visitor\'s click on a card as what arms this button: a selector in upsell context pre-selects a card while booting, but this button does not reliably hear that, so it can start out disabled beside a card that looks chosen.',
    },
    {
      name: 'data-next-upsell-action-for',
      type: 'string',
      required: false,
      description:
        'Id of a bundle selector to read instead, for offers presented as a bundle rather than single packages.',
    },
    {
      name: 'data-next-quantity',
      type: 'number',
      required: false,
      default: '1',
      description:
        'How many units to add. A linked selector\'s own quantity wins once a selection is made.',
      values: 'positive integer',
    },
    {
      name: 'data-next-url',
      type: 'string',
      required: false,
      description:
        'Where to send the visitor after the upsell is accepted — usually the next offer or the receipt. Query parameters from the current page are preserved.',
      notes:
        'With no value here, the SDK falls back to `<meta name="next-upsell-accept-url">`. With neither, the loading overlay clears and the visitor stays on the page — which reads as a broken funnel, so set one.',
    },
  ],

  classes: [
    {
      name: 'next-disabled',
      description:
        'The button has nothing to accept yet — a linked selector has no selection.',
    },
  ],

  emits: ['upsell:accepted'],

  conflicts: [
    {
      feature: 'package-selector',
      because:
        'a selector without `data-next-upsell-context` writes to the cart on selection, which is wrong after checkout — the order is already paid. Always set the upsell context on selectors feeding this button.',
    },
  ],
});
