/**
 * Sidebar placement for the guide markdown the docs site publishes.
 *
 * Every `.md` file in a feature's `guide/` folder, a store's `guide/` folder, or
 * `src/core/guide/` is rendered as a page of the TypeDoc site. TypeDoc decides where
 * a page sits in the sidebar from three YAML frontmatter keys, and this module is the
 * one place that writes them:
 *
 * | Key | What TypeDoc does with it |
 * |---|---|
 * | `title` | Becomes the page's **name**, which drives both the sidebar tree and the URL. A `/` in it is a tree level, so `Features/Cart/Quantity Control/Attributes` reads **Features › Cart › Quantity Control › Attributes** and lands at `documents/Features_Cart_Quantity_Control_Attributes.html`. |
 * | `group` | The top-level area the page belongs to — `Features`, `Core`, `State`. |
 * | `category` | The feature, store, or subsystem that owns the page. Sections on the site's index page come from this. |
 *
 * Two things to know before changing anything here:
 *
 * - **`title` is the URL.** Renaming one moves a published page, so treat a change to
 *   {@link featureNavTitle}, {@link stateNavTitle} or {@link coreNavTitle} as a
 *   breaking change to customer links, not as a cosmetic edit.
 * - **Values are double-quoted on purpose.** The drift tests ban the dismissive words
 *   from `.claude/rules/documentation.md` §2 and strip quoted copy before searching,
 *   so the feature genuinely named `simple-exit-intent` can carry a readable title
 *   without failing its own guide.
 *
 * Frontmatter on a **generated** page is written by the `render-*.ts` module that owns
 * it, so the drift tests keep it current. Frontmatter on a **hand-written** page is
 * committed in the file.
 */

import type { FeatureCategory, FeatureManifest } from './feature-manifest';
import type { StateManifest } from './state-manifest';

/** The sidebar label for each feature category folder. */
export const FEATURE_CATEGORY_LABELS: Record<FeatureCategory, string> = {
  cart: 'Cart',
  checkout: 'Checkout',
  display: 'Display',
  order: 'Order',
  ui: 'UI',
  behavior: 'Behavior',
};

/**
 * Words a plain capitalisation would get wrong. Acronyms stay upper, and the short
 * joining words stay lower unless they open the label — `add-to-cart` should read
 * "Add to Cart", not "Add To Cart".
 */
const WORD_CASE: Record<string, string> = {
  api: 'API',
  cta: 'CTA',
  dom: 'DOM',
  fomo: 'FOMO',
  ga4: 'GA4',
  html: 'HTML',
  id: 'ID',
  js: 'JS',
  sdk: 'SDK',
  ui: 'UI',
  url: 'URL',
  utm: 'UTM',
  a: 'a',
  an: 'an',
  and: 'and',
  for: 'for',
  in: 'in',
  of: 'of',
  on: 'on',
  the: 'the',
  to: 'to',
};

/**
 * Turns a kebab-case file or folder name into a sidebar label:
 * `object-attributes` → `Object Attributes`, `url-parameters` → `URL Parameters`,
 * `add-to-cart` → `Add to Cart`.
 */
export function navLabel(kebab: string): string {
  return kebab
    .split('-')
    .map((word, index) => {
      const cased = WORD_CASE[word];
      if (cased && (index > 0 || cased === cased.toUpperCase())) return cased;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/** The frontmatter block, including the blank line that separates it from the body. */
function frontmatter(title: string, group: string, category: string): string {
  return [
    '---',
    `title: "${title}"`,
    `group: "${group}"`,
    `category: "${category}"`,
    '---',
    '',
    '',
  ].join('\n');
}

/**
 * Where a feature's guide page sits: `Features/<Category>/<Feature>/<Page>`.
 *
 * `leaf` is the page label, not the file name — pass `Attributes`, not
 * `attributes.md`.
 *
 * @example
 * featureNavTitle(quantityControl, 'Attributes');
 * // → 'Features/Cart/Quantity Control/Attributes'
 */
export function featureNavTitle(
  manifest: FeatureManifest,
  leaf: string
): string {
  return [
    'Features',
    FEATURE_CATEGORY_LABELS[manifest.category],
    navLabel(manifest.id),
    leaf,
  ].join('/');
}

/** Frontmatter for one page of a feature's guide. */
export function featureNav(manifest: FeatureManifest, leaf: string): string {
  return frontmatter(
    featureNavTitle(manifest, leaf),
    'Features',
    navLabel(manifest.id)
  );
}

/**
 * Where a store's guide page sits: `State/<Store>/<Page>`.
 *
 * @example
 * stateNavTitle(cartStoreManifest, 'State Reference');
 * // → 'State/Cart/State Reference'
 */
export function stateNavTitle(manifest: StateManifest, leaf: string): string {
  return ['State', navLabel(manifest.id), leaf].join('/');
}

/** Frontmatter for one page of a store's guide. */
export function stateNav(manifest: StateManifest, leaf: string): string {
  return frontmatter(
    stateNavTitle(manifest, leaf),
    'State',
    `${navLabel(manifest.id)} Store`
  );
}

/**
 * Which folder of `src/core/guide/` a page belongs to. `null` is the guide root —
 * `overview.md` alone.
 */
export type CoreSection = 'Reference' | 'Subsystems' | null;

/**
 * Where a core guide page sits: `Core/Reference/<Page>`,
 * `Core/Subsystems/<Page>`, or `Core/<Page>` for the guide root.
 *
 * @example
 * coreNavTitle('Reference', 'URL Parameters'); // → 'Core/Reference/URL Parameters'
 */
export function coreNavTitle(section: CoreSection, leaf: string): string {
  return ['Core', ...(section ? [section] : []), leaf].join('/');
}

/** Frontmatter for one page of `src/core/guide/`. */
export function coreNav(section: CoreSection, leaf: string): string {
  return frontmatter(
    coreNavTitle(section, leaf),
    'Core',
    section ? `Core ${section}` : 'Core'
  );
}

/**
 * Where a cross-cutting index page sits: `Reference/<Page>`.
 *
 * For the pages that belong to no feature, store, or subsystem — the site-wide
 * attribute indexes generated into `docs/` — so they get their own top-level area
 * beside Features, State and Core rather than being filed under an unrelated owner.
 *
 * @example
 * referenceNavTitle('All Attributes'); // → 'Reference/All Attributes'
 */
export function referenceNavTitle(leaf: string): string {
  return `Reference/${leaf}`;
}

/** Frontmatter for a cross-cutting index page. */
export function referenceNav(leaf: string, category = 'Attributes'): string {
  return frontmatter(referenceNavTitle(leaf), 'Reference', category);
}
