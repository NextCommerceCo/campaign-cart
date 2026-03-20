/**
 * Bundle Selector Enhancer
 *
 * Lets the developer define named bundles — each bundle being a fixed set of
 * packages + quantities — and lets the visitor pick one. When a bundle is
 * selected in **swap** mode the enhancer atomically replaces the previous
 * bundle's cart items with the new bundle's items while leaving unrelated
 * cart items untouched.
 *
 * ─── Container attributes ────────────────────────────────────────────────────
 *
 *   data-next-bundle-selector            — marks the container element
 *
 *   data-next-selection-mode             — "swap" (default) | "select"
 *     swap   → selecting a bundle immediately updates the cart
 *     select → only tracks selection; an external add-to-cart handles the cart
 *
 *   data-next-bundle-vouchers (on each card) — comma-separated list of voucher
 *     / coupon codes to apply when this bundle is selected. When switching
 *     bundles the previous card's vouchers are removed before the new ones are
 *     applied. Alternatively supply a JSON array: '["CODE1","CODE2"]'.
 *     Also supported in auto-render JSON via the "vouchers" key:
 *       { "id": "premium", "vouchers": ["SAVE10"], "items": […] }
 *
 *   data-next-bundles='[…]'             — JSON array of bundle definitions for
 *                                          auto-rendered mode (see below)
 *
 *   data-next-bundle-template-id="<id>" — ID of an element whose innerHTML is
 *                                          the card template (auto-render mode)
 *
 *   data-next-bundle-template="<html>"  — inline card template string
 *                                          (alternative to template-id)
 *
 * ─── Backend price calculation ────────────────────────────────────────────────
 *
 *   Place an element with data-next-bundle-price inside a bundle card (or its
 *   template) to receive the backend-calculated total price for that bundle.
 *   The enhancer calls the /calculate API for each card on init and re-fetches
 *   whenever the user changes a variant selection.
 *
 *   Attribute values (optional):
 *     data-next-bundle-price            — formatted total (default)
 *     data-next-bundle-price="subtotal" — formatted subtotal
 *     data-next-bundle-price="compare"  — formatted compare-at total
 *     data-next-bundle-price="savings"  — formatted savings amount
 *     data-next-bundle-price="savingsPercentage" — formatted savings percentage
 *
 *   Example:
 *     <span data-next-bundle-price></span>
 *     <span data-next-bundle-price="compare"></span>
 *
 * ─── Per-item slot templates ──────────────────────────────────────────────────
 *
 *   data-next-bundle-slot-template-id="<id>"
 *     ID of a <template> element whose innerHTML is the slot template rendered
 *     once for each item in the bundle. Inject variant selectors by placing
 *     an element with data-next-variant-selectors inside the template.
 *     If omitted, no per-item rows are rendered.
 *
 *   data-next-bundle-slot-template="<html>"
 *     Inline alternative to data-next-bundle-slot-template-id.
 *
 *   data-next-variant-option-template-id="<id>"
 *     ID of a <template> element whose innerHTML represents a single variant
 *     option (e.g. a button or swatch). When provided, custom elements replace
 *     the default <select> dropdowns. Omit to keep the default <select> behavior.
 *
 * ─── Slot template variables ─────────────────────────────────────────────────
 *
 *   {slot.index}                — 1-based slot number
 *   {slot.unitNumber}           — 1-based unit index within a configurable item
 *   {slot.unitIndex}            — 0-based unit index within a configurable item
 *   {item.packageId}            — current package ref_id for this slot
 *   {item.name}                 — package name
 *   {item.image}                — package image URL
 *   {item.quantity}             — quantity for this slot
 *   {item.qty}                  — units per package
 *   {item.variantName}          — variant display name (e.g. "Black / Small")
 *   {item.productName}          — product name
 *   {item.sku}                  — product SKU
 *   {item.isRecurring}          — "true" / "false"
 *   Campaign prices (before offer discounts):
 *   {item.price}                — per-unit price (campaign)
 *   {item.priceTotal}           — total package price (campaign)
 *   {item.priceRetail}          — retail per-unit price
 *   {item.priceRetailTotal}     — retail total price
 *   {item.priceRecurring}       — recurring per-unit price
 *   API prices (reflect applied offer/coupon discounts):
 *   {item.unitPrice}            — per-unit price after discounts
 *   {item.originalUnitPrice}    — per-unit price before discounts
 *   {item.packagePrice}         — package total after discounts
 *   {item.originalPackagePrice} — package total before discounts
 *   {item.subtotal}             — line subtotal
 *   {item.totalDiscount}        — total discount on this line
 *   {item.total}                — line total after all discounts
 *   Conditional helpers:
 *   {item.hasDiscount}          — "show" / "hide"
 *   {item.hasSavings}           — "show" / "hide"
 *
 * ─── Variant selector injection ──────────────────────────────────────────────
 *
 *   Place an element with data-next-variant-selectors inside the slot template.
 *   The enhancer populates it with one selector block per variant attribute.
 *   Products without variant attributes get no selectors injected.
 *
 *   Default: a <select> dropdown per attribute dimension.
 *   Custom (data-next-variant-option-template-id): renders one copy per option.
 *
 *   Custom option template variables:
 *     {attr.code}         — attribute code (e.g. "color")
 *     {attr.name}         — attribute label (e.g. "Color")
 *     {option.value}      — option value (e.g. "Red")
 *     {option.selected}   — "true" / "false"
 *     {option.available}  — "true" / "false" — false when no package exists for
 *                           this value combined with the other currently-selected
 *                           attribute values (e.g. "Blue / XL" doesn't exist)
 *
 *   CSS class added to the selected option:    next-variant-selected
 *   CSS class added to unavailable options:    next-variant-unavailable
 *   data-selected="true" is set on the selected option element.
 *   data-unavailable="true" is set on unavailable option elements.
 *   Clicks on unavailable options are silently ignored.
 *
 *   Default <select> mode: unavailable options are rendered with the HTML
 *   `disabled` attribute.
 *
 * ─── Bundle card placement ────────────────────────────────────────────────────
 *
 *   Place a [data-next-bundle-slots] element inside the bundle card template to
 *   mark where per-item slot rows are injected.
 *
 * ─── Auto-render mode ────────────────────────────────────────────────────────
 *
 * ─── Per-unit configuration (color / size per unit) ─────────────────────────
 *
 *   Add "configurable": true to any bundle item whose quantity > 1 to expand
 *   it into individual slots — one per unit — each with its own variant
 *   selectors. Without this flag a quantity-3 item renders as a single slot.
 *
 *   Extra slot template variables available for configurable items:
 *     {slot.unitNumber} — 1-based index within the item's expanded units
 *     {slot.unitIndex}  — 0-based index within the item's expanded units
 *
 * ─── Auto-render mode ────────────────────────────────────────────────────────
 *
 *   [
 *     {
 *       "id": "starter",
 *       "name": "Starter Kit",
 *       "price": "$49",
 *       "items": [
 *         { "packageId": 10, "quantity": 1 },
 *         { "packageId": 20, "quantity": 1 }
 *       ]
 *     }
 *   ]
 *
 *   With per-unit configuration (e.g. 3 units, each configurable):
 *
 *   [
 *     {
 *       "id": "trio",
 *       "name": "Pick Your 3",
 *       "items": [
 *         { "packageId": 10, "quantity": 3, "configurable": true }
 *       ]
 *     }
 *   ]
 *
 * ─── Manual / static card mode ───────────────────────────────────────────────
 *
 *   <div data-next-bundle-selector
 *        data-next-bundle-slot-template-id="slot-tpl"
 *        data-next-variant-option-template-id="variant-opt-tpl">
 *
 *     <!-- quantity 3, each unit independently configurable -->
 *     <div data-next-bundle-card
 *          data-next-bundle-id="buy3"
 *          data-next-bundle-items='[{"packageId":101,"quantity":3,"configurable":true}]'
 *          data-next-selected="true">
 *       <h3>Pick Your 3</h3>
 *       <div data-next-bundle-slots></div>
 *     </div>
 *   </div>
 *
 *   <template id="slot-tpl">
 *     <div class="slot-row">
 *       <img src="{item.image}" alt="{item.name}" />
 *       <div data-next-variant-selectors></div>
 *     </div>
 *   </template>
 *
 *   <template id="variant-opt-tpl">
 *     <button class="swatch" data-selected="{option.selected}">{option.value}</button>
 *   </template>
 *
 * ─── CSS classes applied ─────────────────────────────────────────────────────
 *
 *   next-bundle-card    — added to every registered card
 *   next-selected       — the currently selected card
 *   next-in-cart        — all bundle items are present in the cart at required qty
 *
 * ─── Events emitted ──────────────────────────────────────────────────────────
 *
 *   bundle:selected           — card clicked; payload: { bundleId, items }
 *   bundle:selection-changed  — internal selection updated; same payload
 *
 * ─── Container attribute set by enhancer ─────────────────────────────────────
 *
 *   data-selected-bundle="<id>"  — reflects the currently selected bundle id
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCartStore } from '@/stores/cartStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { calculateBundlePrice, buildCartTotals } from '@/utils/calculations/CartCalculator';
import type { CartState } from '@/types/global';
import type { Package } from '@/types/campaign';
import type { SummaryLine } from '@/types/api';

// ─── Internal types ───────────────────────────────────────────────────────────

interface BundleItem {
  packageId: number;
  quantity: number;
  /**
   * When true, a quantity > 1 is expanded into individual slots so the visitor
   * can configure color / size (or any variant) independently per unit.
   */
  configurable?: boolean;
  /**
   * When true, no slot row is rendered for this item even when a slot template
   * is configured. Useful for silent add-ons like free gifts that are displayed
   * via a separate static block rather than a slot row.
   */
  noSlot?: boolean;
}

