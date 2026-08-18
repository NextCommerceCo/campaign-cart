/**
 * The typed HTML contract of a feature — its activating selector, the attributes
 * it reads, what it writes back to the DOM, and the events it emits.
 *
 * A manifest is the single source of truth for a feature's reference docs. The
 * generator turns it into `guide/reference/attributes.md` and
 * `guide/reference/events.md`, and a drift test checks it against the source, so
 * a renamed attribute or event cannot quietly leave the docs behind.
 *
 * **Manifests are build-time only.** Nothing under `src/` may import one: they
 * carry prose, and a runtime import would ship every description in the bundle
 * that loads on customer landing pages. The link to runtime behaviour is
 * enforced by a test that compares {@link FeatureManifest.activates} against
 * `AttributeScanner`'s selector list, not by importing manifests into it.
 *
 * @see docs/documentation-plan.md
 */

import type { EventMap } from '@/types/global';

/** How prominently a feature should appear in the catalog. */
export type FeatureStatus =
  /** One of the handful of features every campaign page uses. */
  | 'core'
  /** Useful, but a page works without it. */
  | 'optional'
  /** Still functions; do not use in new work. */
  | 'deprecated';

export type FeatureCategory =
  | 'cart'
  | 'checkout'
  | 'display'
  | 'order'
  | 'ui'
  | 'behavior';

/** One accepted value of an enumerated attribute, and what choosing it does. */
export interface AttributeValue {
  value: string;
  /** What this value makes the feature do, in product terms. */
  description: string;
}

/** An attribute the integrator writes in their HTML. */
export interface AttributeDoc {
  /** Exact attribute name, e.g. `data-next-quantity`. */
  name: string;
  /**
   * Heading to file this attribute under, e.g. `Container attributes` /
   * `Card attributes`. Attributes with no group are listed first, ungrouped.
   * Groups render in the order they first appear.
   */
  group?: string;
  /** TypeScript-ish type as the reader should think of it, e.g. `number`. */
  type: string;
  /** Whether the feature throws or does nothing without it. */
  required?: boolean;
  /** Value used when the attribute is absent. Omit when there is no default. */
  default?: string;
  /**
   * Markdown. What it does and how changing it changes behaviour.
   *
   * Required when the feature's `reference` is `generated`. Omit it under
   * `hand-written`, where the prose lives in the guide and repeating it here
   * would be a second copy to drift.
   */
  description?: string;
  /** Enumerated values, or a free-text constraint like `positive integer`. */
  values?: AttributeValue[] | string;
  /** Markdown. The trap, the symptom, and the fix. */
  notes?: string;
}

/** Something the feature writes to the DOM — an attribute, class, or token. */
export interface WrittenDoc {
  /** Attribute name, class name, or token, e.g. `data-quantity`, `{step}`. */
  name: string;
  /** When it appears and what a reader can infer from it. */
  description: string;
  /** The values it takes, when it is not free-form. */
  values?: string;
  /** The trap, the symptom, and the fix. Appended to the description. */
  notes?: string;
}

/**
 * One error a reader can hit, and what to do about it.
 *
 * The message is checked against the feature's source, so it cannot drift from what
 * is actually thrown. Everything else is judgement a generator cannot supply —
 * `.claude/rules/guide.md` forbids documenting an error without saying whether it is
 * recoverable, because that is the first thing a reader needs to know.
 */
export interface ErrorDoc {
  /**
   * The exact message, as thrown. Must appear verbatim in the feature's source, or
   * set {@link fromApi} for one that originates outside it.
   */
  message: string;
  /**
   * `recoverable` — the visitor can get past it by retrying or correcting input; no
   * code change needed. `fatal` — it needs a code, markup, or config change, and
   * will happen every time until then.
   */
  kind: 'recoverable' | 'fatal';
  /** What produced it. */
  cause: string;
  /** Actionable steps. Markdown; a code block is fine. */
  fix: string;
  /**
   * Set when the message comes from the API or another feature rather than being
   * thrown here, which exempts it from the source check. These matter to a reader
   * even though this feature does not raise them.
   */
  fromApi?: boolean;
}

