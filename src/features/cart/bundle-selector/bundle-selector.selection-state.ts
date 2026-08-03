import type { Logger } from '@/core/logger';
import type { BundleCard } from './bundle-selector.types';

export interface ForceBundleSpec {
  selectorId: string | null;
  bundleId: string;
}

/**
 * Parse a `forceBundleId` URL-parameter value into per-selector specs.
 *
 * Accepted forms (comma-separated):
 *   "premium"                       → unscoped: matches the first selector containing a card with this id
 *   "tier-selector:premium"         → scoped to selectorId "tier-selector"
 *   "tier:premium,gift:luxury"      → multiple scoped specs
 *
 * Whitespace around tokens is tolerated. Empty/malformed entries are dropped silently
 * (the caller logs at a higher level when nothing matches).
 */
export function parseForceBundleId(
  raw: string | null | undefined
): ForceBundleSpec[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const colonIdx = part.indexOf(':');
      if (colonIdx === -1) {
        return { selectorId: null, bundleId: part };
      }
      const selectorId = part.slice(0, colonIdx).trim();
      const bundleId = part.slice(colonIdx + 1).trim();
      if (!bundleId) return null;
      return { selectorId: selectorId || null, bundleId };
    })
    .filter((s): s is ForceBundleSpec => s !== null);
}

/**
 * Pick the bundleId from a parsed force-spec list that applies to a given selector.
 * Prefers a scoped match (`selectorId:bundleId`) over an unscoped one.
 */
export function resolveForcedBundleId(
  specs: ForceBundleSpec[],
  selectorId: string | null
): string | null {
  const scoped = specs.find(
    s => s.selectorId !== null && s.selectorId === selectorId
  );
  if (scoped) return scoped.bundleId;
  const unscoped = specs.find(s => s.selectorId === null);
  return unscoped ? unscoped.bundleId : null;
}

export interface DefaultCardChoice {
  card: BundleCard | null;
  /** Came from a successful `forceBundleId` match. */
  fromForce: boolean;
  /** A `forceBundleId` resolved for this selector but no card matched. Carries the attempted bundleId. */
  forcedMiss: string | null;
  /** No card had `isPreSelected` and we fell back to `cards[0]`. Only set when card came from the first-card fallback. */
  usedFirstCardFallback: boolean;
}

/**
 * Pick the card that should be selected when no user interaction has happened yet.
 *
 * Precedence:
 *   1. `forceBundleId` URL param (after parsing + selector scoping) — wins over everything
 *   2. `isPreSelected` (i.e. `data-next-selected="true"`)
 *   3. First registered card
 *
 * When the param resolves to a bundleId but no matching card exists in this selector,
 * `forcedMiss` carries that bundleId so the caller can log a warning before falling
 * through to (2) and (3).
 */
export function pickDefaultCard(
  cards: BundleCard[],
  rawForceBundleId: string | null | undefined,
  selectorId: string | null
): DefaultCardChoice {
  const specs = parseForceBundleId(rawForceBundleId);
  const forcedId = resolveForcedBundleId(specs, selectorId);

  let forcedMiss: string | null = null;
  if (forcedId) {
    const match = cards.find(c => c.bundleId === forcedId) ?? null;
    if (match) {
      return {
        card: match,
        fromForce: true,
        forcedMiss: null,
        usedFirstCardFallback: false,
      };
    }
    forcedMiss = forcedId;
  }

  const preSelected = cards.find(c => c.isPreSelected);
  if (preSelected) {
    return {
      card: preSelected,
      fromForce: false,
      forcedMiss,
      usedFirstCardFallback: false,
    };
  }

  const first = cards[0] ?? null;
  return {
    card: first,
    fromForce: false,
    forcedMiss,
    usedFirstCardFallback: first !== null,
  };
}

/**
 * Run the default-card precedence (forceBundleId → data-next-selected → cards[0])
 * and emit the appropriate log messages for the outcome.
 */
export function pickAndLogDefaultCard(
  cards: BundleCard[],
  selectorId: string | null,
  logger: Logger
): BundleCard | null {
  const raw = (window as any)._nextForceBundleId;
  const choice = pickDefaultCard(
    cards,
    typeof raw === 'string' ? raw : null,
    selectorId
  );
  if (choice.forcedMiss) {
    logger.warn(
      `forceBundleId="${choice.forcedMiss}" did not match any card in this selector — falling back to default`
    );
  }
  if (choice.fromForce && choice.card) {
    logger.info(
      `Bundle pre-selected via forceBundleId: "${choice.card.bundleId}"`,
      selectorId ? { selectorId } : undefined
    );
  } else if (choice.usedFirstCardFallback) {
    logger.warn(
      'No card has data-next-selected="true" — auto-selecting first card. ' +
        'Add data-next-selected="true" to the default card to suppress this warning.'
    );
  }
  return choice.card;
}
