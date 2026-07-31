/**
 * The typed contract of a **store** — its schema, how it persists, what you can do
 * with it, and the traps.
 *
 * Same idea as {@link ../docs/feature-manifest.FeatureManifest} and the same reason:
 * the state types carry almost no TSDoc, only line comments, so the prose has to live
 * somewhere a drift test can check. The **field inventory** is checked against the
 * store's real TypeScript interface, so a field added to the code cannot stay
 * undocumented, and a field removed cannot linger in the docs.
 *
 * What is deliberately *not* declared here: field types. Those are read from the
 * interface, because a type copied into a manifest is a second copy that drifts.
 *
 * **Build-time only.** Nothing under `src/` may import a manifest — they carry prose,
 * and a runtime import would ship every description in the bundle that loads on
 * customer landing pages.
 */

import type { EventMap } from '@/types/global';

/**
 * How a field survives — or does not survive — a page reload.
 *
 * This is the distinction readers get wrong most often, because it is invisible in the
 * type: `items` and `isCalculating` look identical in `CartState`, but one comes back
 * after a refresh and the other does not.
 */
export type FieldKind =
  /** Written to storage and restored on reload. Must be in the store's `partialize`. */
  | 'persisted'
  /** Derived from other fields and overwritten on every recalculation. */
  | 'computed'
  /** Runtime only — gone on reload. */
  | 'transient';

/** One field of the store's state. */
export interface StateField {
  /** Field name, exactly as it appears on the store's interface. */
  name: string;
  kind: FieldKind;
  /**
   * What it means in product terms — not a restatement of the type. For a nullable
   * field, say what `null` means: "not chosen yet", not "optional".
   */
  description: string;
  /** The trap, the symptom, and the fix. */
  notes?: string;
}

/** One thing a reader can call. */
export interface StateOperation {
  /** Call signature as a reader would write it, e.g. `addItem(item)`. */
  name: string;
  /** What it changes. Say whether it hits the API and whether it recalculates. */
  effect: string;
  /** Set when it still exists but should not be used in new code. */
  deprecated?: string;
}

/**
 * How the store reaches storage. `none` is a real answer and worth stating — a reader
 * checking "will this survive checkout?" needs it.
 */
export interface StatePersistence {
  /** `zustand-persist`, `manual` (the store writes storage itself), or `none`. */
  mechanism: 'zustand-persist' | 'manual' | 'none';
  /** Storage key, or the key pattern when it varies (`next-campaign-cache_{currency}`). */
  key?: string;
  /** How long the data stays valid, in product terms, e.g. `15 minutes`. */
  expiry?: string;
  /**
   * What a new field has to do to be persisted. The honest answer differs per
   * mechanism, and getting it wrong means a field that silently resets on reload.
   */
  newFieldRule: string;
}

export interface StateManifest {
  /** Kebab-case id matching the folder under `src/state/`, e.g. `cart`. */
  id: string;
  /** The exported hook, e.g. `useCartStore`. */
  storeHook: string;
  /**
   * The state interface the fields belong to, e.g. `CartState`. The drift test reads
   * its members from source and compares them against {@link fields}.
   */
  stateInterface: string;
  /** File the interface is declared in, relative to `src/`. */
  interfaceFile: string;
  /**
   * The file that *creates* the store — where `persist()` is called — relative to
   * `src/`. Defaults to {@link interfaceFile}.
   *
   * These are the same file for most stores but not for all: `CartState` is declared in
   * `types/global.ts` while `persist()` lives in `state/cart/cart.state.ts`. Conflating
   * the two made the persistence check look for `persist(` in a types file and fail on a
   * manifest that was telling the truth.
   */
  storeFile?: string;
  /** One sentence: what this store holds, in product terms. */
  summary: string;
  persistence: StatePersistence;
  fields: StateField[];
  /** The path a reader should use — `sdk.cart.*` / `cartOperations`. */
  operations?: StateOperation[];
  /** Direct writes that do not call the API. */
  setters?: StateOperation[];
  /** Reads and derived lookups. */
  selectors?: StateOperation[];
  /** Events emitted by this store or its operations. */
  emits?: (keyof EventMap)[];
  /** A realistic snapshot, as JSON. Shown under "What the data looks like". */
  example?: string;
  /** Traps. Each names the trap, the symptom, and the fix. */
  cautions?: string[];
}

export function defineStore(manifest: StateManifest): StateManifest {
  return manifest;
}