export interface FeatureConflict {
  /** The other feature's manifest `id`. */
  feature: string;
  /** The conflicting mode, when only one mode conflicts. */
  mode?: string;
  /** What actually breaks. Never just "they conflict". */
  because: string;
}

/**
 * A link from this feature to another, for `relations.md`.
 *
 * The distinction from {@link FeatureConflict} matters and is easy to get wrong: a
 * conflict means **do not use these together**, while a pairing with a `caution` is
 * the recommended combination that happens to have a trap in it. Filing a pairing
 * under conflicts gives a reader the opposite of the advice they need — it happened
 * to `quantity-control` + `cart-item-list`, which are the standard cart-row pairing.
 */
export interface FeatureLink {
  /** The other feature's manifest `id`. Checked against the set of manifests. */
  feature: string;
  /** The relevant mode, when it only applies to one. */
  mode?: string;
  /** Why they go together, or what this one needs the other for. */
  because: string;
  /** For a pairing: the trap, its symptom, and the fix. */
  caution?: string;
}

/** Something outside `features/` that a feature needs — a store, a service, a package. */
export interface ExternalDependency {
  /** e.g. `cartStore`, `@floating-ui/dom`. */
  name: string;
  /** What breaks without it. */
  because: string;
}

/**
 * Who owns the feature's `reference/attributes.md` and `reference/events.md`.
 *
 * `generated` (the default) is the goal: the manifest carries the prose and the
 * pages are written from it, so they cannot drift.
 *
 * `hand-written` exists for features whose reference is long-form and already
 * good — `bundle-selector`'s runs to 850 lines of worked examples and grammar
 * that would read worse as table rows, and moving it into a TypeScript literal
 * would make it harder to edit for no reader benefit. Under this mode the
 * manifest is the **inventory** only: it still feeds the global attribute index
 * and the feature catalog, and the drift test still checks the inventory against
 * the source *and* against the hand-written page, so an attribute cannot be added
 * to the code and missed by the docs. It simply does not overwrite the page.
 */
export type ReferenceOwner = 'generated' | 'hand-written';

