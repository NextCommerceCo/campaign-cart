import Decimal from 'decimal.js';
import type { Logger } from '@/core/logger';
import type { Package } from '@/types/campaign';
import { useCampaignStore } from '@/state/campaign';
import type {
  BundleCard,
  BundleItem,
  BundlePackageState,
  ClassNames,
} from './bundle-selector.types';

/**
 * Build a BundlePackageState from a campaign Package.
 * Used when registering cards and when a variant change introduces a new packageId.
 * Prices are provisional (campaign baseline) until fetchAndUpdateBundlePrice runs.
 */
export function makePackageState(pkg: Package): BundlePackageState {
  return {
    packageId: pkg.ref_id,
    name: pkg.name || '',
    image: pkg.image || '',
    productName: pkg.product_name || '',
    variantName: pkg.product_variant_name || '',
    sku: pkg.product_sku ?? null,
    isRecurring: pkg.is_recurring,
    interval: pkg.interval ?? null,
    intervalCount: pkg.interval_count ?? null,
    recurringPrice: new Decimal(pkg.price_recurring_total || 0),
    originalRecurringPrice: new Decimal(pkg.price_recurring_total || 0),
    unitPrice: new Decimal(pkg.price_total || 0),
    originalUnitPrice: new Decimal(pkg.price_total || 0),
    discountAmount: new Decimal(0),
    discountPercentage: new Decimal(0),
    originalPrice: new Decimal(pkg.price_total || 0),
    price: new Decimal(pkg.price_total || 0),
    hasDiscount: false,
    currency: useCampaignStore.getState().currency ?? '',
    offerDiscounts: [],
    voucherDiscounts: [],
  };
}

/**
 * Derive the effective BundleItem list from a card's current slot state.
 * Applies the card's `bundleQuantity` multiplier to every aggregated line —
 * this is the single load-bearing point where the multiplier is folded in,
 * so every downstream consumer (applyBundle, applyEffectiveChange, price
 * fetch, cart sync, event payloads, AddToCart's _getSelectedBundleItems)
 * sees the correctly-multiplied quantities without special-casing.
 */
