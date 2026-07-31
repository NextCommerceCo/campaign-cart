import { defineFeature } from '@/docs/schema/feature-manifest';

export default defineFeature({
  id: 'simple-exit-intent',
  category: 'behavior',
  status: 'optional',
  summary:
    'Shows one last offer when the visitor looks like they are leaving — pointer heading for the tab bar, or a fast scroll up on mobile.',
  activatedByApi: 'next.exitIntent({ … })',
  apiExample: `window.nextReady.push(() => {
  next.exitIntent({
    image: '/img/exit-offer.jpg',
    // Runs when the visitor clicks the image or the action button.
    action: () => next.applyCoupon('COMEBACK10'),
    actionButtonText: 'Claim 10% off',
    // Show it once per session rather than on every exit gesture.
    maxTriggers: 1,
    useSessionStorage: true,
    // Desktop only: there is no mouse-leave signal on touch devices.
    disableOnMobile: true,
  });
});`,
  logPrefix: 'ExitIntentEnhancer',

  // Started from JavaScript. The attributes below are read from the template you
  // pass in, not from the page.
  attributes: [],

  readsElsewhere: [
    {
      name: 'data-exit-intent-action',
      description:
        'Put on a button inside your `template` to make it the accept action. Clicking it runs the `action` callback, applies `data-coupon-code` if present, and closes the popup.',
    },
    {
      name: 'data-coupon-code',
      description:
        'Put alongside `data-exit-intent-action` to apply a discount code when the visitor accepts, without writing the apply call yourself.',
    },
  ],

  sets: [
    {
      name: 'data-exit-intent',
      description:
        'Set by the feature on the parts it builds, so you can style them: `overlay` on the backdrop, `popup` on the panel, `close` on the close button.',
      values: '`overlay`, `popup`, `close`',
    },
  ],

  emits: [
    'exit-intent:shown',
    'exit-intent:clicked',
    'exit-intent:dismissed',
    'exit-intent:closed',
    'exit-intent:action',
  ],

  sections: [
    {
      title: 'Turning it on',
      body: `
No activating attribute — it is started from JavaScript:

\`\`\`js
next.exitIntent({
  template: \`
    <h2>Wait — 10% off</h2>
    <p>Use code STAY10 at checkout.</p>
    <button data-exit-intent-action data-coupon-code="STAY10">
      Apply my discount
    </button>
  \`,
  action: () => console.log('offer accepted'),
  maxTriggers: 1,
  disableOnMobile: false,
  mobileScrollTrigger: true,
  useSessionStorage: true,
  overlayClosable: true,
  showCloseButton: true,
});

next.disableExitIntent();  // stop watching
\`\`\`

| Option | Meaning |
|---|---|
| \`image\` | Show a single clickable image instead of a template |
| \`template\` | HTML for the popup body |
| \`action\` | Called when the visitor accepts; may be async |
| \`maxTriggers\` | How many times the popup may appear at all |
| \`disableOnMobile\` | Skip mobile entirely, where exit intent is guesswork |
| \`mobileScrollTrigger\` | On mobile, treat a fast scroll up as leaving |
| \`useSessionStorage\` / \`sessionStorageKey\` | Remember that it fired, so a reload does not re-show it |
| \`overlayClosable\` | Let a click on the backdrop dismiss it |
| \`showCloseButton\` | Render the built-in close button |
| \`imageClickable\` | Make the image itself the accept action |
| \`actionButtonText\` | Label for the generated action button |

Pass either \`image\` or \`template\`, not both.
`,
    },
    {
      title: 'Which event to use',
      body: `
Five events fire around one popup, and they are often mistaken for one another:

| Event | Fires when |
|---|---|
| \`exit-intent:shown\` | The popup appeared |
| \`exit-intent:action\` | The visitor **accepted** — this is the conversion signal |
| \`exit-intent:clicked\` | The visitor clicked the popup content, e.g. a clickable image |
| \`exit-intent:dismissed\` | The visitor rejected it — close button, backdrop, or Escape |
| \`exit-intent:closed\` | The popup left the page, for any reason at all |

\`exit-intent:closed\` fires alongside \`dismissed\` **and** after \`action\`, so
counting it as a rejection overstates dismissals. Track \`action\` against
\`dismissed\`.
`,
    },
  ],
});
