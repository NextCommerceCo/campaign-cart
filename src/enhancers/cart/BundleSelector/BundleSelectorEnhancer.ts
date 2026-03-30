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
import type { CartState } from '@/types/global';
import type { SummaryLine } from '@/types/api';

import type {
  BundleCard,
  BundleDef,
  BundleItem,
  BundleSlot,
  ClassNames,
  HandlerContext,
  PriceContext,
  RenderContext,
} from './BundleSelectorEnhancer.types';
import { renderBundleTemplate, renderSlotsForCard } from './BundleSelectorEnhancer.renderer';
import {
  applyBundle,
  applyVoucherSwap,
  handleCardClick,
  handleSelectVariantChange,
  handleVariantOptionClick,
} from './BundleSelectorEnhancer.handlers';
import { fetchAndUpdateBundlePrice } from './BundleSelectorEnhancer.price';

export class BundleSelectorEnhancer extends BaseEnhancer {
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
  private previewLines = new Map<string, SummaryLine[]>();
  private currencyChangeTimeout: ReturnType<typeof setTimeout> | null = null;
  private voucherChangeTimeout: ReturnType<typeof setTimeout> | null = null;

  public async initialize(): Promise<void> {
    this.validateElement();
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
        handleVariantOptionClick(e, this.cards, this.makeHandlerContext());
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

    // Re-fetch bundle prices whenever checkout vouchers change (debounced)
    let prevCheckoutVouchers = useCheckoutStore.getState().vouchers;
    this.subscribe(useCheckoutStore, state => {
      const next = state.vouchers;
      if (
        next.length !== prevCheckoutVouchers.length ||
        next.some((v, i) => v !== prevCheckoutVouchers[i])
      ) {
        prevCheckoutVouchers = next;
        if (this.voucherChangeTimeout !== null) clearTimeout(this.voucherChangeTimeout);
        this.voucherChangeTimeout = setTimeout(() => {
          this.voucherChangeTimeout = null;
          for (const card of this.cards) {
            void fetchAndUpdateBundlePrice(card, this.makePriceContext());
          }
        }, 150);
      }
    });

    // Re-fetch prices when the active currency changes (debounced)
    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null) clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const card of this.cards) {
          void fetchAndUpdateBundlePrice(card, this.makePriceContext());
        }
      }, 150);
    };
    document.addEventListener('next:currency-changed', this.boundCurrencyChangeHandler);

    for (const card of this.cards) {
      void fetchAndUpdateBundlePrice(card, this.makePriceContext());
    }

    this.logger.debug('BundleSelectorEnhancer initialized', {
      mode: this.mode,
      cardCount: this.cards.length,
    });
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
      items: this.getEffectiveItems(card),
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

  // ─── Cart sync ────────────────────────────────────────────────────────────────

  private syncWithCart(cartState: CartState): void {
    for (const card of this.cards) {
      const effectiveItems = this.getEffectiveItems(card);
      const allItemsInCart = effectiveItems.every(bi => {
        const ci = cartState.items.find(i => i.packageId === bi.packageId);
        return ci != null && ci.quantity >= bi.quantity;
      });
      card.element.classList.toggle(this.classNames.inCart, allItemsInCart);
      card.element.setAttribute('data-next-in-cart', String(allItemsInCart));

      if (this.slotTemplate && !this.isApplyingRef.value && !this.externalSlotsEl) {
        renderSlotsForCard(card, this.makeRenderContext());
      }
    }

    if (this.externalSlotsEl && this.selectedCard && !this.isApplyingRef.value) {
      this.renderExternalSlots(this.selectedCard);
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
      previewLines: this.previewLines,
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
      getEffectiveItems: card => this.getEffectiveItems(card),
      fetchAndUpdateBundlePrice: card =>
        fetchAndUpdateBundlePrice(card, this.makePriceContext()),
      renderSlotsForCard: card => {
        renderSlotsForCard(card, this.makeRenderContext());
        if (this.externalSlotsEl) {
          renderSlotsForCard(card, this.makeRenderContext(), this.externalSlotsEl);
        }
      },
      emit: (event, detail) => this.emit(event, detail),
    };
  }

  private makePriceContext(): PriceContext {
    return {
      includeShipping: this.includeShipping,
      previewLines: this.previewLines,
      cards: this.cards,
      logger: this.logger,
      slotTemplate: this.slotTemplate,
      renderSlotsForCard: card => renderSlotsForCard(card, this.makeRenderContext()),
      getEffectiveItems: card => this.getEffectiveItems(card),
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

  private getEffectiveItems(card: BundleCard): BundleItem[] {
    const qtyCounts = new Map<number, number>();
    for (const slot of card.slots) {
      qtyCounts.set(
        slot.activePackageId,
        (qtyCounts.get(slot.activePackageId) ?? 0) + slot.quantity,
      );
    }
    return Array.from(qtyCounts.entries()).map(([packageId, quantity]) => ({
      packageId,
      quantity,
    }));
  }

  private parseVouchers(attr: string | null): string[] {
    if (!attr) return [];
    const trimmed = attr.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed)
          ? parsed.filter((v): v is string => typeof v === 'string')
          : [];
      } catch {
        this.logger.warn('Invalid JSON in data-next-bundle-vouchers', attr);
        return [];
      }
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
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
