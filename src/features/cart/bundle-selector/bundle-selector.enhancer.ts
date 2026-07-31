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

import { BaseEnhancer } from '@/core/base/base-enhancer';
import { useCartStore } from '@/state/cart';
import { useCheckoutStore } from '@/state/checkout';
import type { CartState } from '@/types/global';

import type {
  BundleCard,
  BundleCardPublicState,
  CardRegistrationContext,
  ClassNames,
  HandlerContext,
  PriceContext,
  RenderContext,
} from './bundle-selector.types';
import {
  autoRenderBundleCards,
  relenderVariables,
  renderExternalSlotsForCard,
} from './bundle-selector.renderer';
import {
  applyEffectiveChange,
  handleSelectVariantChange,
  handleVariantOptionClick,
  onVoucherApplied,
  syncCardsWithCart,
} from './bundle-selector.handlers';
import { fetchAndUpdateBundlePrice } from './bundle-selector.price';
import {
  attachBundleAccessors,
  getAllKnownBundleVouchers,
  getEffectiveItems,
  parseClassNames,
  pickAndLogDefaultCard,
  resolveBundleTemplates,
} from './bundle-selector.state';
import { registerCard, scanCards } from './bundle-selector.cards';

export class BundleSelectorEnhancer extends BaseEnhancer {
  private static readonly _instances = new Set<BundleSelectorEnhancer>();

  private mode: 'swap' | 'select' = 'swap';
  /** When true, operates in post-purchase upsell context: clicks add to order, not cart. */
  private isUpsellContext: boolean = false;
  private template: string = '';
  private slotTemplate: string = '';
  private variantOptionTemplate: string = '';
  private variantSelectorTemplate: string = '';
  private cards: BundleCard[] = [];
  private selectedCard: BundleCard | null = null;
  private clickHandlers = new Map<HTMLElement, (e: Event) => void>();
  private selectHandlers = new Map<HTMLSelectElement, EventListener>();
  private quantityHandlers = new Map<HTMLElement, (e: Event) => void>();
  /** Map card → its stepper display-refresh callback (returned by setupQuantityControls). */
  private quantityRefreshers = new Map<HTMLElement, () => void>();
  private mutationObserver: MutationObserver | null = null;
  private boundVariantOptionClick: ((e: Event) => void) | null = null;
  private boundCurrencyChangeHandler: (() => void) | null = null;
  private boundDefaultPropertyBlurHandler: ((e: FocusEvent) => void) | null =
    null;
  private isApplyingRef = { value: false };
  private includeShipping: boolean = false;
  private selectorId: string | null = null;
  private externalSlotsEl: HTMLElement | null = null;
  private classNames!: ClassNames;
  private currencyChangeTimeout: ReturnType<typeof setTimeout> | null = null;
  private voucherChangeTimeout: ReturnType<typeof setTimeout> | null = null;

  public async initialize(): Promise<void> {
    this.validateElement();
    BundleSelectorEnhancer._instances.add(this);
    this.classNames = parseClassNames(this.element);

    this.isUpsellContext = this.element.hasAttribute(
      'data-next-upsell-context'
    );
    // Upsell context is always select mode — no cart writes on selection.
    this.mode = this.isUpsellContext
      ? 'select'
      : ((this.getAttribute('data-next-selection-mode') ?? 'swap') as
          | 'swap'
          | 'select');
    this.includeShipping =
      this.getAttribute('data-next-include-shipping') === 'true';

    // ── External slots container ────────────────────────────────────────────────
    const selectorId = this.getAttribute('data-next-selector-id');
    this.selectorId = selectorId;
    if (selectorId) {
      this.externalSlotsEl = document.querySelector<HTMLElement>(
        `[data-next-bundle-slots-for="${selectorId}"]`
      );
    }

    // ── Card / slot / variant templates ─────────────────────────────────────────
    const resolved = resolveBundleTemplates(
      this.element,
      this.externalSlotsEl,
      this.logger
    );
    this.template = resolved.template;
    this.slotTemplate = resolved.slotTemplate;
    this.variantOptionTemplate = resolved.variantOptionTemplate;
    this.variantSelectorTemplate = resolved.variantSelectorTemplate;

    // ── Auto-render bundle cards from JSON ─────────────────────────────────────
    const bundlesAttr = this.getAttribute('data-next-bundles');
    if (bundlesAttr && this.template) {
      autoRenderBundleCards(
        this.element,
        bundlesAttr,
        this.template,
        this.logger
      );
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

    scanCards(this.element, this.cards, this.makeCardsContext());
    this.setupMutationObserver();

    attachBundleAccessors(this.element, () => this.selectedCard);

    if (this.isUpsellContext) {
      // No cart sync in upsell context — just pre-select the default card.
      const cardToSelect = pickAndLogDefaultCard(
        this.cards,
        this.selectorId,
        this.logger
      );
      if (cardToSelect) this.selectCard(cardToSelect);
    } else {
      this.subscribe(useCartStore, this.syncWithCart.bind(this));
      this.syncWithCart(useCartStore.getState());
    }

    // Re-fetch bundle prices whenever user-entered coupons change (debounced).
    // Runs in both normal and upsell contexts so exit-intent vouchers
    // trigger a price recalculation on upsell pages too.
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
      if (this.voucherChangeTimeout !== null)
        clearTimeout(this.voucherChangeTimeout);
      this.voucherChangeTimeout = setTimeout(() => {
        this.voucherChangeTimeout = null;
        const allBundleVouchers = this.getAllKnownBundleVouchers();
        onVoucherApplied(next, prev, this.cards, allBundleVouchers, card =>
          this.calculateAndRenderPrice(card)
        );
      }, 150);
    });

