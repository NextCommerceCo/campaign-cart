import { defineFeature } from '@/core/docs/feature-manifest';

export default defineFeature({
  id: 'timer',
  category: 'display',
  status: 'optional',
  summary:
    'Counts down to a deadline and survives a page reload, so an offer window stays honest.',
  activates: '[data-next-timer]',
  // The display and expired elements are scanned independently, so a countdown's
  // parts work even when they sit outside the timer element.
  alsoActivates: ['[data-next-timer-display]', '[data-next-timer-expired]'],
  logPrefix: 'TimerEnhancer',

  attributes: [
    {
      name: 'data-next-timer',
      type: 'boolean (presence)',
      required: true,
      description: 'Marks the element as a countdown timer.',
    },
    {
      name: 'data-duration',
      type: 'number (seconds)',
      required: true,
      description:
        'How long the countdown runs, in seconds. Counted from the moment the visitor first saw this timer, not from each page load.',
      notes:
        'Missing or non-numeric, the feature throws during init and the timer never starts.',
    },
    {
      name: 'data-persistence-id',
      type: 'string',
      required: false,
      default: 'default-timer',
      description:
        "The key this timer's start time is stored under in `localStorage`. Because the start time persists, reloading the page does not restart the countdown — which is what stops a deadline from being infinitely renewable.",
      notes:
        'Two timers sharing an id share one deadline. Give every distinct offer its own id, or a second timer will silently inherit the first\'s remaining time.',
    },
    {
      name: 'data-format',
      type: 'string',
      required: false,
      default: 'mm:ss',
      description:
        'How the remaining time is rendered — for example `mm:ss` for `04:31`, or a format including hours for a longer window.',
    },
  ],

  readsElsewhere: [
    {
      name: 'data-next-timer-display',
      description:
        "Put on an element inside the timer to receive the formatted time. Without one, the timer element's own text is replaced.",
    },
    {
      name: 'data-next-timer-expired',
      description:
        'Put on an element **anywhere** in the page, carrying the same `data-persistence-id` as the timer. It is revealed when that timer reaches zero — use it for the "offer expired" state.',
    },
  ],

  emits: ['timer:expired'],

  pairsWith: [
    {
      feature: 'conditional-display',
      because:
        'a countdown usually needs the offer it gates to disappear with it, which is a condition rather than a timer concern.',
    },
  ],
  sections: [
    {
      title: 'Example',
      body: `
\`\`\`html
<div data-next-timer data-duration="600" data-persistence-id="flash-sale" data-format="mm:ss">
  Offer ends in <span data-next-timer-display></span>
</div>

<!-- Revealed when the flash-sale timer hits zero; can sit anywhere -->
<div data-next-timer-expired data-persistence-id="flash-sale" hidden>
  This offer has expired.
</div>
\`\`\`

The countdown resumes across reloads because the start time lives in
\`localStorage\` under \`next-timer-flash-sale\`. Clearing site data resets it.
`,
    },
  ],
});