export interface FeatureManifest {
  /** Kebab-case id, matching the feature folder name. */
  id: string;
  category: FeatureCategory;
  status: FeatureStatus;
  /** Who owns the reference pages. Defaults to `generated`. */
  reference?: ReferenceOwner;
  /**
   * Who owns each of the two pages that are generated from the *source* rather than
   * from this manifest. Both default to `generated`.
   *
   * `hand-written` exists because a page in the older When / Meaning / Action shape
   * says what to **do** about a message or an error, which no generator can derive
   * — that prose is the most valuable part of those pages, so it is kept. Under that
   * mode the drift test checks coverage instead of overwriting:
   *
   * - `logs` — the page must mention every `error` and `warn` the feature can print.
   *   Those are what a reader looks up after something broke; a `debug` line is read
   *   in the context of the ones around it.
   * - `errors` — the page must mention every message the feature's own code throws.
   *
   * Independent of {@link reference}: a feature can have a generated attributes page
   * and a hand-written logs page.
   */
  pages?: {
    logs?: ReferenceOwner;
    errors?: ReferenceOwner;
    /**
     * `relations.md`. Unlike the other two this is generated entirely from the
     * manifests, so `hand-written` is a migration step rather than a destination —
     * the generated page derives inbound links from every other manifest, which a
     * hand-written one cannot do.
     */
    relations?: ReferenceOwner;
    /**
     * `get-started.md`. Also generated from the manifest — the prerequisites are
     * `dependsOn` and `requires`, the markup is the required attributes plus the
     * fixture-verified snippet, and the verify step is the feature's own init log and
     * its events. `hand-written` is for the pages that walk through several setup
     * options, which a generator cannot choose between.
     */
    getStarted?: ReferenceOwner;
  };
  /** One line: what problem this solves. Used in the feature catalog. */
  summary: string;
  /**
   * The CSS selector `AttributeScanner` matches to instantiate this feature.
   * Must appear verbatim in `src/core/attribute-scanner.ts`.
   *
   * Omit it only for a feature turned on from JavaScript instead of from markup —
   * then set {@link FeatureManifest.activatedByApi}. Exactly one of the two is
   * required, so a feature can never claim no way of being switched on.
   */
  activates?: string;
  /**
   * Further selectors `AttributeScanner` queries for this same feature. Several
   * features have more than one entry point — `conditional-display` answers both
   * `data-next-show` and `data-next-hide`, `upsell` both of its selector forms —
   * and a reader needs to know that either turns the feature on. Every scanner
   * selector must be claimed here or by {@link FeatureManifest.activates}.
   */
  alsoActivates?: string[];
  /**
   * For a feature with no activating attribute: the `window.next` call that turns
   * it on, e.g. `next.exitIntent({ … })`. These features are invisible to a reader
   * scanning attribute docs, so the call has to be stated somewhere.
   */
  activatedByApi?: string;
  /** The `Logger` prefix this feature logs under, for the logs reference. */
  logPrefix: string;
  /**
   * Extra files or folders this feature's code lives in, relative to the manifest.
   *
   * A feature with its own folder owns everything under it, and a flat feature owns
   * the files named after it. Neither covers a feature whose implementation is split
   * into shared helper folders — `checkout-form` delegates to `services/`, and the
   * display core reads context in `display-context.ts`. Without naming those, the
   * drift check would reject attributes the feature genuinely reads.
   *
   * List only what the feature actually owns: anything listed here can satisfy its
   * attribute and event checks.
   *
   * An entry starting with `src/` is resolved from the source root instead, which is
   * how a feature claims genuinely shared code — `data-next-discounts` is rendered
   * by `src/core/rendering/discount-renderer.ts` on behalf of three features, and each
   * of them names it here.
   */
  extraSource?: string[];
  /**
   * For a `data-next-display` feature: the namespace it answers, e.g. `cart` or
   * `package`. Set it and the reference gains `reference/display-paths.md`, a table
   * of every path available under that namespace, read out of the SDK rather than
   * transcribed.
   *
   * The list comes from the enhancer that resolves the namespace — its
   * `getPropertyValue` and whatever that hands the path on to. `PROPERTY_MAPPINGS` in
   * `core/base/display-types.ts` routes five of the namespaces, but a routing entry
   * is a format and a fallback, not a promise that anything resolves the path, so it
   * is checked against the resolver rather than published as if it were the answer.
   * Reading it as the answer put ten paths that render nothing on the `cart.` page
   * (finding 127 in `docs/code-findings.md`).
   *
   * A namespace nothing resolves fails the drift test instead of publishing "no
   * paths".
   */
  displayNamespace?: string;
  /**
   * For a namespace whose resolver ends in
   * `PropertyResolver.getNestedProperty(data, path)`: the declared types that read
   * lands on, so a routing entry with no branch behind it can still be proved.
   *
   * `package.price_retail_total` has no `case` anywhere and works, because `Package`
   * has that field. Without this the gate would report fifteen live paths as dead;
   * with a hand-kept allowlist instead, it would be the same unchecked list that put
   * four fictional properties on `bundle-selector`'s page. Every entry here is
   * checked twice — the resolver must really have such a branch, and the type must
   * really declare the field.
   *
   * Order matters: the first entry whose {@link DisplayFallback.mappedPrefix} the
   * routed path starts with wins.
   */
  displayFallback?: DisplayFallback[];
  /**
   * Paths `PROPERTY_MAPPINGS` declares for this namespace that nothing resolves.
   *
   * These render nothing — or worse, a routing entry's `fallback` value, which looks
   * deliberate. They are published rather than dropped because the names are already
   * out there on live pages, and "this one does nothing, use that one" is the answer
   * the reader is looking for.
   *
   * The set is checked against the code, both ways: a name here that the resolver
   * *does* answer fails, and a routing entry that nothing answers and is not listed
   * here fails. So the list can only shrink, and only by making the path work.
   */
  displayUnanswered?: UnansweredPath[];
  /**
   * Prose for {@link displayNamespace}'s page: what each path means, and the markup
   * grammar around it.
   *
   * The split is the same one {@link errors} uses. The **source** decides which paths
   * exist — the drift test rejects a documented path the code cannot answer and an
   * answered path with no entry here — while the manifest carries what no generator
   * can derive: what a value means in product terms, how the prefix is written, and
   * the traps.
   *
   * Required for a namespace answered by an enhancer, because those pages replaced
   * hand-written ones whose per-path prose is the reason to read them.
   */
  displayPaths?: DisplayPathsDoc;
  /**
   * Further `data-next-display` namespaces this same feature answers, besides
   * {@link displayNamespace}.
   *
   * `ProductDisplayEnhancer` is the reason this exists: it resolves both `package.`
   * and `campaign.` out of one `getPropertyValue`, and the second was invisible to
   * every gate above — `PROPERTY_MAPPINGS` has no entry for it, `docs:coverage`
   * counted the feature as covered because it scores by *owning feature*, and no
   * `displayPaths` prose existed for it to document. A namespace here gets exactly
   * the same treatment as {@link displayNamespace}: its own generated
   * `reference/display-paths-{namespace}.md`, checked both ways against the
   * resolver, with its own {@link displayFallback} and {@link displayUnanswered}.
   *
   * Set {@link AdditionalDisplayNamespace.namespace} to the literal
   * `AttributeScanner` routes to this feature — `campaign` for
   * `parsed.object === 'package' || parsed.object === 'campaign'`.
   */
  additionalDisplayNamespaces?: AdditionalDisplayNamespace[];
  /** Attributes the integrator writes on the activated element. Required first. */
  attributes: AttributeDoc[];
  /**
   * Attributes this feature reads from *other* elements — inputs elsewhere in the
   * page, or a linked selector. Readers hunt for these for hours otherwise,
   * because they are not on the element the feature is bound to.
   */
  readsElsewhere?: WrittenDoc[];
  /** Attributes the feature sets on the element for CSS and debugging. */
  sets?: WrittenDoc[];
  /** CSS classes the feature toggles. */
  classes?: WrittenDoc[];
  /** Template tokens the feature substitutes in the element's content. */
  tokens?: WrittenDoc[];
  /** Events emitted, as `EventMap` keys — a renamed event fails type-check. */
  emits: (keyof EventMap)[];
  /**
   * Errors a reader can hit, for the generated `reference/errors.md`. Leave it off a
   * feature that throws nothing — the page then says so, which is the answer someone
   * checking "can this fail?" came for.
   */
  errors?: ErrorDoc[];
  /**
   * A runnable snippet for a feature turned on from JavaScript. Required in practice
   * for anything with {@link activatedByApi}: without it `get-started.md` can only say
   * "call the method", and `.claude/rules/guide.md` forbids a `…` placeholder standing
   * in for the arguments a reader actually needs.
   */
  apiExample?: string;
  /**
   * Other features this one needs on the page to work at all — `add-to-cart` in
   * selector-linked mode cannot resolve a package without its selector.
   */
  dependsOn?: FeatureLink[];
  /**
   * Features commonly used with this one, and what the combination achieves. Put the
   * trap in `caution`.
   *
   * Only one side needs to declare a pairing: `relations.md` derives the reverse from
   * every other manifest, so the reader sees it from both pages.
   */
  pairsWith?: FeatureLink[];
  /** Stores, services, or npm packages this feature needs. */
  requires?: ExternalDependency[];
  conflicts?: FeatureConflict[];
  /**
   * Free markdown appended after the attribute tables — for contracts that are
   * not one-attribute-per-row, such as a display-path grammar or a resolution
   * order between three competing template sources. Use it rather than flatten
   * such a contract into rows that lose its shape.
   */
  sections?: FeatureSection[];
}

