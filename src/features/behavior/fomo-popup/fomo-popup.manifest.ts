import { defineFeature } from '@/docs/schema/feature-manifest';

export default defineFeature({
  id: 'fomo-popup',
  category: 'behavior',
  status: 'optional',
  summary:
    'Rotates small social-proof notifications — "Sarah from Denver just bought this" — to show the page has traffic.',
  activatedByApi: 'next.fomo({ … })',
  apiExample: `window.nextReady.push(() => {
  next.fomo({
    // How long each notification stays up, and the gap before the next one.
    displayDuration: 5000,
    delayBetween: 12000,
    initialDelay: 3000,
    // Cap it on small screens, where notifications cover the buy button.
    maxMobileShows: 3,
    // Names shown per country. Leave it out to use the built-in list.
    customers: {
      US: ['Sarah from Austin, TX', 'Mike from Denver, CO'],
      GB: ['Emma from Manchester', 'Tom from Bristol'],
    },
  });
});`,
  logPrefix: 'FomoPopupEnhancer',

  // Configured entirely from JavaScript; there is no markup contract.
  attributes: [],

  classes: [
    {
      name: 'next-fomo-show',
      description:
        'On the notification while it is on screen. Animate in and out from this class — the element itself persists between showings.',
    },
  ],

  emits: ['fomo:shown'],

  requires: [
    {
      name: 'campaignStore',
      because:
        'the notifications name real packages from the campaign, so it waits for campaign data before showing anything.',
    },
  ],
  sections: [
    {
      title: 'Turning it on',
      body: `
This feature has no activating attribute — it is started from JavaScript, so it
will not appear by adding markup:

\`\`\`js
next.fomo({
  items: [
    { text: '3-Pack Bundle', image: 'https://cdn.example.com/pack3.jpg' },
    { text: 'Starter Kit',   image: 'https://cdn.example.com/starter.jpg' },
  ],
  customers: {
    US: ['Sarah from Denver', 'Mike from Austin'],
    CA: ['Emma from Toronto'],
  },
  initialDelay: 5000,
  displayDuration: 4000,
  delayBetween: 12000,
  maxMobileShows: 3,
});
\`\`\`

| Option | Meaning |
|---|---|
| \`items\` | The products to mention, each with the image to show beside it |
| \`customers\` | Customer lines per country code, so the names suit the visitor's region |
| \`initialDelay\` | How long after load the first notification appears, in ms |
| \`displayDuration\` | How long each notification stays, in ms |
| \`delayBetween\` | Gap between notifications, in ms |
| \`maxMobileShows\` | Cap on notifications on small screens, where they cost more attention |

Calling \`next.fomo()\` again reconfigures the running popup rather than starting a
second one.
`,
    },
    {
      title: 'Cautions',
      body: `
- The notifications are **generated from the options you pass**, not from real
  orders. Claiming a specific person bought something when nobody did is a
  misrepresentation in many markets — check what your jurisdiction allows before
  using real-looking names.
- On mobile the cap exists because these overlay the page. Raising
  \`maxMobileShows\` far above its default tends to cost more conversions than it
  wins.
`,
    },
  ],
});