interface BundleDef {
  id: string;
  items: BundleItem[];
  vouchers?: string[];
  [key: string]: unknown;
}

/** Tracks one item slot within a bundle card, with variant override support. */
interface BundleSlot {
  slotIndex: number;
  /**
   * 0-based index within the units that were expanded from this item.
   * Always 0 for non-configurable items.
   */
  unitIndex: number;
  /** Package as originally defined in the bundle. */
  originalPackageId: number;
  /** Currently active package (may differ after the user selects a variant). */
  activePackageId: number;
  quantity: number;
  /** When true, no slot row is rendered for this slot. */
  noSlot?: boolean;  
}

interface BundleCard {
  element: HTMLElement;
  bundleId: string;
  /** Original item definitions — kept for reference. */
  items: BundleItem[];
  /** One slot per item; tracks active variant selections. */
  slots: BundleSlot[];
  isPreSelected: boolean;
  /** Voucher/coupon codes to apply when this bundle is selected. */
  vouchers: string[];
}

// ─── Enhancer ─────────────────────────────────────────────────────────────────

export class BundleSelectorEnhancer extends BaseEnhancer {
  private mode: 'swap' | 'select' = 'swap';
  private template: string = '';
  private slotTemplate: string = '';
  private variantOptionTemplate: string = '';
  private cards: BundleCard[] = [];
  private selectedCard: BundleCard | null = null;
  private clickHandlers = new Map<HTMLElement, (e: Event) => void>();
  private selectHandlers = new Map<HTMLSelectElement, EventListener>();
  private mutationObserver: MutationObserver | null = null;
  private boundVariantOptionClick: ((e: Event) => void) | null = null;
  private boundCurrencyChangeHandler: (() => void) | null = null;
  /** Prevents re-entrant cart updates when we trigger them ourselves. */
  private isApplying: boolean = false;
  private includeShipping: boolean = false;
  /** Per-bundle preview lines from the calculate API (used when bundle is not in cart). */
  private previewLines = new Map<string, SummaryLine[]>();
  /** Debounce timer for currency-change price re-fetches. */
  private currencyChangeTimeout: ReturnType<typeof setTimeout> | null = null;

