/**
 * Attributes that belong to the SDK itself rather than to any one feature.
 *
 * Every other attribute in the docs is owned by a feature manifest. These are not:
 * they are read or written by the boot sequence, the shared base class, the
 * attribution collector, or the DOM observer — so no feature is their rightful
 * home, and before this list they were documented nowhere.
 *
 * Build-time only, like the manifests: nothing under `src/` may import this.
 */

import type { AttributeDoc } from '../schema/feature-manifest';

/** One SDK-level attribute, with the subsystem that owns it. */
export interface SdkAttributeDoc extends AttributeDoc {
  /** Which part of the SDK reads or writes it, for the reader's orientation. */
  owner: string;
  /** True when the SDK writes it and you read it, rather than the reverse. */
  setBySdk?: boolean;
}

/**
 * Classes the SDK applies outside any feature — on `<html>` or `<body>` — as boot
 * signals. Like the attributes below, no feature owns them.
 */
export const SDK_CLASSES: Array<{ name: string; owner: string; description: string }> = [
  {
    name: 'next-display-ready',
    owner: 'SDK boot',
    description:
      'Added to `<html>` once display bindings have resolved their first values. Pair it with `data-next-sdk-loading` on `<body>`: the attribute says the SDK is running, this class says the page is safe to show.',
  },
];

export const SDK_ATTRIBUTES: SdkAttributeDoc[] = [
  {
    name: 'data-next-sdk-loading',
    owner: 'SDK boot',
    type: "'true' | 'false'",
    setBySdk: true,
    description:
      'Set on `<body>`: `true` while the SDK is starting, `false` once it is ready. Style your page off this to avoid the flash of un-enhanced markup — prices reading `{price}` and empty cart totals — before the SDK has run.',
    notes:
      'It is on `<body>`, not on any feature element, so a rule like `body[data-next-sdk-loading="true"] .price { visibility: hidden }` is the intended use.',
  },
  // An entry for the page type used to sit here, described as a data attribute. No
  // such attribute exists: the value is read from `<meta name="next-page-type">`
  // (config.state.ts, upsell.handlers.ts, RudderStackAdapter, UpsellSelector) and
  // never from markup on an element, so an author who followed that entry got no
  // page type at all. It is documented once, correctly, as a meta tag in
  // `meta-tags.ts`.
  //
  // Do not name the old attribute in full anywhere under `src/` — `docs-coverage`
  // scans source for `data-next-` tokens and cannot tell a real attribute from one
  // merely mentioned in a comment, so writing it out re-opens the gap it closed.
  {
    name: 'data-next-tracking-tag',
    owner: 'Attribution',
    type: 'string (meta tag)',
    description:
      'Read from a `<meta>` tag, not from an element: `<meta name="data-next-tracking-tag" data-tag-name="funnel_name" content="…">`. Supplies campaign attribution values that are attached to the order.',
    notes:
      'The legacy `os-tracking-tag` meta name is still read as a fallback.',
  },
  {
    name: 'data-loading-text',
    owner: 'Shared action base',
    type: 'string',
    setBySdk: true,
    description:
      'Set on any action element — an add-to-cart or accept-upsell button — while its work is in flight, carrying the loading label. Available on every action feature rather than declared by each one.',
  },
  {
    name: 'data-next-validate',
    owner: 'DOM observer',
    type: 'string',
    description:
      'Watched by the DOM observer, so changing it re-runs the affected validation rather than needing a manual refresh. Relevant when your own code drives validation state.',
  },
  {
    name: 'data-next-await',
    owner: 'Debug overlay',
    type: 'boolean (presence)',
    description:
      'Recognised by the debug x-ray overlay, which highlights elements waiting on SDK data. It has no effect on a production page.',
    notes:
      'No non-debug code reads it. Treat it as a debugging aid, not a supported page attribute.',
  },
  {
    name: 'data-next-toggle',
    owner: 'DOM observer / debug overlay',
    type: 'boolean (presence)',
    description:
      'Watched by the DOM observer and highlighted by the debug overlay. For the package toggle feature use `data-next-package-toggle` — this shorter name is not its activating attribute.',
    notes:
      'Easy to confuse with `data-next-package-toggle`. Adding this one does not create a toggle.',
  },
];
