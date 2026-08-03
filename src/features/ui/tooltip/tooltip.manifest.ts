import { defineFeature } from '@/docs/schema/feature-manifest';

export default defineFeature({
  id: 'tooltip',
  category: 'ui',
  status: 'optional',
  summary:
    'Shows a small explanation on hover or focus — what a fee covers, what a guarantee includes.',
  activates: '[data-next-tooltip]',
  logPrefix: 'TooltipEnhancer',

  attributes: [
    {
      name: 'data-next-tooltip',
      type: 'string',
      required: true,
      description:
        'The text to show. Marks the element as having a tooltip and supplies its content in one attribute.',
    },
    {
      name: 'data-next-tooltip-placement',
      type: 'string',
      required: false,
      default: 'top',
      description:
        'Which side of the element the tooltip prefers. It flips automatically when there is not enough room on that side, so this is a preference rather than a guarantee.',
      values: '`top`, `bottom`, `left`, `right`, and their `-start` / `-end` variants',
    },
    {
      name: 'data-next-tooltip-offset',
      type: 'number (px)',
      required: false,
      default: '8',
      description: 'Gap between the element and the tooltip.',
    },
    {
      name: 'data-next-tooltip-delay',
      type: 'number (ms)',
      required: false,
      default: '500',
      description:
        'How long the pointer must rest before the tooltip appears. The delay is what stops tooltips flickering as the pointer crosses a row of them.',
    },
    {
      name: 'data-next-tooltip-max-width',
      type: 'string (CSS length)',
      required: false,
      default: '200px',
      description:
        'Width at which the text wraps. Accepts any CSS length, so `30ch` or `50%` work as well as pixels.',
    },
    {
      name: 'data-next-tooltip-class',
      type: 'string',
      required: false,
      description:
        'Extra class names put on the tooltip, for a variant that differs from the default styling.',
    },
  ],

  sets: [
    {
      name: 'data-placement',
      description:
        'On the tooltip element: the side it actually rendered on after any flip. The built-in arrow styling keys off this, and so can yours.',
      values: '`top`, `bottom`, `left`, `right`, with `-start` / `-end` variants',
    },
  ],

  classes: [
    {
      name: 'next-tooltip--visible',
      description:
        'On the tooltip while it is shown. Animate from this rather than from the element being inserted.',
    },
  ],

  emits: [],

  sections: [
    {
      title: 'Example',
      body: `
\`\`\`html
<span data-next-tooltip="Charged once, not per shipment."
      data-next-tooltip-placement="right"
      data-next-tooltip-max-width="28ch">
  What is this fee?
</span>
\`\`\`

The tooltip is appended to the page rather than nested inside the element, so a
parent with \`overflow: hidden\` cannot clip it. Style it with
\`.next-tooltip\`, or pass your own class through
\`data-next-tooltip-class\`.
`,
    },
  ],
});
