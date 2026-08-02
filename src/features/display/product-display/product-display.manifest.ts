import { defineFeature } from '@/docs/schema/feature-manifest';

export default defineFeature({
  id: 'product-display',
  category: 'display',
  status: 'core',
  summary:
    "Shows a campaign package's own name, price, and savings — before anything is in the cart.",
  activates: '[data-next-display]',
  logPrefix: 'ProductDisplayEnhancer',
  // Keeps its When / Meaning / Action prose; the drift test checks coverage
  // instead of overwriting. See FeatureManifest.pages.
  pages: { logs: 'hand-written', errors: 'hand-written', relations: 'hand-written', getStarted: 'hand-written' },
  displayNamespace: 'package',
  // Fifteen of the routed `package.` paths have no branch anywhere: they are the
  // API's own field names, and `getPackageValue` reads them straight off the
  // package. `Package` declaring the field is what makes each of them work.
  displayFallback: [{ shape: 'Package' }],
  // `campaign.` is answered by the same `getPropertyValue`, behind
  // `this.displayPath?.startsWith('campaign.')`, but nothing routes it —
  // `PROPERTY_MAPPINGS` has no `campaign` entry — so it needs its own prose the
  // same way `selector`/`bundle`/`toggle` do. It used to be undocumented
  // everywhere: not in PROPERTY_MAPPINGS, not on any page, and invisible to
  // `docs:coverage` because that scan counts by owning feature, not by
  // namespace (finding 143 in docs/code-findings.md).
  additionalDisplayNamespaces: [
    {
      namespace: 'campaign',
      displayPaths: {
        prefix: 'campaign',
        intro:
          'with no package id in front of it — a campaign has exactly one ' +
          'active currency and language at a time, so there is nothing to select between.',
        example:
          '<!-- The campaign\'s own name, currency, and language -->\n' +
          '<span data-next-display="campaign.name"></span>\n' +
          '<span data-next-display="campaign.currency"></span>\n' +
          '<span data-next-display="campaign.language"></span>',
        paths: [
          {
            name: 'name',
            description: "The campaign's display name, as configured in NextCommerce.",
          },
          {
            name: 'currency',
            description:
              'The ISO 4217 code of the currency prices are shown in on this page ' +
              '(e.g. `USD`) — the same value `useCampaignStore.getState().data.currency` holds.',
          },
          {
            name: 'language',
            description:
              'The BCP 47 language tag the campaign is configured for (e.g. `en`) — ' +
              'not the visitor\'s browser language.',
          },
        ],
        cautions: [
          'Any other property after `campaign.` — `campaign.price`, ' +
            '`campaign.id`, anything not `name`/`currency`/`language` — falls through ' +
            'to `getCampaignProperty`\'s `default` case, which logs ' +
            '`Unknown campaign property: {property}` and renders nothing. There is no ' +
            'alias to `package.` here: a per-package value needs `package.{id}.{property}` instead.',
        ],
      },
    },
  ],

  attributes: [
    {
      name: 'data-next-multiply-quantity',
      type: 'boolean (presence)',
      required: false,
      description:
        "Scales the value by the quantity currently chosen, so a per-unit price reads as the pack total the visitor would actually pay.",
    },
    {
      name: 'data-next-quantity-selector-id',
      type: 'string',
      required: false,
      description:
        'Which selector supplies that quantity, by id. Use it when the price sits outside the selector whose stepper drives it.',
    },
    {
      name: 'data-next-selector-id',
      type: 'string',
      required: false,
      description:
        'Read from an enclosing selector so a price inside a card follows that card without being configured.',
    },
  ],

  readsElsewhere: [
    {
      name: 'data-next-upsell / data-next-upsell-quantity',
      description:
        'Read from an enclosing upsell offer, so a price shown inside an offer reflects the offer quantity rather than a cart line.',
    },
    {
      name: 'data-container',
      description:
        'Read while walking up the DOM to find the element a price belongs to, for markup that groups a package without using a selector card.',
    },
  ],

  emits: [],

  sections: [
    {
      title: 'Modifiers',
      body: `
Formatting and hiding work the same as for every display namespace —
\`data-next-format\`, \`data-hide-if-zero\`, \`data-hide-if-false\`,
\`data-hide-zero-cents\`, \`data-multiply-by\`, \`data-divide-by\`. They are
documented once in
[display-core](../../../../display/display-core/guide/reference/attributes.md).

This same enhancer also answers a \`campaign.\` namespace — the campaign's own
\`name\`, \`currency\` and \`language\`, with no package id in front of it. It is
not an alias for \`package.\`: it answers exactly those three properties, not
every \`package.\` one. See
[its display-paths reference](./display-paths-campaign.md).

\`\`\`html
<!-- A package's price, and its per-unit price -->
<span data-next-display="package.101.price"></span>
<span data-next-display="package.101.price" data-divide-by="3"></span>

<!-- Savings, hidden entirely when there are none -->
<span data-next-display="package.101.savingsAmount" data-hide-if-zero="true"></span>
\`\`\`
`,
    },
  ],
});
