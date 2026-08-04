/**
 * The facts {@link extractAnalytics} in `./extract-analytics-events-surface` returns —
 * split into its own module so every other sibling can depend on the shape without
 * depending on the extraction logic itself.
 */

/** One entry of the canonical `DL_EVENTS` vocabulary. */
export interface DlEventEntry {
  name: string;
  category: string;
  /** True when `eventSchemas` defines field-level validation for it. */
  hasSchema: boolean;
  /** The one-line label carried in the vocabulary itself. */
  description: string;
}

/** Names of the field tables that several events share verbatim. */
export type SharedShape = 'UserProperties' | 'Product';

/** One field of an event's payload, as the validation schema declares it. */
export interface SchemaField {
  /** Dotted path from the event root, e.g. `ecommerce.transaction_id`. */
  path: string;
  /** `string` / `number` / `object` / `Product[]` / `object[]` / … */
  type: string;
  /** True when the schema marks it required. */
  required: boolean;
  /**
   * Set when this field's shape is one of the shared tables, which are
   * documented once instead of per event. Expansion stops here.
   */
  sharedShape?: SharedShape;
}

/** Where in the source an event object is constructed. */
export interface EmitSite {
  /** Path relative to `src/`, POSIX separators. */
  file: string;
  /**
   * Enclosing symbol, e.g. `UserEvents.buildSignUp` — empty at module scope.
   * A symbol rather than a line so reformatting the file does not rewrite the
   * published page; see `anchorOf` in `./source-anchor`.
   */
  symbol: string;
  /** The construction call or object property that produced it. */
  how: string;
}

/** One provider the registry knows how to build. */
export interface ProviderRegistryEntry {
  /** The `analytics.providers.<key>` config key. */
  key: string;
  /**
   * Config path the provider refuses to start without, when the registry
   * declares one. `undefined` means the provider needs no settings.
   */
  requiredSetting?: string;
}

/** What each adapter does with the vocabulary, read from its literals. */
export interface ProviderEventMaps {
  /** `dl_*` → Meta Pixel event name. */
  facebook: Record<string, string>;
  /** Meta event names dispatched with `trackCustom` instead of `track`. */
  facebookCustomEvents: string[];
  /** `dl_*` → RudderStack spec event name. */
  rudderstack: Record<string, string>;
  /** `dl_*` names RudderStack handles outside the mapping table. */
  rudderstackSpecialCases: string[];
  /** The only `dl_*` names NextCampaign maps. */
  nextCampaign: string[];
  /** `dl_*` names GTM treats as GA4 ecommerce. */
  gtmEcommerce: string[];
}

/** Everything the analytics source can tell us without human judgement. */
export interface AnalyticsExtract {
  events: DlEventEntry[];
  /** Field schema per event name; absent for events with no schema. */
  schemas: Record<string, SchemaField[]>;
  /** The field tables shared across events, documented once. */
  shared: Record<SharedShape, SchemaField[]>;
  /** Construction sites per event name; `[]` when nothing builds it. */
  emitSites: Record<string, EmitSite[]>;
  providers: ProviderRegistryEntry[];
  providerEventMaps: ProviderEventMaps;
}