export function getEffectiveItems(card: BundleCard): BundleItem[] {
  const propertiesKey = (p?: Record<string, string>): string =>
    p && Object.keys(p).length > 0
      ? JSON.stringify(Object.fromEntries(Object.entries(p).sort()))
      : '';

  type GroupEntry = {
    packageId: number;
    quantity: number;
    properties?: Record<string, string>;
    excludeProperties?: string;
  };
  const groups = new Map<string, GroupEntry>();

  for (const slot of card.slots) {
    const pk = propertiesKey(slot.properties);
    const key = `${slot.activePackageId}|${pk}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += slot.quantity;
    } else {
      groups.set(key, {
        packageId: slot.activePackageId,
        quantity: slot.quantity,
        ...(slot.properties !== undefined && { properties: slot.properties }),
        ...(slot.excludeProperties && {
          excludeProperties: slot.excludeProperties,
        }),
      });
    }
  }

  const multiplier = card.bundleQuantity > 0 ? card.bundleQuantity : 1;
  return Array.from(groups.values()).map(g => ({
    ...g,
    quantity: g.quantity * multiplier,
  }));
}

/**
 * Wires the `_getSelectedBundleItems` / `_getSelectedBundleVouchers` accessors
 * that AddToCartEnhancer reads off the selector element to submit the current
 * selection. `getSelectedCard` is called lazily on each access so the result
 * always reflects the live selection, not the selection at wiring time.
 */
export function attachBundleAccessors(
  element: HTMLElement,
  getSelectedCard: () => BundleCard | null
): void {
  (element as unknown as Record<string, unknown>)['_getSelectedBundleItems'] =
    () => {
      const card = getSelectedCard();
      if (!card) return null;
      const needsVariant = card.slots.some(
        s => s.configurable && !s.variantSelected
      );
      return needsVariant ? null : getEffectiveItems(card);
    };

  (element as unknown as Record<string, unknown>)[
    '_getSelectedBundleVouchers'
  ] = () => getSelectedCard()?.vouchers ?? [];
}

/**
 * Parses the `data-next-class-*` override attributes into the class-name set
 * used throughout rendering and selection state. Falls back to the SDK's
 * default `next-*` class names when an override attribute is absent.
 */
export function parseClassNames(element: HTMLElement): ClassNames {
  const get = (key: string, fallback: string) =>
    element.getAttribute(`data-next-class-${key}`) ?? fallback;
  return {
    bundleCard: get('bundle-card', 'next-bundle-card'),
    selected: get('selected', 'next-selected'),
    inCart: get('in-cart', 'next-in-cart'),
    variantSelected: get('variant-selected', 'next-variant-selected'),
    variantUnavailable: get('variant-unavailable', 'next-variant-unavailable'),
    bundleSlot: get('bundle-slot', 'next-bundle-slot'),
    slotVariantGroup: get('slot-variant-group', 'next-slot-variant-group'),
  };
}

/** Parse the `data-next-bundle-vouchers` attribute into a string array. */
export function parseVouchers(attr: string | null, logger: Logger): string[] {
  if (!attr) return [];
  const trimmed = attr.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === 'string')
        : [];
    } catch {
      logger.warn('Invalid JSON in data-next-bundle-vouchers', attr);
      return [];
    }
  }
  return trimmed
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Extracts a slot template nested inside the card template HTML via a
 * <template> child of [data-next-bundle-slots]. Returns the stripped card
 * template (with the inner <template> removed so the live render target
 * stays empty) and the extracted slot template HTML — empty when no nested
 * template is present.
 */
export function extractNestedSlotTemplate(cardTemplate: string): {
  card: string;
  slot: string;
} {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = cardTemplate;

  const slotTpl = wrapper.querySelector<HTMLTemplateElement>(
    '[data-next-bundle-slots] > template'
  );
  if (!slotTpl) return { card: cardTemplate, slot: '' };

  const slot = slotTpl.innerHTML.trim();
  slotTpl.remove();
  return { card: wrapper.innerHTML, slot };
}

/**
 * Extracts nested <template> elements for variant-selector and variant-option
 * wrappers out of a slot template HTML string, returning the stripped slot
 * template plus the extracted template strings (empty when not present).
 *
 * The variant-option template is read from inside the variant-selector
 * template's content because that is the legal authoring structure —
 * [data-next-variant-options] lives inside the variant-selector wrapper.
 */
export function extractNestedVariantTemplates(slotTemplate: string): {
  slot: string;
  variantSelector: string;
  variantOption: string;
} {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = slotTemplate;

  let variantSelector = '';
  let variantOption = '';

  const vsTemplate = wrapper.querySelector<HTMLTemplateElement>(
    '[data-next-variant-selectors] > template'
  );
  if (vsTemplate) {
    const voTemplate = vsTemplate.content.querySelector<HTMLTemplateElement>(
      '[data-next-variant-options] > template'
    );
    if (voTemplate) {
      variantOption = voTemplate.innerHTML.trim();
      voTemplate.remove();
    }
    variantSelector = vsTemplate.innerHTML.trim();
    vsTemplate.remove();
  }

  return { slot: wrapper.innerHTML, variantSelector, variantOption };
}

/** Card/slot/variant templates resolved from their attribute/child-template sources. */
export interface ResolvedBundleTemplates {
  template: string;
  slotTemplate: string;
  variantOptionTemplate: string;
  variantSelectorTemplate: string;
}

/**
 * Resolves the card template, slot template, and variant templates.
 *
 * Card template resolution order: id attribute → inline HTML attribute →
 * direct `<template>` child of `element`. The child fallback lets authors
 * write native HTML without assigning template ids.
 *
 * Slot template resolution order: id attribute → inline HTML attribute →
 * direct `<template>` child of `externalSlotsEl` → nested `<template>` inside
 * the card template's `[data-next-bundle-slots]` placeholder. The nested
 * fallback lets authors keep card and slot markup co-located without setting
 * any template id or HTML string attribute.
 *
 * Variant templates: an explicit id attribute takes precedence; otherwise
 * they are extracted from `<template>`s nested inside
 * `[data-next-variant-selectors]` / `[data-next-variant-options]` within the
 * slot template.
 */
export function resolveBundleTemplates(
  element: HTMLElement,
  externalSlotsEl: HTMLElement | null,
  logger: Logger
): ResolvedBundleTemplates {
  const templateId = element.getAttribute('data-next-bundle-template-id');
  const templateAttr = element.getAttribute('data-next-bundle-template');
  let template: string;
  if (templateId) {
    template = document.getElementById(templateId)?.innerHTML.trim() ?? '';
  } else if (templateAttr != null) {
    template = templateAttr;
  } else {
    const inline =
      element.querySelector<HTMLTemplateElement>(':scope > template');
    template = inline?.innerHTML.trim() ?? '';
  }

  const slotTemplateId = element.getAttribute(
    'data-next-bundle-slot-template-id'
  );
  const slotTemplateAttr = element.getAttribute(
    'data-next-bundle-slot-template'
  );
  let slotTemplate: string;
  if (slotTemplateId) {
    slotTemplate =
      document.getElementById(slotTemplateId)?.innerHTML.trim() ?? '';
  } else if (slotTemplateAttr != null) {
    slotTemplate = slotTemplateAttr;
  } else if (externalSlotsEl) {
    const inline =
      externalSlotsEl.querySelector<HTMLTemplateElement>(':scope > template');
    slotTemplate = inline?.innerHTML.trim() ?? '';
  } else {
    slotTemplate = '';
  }

  if (!slotTemplate && template) {
    const { card, slot } = extractNestedSlotTemplate(template);
    if (slot) {
      template = card;
      slotTemplate = slot;
      logger.debug(
        'Extracted nested slot template from card template [data-next-bundle-slots]'
      );
    }
  }

  let variantOptionTemplate = '';
  const variantOptionTemplateId = element.getAttribute(
    'data-next-variant-option-template-id'
  );
  if (variantOptionTemplateId) {
    variantOptionTemplate =
      document.getElementById(variantOptionTemplateId)?.innerHTML.trim() ?? '';
  }

  let variantSelectorTemplate = '';
  const variantSelectorTemplateId = element.getAttribute(
    'data-next-variant-selector-template-id'
  );
  if (variantSelectorTemplateId) {
    variantSelectorTemplate =
      document.getElementById(variantSelectorTemplateId)?.innerHTML.trim() ??
      '';
  }

  if (slotTemplate && (!variantSelectorTemplate || !variantOptionTemplate)) {
    const { slot, variantSelector, variantOption } =
      extractNestedVariantTemplates(slotTemplate);
    slotTemplate = slot;
    if (!variantSelectorTemplate && variantSelector) {
      variantSelectorTemplate = variantSelector;
    }
    if (!variantOptionTemplate && variantOption) {
      variantOptionTemplate = variantOption;
    }
  }

  return {
    template,
    slotTemplate,
    variantOptionTemplate,
    variantSelectorTemplate,
  };
}

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

/** Vouchers defined across a single instance's bundle cards. */
export function getBundleVouchers(cards: BundleCard[]): string[] {
  return cards.flatMap(c => c.vouchers);
}

/** Vouchers defined across ALL live BundleSelectorEnhancer instances. */
export function getAllKnownBundleVouchers(
  allCards: BundleCard[][]
): Set<string> {
  return new Set(allCards.flatMap(cards => getBundleVouchers(cards)));
}