export interface FeatureSection {
  title: string;
  /** Markdown body. Headings inside it must start at `###` or deeper. */
  body: string;
}

/** What one `data-next-display` path shows, for the namespace's paths page. */
export interface DisplayPathDoc {
  /**
   * The property as written after the prefix, e.g. `unitPrice`. Must be one the
   * owning enhancer resolves — the drift test checks the whole set both ways.
   */
  name: string;
  /**
   * Heading to file the path under, e.g. `Price`. Paths with no group render in one
   * table before the grouped ones; groups render in the order they first appear.
   */
  group?: string;
  /** What the value means in product terms. Markdown; keep it to a table cell. */
  description: string;
}

/**
 * Where a namespace's resolver reads a path it has no branch for.
 *
 * @example
 * ```ts
 * // order.total routes to `order.total_incl_tax`, read off the Order; everything
 * // else routes to a field of the store state.
 * displayFallback: [{ mappedPrefix: 'order.', shape: 'Order' }, { shape: 'OrderState' }]
 * ```
 */
export interface DisplayFallback {
  /**
   * The prefix a routed path must start with to land on this shape, stripped before
   * the field is looked up. Omit it for the shape everything else lands on.
   */
  mappedPrefix?: string;
  /** Name of the interface the read lands on — `Package`, `Order`, `OrderState`. */
  shape: string;
}

