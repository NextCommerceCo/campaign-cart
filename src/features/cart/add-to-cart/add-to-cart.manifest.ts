import { defineFeature } from '@/docs/schema/feature-manifest';

export default defineFeature({
  id: 'add-to-cart',
  category: 'cart',
  status: 'core',
  summary:
    'Adds a package to the cart on click — either a fixed package or whatever a linked selector currently has selected.',
  activates: '[data-next-action="add-to-cart"]',
  logPrefix: 'AddToCartEnhancer',
  // Keeps its When / Meaning / Action prose; the drift test checks coverage
  // instead of overwriting. See FeatureManifest.pages.
  pages: { logs: 'hand-written', errors: 'hand-written', relations: 'hand-written', getStarted: 'hand-written' },

  attributes: [
    {
      name: 'data-next-action',
      type: 'string',
      required: true,
      description:
        'Must be `"add-to-cart"`. This is the activation attribute — without it the feature is never instantiated.',
      values: [
        { value: 'add-to-cart', description: 'Turns this element into an add-to-cart button.' },
      ],
    },
    {
      name: 'data-next-package-id',
      type: 'number',
      required: false,
      description:
        'The package `ref_id` to add on click. Use this for a button that always adds the same package, regardless of any selector on the page.',
      notes:
        'Set either `data-next-package-id` or `data-next-selector-id`. With neither, the click logs `No package ID available for add-to-cart action` and nothing is written to the cart.',
    },
    {
      name: 'data-next-selector-id',
      type: 'string',
      required: false,
      description:
        'The selector id of a package selector, cart selector, or bundle selector on the page. The button reads that selector\'s current selection at click time and adds the selected package.\n\nThe button stays disabled until the linked selector has a selection.',
      notes:
        'The selector element is looked up up to 5 times at 50ms intervals after init. If it is still missing, the button logs `Selector "{id}" not found after retries` and never enables.',
    },
    {
      name: 'data-next-quantity',
      type: 'number',
      required: false,
      default: '1',
      description:
        'How many units to add. When a selector is linked, a quantity carried by the selected item wins over this value.',
    },
    {
      name: 'data-next-url',
      type: 'string',
      required: false,
      description:
        'Where to send the visitor after a successful add. Query parameters from the current page URL are preserved and merged into the target, so attribution and test-mode flags survive the hop.',
    },
    {
      name: 'data-next-clear-cart',
      type: 'string',
      required: false,
      default: 'false',
      description:
        'When `"true"`, the whole cart is emptied before the new item is added. Use it for single-item flows and "replace and buy" CTAs.',
      values: [
        { value: 'true', description: 'Empty the cart first, then add.' },
        { value: 'false', description: 'Add alongside whatever is already in the cart.' },
      ],
    },
    {
      name: 'data-next-property-container',
      type: 'string',
      required: false,
      description:
        'A CSS selector for an element wrapping custom-property inputs — engraving text, gift messages, a chosen colour. Every `[data-next-property]` input inside it is collected and attached to the cart line on add, and re-synced whenever the visitor edits one.',
    },
  ],

  readsElsewhere: [
    {
      name: 'data-next-property',
      description:
        'Put on an input, textarea, or select **inside** `data-next-property-container`. Its value becomes the named property on the cart line. Empty inputs are skipped.',
    },
    {
      name: 'data-next-default-property',
      description:
        'Put on an input anywhere in the document. Collected for every add-to-cart button on the page, no container needed. Container properties override defaults with the same key.',
    },
    {
      name: 'data-next-selection-mode',
      description:
        'Read from the *linked selector*, not from the button. In `select` mode the button also accepts a selection carried purely in the DOM, so it enables without waiting for a selection event.',
    },
    {
      name: 'data-selected-package / data-selected-bundle',
      description:
        'Read from the *linked selector* as the DOM fallback for the current selection when no in-memory selection is available yet — for example on a page that renders with a pre-selected card.',
    },
  ],

  sets: [
    {
      name: 'disabled',
      description:
        'Present while a linked selector has no selection, and for the duration of the cart write. Style it, or the visitor can queue duplicate adds.',
    },
    {
      name: 'aria-busy',
      description: 'Set while the cart write is in flight, so the wait is announced.',
      values: '`true` / `false`',
    },
  ],

  classes: [
    {
      name: 'next-disabled',
      description: 'Mirrors the `disabled` attribute while the button has nothing to add.',
    },
    {
      name: 'loading',
      description: 'The cart write is in flight.',
    },
    {
      name: 'next-loading',
      description: 'Namespaced twin of `loading`, for styling that must not collide with page CSS.',
    },
  ],

  emits: ['cart:item-added'],

  conflicts: [
    {
      feature: 'package-selector',
      mode: 'swap',
      because:
        'a swap-mode selector writes to the cart itself on every selection, so pairing it with a button that also writes produces two cart writes per click. Use swap mode without a button, or put the selector in select mode and let the button do the writing.',
    },
  ],
});