    // Re-fetch prices when the active currency changes (debounced)
    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null)
        clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const card of this.cards) {
          void this.calculateAndRenderPrice(card);
        }
      }, 150);
    };
    document.addEventListener(
      'next:currency-changed',
      this.boundCurrencyChangeHandler
    );

    // Trigger applyEffectiveChange when user blurs a page-level default property input.
    // Uses capture phase so the blur event (which doesn't bubble) is caught.
    if (this.mode === 'swap' && !this.isUpsellContext) {
      this.boundDefaultPropertyBlurHandler = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (!target.hasAttribute('data-next-default-property')) return;
        const card = this.selectedCard;
        if (!card) return;
        void applyEffectiveChange(card, this.makeHandlerContext());
      };
      document.addEventListener(
        'blur',
        this.boundDefaultPropertyBlurHandler,
        true
      );
    }

    for (const card of this.cards) {
      void this.calculateAndRenderPrice(card);
    }

    this.logger.debug('BundleSelectorEnhancer initialized', {
      mode: this.mode,
      cardCount: this.cards.length,
      isUpsellContext: this.isUpsellContext,
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
    relenderVariables(
      card,
      this.slotTemplate,
      this.makeRenderContext(),
      this.externalSlotsEl,
      this.selectedCard,
      this.selectorId
    );
  }

  // ─── Card registration ────────────────────────────────────────────────────────

  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          if (node.hasAttribute('data-next-bundle-card')) {
            if (!this.cards.find(c => c.element === node)) {
              registerCard(node, this.cards, this.makeCardsContext());
            }
          }
          node
            .querySelectorAll<HTMLElement>('[data-next-bundle-card]')
            .forEach(el => {
              if (!this.cards.find(c => c.element === el)) {
                registerCard(el, this.cards, this.makeCardsContext());
              }
            });
        });
      }
    });
    this.mutationObserver.observe(this.element, {
      childList: true,
      subtree: true,
    });
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
      selectorId: this.selectorId ?? '',
      items: getEffectiveItems(card),
    });
    renderExternalSlotsForCard(
      card,
      this.makeRenderContext(),
      this.externalSlotsEl,
      this.slotTemplate
    );

    // Notify BundleDisplayEnhancer (which listens on document, not EventBus).
    // Fires bundle:price-updated with the selectorId so displays using
    // "bundle.{selectorId}.property" immediately reflect the new selection.
    // The card's bundlePrice is already populated from the init-time fetch.
    if (this.selectorId) {
      document.dispatchEvent(
        new CustomEvent('bundle:price-updated', {
          detail: { selectorId: this.selectorId },
        })
      );
    }
  }

  public getSelectedCard(): BundleCard | null {
    return this.selectedCard;
  }

  /**
   * Returns display state for a bundle card by id, for use by BundleDisplayEnhancer.
   * If `selectorId` matches a selector's `data-next-selector-id`, returns the currently
   * selected card's state — enabling `bundle.{selectorId}.property` to always reflect
   * the active selection.
   */
  static getBundleState(selectorId: string): BundleCardPublicState | null {
    for (const inst of BundleSelectorEnhancer._instances) {
      const card = inst.cards.find(c => c.bundleId === selectorId);
      if (card) {
        return {
          name: card.name,
          isSelected: inst.selectedCard?.bundleId === selectorId,
          bundlePrice: card.bundlePrice,
        };
      }
    }
    // Fall back: if the id matches a selector id, return the selected card's state
    for (const inst of BundleSelectorEnhancer._instances) {
      if (inst.selectorId === selectorId && inst.selectedCard) {
        return {
          name: inst.selectedCard.name,
          isSelected: true,
          bundlePrice: inst.selectedCard.bundlePrice,
        };
      }
    }
    return null;
  }

  // ─── Cart sync ────────────────────────────────────────────────────────────────

  private syncWithCart(cartState: CartState): void {
    syncCardsWithCart(
      cartState,
      this.cards,
      () => pickAndLogDefaultCard(this.cards, this.selectorId, this.logger),
      this.makeHandlerContext()
    );
  }

  public update(): void {
    if (!this.isUpsellContext) this.syncWithCart(useCartStore.getState());
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
        handleSelectVariantChange(
          select,
          bundleId,
          slotIndex,
          this.cards,
          this.makeHandlerContext()
        ),
      onPropertyBlur: card =>
        void applyEffectiveChange(card, this.makeHandlerContext()),
    };
  }

  private makeHandlerContext(): HandlerContext {
    return {
      mode: this.mode,
      logger: this.logger,
      classNames: this.classNames,
      isApplyingRef: this.isApplyingRef,
      externalSlotsEl: this.externalSlotsEl,
      containerElement: this.element,
      isUpsellContext: this.isUpsellContext,
      selectorId: this.selectorId,
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
      isUpsellContext: this.isUpsellContext,
      logger: this.logger,
    };
  }

  private makeCardsContext(): CardRegistrationContext {
    return {
      classNames: this.classNames,
      slotTemplate: this.slotTemplate,
      externalSlotsEl: this.externalSlotsEl,
      selectorId: this.selectorId,
      logger: this.logger,
      clickHandlers: this.clickHandlers,
      quantityHandlers: this.quantityHandlers,
      quantityRefreshers: this.quantityRefreshers,
      makeRenderContext: () => this.makeRenderContext(),
      makeHandlerContext: () => this.makeHandlerContext(),
    };
  }

  // ─── Small helpers ────────────────────────────────────────────────────────────

  /** Vouchers defined across ALL live BundleSelectorEnhancer instances. */
  private getAllKnownBundleVouchers(): Set<string> {
    return getAllKnownBundleVouchers(
      [...BundleSelectorEnhancer._instances].map(inst => inst.cards)
    );
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────────

  protected override cleanupEventListeners(): void {
    this.clickHandlers.forEach((h, el) => el.removeEventListener('click', h));
    this.clickHandlers.clear();
    this.selectHandlers.forEach((h, sel) =>
      sel.removeEventListener('change', h)
    );
    this.selectHandlers.clear();
    this.quantityHandlers.forEach((h, el) =>
      el.removeEventListener('click', h)
    );
    this.quantityHandlers.clear();
    this.quantityRefreshers.clear();
    for (const card of this.cards) {
      if (card.qtyDebounceTimeout !== null) {
        clearTimeout(card.qtyDebounceTimeout);
        card.qtyDebounceTimeout = null;
      }
    }
    if (this.boundVariantOptionClick) {
      this.element.removeEventListener('click', this.boundVariantOptionClick);
      this.externalSlotsEl?.removeEventListener(
        'click',
        this.boundVariantOptionClick
      );
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
      document.removeEventListener(
        'next:currency-changed',
        this.boundCurrencyChangeHandler
      );
      this.boundCurrencyChangeHandler = null;
    }
    if (this.boundDefaultPropertyBlurHandler) {
      document.removeEventListener(
        'blur',
        this.boundDefaultPropertyBlurHandler,
        true
      );
      this.boundDefaultPropertyBlurHandler = null;
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
        this.classNames.inCart
      )
    );
    this.cards = [];
  }
}
