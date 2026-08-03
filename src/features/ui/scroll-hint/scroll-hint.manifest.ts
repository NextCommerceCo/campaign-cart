import { defineFeature } from '@/docs/schema/feature-manifest';

export default defineFeature({
  id: 'scroll-hint',
  category: 'ui',
  status: 'optional',
  summary:
    'Shows a "scroll for more" cue while a scrollable list is at the top and has content below the fold.',
  activates: '[data-next-component="scroll-hint"]',
  logPrefix: 'ScrollHintEnhancer',

  attributes: [
    {
      name: 'data-next-component',
      type: 'string',
      required: true,
      description:
        'Must be `"scroll-hint"`. Marks the element as the cue.',
      values: [
        { value: 'scroll-hint', description: 'Turns this element into a scroll hint.' },
      ],
    },
    {
      name: 'data-next-scroll-target',
      type: 'string (CSS selector)',
      required: false,
      description:
        'The scrollable container to watch. Without it the feature looks for a nearby cart items list, which covers the common case of a hint sitting under one.',
      notes:
        'If neither the selector nor the fallback matches, there is nothing to watch and the hint never appears. Set this explicitly for any list that is not a cart items list.',
    },
    {
      name: 'data-next-scroll-threshold',
      type: 'number (px)',
      required: false,
      default: '5',
      description:
        'How far the visitor may scroll before the hint is considered dismissed. A few pixels of tolerance stops the hint flickering on trackpad drift.',
    },
  ],

  classes: [
    {
      name: 'cart-items__scroll-hint--active',
      description:
        'On the hint while it should be visible: the target is at the top and has more content below. Style the hint as hidden by default and reveal it with this class.',
    },
  ],

  sets: [
    {
      name: 'aria-hidden',
      description:
        'Kept in step with visibility, so a screen reader does not announce a cue that is not showing.',
      values: '`true` / `false`',
    },
  ],

  emits: ['scroll-hint:updated'],

  pairsWith: [
    {
      feature: 'cart-item-list',
      because:
        'a long cart is the case where a scrollable list needs telling the visitor there is more below.',
      caution:
        'The list replaces its `innerHTML` on every cart update. Point the hint at the scroll container rather than at anything the list renders inside it.',
    },
  ],
  sections: [
    {
      title: 'Example',
      body: `
\`\`\`html
<div class="cart-items__list">…many rows…</div>

<div data-next-component="scroll-hint"
     data-next-scroll-target=".cart-items__list"
     class="cart-items__scroll-hint">
  Scroll for more
</div>
\`\`\`

The hint appears only when both things are true: the list is scrolled to the top,
and it actually has content below the fold. A short list therefore never shows a
cue that would be a lie.
`,
    },
  ],
});
