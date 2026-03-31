/**
 * Bundle Selector Enhancer
 *
 * Lets the developer define named bundles — each bundle being a fixed set of
 * packages + quantities — and lets the visitor pick one. When a bundle is
 * selected in **swap** mode the enhancer atomically replaces the previous
 * bundle's cart items with the new bundle's items while leaving unrelated
 * cart items untouched.
 *
 * See the original file-level JSDoc for full attribute documentation.
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCartStore } from '@/stores/cartStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { useCampaignStore } from '@/stores/campaignStore';
import type { CartState } from '@/types/global';

import type {
  BundleCard,
  BundleCardPublicState,
  BundleDef,
  BundleItem,
  BundlePackageState,
  BundleSlot,
  ClassNames,
  HandlerContext,
  PriceContext,
  RenderContext,
} from './BundleSelectorEnhancer.types';
import {
  renderBundleTemplate,
  renderSlotsForCard,
  updateCardDisplayElements,
} from './BundleSelectorEnhancer.renderer';
import {
  applyBundle,
  applyVoucherSwap,
  handleCardClick,
  handleSelectVariantChange,
  handleVariantOptionClick,
  onVoucherApplied,
} from './BundleSelectorEnhancer.handlers';
import { fetchAndUpdateBundlePrice } from './BundleSelectorEnhancer.price';
import { getEffectiveItems, makePackageState, parseVouchers } from './BundleSelectorEnhancer.state';

export class BundleSelectorEnhancer extends BaseEnhancer {
  private static readonly _instances = new Set<BundleSelectorEnhancer>();

  private mode: 'swap' | 'select' = 'swap';
  private template: string = '';
  private slotTemplate: string = '';
  private variantOptionTemplate: string = '';
  private variantSelectorTemplate: string = '';
  private cards: BundleCard[] = [];
  private selectedCard: BundleCard | null = null;
  private clickHandlers = new Map<HTMLElement, (e: Event) => void>();
  private selectHandlers = new Map<HTMLSelectElement, EventListener>();
  private mutationObserver: MutationObserver | null = null;
  private boundVariantOptionClick: ((e: Event) => void) | null = null;
  private boundCurrencyChangeHandler: (() => void) | null = null;
  private isApplyingRef = { value: false };
  private includeShipping: boolean = false;
  private externalSlotsEl: HTMLElement | null = null;
  private classNames!: ClassNames;
  private currencyChangeTimeout: ReturnType<typeof setTimeout> | null = null;
  private voucherChangeTimeout: ReturnType<typeof setTimeout> | null = null;

  public async initialize(): Promise<void> {
    this.validateElement();
    BundleSelectorEnhancer._instances.add(this);
    this.classNames = this.parseClassNames();

    this.mode = (this.getAttribute('data-next-selection-mode') ?? 'swap') as 'swap' | 'select';
    this.includeShipping = this.getAttribute('data-next-include-shipping') === 'true';

    // ── External slots container ────────────────────────────────────────────────
    const selectorId = this.getAttribute('data-next-selector-id');
    if (selectorId) {
      this.externalSlotsEl = document.querySelector<HTMLElement>(
        `[data-next-bundle-slots-for="${selectorId}"]`,
      );
    }

    // ── Card template ──────────────────────────────────────────────────────────
    const templateId = this.getAttribute('data-next-bundle-template-id');
    this.template = templateId
      ? (document.getElementById(templateId)?.innerHTML.trim() ?? '')
      : (this.getAttribute('data-next-bundle-template') ?? '');

    // ── Slot template ──────────────────────────────────────────────────────────
    const slotTemplateId = this.getAttribute('data-next-bundle-slot-template-id');
    this.slotTemplate = slotTemplateId
      ? (document.getElementById(slotTemplateId)?.innerHTML.trim() ?? '')
      : (this.getAttribute('data-next-bundle-slot-template') ?? '');

    // ── Custom variant option template ─────────────────────────────────────────
    const variantOptionTemplateId = this.getAttribute('data-next-variant-option-template-id');
    if (variantOptionTemplateId) {
      this.variantOptionTemplate =
        document.getElementById(variantOptionTemplateId)?.innerHTML.trim() ?? '';
    }

    // ── Custom variant selector template ───────────────────────────────────────
    const variantSelectorTemplateId = this.getAttribute(
      'data-next-variant-selector-template-id',
    );
    if (variantSelectorTemplateId) {
      this.variantSelectorTemplate =
        document.getElementById(variantSelectorTemplateId)?.innerHTML.trim() ?? '';
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
            const el = renderBundleTemplate(this.template, def, this.logger);
            if (el) this.element.appendChild(el);
          }
        }
      } catch {
        this.logger.warn('Invalid JSON in data-next-bundles, ignoring auto-render', bundlesAttr);
      }
    }

    // ── Delegated click handler for custom variant options ─────────────────────
    if (this.slotTemplate) {
      const handler = (e: Event) =>
        void handleVariantOptionClick(e, this.cards, this.makeHandlerContext());
      this.boundVariantOptionClick = handler;
      this.element.addEventListener('click', handler);
      // External slots are outside this.element — attach there too
      if (this.externalSlotsEl) {
        this.externalSlotsEl.addEventListener('click', handler);
      }
    }

    this.scanCards();
    this.setupMutationObserver();

    this.subscribe(useCartStore, this.syncWithCart.bind(this));
    this.syncWithCart(useCartStore.getState());

    // Re-fetch bundle prices whenever user-entered coupons change (debounced).
    // onVoucherApplied skips the re-fetch when only bundle-managed vouchers changed
    // (e.g. during a bundle swap), avoiding redundant API calls.
    let prevCheckoutVouchers = useCheckoutStore.getState().vouchers;
    this.subscribe(useCheckoutStore, state => {
      const next = state.vouchers;
      const prev = prevCheckoutVouchers;
      const changed =
        next.length !== prev.length || next.some((v, i) => v !== prev[i]);
      if (!changed) return;

      prevCheckoutVouchers = next;
      if (this.voucherChangeTimeout !== null) clearTimeout(this.voucherChangeTimeout);
      this.voucherChangeTimeout = setTimeout(() => {
        this.voucherChangeTimeout = null;
        const allBundleVouchers = this.getAllKnownBundleVouchers();
        onVoucherApplied(next, prev, this.cards, allBundleVouchers, card =>
          this.calculateAndRenderPrice(card),
        );
      }, 150);
    });

    // Re-fetch prices when the active currency changes (debounced)
    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null) clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const card of this.cards) {
          void this.calculateAndRenderPrice(card);
        }
      }, 150);
    };
    document.addEventListener('next:currency-changed', this.boundCurrencyChangeHandler);

    for (const card of this.cards) {
      void this.calculateAndRenderPrice(card);
    }

    this.logger.debug('BundleSelectorEnhancer initialized', {
      mode: this.mode,
      cardCount: this.cards.length,
    });
  }

  // ─── Price fetch + slot re-render ─────────────────────────────────────────────

  /**
   * Phases 3+4+5: fetch prices (CalculatePrices), write state (UpdateBundleState),
   * then update all variable parts of the DOM (RelenderVariable).
   * Entry point for onVariantChanged and onVoucherApplied — skips RenderBundleCard
   * and RenderBundleCardItems.
   */
  private async calculateAndRenderPrice(card: BundleCard): Promise<void> {
    await fetchAndUpdateBundlePrice(card, this.makePriceContext());
    this.relenderVariables(card);
  }

  /**
   * Phase 5 — RelenderVariable: updates all DOM that depends on calculated prices.
   * Covers slot {item.xxx} variables, [data-next-bundle-display] elements,
   * data-bundle-price-* attributes, and the bundle:price-updated event for
   * BundleDisplayEnhancer.
   */
  private relenderVariables(card: BundleCard): void {
    if (this.slotTemplate) {
      renderSlotsForCard(card, this.makeRenderContext());
      if (this.externalSlotsEl && card === this.selectedCard) {
        renderSlotsForCard(card, this.makeRenderContext(), this.externalSlotsEl);
      }
    }
    if (card.bundlePrice) {
      updateCardDisplayElements(card, card.bundlePrice);
    }
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

    const name = el.getAttribute('data-next-bundle-name') ?? '';
    const isPreSelected = el.getAttribute('data-next-selected') === 'true';
    const vouchers = parseVouchers(el.getAttribute('data-next-bundle-vouchers'), this.logger);

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

    // Populate bundle-owned package states from campaign packages (provisional baseline)
    const allPackages = useCampaignStore.getState().packages ?? [];
    const packageStates = new Map<number, BundlePackageState>();
    for (const slot of slots) {
      if (!packageStates.has(slot.activePackageId)) {
        const pkg = allPackages.find(p => p.ref_id === slot.activePackageId);
        if (pkg) packageStates.set(slot.activePackageId, makePackageState(pkg));
      }
    }

    const card: BundleCard = {
      element: el,
      bundleId,
      name,
      items,
      slots,
      isPreSelected,
      vouchers,
      packageStates,
      bundlePrice: null,
      slotVarsCache: new Map(),
    };
    this.cards.push(card);
    el.classList.add(this.classNames.bundleCard);

    if (this.slotTemplate) {
      renderSlotsForCard(card, this.makeRenderContext());
    }

    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('select, [data-next-variant-option]')) return;
      void handleCardClick(e, card, this.selectedCard, this.makeHandlerContext());
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

  // ─── Selection state ──────────────────────────────────────────────────────────

  public selectCard(card: BundleCard): void {
    this.cards.forEach(c => {
      c.element.classList.remove(this.classNames.selected);
      c.element.setAttribute('data-next-selected', 'false');
    });
    card.element.classList.add(this.classNames.selected);
    card.element.setAttribute('data-next-selected', 'true');
    this.selectedCard = card;
    this.element.setAttribute('data-selected-bundle', card.bundleId);
    this.emit('bundle:selection-changed', {
      bundleId: card.bundleId,
      items: getEffectiveItems(card),
    });
    this.renderExternalSlots(card);
  }

  private renderExternalSlots(card: BundleCard): void {
    if (!this.externalSlotsEl || !this.slotTemplate) return;
    renderSlotsForCard(card, this.makeRenderContext(), this.externalSlotsEl);
  }

  public getSelectedCard(): BundleCard | null {
    return this.selectedCard;
  }

  /** Returns display state for a bundle card by id, for use by BundleDisplayEnhancer. */
  static getBundleState(bundleId: string): BundleCardPublicState | null {
    for (const inst of BundleSelectorEnhancer._instances) {
      const card = inst.cards.find(c => c.bundleId === bundleId);
      if (card) {
        return {
          name: card.name,
          isSelected: inst.selectedCard?.bundleId === bundleId,
          bundlePrice: card.bundlePrice,
        };
      }
    }
    return null;
  }

  // ─── Cart sync ────────────────────────────────────────────────────────────────

  private syncWithCart(cartState: CartState): void {
    for (const card of this.cards) {
      const effectiveItems = getEffectiveItems(card);
      // Check both packageId AND bundleId so a package shared across bundles
      // doesn't cause incorrect "in cart" state on the wrong bundle.
      const allItemsInCart = effectiveItems.every(bi => {
        const ci = cartState.items.find(
          i => i.packageId === bi.packageId && i.bundleId === card.bundleId,
        );
        return ci != null && ci.quantity >= bi.quantity;
      });
      card.element.classList.toggle(this.classNames.inCart, allItemsInCart);
      card.element.setAttribute('data-next-in-cart', String(allItemsInCart));
    }

    if (!this.selectedCard) {
      const preSelected = this.cards.find(c => c.isPreSelected);
      const cardToSelect = preSelected ?? this.cards[0] ?? null;
      if (!preSelected && cardToSelect) {
        this.logger.warn(
          'No card has data-next-selected="true" — auto-selecting first card. ' +
          'Add data-next-selected="true" to the default card to suppress this warning.',
        );
      }
      if (cardToSelect) {
        this.selectCard(cardToSelect);
        const initVouchers = cardToSelect.vouchers.length
          ? applyVoucherSwap(null, cardToSelect)
          : Promise.resolve();
        if (this.mode === 'swap') {
          void initVouchers.then(() => applyBundle(null, cardToSelect, this.makeHandlerContext()));
        } else {
          void initVouchers;
        }
      }
    }
  }

  public update(): void {
    this.syncWithCart(useCartStore.getState());
  }

  // ─── Context factories ────────────────────────────────────────────────────────

  private makeRenderContext(): RenderContext {
    return {
      slotTemplate: this.slotTemplate,
      variantOptionTemplate: this.variantOptionTemplate,
      variantSelectorTemplate: this.variantSelectorTemplate,
      selectHandlers: this.selectHandlers,
      logger: this.logger,
      classNames: this.classNames,
      onSelectChange: (select, bundleId, slotIndex) =>
        handleSelectVariantChange(select, bundleId, slotIndex, this.cards, this.makeHandlerContext()),
    };
  }

  private makeHandlerContext(): HandlerContext {
    return {
      mode: this.mode,
      logger: this.logger,
      classNames: this.classNames,
      isApplyingRef: this.isApplyingRef,
      externalSlotsEl: this.externalSlotsEl,
      selectCard: card => this.selectCard(card),
      getSelectedCard: () => this.selectedCard,
      fetchAndUpdateBundlePrice: card => this.calculateAndRenderPrice(card),
      emit: (event, detail) => this.emit(event, detail),
    };
  }

  private makePriceContext(): PriceContext {
    return {
      includeShipping: this.includeShipping,
      allBundleVouchers: this.getAllKnownBundleVouchers(),
      logger: this.logger,
    };
  }

  // ─── Small helpers ────────────────────────────────────────────────────────────

  private parseClassNames(): ClassNames {
    const get = (key: string, fallback: string) =>
      this.getAttribute(`data-next-class-${key}`) ?? fallback;
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

  /** Vouchers defined across this instance's bundle cards. */
  private getBundleVouchers(): string[] {
    return this.cards.flatMap(c => c.vouchers);
  }

  /** Vouchers defined across ALL live BundleSelectorEnhancer instances. */
  private getAllKnownBundleVouchers(): Set<string> {
    return new Set(
      [...BundleSelectorEnhancer._instances].flatMap(inst => inst.getBundleVouchers()),
    );
  }


  // ─── Cleanup ──────────────────────────────────────────────────────────────────

  protected override cleanupEventListeners(): void {
    this.clickHandlers.forEach((h, el) => el.removeEventListener('click', h));
    this.clickHandlers.clear();
    this.selectHandlers.forEach((h, sel) => sel.removeEventListener('change', h));
    this.selectHandlers.clear();
    if (this.boundVariantOptionClick) {
      this.element.removeEventListener('click', this.boundVariantOptionClick);
      this.externalSlotsEl?.removeEventListener('click', this.boundVariantOptionClick);
      this.boundVariantOptionClick = null;
    }
    if (this.voucherChangeTimeout !== null) {
      clearTimeout(this.voucherChangeTimeout);
      this.voucherChangeTimeout = null;
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
    BundleSelectorEnhancer._instances.delete(this);
    super.destroy();
    this.cards.forEach(c =>
      c.element.classList.remove(
        this.classNames.bundleCard,
        this.classNames.selected,
        this.classNames.inCart,
      ),
    );
    this.cards = [];
  }
}