/** One routing-table entry that no branch and no data field answers. */
export interface UnansweredPath {
  /** The name as `PROPERTY_MAPPINGS` spells it, without the namespace. */
  name: string;
  /**
   * What to write instead. A path of this namespace named in backticks is checked
   * against the answered list, so a caution cannot point at a second dead path.
   */
  instead: string;
}

/**
 * The prose half of `reference/display-paths.md`. The path list itself comes from
 * the code — see {@link FeatureManifest.displayPaths}.
 */
export interface DisplayPathsDoc {
  /**
   * Everything a reader writes before the property, with runtime values as `{TOKEN}`
   * — `bundle.{bundleId}`, `selector.{selectorId}.{packageId}`. Its segment count is
   * checked against the segments the enhancer parses, so a class that starts reading
   * one more segment cannot leave this claim behind.
   */
  prefix: string;
  /**
   * Continues the opening sentence after "Write it as `data-next-display=…`" — so it
   * starts lower-case and explains the `{TOKEN}`s. Omit it and the sentence just ends.
   */
  intro?: string;
  /** HTML the reader can paste, shown under the opening paragraph. */
  example?: string;
  /** One entry per path the enhancer answers, in the order they should be read. */
  paths: DisplayPathDoc[];
  /** Markdown after the tables — where the numbers come from, and what that implies. */
  footer?: string;
  /** The trap, the symptom, and the fix, one bullet each. Markdown. */
  cautions?: string[];
}

/**
 * One further `data-next-display` namespace a feature answers, beyond its primary
 * {@link FeatureManifest.displayNamespace}. See
 * {@link FeatureManifest.additionalDisplayNamespaces}.
 */
export interface AdditionalDisplayNamespace {
  /** The literal `AttributeScanner` routes to this feature, e.g. `campaign`. */
  namespace: string;
  /** Same meaning as {@link FeatureManifest.displayFallback}, scoped to this namespace. */
  displayFallback?: DisplayFallback[];
  /** Same meaning as {@link FeatureManifest.displayUnanswered}, scoped to this namespace. */
  displayUnanswered?: UnansweredPath[];
  /** Same meaning as {@link FeatureManifest.displayPaths}, scoped to this namespace. */
  displayPaths?: DisplayPathsDoc;
}

/**
 * Declares a feature's HTML contract. Identity at runtime; its only job is to
 * type-check the object literal.
 *
 * @example
 * ```ts
 * export default defineFeature({
 *   id: 'remove-item',
 *   category: 'cart',
 *   status: 'core',
 *   summary: 'Removes a line from the cart.',
 *   activates: '[data-next-remove-item]',
 *   logPrefix: 'RemoveItem',
 *   attributes: [
 *     {
 *       name: 'data-next-remove-item',
 *       type: 'number',
 *       required: true,
 *       description: 'The package `ref_id` to remove.',
 *     },
 *   ],
 *   emits: ['cart:item-removed'],
 * });
 * ```
 */
export function defineFeature(manifest: FeatureManifest): FeatureManifest {
  return manifest;
}