  public async initialize(): Promise<void> {
    this.validateElement();

    this.mode = (this.getAttribute('data-next-selection-mode') ?? 'swap') as 'swap' | 'select';
    this.includeShipping = this.getAttribute('data-next-include-shipping') === 'true';

    // ── Card template ──────────────────────────────────────────────────────────
    const templateId = this.getAttribute('data-next-bundle-template-id');
    if (templateId) {
      this.template = document.getElementById(templateId)?.innerHTML.trim() ?? '';
    } else {
      this.template = this.getAttribute('data-next-bundle-template') ?? '';
    }

    // ── Slot template (per-item rows within a card) ────────────────────────────
    const slotTemplateId = this.getAttribute('data-next-bundle-slot-template-id');
    if (slotTemplateId) {
      this.slotTemplate = document.getElementById(slotTemplateId)?.innerHTML.trim() ?? '';
    } else {
      this.slotTemplate = this.getAttribute('data-next-bundle-slot-template') ?? '';
    }

    // ── Custom variant option template ─────────────────────────────────────────
    const variantOptionTemplateId = this.getAttribute('data-next-variant-option-template-id');
    if (variantOptionTemplateId) {
      this.variantOptionTemplate =
        document.getElementById(variantOptionTemplateId)?.innerHTML.trim() ?? '';
    }

    // ── Auto-render bundle cards from JSON ─────────────────────────────────────
    const bundlesAttr = this.getAttribute('data-next-bundles');
    if (bundlesAttr && this.template) {
      try {
        const parsed: unknown = JSON.parse(bundlesAttr);
        if (!Array.isArray(parsed)) {
          this.logger.warn('data-next-bundles must be a JSON array, ignoring auto-render');
        } else {
          this.element.innerHTML = '';
          for (const def of parsed as BundleDef[]) {
            const el = this.renderBundleTemplate(def);
            if (el) this.element.appendChild(el);
          }
        }
      } catch {
        this.logger.warn('Invalid JSON in data-next-bundles, ignoring auto-render', bundlesAttr);
      }
    }

    // ── Delegated click handler for custom variant options ─────────────────────
    if (this.slotTemplate) {
      const handler = this.handleVariantOptionClick.bind(this);
      this.boundVariantOptionClick = handler;
      this.element.addEventListener('click', handler);
    }

    this.scanCards();
    this.setupMutationObserver();

    this.subscribe(useCartStore, this.syncWithCart.bind(this));
    this.syncWithCart(useCartStore.getState());

    // Re-fetch bundle prices whenever checkout vouchers change
    let prevCheckoutVouchers = useCheckoutStore.getState().vouchers;
    this.subscribe(useCheckoutStore, (state) => {
      const next = state.vouchers;
      if (next.length !== prevCheckoutVouchers.length ||
          next.some((v, i) => v !== prevCheckoutVouchers[i])) {
        prevCheckoutVouchers = next;
        for (const card of this.cards) {
          void this.fetchAndUpdateBundlePrice(card);
        }
      }
    });

    // Re-fetch prices when the active currency changes (debounced to avoid thundering herd)
    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null) clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const card of this.cards) {
          void this.fetchAndUpdateBundlePrice(card);
        }
      }, 150);
    };
    document.addEventListener('next:currency-changed', this.boundCurrencyChangeHandler);

    // Fetch backend prices for all registered cards
    for (const card of this.cards) {
      void this.fetchAndUpdateBundlePrice(card);
    }

    this.logger.debug('BundleSelectorEnhancer initialized', {
      mode: this.mode,
      cardCount: this.cards.length,
    });
  }

  // ─── Bundle card template rendering ──────────────────────────────────────────

  private renderBundleTemplate(bundle: BundleDef): HTMLElement | null {
    const vars: Record<string, string> = {};
    for (const [key, value] of Object.entries(bundle)) {
      if (key !== 'items') {
        vars[`bundle.${key}`] = value != null ? String(value) : '';
      }
    }

    const html = this.template.replace(/\{([^}]+)\}/g, (_, k: string) => vars[k] ?? '');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();

    const firstChild = wrapper.firstElementChild;
    const cardEl =
      wrapper.querySelector<HTMLElement>('[data-next-bundle-card]') ??
      (firstChild instanceof HTMLElement ? firstChild : null);

    if (!cardEl) {
      this.logger.warn('Bundle template produced no root element for bundle', bundle.id);
      return null;
    }

    cardEl.setAttribute('data-next-bundle-card', '');
    cardEl.setAttribute('data-next-bundle-id', bundle.id);
    cardEl.setAttribute('data-next-bundle-items', JSON.stringify(bundle.items));
    if (bundle.vouchers?.length) {
      cardEl.setAttribute('data-next-bundle-vouchers', JSON.stringify(bundle.vouchers));
    }

    return cardEl;
  }

  // ─── Card registration ────────────────────────────────────────────────────────

  private scanCards(): void {
    this.element.querySelectorAll<HTMLElement>('[data-next-bundle-card]').forEach(el => {
      if (!this.cards.find(c => c.element === el)) this.registerCard(el);
    });
  }

  private registerCard(el: HTMLElement): void {
    const bundleId = el.getAttribute('data-next-bundle-id');
    if (!bundleId) {
      this.logger.warn('Bundle card is missing data-next-bundle-id', el);
      return;
    }

    const itemsAttr = el.getAttribute('data-next-bundle-items');
    if (!itemsAttr) {
      this.logger.warn(`Bundle card "${bundleId}" is missing data-next-bundle-items`, el);
      return;
    }

    let items: BundleItem[];
    try {
      items = JSON.parse(itemsAttr);
    } catch {
      this.logger.warn(`Invalid JSON in data-next-bundle-items for bundle "${bundleId}"`, el);
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      this.logger.warn(`Bundle "${bundleId}" has no items`, el);
      return;
    }

    const isPreSelected = el.getAttribute('data-next-selected') === 'true';

    const vouchers = this.parseVouchers(el.getAttribute('data-next-bundle-vouchers'));

    const slots: BundleSlot[] = [];
    let slotIdx = 0;
    for (const item of items) {
      if (item.configurable && item.quantity > 1) {
        for (let u = 0; u < item.quantity; u++) {
          slots.push({
            slotIndex: slotIdx++,
            unitIndex: u,
            originalPackageId: item.packageId,
            activePackageId: item.packageId,
            quantity: 1,
            noSlot: item.noSlot,
          });
        }
      } else {
        slots.push({
          slotIndex: slotIdx++,
          unitIndex: 0,
          originalPackageId: item.packageId,
          activePackageId: item.packageId,
          quantity: item.quantity,
          noSlot: item.noSlot,
        });
      }
    }

    const card: BundleCard = { element: el, bundleId, items, slots, isPreSelected, vouchers };

    this.cards.push(card);
    el.classList.add('next-bundle-card');

    // Render per-item slots when a slot template is configured
    if (this.slotTemplate) {
      this.renderSlotsForCard(card);
    }

    // Card click selects the bundle — but not when clicking variant controls
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('select, [data-next-variant-option]')) return;
      void this.handleCardClick(e, card);
    };
    this.clickHandlers.set(el, handler);
    el.addEventListener('click', handler);

    this.logger.debug(`Registered bundle card "${bundleId}"`, { itemCount: items.length });
  }

  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          if (node.hasAttribute('data-next-bundle-card')) {
            if (!this.cards.find(c => c.element === node)) this.registerCard(node);
          }
          node.querySelectorAll<HTMLElement>('[data-next-bundle-card]').forEach(el => {
            if (!this.cards.find(c => c.element === el)) this.registerCard(el);
          });
        });
      }
    });
    this.mutationObserver.observe(this.element, { childList: true, subtree: true });
  }

  // ─── Slot rendering ───────────────────────────────────────────────────────────

  private renderSlotsForCard(card: BundleCard): void {
    const placeholder = card.element.querySelector<HTMLElement>('[data-next-bundle-slots]');
    if (!placeholder) return;

    // Clean up any existing select handlers for this card's slots
    placeholder.querySelectorAll<HTMLSelectElement>('select').forEach(s => {
      const h = this.selectHandlers.get(s);
      if (h) {
        s.removeEventListener('change', h);
        this.selectHandlers.delete(s);
      }
    });

    const allPackages = useCampaignStore.getState().packages || [];
    placeholder.innerHTML = '';

    const cartState = useCartStore.getState();
    const effectiveItems = this.getEffectiveItems(card);
    const isInCart = effectiveItems.every(bi => {
      const ci = cartState.items.find(i => i.packageId === bi.packageId);
      return ci != null && ci.quantity >= bi.quantity;
    });

    for (const slot of card.slots) {
      if (slot.noSlot) continue;

      const pkg = allPackages.find(p => p.ref_id === slot.activePackageId);
      if (!pkg) continue;

      const slotEl = this.createSlotElement(card.bundleId, slot, pkg, isInCart);

      const variantPlaceholder = slotEl.querySelector<HTMLElement>('[data-next-variant-selectors]');
      if (variantPlaceholder && (pkg.product_variant_attribute_values?.length ?? 0) > 0) {
        this.renderVariantSelectors(variantPlaceholder, card.bundleId, slot.slotIndex, pkg, allPackages);
      }

      placeholder.appendChild(slotEl);
    }
  }

  private createSlotElement(bundleId: string, slot: BundleSlot, pkg: Package, isInCart = false): HTMLElement {
    // Pull SummaryLine for this package (enriched with discounted prices from API).
    // Cart summary is used when the bundle is in the cart; preview lines (from
    // calculateBundlePrice) are used as a fallback for non-selected bundles.
    const summaryLine = isInCart
      ? useCartStore.getState().summary?.lines.find(l => l.package_id === slot.activePackageId)
      : this.previewLines.get(bundleId)?.find(l => l.package_id === slot.activePackageId);

    const hasDiscount = summaryLine ? parseFloat(summaryLine.total_discount) > 0 : false;
    const hasSavings = summaryLine?.price_retail_total != null
      ? parseFloat(summaryLine.price_retail_total) > parseFloat(summaryLine.package_price)
      : (pkg.price_retail != null && pkg.price_retail !== pkg.price);

    const vars: Record<string, string> = {
      // Slot position
      'slot.index': String(slot.slotIndex + 1),
      'slot.unitIndex': String(slot.unitIndex),
      'slot.unitNumber': String(slot.unitIndex + 1),
      // Package identity
      'item.packageId': String(slot.activePackageId),
      'item.name': pkg.name || '',
      'item.image': pkg.image || '',
      'item.quantity': String(slot.quantity),
      'item.variantName': pkg.product_variant_name || '',
      'item.productName': pkg.product_name || '',
      'item.sku': pkg.product_sku || '',
      'item.qty': String(pkg.qty ?? 1),
      // Campaign prices (formatted strings, before any offer discounts)
      'item.price': pkg.price || '',
      'item.priceTotal': pkg.price_total || '',
      'item.priceRetail': pkg.price_retail || '',
      'item.priceRetailTotal': pkg.price_retail_total || '',
      'item.priceRecurring': pkg.price_recurring || '',
      'item.isRecurring': pkg.is_recurring ? 'true' : 'false',
      // API summary prices (reflect applied offer/coupon discounts)
      'item.unitPrice':            summaryLine?.unit_price            ?? pkg.price ?? '',
      'item.originalUnitPrice':    summaryLine?.original_unit_price   ?? pkg.price ?? '',
      'item.packagePrice':         summaryLine?.package_price         ?? pkg.price_total ?? '',
      'item.originalPackagePrice': summaryLine?.original_package_price ?? pkg.price_total ?? '',
      'item.subtotal':             summaryLine?.subtotal              ?? '',
      'item.totalDiscount':        summaryLine?.total_discount        ?? '0',
      'item.total':                summaryLine?.total                 ?? pkg.price_total ?? '',
      // Conditional helpers
      'item.hasDiscount': hasDiscount ? 'show' : 'hide',
      'item.hasSavings':  hasSavings  ? 'show' : 'hide',
    };

    const wrapper = document.createElement('div');
    wrapper.className = 'next-bundle-slot';
    wrapper.dataset.nextBundleId = bundleId;
    wrapper.dataset.nextSlotIndex = String(slot.slotIndex);
    wrapper.innerHTML = this.slotTemplate.replace(/\{([^}]+)\}/g, (_, key) => vars[key] ?? '');
    return wrapper;
  }

  // ─── Variant selector rendering ───────────────────────────────────────────────

  private renderVariantSelectors(
    container: HTMLElement,
    bundleId: string,
    slotIndex: number,
    currentPkg: Package,
    allPackages: Package[]
  ): void {
    const productId = currentPkg.product_id;
    if (!productId) return;

    const productPkgs = allPackages.filter(p => p.product_id === productId);
    const currentAttrs = currentPkg.product_variant_attribute_values || [];
    if (currentAttrs.length === 0) return;

    // Collect ordered attribute definitions
    const attrDefs = new Map<string, string>();
    for (const pkg of productPkgs) {
      for (const attr of pkg.product_variant_attribute_values || []) {
        if (!attrDefs.has(attr.code)) attrDefs.set(attr.code, attr.name);
      }
    }

    const selected: Record<string, string> = {};
    for (const attr of currentAttrs) selected[attr.code] = attr.value;

    container.innerHTML = '';

    for (const [code, name] of attrDefs) {
      const values = [
        ...new Set(
          productPkgs.flatMap(p =>
            (p.product_variant_attribute_values || [])
              .filter(a => a.code === code)
              .map(a => a.value)
          )
        ),
      ];

      if (this.variantOptionTemplate) {
        this.renderCustomOptions(container, bundleId, slotIndex, code, name, values, selected[code] ?? '', productPkgs, selected);
      } else {
        const field = document.createElement('div');
        field.className = 'next-slot-variant-field';

        const label = document.createElement('label');
        label.className = 'next-slot-variant-label';
        label.textContent = `${name}:`;

        const select = document.createElement('select');
        select.className = 'next-slot-variant-select';
        select.dataset.variantCode = code;

        for (const value of values) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          if (value === selected[code]) option.selected = true;
          if (!this.isVariantValueAvailable(value, code, productPkgs, selected)) {
            option.disabled = true;
          }
          select.appendChild(option);
        }

        const handler: EventListener = () =>
          void this.handleSelectVariantChange(select, bundleId, slotIndex);
        this.selectHandlers.set(select, handler);
        select.addEventListener('change', handler);

        field.appendChild(label);
        field.appendChild(select);
        container.appendChild(field);
      }
    }
  }

  private isVariantValueAvailable(
    value: string,
    code: string,
    productPkgs: Package[],
    allSelectedAttrs: Record<string, string>
  ): boolean {
    return productPkgs.some(pkg => {
      if (pkg.product_purchase_availability === 'unavailable') return false;
      const attrs = pkg.product_variant_attribute_values || [];
      if (!attrs.some(a => a.code === code && a.value === value)) return false;
      return Object.entries(allSelectedAttrs)
        .filter(([c]) => c !== code)
        .every(([c, v]) => attrs.some(a => a.code === c && a.value === v));
    });
  }

  private renderCustomOptions(
    container: HTMLElement,
    bundleId: string,
    slotIndex: number,
    code: string,
    name: string,
    values: string[],
    selectedValue: string,
    productPkgs: Package[],
    allSelectedAttrs: Record<string, string>
  ): void {
    const group = document.createElement('div');
    group.className = 'next-slot-variant-group';
    group.dataset.variantCode = code;
    group.dataset.variantName = name;
    group.dataset.nextBundleId = bundleId;
    group.dataset.nextSlotIndex = String(slotIndex);

    for (const value of values) {
      const isSelected = value === selectedValue;
      const isAvailable = this.isVariantValueAvailable(value, code, productPkgs, allSelectedAttrs);
      const vars: Record<string, string> = {
        'attr.code': code,
        'attr.name': name,
        'option.value': value,
        'option.selected': String(isSelected),
        'option.available': String(isAvailable),
      };
      const html = this.variantOptionTemplate.replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? '');
      const temp = document.createElement('div');
      temp.innerHTML = html.trim();
      const first = temp.firstElementChild;
      const el = first instanceof HTMLElement ? first : null;
      if (!el) continue;

      el.dataset.nextVariantOption = code;
      el.dataset.nextVariantValue = value;
      if (isSelected) {
        el.setAttribute('data-selected', 'true');
        el.classList.add('next-variant-selected');
      }
      if (!isAvailable) {
        el.dataset.nextUnavailable = 'true';
        el.classList.add('next-variant-unavailable');
      }

      group.appendChild(el);
    }

    container.appendChild(group);
  }

  // ─── Variant change handlers ──────────────────────────────────────────────────

  /** Delegated click handler for custom variant option elements. */
  private handleVariantOptionClick(e: Event): void {
    const target = e.target as HTMLElement;
    const optionEl = target.closest<HTMLElement>('[data-next-variant-option]');
    if (!optionEl) return;

    // Ignore clicks on unavailable options
    if (optionEl.dataset.nextUnavailable === 'true') return;

    const code = optionEl.dataset.nextVariantOption;
    const value = optionEl.dataset.nextVariantValue;
    if (!code || !value) return;

    const group = optionEl.closest<HTMLElement>('[data-variant-code]');
    if (!group) return;

    const bundleId = group.dataset.nextBundleId;
    const slotIndex = Number(group.dataset.nextSlotIndex);
    if (!bundleId) return;

    const card = this.cards.find(c => c.bundleId === bundleId);
    if (!card) return;

    // Update visual selection within this attribute group
    group.querySelectorAll<HTMLElement>('[data-next-variant-option]').forEach(el => {
      el.removeAttribute('data-selected');
      el.classList.remove('next-variant-selected');
    });
    optionEl.setAttribute('data-selected', 'true');
    optionEl.classList.add('next-variant-selected');

    // Read all currently selected values across groups for this slot
    const slotEl = card.element.querySelector<HTMLElement>(`[data-next-slot-index="${slotIndex}"]`);
    if (!slotEl) return;

    const selectedAttrs: Record<string, string> = {};
    slotEl.querySelectorAll<HTMLElement>('[data-variant-code]').forEach(g => {
      const attrCode = g.dataset.variantCode;
      if (!attrCode) return;
      const sel = g.querySelector<HTMLElement>('[data-next-variant-option][data-selected="true"]');
      if (sel?.dataset.nextVariantValue) selectedAttrs[attrCode] = sel.dataset.nextVariantValue;
    });

    void this.applyVariantChange(card, slotIndex, selectedAttrs);
  }

  private async handleSelectVariantChange(
    select: HTMLSelectElement,
    bundleId: string,
    slotIndex: number
  ): Promise<void> {
    const card = this.cards.find(c => c.bundleId === bundleId);
    if (!card) return;

    // Read all selects within this slot to get the full combination
    const slotEl = card.element.querySelector<HTMLElement>(`[data-next-slot-index="${slotIndex}"]`);
    if (!slotEl) return;

    const selectedAttrs: Record<string, string> = {};
    slotEl.querySelectorAll<HTMLSelectElement>('select[data-variant-code]').forEach(s => {
      if (s.dataset.variantCode) selectedAttrs[s.dataset.variantCode] = s.value;
    });

    await this.applyVariantChange(card, slotIndex, selectedAttrs);
  }

  private async applyVariantChange(
    card: BundleCard,
    slotIndex: number,
    selectedAttrs: Record<string, string>
  ): Promise<void> {
    if (this.isApplying) return;

    const slot = card.slots[slotIndex];
    if (!slot) return;

    const allPackages = useCampaignStore.getState().packages || [];
    const currentPkg = allPackages.find(p => p.ref_id === slot.activePackageId);
    if (!currentPkg?.product_id) return;

    const productPkgs = allPackages.filter(p => p.product_id === currentPkg.product_id);

    const matched = productPkgs.find(pkg => {
      const attrs = pkg.product_variant_attribute_values || [];
      return Object.entries(selectedAttrs).every(([c, v]) =>
        attrs.some(a => a.code === c && a.value === v)
      );
    });

    if (!matched) {
      this.logger.warn('No package found for variant combination', selectedAttrs);
      return;
    }

    if (slot.activePackageId === matched.ref_id) return;

    slot.activePackageId = matched.ref_id;

    // Re-render slots so image and all template vars reflect the new package
    this.renderSlotsForCard(card);

    if (this.mode === 'swap' && this.selectedCard === card) {
      await this.applyEffectiveChange(card);
    }

    void this.fetchAndUpdateBundlePrice(card);

    this.logger.debug(
      `Variant changed on bundle "${card.bundleId}" slot ${slotIndex}`,
      { packageId: matched.ref_id }
    );
  }

  // ─── Selection & cart update ──────────────────────────────────────────────────

  private async handleCardClick(e: Event, card: BundleCard): Promise<void> {
    e.preventDefault();
    if (this.selectedCard === card) return;

    const previous = this.selectedCard;
    this.selectCard(card);
    this.emit('bundle:selected', { bundleId: card.bundleId, items: this.getEffectiveItems(card) });

    if (card.vouchers.length || previous?.vouchers.length) {
      await this.applyVoucherSwap(previous, card);
    }
    if (this.mode === 'swap') {
      await this.applyBundle(previous, card);
    }
  }

  private selectCard(card: BundleCard): void {
    this.cards.forEach(c => {
      c.element.classList.remove('next-selected');
      c.element.setAttribute('data-next-selected', 'false');
    });
    card.element.classList.add('next-selected');
    card.element.setAttribute('data-next-selected', 'true');
    this.selectedCard = card;
    this.element.setAttribute('data-selected-bundle', card.bundleId);
    this.emit('bundle:selection-changed', { bundleId: card.bundleId, items: this.getEffectiveItems(card) });
  }

  /**
   * Returns the currently active cart items for a bundle card, accounting for
   * any variant selections the user has made in the slot rows.
   */
  private getEffectiveItems(card: BundleCard): BundleItem[] {
    const qtyCounts = new Map<number, number>();
    for (const slot of card.slots) {
      qtyCounts.set(
        slot.activePackageId,
        (qtyCounts.get(slot.activePackageId) ?? 0) + slot.quantity
      );
    }
    return Array.from(qtyCounts.entries()).map(([packageId, quantity]) => ({ packageId, quantity }));
  }

  /**
   * Apply a bundle to the cart.
   *
   * - Swapping from a previous bundle: strips previous bundle's packages and
   *   replaces them with the new bundle, leaving unrelated items untouched.
   * - First selection (no previous): replaces the entire cart with the bundle's items.
   *
   * Uses getEffectiveItems() so variant selections are respected.
   */
  private async applyBundle(previous: BundleCard | null, selected: BundleCard): Promise<void> {
    const cartStore = useCartStore.getState();
    const newItems = this.getEffectiveItems(selected).map(i => ({ ...i, bundleId: selected.bundleId }));
    try {
      if (previous) {
        const retained = cartStore.items
          .filter(ci => ci.bundleId !== previous.bundleId)
          .map(ci => ({ packageId: ci.packageId, quantity: ci.quantity, isUpsell: ci.is_upsell, bundleId: ci.bundleId }));
        await cartStore.swapCart([...retained, ...newItems]);
      } else {
        await cartStore.swapCart(newItems);
      }
      this.logger.debug(`Applied bundle "${selected.bundleId}"`, newItems);
    } catch (error) {
      // Revert visual selection so UI stays consistent with cart state
      if (previous) {
        this.selectCard(previous);
      } else {
        selected.element.classList.remove('next-selected');
        selected.element.setAttribute('data-next-selected', 'false');
        this.selectedCard = null;
        this.element.removeAttribute('data-selected-bundle');
      }
      this.handleError(error, 'applyBundle');
    }
  }

  /**
   * Called when the user changes a variant on the currently selected bundle.
   * Swaps the previous effective items out and the new ones in.
   */
  private async applyEffectiveChange(
    card: BundleCard
  ): Promise<void> {
    if (this.isApplying) return;
    this.isApplying = true;
    try {
      const cartStore = useCartStore.getState();
      const retained = cartStore.items
        .filter(ci => ci.bundleId !== card.bundleId)
        .map(ci => ({ packageId: ci.packageId, quantity: ci.quantity, isUpsell: ci.is_upsell, bundleId: ci.bundleId }));
      const newItems = this.getEffectiveItems(card).map(i => ({ ...i, bundleId: card.bundleId }));
      await cartStore.swapCart([...retained, ...newItems]);
      this.logger.debug(`Variant change synced for bundle "${card.bundleId}"`, newItems);
    } catch (error) {
      this.handleError(error, 'applyEffectiveChange');
    } finally {
      this.isApplying = false;
    }
  }

  // ─── Backend price calculation ────────────────────────────────────────────────

  private async fetchAndUpdateBundlePrice(card: BundleCard): Promise<void> {
    const items = this.getEffectiveItems(card);
    const currency = useCampaignStore.getState().data?.currency ?? null;

    card.element.classList.add('next-loading');
    card.element.setAttribute('data-next-loading', 'true');

    try {
      const checkoutVouchers = useCheckoutStore.getState().vouchers;
      const merged = [...new Set([...checkoutVouchers, ...card.vouchers])];
      const vouchers = merged.length ? merged : undefined;
      const { totals, summary } = await calculateBundlePrice(items, { currency, exclude_shipping: !this.includeShipping, vouchers });

      // Skip stale results if effective items changed while the fetch was in flight
      const currentItems = this.getEffectiveItems(card);
      if (
        currentItems.length !== items.length ||
        currentItems.some((ci, i) => ci.packageId !== items[i].packageId || ci.quantity !== items[i].quantity)
      ) {
        return;
      }

      this.previewLines.set(card.bundleId, summary.lines);
      // Re-render slots so per-item prices reflect the preview discounts
      if (this.slotTemplate) this.renderSlotsForCard(card);

      // Compute compareTotal from campaign package retail prices so savings
      // reflects the retail/compare-at price diff, not just coupon discounts.
      const campaignPackages = useCampaignStore.getState().packages;
      const retailCompareTotal = items.reduce((sum, item) => {
        const pkg = campaignPackages.find(p => p.ref_id === item.packageId);
        if (!pkg?.price_retail) return sum;
        return sum + parseFloat(pkg.price_retail) * item.quantity;
      }, 0);
      const effectiveTotals = retailCompareTotal > 0
        ? buildCartTotals(summary, { exclude_shipping: !this.includeShipping, compareTotal: retailCompareTotal })
        : totals;

      card.element.querySelectorAll<HTMLElement>('[data-next-bundle-price]').forEach(el => {
        const field = el.getAttribute('data-next-bundle-price') || 'total';
        switch (field) {
          case 'subtotal':   el.textContent = effectiveTotals.subtotal.formatted; break;
          case 'compare':    el.textContent = effectiveTotals.compareTotal.formatted; break;
          case 'savings':    el.textContent = effectiveTotals.totalSavings.formatted; break;
          case 'savingsPercentage': el.textContent = effectiveTotals.totalSavingsPercentage.formatted; break;
          default:           el.textContent = effectiveTotals.total.formatted; break;
        }
      });
    } catch (error) {
      this.logger.warn(`Failed to fetch bundle price for "${card.bundleId}"`, error);
    } finally {
      card.element.classList.remove('next-loading');
      card.element.setAttribute('data-next-loading', 'false');
    }
  }

  // ─── Voucher helpers ──────────────────────────────────────────────────────────

  private parseVouchers(attr: string | null): string[] {
    if (!attr) return [];
    const trimmed = attr.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
      } catch {
        this.logger.warn('Invalid JSON in data-next-bundle-vouchers', attr);
        return [];
      }
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }

  private async applyVoucherSwap(previous: BundleCard | null, next: BundleCard): Promise<void> {
    const { useCheckoutStore } = await import('@/stores/checkoutStore');
    const checkoutStore = useCheckoutStore.getState();
    const toRemove = previous?.vouchers ?? [];
    const toApply = next.vouchers;
    for (const code of toRemove) {
      if (!toApply.includes(code)) checkoutStore.removeVoucher(code);
    }
    for (const code of toApply) {
      const current = useCheckoutStore.getState().vouchers;
      if (!current.includes(code)) checkoutStore.addVoucher(code);
    }
  }

  // ─── Cart sync ────────────────────────────────────────────────────────────────

  private syncWithCart(cartState: CartState): void {
    for (const card of this.cards) {
      const effectiveItems = this.getEffectiveItems(card);
      const allItemsInCart = effectiveItems.every(bi => {
        const ci = cartState.items.find(i => i.packageId === bi.packageId);
        return ci != null && ci.quantity >= bi.quantity;
      });
      card.element.classList.toggle('next-in-cart', allItemsInCart);
      card.element.setAttribute('data-next-in-cart', String(allItemsInCart));

      // Re-render slots so per-item prices reflect updated cart summary (discounts)
      if (this.slotTemplate && !this.isApplying) {
        this.renderSlotsForCard(card);
      }
    }

    if (!this.selectedCard) {
      const preSelected = this.cards.find(c => c.isPreSelected);
      if (preSelected) {
        this.selectCard(preSelected);
        const initVouchers = preSelected.vouchers.length
          ? this.applyVoucherSwap(null, preSelected)
          : Promise.resolve();
        if (this.mode === 'swap') {
          void initVouchers.then(() => this.applyBundle(null, preSelected));
        } else {
          void initVouchers;
        }
      }
    }
  }

  // ─── BaseEnhancer ──────────────────────────────────────────────────────────────

  public update(): void {
    this.syncWithCart(useCartStore.getState());
  }

  public getSelectedCard(): BundleCard | null {
    return this.selectedCard;
  }

  protected override cleanupEventListeners(): void {
    this.clickHandlers.forEach((h, el) => el.removeEventListener('click', h));
    this.clickHandlers.clear();
    this.selectHandlers.forEach((h, sel) => sel.removeEventListener('change', h));
    this.selectHandlers.clear();
    if (this.boundVariantOptionClick) {
      this.element.removeEventListener('click', this.boundVariantOptionClick);
      this.boundVariantOptionClick = null;
    }
    if (this.currencyChangeTimeout !== null) {
      clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = null;
    }
    if (this.boundCurrencyChangeHandler) {
      document.removeEventListener('next:currency-changed', this.boundCurrencyChangeHandler);
      this.boundCurrencyChangeHandler = null;
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }

  public override destroy(): void {
    this.cleanupEventListeners();
    this.cards.forEach(c =>
      c.element.classList.remove('next-bundle-card', 'next-selected', 'next-in-cart')
    );
    this.cards = [];
    super.destroy();
  }
}
