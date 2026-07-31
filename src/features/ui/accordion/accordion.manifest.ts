import { defineFeature } from '@/core/docs/feature-manifest';

export default defineFeature({
  id: 'accordion',
  category: 'ui',
  status: 'optional',
  summary:
    'Collapses a section behind a trigger — an order summary on mobile, an FAQ, a shipping-details panel.',
  activates: '[data-next-accordion]',
  logPrefix: 'AccordionEnhancer',

  attributes: [
    {
      name: 'data-next-accordion',
      type: 'string (id)',
      required: true,
      description:
        'Marks the accordion and names it. The value is an id you choose; the trigger, panel, and text elements below use the same id to opt in, which is how several accordions coexist on one page.',
    },
    {
      name: 'data-initial-state',
      type: "'open' | 'closed'",
      required: false,
      default: 'closed',
      description: 'Whether the section starts expanded or collapsed.',
      values: [
        { value: 'open', description: 'Expanded on load.' },
        { value: 'closed', description: 'Collapsed on load.' },
      ],
    },
    {
      name: 'data-toggle-class',
      type: 'string',
      required: false,
      default: 'next-expanded',
      description:
        'The class added to the accordion while it is open. Change it to match a class your stylesheet already uses instead of writing new CSS.',
    },
    {
      name: 'data-animation-duration',
      type: 'number (ms)',
      required: false,
      default: '300',
      description:
        'How long the expand and collapse animation runs. Set `0` to switch instantly.',
    },
    {
      name: 'data-open-text',
      type: 'string',
      required: false,
      description:
        'Label written into the text element when the section **opens** — so it names the action that is now available, closing it. Default `Hide`.',
      notes:
        'The names read backwards at first: `data-open-text` is the label while open, not the label that invites opening. The defaults are the clue — `Hide` for open, `Show` for closed.',
    },
    {
      name: 'data-close-text',
      type: 'string',
      required: false,
      description:
        'Label written into the text element when the section **closes**, e.g. `Show order summary`. Default `Show`. This is what a collapsed accordion displays, including on first load.',
    },
  ],

  readsElsewhere: [
    {
      name: 'data-next-accordion-trigger',
      description:
        'The clickable element, carrying the same id as the accordion. Required — with none, the accordion logs a warning naming the id it looked for and nothing is clickable.',
    },
    {
      name: 'data-next-accordion-panel',
      description:
        'The element that expands and collapses, carrying the same id. Required — with none, the accordion warns and there is nothing to reveal.',
    },
    {
      name: 'data-next-accordion-text',
      description:
        'Optional element whose text is swapped between `data-open-text` and `data-close-text`. Without it those labels have nowhere to go.',
    },
  ],

  emits: ['accordion:toggled', 'accordion:opened', 'accordion:closed'],

  sections: [
    {
      title: 'Example',
      body: `
Every part carries the same id — \`order-summary\` here:

\`\`\`html
<div data-next-accordion="order-summary"
     data-initial-state="closed"
     data-open-text="Hide order summary"
     data-close-text="Show order summary">

  <div data-next-accordion-trigger="order-summary">
    <span data-next-accordion-text="order-summary">Show order summary</span>
  </div>

  <div data-next-accordion-panel="order-summary">
    <div data-next-cart-summary>…</div>
  </div>
</div>
\`\`\`

Subscribe to \`accordion:toggled\` and read \`isOpen\` rather than listening for
\`accordion:opened\` and \`accordion:closed\` separately — one handler covers both
directions.
`,
    },
  ],
});
