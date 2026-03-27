/**
 * Package Selector Enhancer
 *
 * Manages a group of mutually-exclusive selectable package cards within a
 * container element. The visitor picks exactly one package. Supports swap mode
 * (immediate cart update) and select mode (external button handles the cart).
 *
 * ─── Container attributes ────────────────────────────────────────────────────
 *
 *   data-next-package-selector        — marks the container element
 *
 *   data-next-selector-id="<id>"      — ID used by AddToCartEnhancer to read
 *                                        the current selection (required)
 *
 *   data-next-selection-mode          — "swap" (default) | "select"
 *     swap   → selecting a card immediately updates the cart
 *     select → only tracks selection; an external button handles the cart
 *
 *   data-next-packages='[…]'          — JSON array of package definitions for
 *                                        auto-render mode (see below)
 *
 *   data-next-package-template-id="<id>" — ID of a <template> element whose
 *                                           innerHTML is the card template
 *
 *   data-next-package-template="<html>"  — inline card template string
 *
 * ─── Card attributes ─────────────────────────────────────────────────────────
 *
 *   data-next-selector-card           — marks a card element
 *   data-next-package-id="<id>"       — package ref_id (required per card)
 *   data-next-selected="true"         — pre-selects this card on init
 *   data-next-quantity="<n>"          — initial quantity (default 1)
 *   data-next-min-quantity="<n>"      — minimum quantity (default 1)
 *   data-next-max-quantity="<n>"      — maximum quantity (default 999)
 *   data-next-shipping-id="<id>"      — shipping method to set on selection
 *
 * ─── Inline quantity controls ────────────────────────────────────────────────
 *
 *   data-next-quantity-increase       — increment button within a card
 *   data-next-quantity-decrease       — decrement button within a card
 *   data-next-quantity-display        — element that shows current quantity
 *
 * ─── Backend price slots ─────────────────────────────────────────────────────
 *
 *   data-next-package-price           — formatted total price (default)
 *   data-next-package-price="compare" — retail/compare-at price
 *   data-next-package-price="savings" — savings amount
 *   data-next-package-price="savingsPercentage" — savings percentage
 *   data-next-package-price="subtotal" — subtotal
 *
 * ─── Auto-render mode ────────────────────────────────────────────────────────
 *
 *   data-next-packages is a JSON array where every object may contain any
 *   keys — all are exposed as {package.<key>} template variables. The
 *   campaign store enriches the following built-ins when not set in JSON:
 *
 *     {package.packageId}     — package ref_id (required in JSON)
 *     {package.name}          — package name
 *     {package.image}         — package image URL
 *     {package.price}         — campaign per-unit price
 *     {package.priceRetail}   — campaign retail/compare price
 *     {package.priceTotal}    — campaign price × qty
 *
 *   Set "selected": true in a JSON object to pre-select that card.
 *
 *   Example:
 *   [
 *     { "packageId": 10, "name": "1 Bottle", "selected": true },
 *     { "packageId": 11, "name": "3 Bottles" }
 *   ]
 *
 * ─── CSS classes applied ─────────────────────────────────────────────────────
 *
 *   next-selector-card  — added to every registered card element
 *   next-selected       — the currently selected card
 *   next-in-cart        — card whose package is present in the cart
 *
 * ─── Events emitted ──────────────────────────────────────────────────────────
 *
 *   selector:item-selected    — card clicked; payload: { selectorId, packageId,
 *                               previousPackageId, mode }
 *   selector:selection-changed — selection updated; payload: { selectorId,
 *                               packageId, quantity, item }
 *   selector:quantity-changed — inline qty control changed; payload:
 *                               { selectorId, packageId, quantity }
 *
 * ─── AddToCartEnhancer contract ──────────────────────────────────────────────
 *
 *   element._getSelectedItem()      → SelectorItem | null
 *   element._getSelectedPackageId() → number | undefined
 *   element[data-selected-package]  → string (packageId)
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCartStore } from '@/stores/cartStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import type { CartState, SelectorItem } from '@/types/global';
import type { PackageDef, SelectorHandlerContext } from './PackageSelectorEnhancer.types';
import { renderPackageTemplate } from './PackageSelectorEnhancer.renderer';
import { fetchAndUpdatePrice } from './PackageSelectorEnhancer.price';
import {
  selectItem,
  handleCardClick,
  updateCart,
  setupQuantityControls,
} from './PackageSelectorEnhancer.handlers';

export class PackageSelectorEnhancer extends BaseEnhancer {
  private selectorId: string = '';
  private mode: 'swap' | 'select' = 'swap';
  private template: string = '';
  private items: SelectorItem[] = [];
  private selectedItemRef: { value: SelectorItem | null } = { value: null };
  private clickHandlers = new Map<HTMLElement, (e: Event) => void>();
  private quantityHandlers = new Map<HTMLElement, (e: Event) => void>();
  private mutationObserver: MutationObserver | null = null;
  private boundCurrencyChangeHandler: (() => void) | null = null;
  private currencyChangeTimeout: ReturnType<typeof setTimeout> | null = null;
  private includeShipping: boolean = false;
  /** When true, operates in post-purchase upsell context: no cart writes, ?upsell=true on calculate. */
  private isUpsellContext: boolean = false;

  public async initialize(): Promise<void> {
    this.validateElement();

    this.selectorId =
      this.getAttribute('data-next-selector-id') ??
      this.getAttribute('data-next-id') ??
      `selector-${Date.now()}`;

    this.isUpsellContext = this.element.hasAttribute('data-next-upsell-context');
    // Upsell context is always select mode — no cart writes on selection.
    this.mode = this.isUpsellContext
      ? 'select'
      : ((this.getAttribute('data-next-selection-mode') ?? 'swap') as 'swap' | 'select');
    this.includeShipping = this.getAttribute('data-next-include-shipping') === 'true';

    const templateId = this.getAttribute('data-next-package-template-id');
    if (templateId) {
      this.template = document.getElementById(templateId)?.innerHTML.trim() ?? '';
    } else {
      this.template = this.getAttribute('data-next-package-template') ?? '';
    }

    const packagesAttr = this.getAttribute('data-next-packages');
    if (packagesAttr && this.template) {
      try {
        const parsed: unknown = JSON.parse(packagesAttr);
        if (!Array.isArray(parsed)) {
          this.logger.warn('data-next-packages must be a JSON array, ignoring auto-render');
        } else {
          this.element.innerHTML = '';
          for (const def of parsed as PackageDef[]) {
            const el = renderPackageTemplate(this.template, def, this.logger);
            if (el) this.element.appendChild(el);
          }
        }
      } catch {
        this.logger.warn('Invalid JSON in data-next-packages, ignoring auto-render', packagesAttr);
      }
    }

    this.scanCards();
    this.setupMutationObserver();

    (this.element as any)._getSelectedItem = () => this.selectedItemRef.value;
    (this.element as any)._getSelectedPackageId = () => this.selectedItemRef.value?.packageId;

    if (this.isUpsellContext) {
      // No cart sync in upsell context — just pre-select the default item.
      this.initializeSelection();
    } else {
      this.subscribe(useCartStore, this.syncWithCart.bind(this));
      this.syncWithCart(useCartStore.getState());

      let prevVouchers = useCheckoutStore.getState().vouchers;
      this.subscribe(useCheckoutStore, state => {
        const next = state.vouchers;
        if (next.length !== prevVouchers.length || next.some((v, i) => v !== prevVouchers[i])) {
          prevVouchers = next;
          for (const item of this.items) {
            void fetchAndUpdatePrice(item, this.includeShipping, this.logger);
          }
        }
      });
    }

    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null) clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const item of this.items) {
          void fetchAndUpdatePrice(item, this.includeShipping, this.logger, this.isUpsellContext);
        }
      }, 150);
    };
    document.addEventListener('next:currency-changed', this.boundCurrencyChangeHandler);

    for (const item of this.items) {
      void fetchAndUpdatePrice(item, this.includeShipping, this.logger, this.isUpsellContext);
    }

    this.logger.debug('PackageSelectorEnhancer initialized', {
      selectorId: this.selectorId,
      mode: this.mode,
      isUpsellContext: this.isUpsellContext,
      itemCount: this.items.length,
    });
  }

  // ─── Upsell context: pre-select default item without touching cart ────────

  private initializeSelection(): void {
    if (this.selectedItemRef.value) return;
    const ctx = this.makeHandlerContext();
    const preSelected = this.items.find(i => i.isPreSelected) ?? this.items[0];
    if (preSelected) selectItem(preSelected, ctx);
  }

  // ─── Context factory ───────────────────────────────────────────────────────

  private makeHandlerContext(): SelectorHandlerContext {
    return {
      selectorId: this.selectorId,
      mode: this.mode,
      includeShipping: this.includeShipping,
      logger: this.logger,
      element: this.element,
      emit: (e, d) => this.emit(e as any, d as any),
      selectedItemRef: this.selectedItemRef,
      items: this.items,
    };
  }

  // ─── Card registration ────────────────────────────────────────────────────

  private scanCards(): void {
    this.element.querySelectorAll<HTMLElement>('[data-next-selector-card]').forEach(el => {
      if (!this.items.find(i => i.element === el)) this.registerCard(el);
    });
  }

  private registerCard(el: HTMLElement): void {
    const packageIdAttr = el.getAttribute('data-next-package-id');
    if (!packageIdAttr) {
      this.logger.warn('Selector card is missing data-next-package-id', el);
      return;
    }
    const packageId = parseInt(packageIdAttr, 10);
    if (isNaN(packageId)) {
      this.logger.warn('Invalid data-next-package-id on selector card', packageIdAttr);
      return;
    }

    const existing = this.items.find(i => i.element === el);
    if (existing) {
      existing.packageId = packageId;
      existing.quantity = parseInt(el.getAttribute('data-next-quantity') ?? '1', 10);
      existing.shippingId = el.getAttribute('data-next-shipping-id') ?? undefined;
      this.updateItemPackageData(existing);
      return;
    }

    const quantity = parseInt(el.getAttribute('data-next-quantity') ?? '1', 10);
    const isPreSelected = el.getAttribute('data-next-selected') === 'true';
    const shippingId = el.getAttribute('data-next-shipping-id') ?? undefined;

    const pkg = useCampaignStore.getState().getPackage(packageId);
    const item: SelectorItem = {
      element: el,
      packageId,
      quantity,
      price: pkg?.price ? parseFloat(pkg.price) : undefined,
      name: pkg?.name ?? `Package ${packageId}`,
      isPreSelected,
      shippingId,
    };

    this.items.push(item);
    el.classList.add('next-selector-card');

    const ctx = this.makeHandlerContext();
    const handler = (e: Event) => void handleCardClick(e, item, ctx);
    this.clickHandlers.set(el, handler);
    el.addEventListener('click', handler);

    setupQuantityControls(item, ctx, this.quantityHandlers);

    this.logger.debug(`Registered selector card for package ${packageId}`);
  }

  private updateItemPackageData(item: SelectorItem): void {
    const pkg = useCampaignStore.getState().getPackage(item.packageId);
    if (pkg) {
      item.price = pkg.price ? parseFloat(pkg.price) : item.price;
      item.name = pkg.name ?? item.name;
    }
  }

  // ─── Mutation observer ────────────────────────────────────────────────────

  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
          const target = mutation.target;
          if (
            target.hasAttribute('data-next-selector-card') &&
            mutation.attributeName === 'data-next-package-id'
          ) {
            this.handlePackageIdChange(target);
          }
        }

        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (!(node instanceof HTMLElement)) return;
            if (node.hasAttribute('data-next-selector-card')) this.registerCard(node);
            node.querySelectorAll<HTMLElement>('[data-next-selector-card]').forEach(el => {
              if (!this.items.find(i => i.element === el)) this.registerCard(el);
            });
          });
          mutation.removedNodes.forEach(node => {
            if (node instanceof HTMLElement) this.handleCardRemoval(node);
          });
        }
      }
    });

    this.mutationObserver.observe(this.element, {
      attributes: true,
      attributeFilter: ['data-next-package-id', 'data-next-quantity', 'data-next-selected'],
      childList: true,
      subtree: true,
    });
  }

  private handlePackageIdChange(el: HTMLElement): void {
    const item = this.items.find(i => i.element === el);
    if (!item) {
      this.registerCard(el);
      return;
    }
    const newIdAttr = el.getAttribute('data-next-package-id');
    if (!newIdAttr) return;
    const newId = parseInt(newIdAttr, 10);
    const oldId = item.packageId;
    if (newId === oldId) return;

    item.packageId = newId;
    item.quantity = parseInt(el.getAttribute('data-next-quantity') ?? '1', 10);
    item.shippingId = el.getAttribute('data-next-shipping-id') ?? undefined;
    this.updateItemPackageData(item);

    if (this.selectedItemRef.value === item && this.mode === 'swap') {
      void updateCart({ ...item, packageId: oldId }, item, this.items);
    }

    this.syncWithCart(useCartStore.getState());
  }

  private handleCardRemoval(el: HTMLElement): void {
    const toRemove: HTMLElement[] = [];
    if (el.hasAttribute('data-next-selector-card')) toRemove.push(el);
    el.querySelectorAll<HTMLElement>('[data-next-selector-card]').forEach(c => toRemove.push(c));

    for (const cardEl of toRemove) {
      const idx = this.items.findIndex(i => i.element === cardEl);
      if (idx === -1) continue;
      const removed = this.items[idx];

      const ch = this.clickHandlers.get(cardEl);
      if (ch) { cardEl.removeEventListener('click', ch); this.clickHandlers.delete(cardEl); }

      for (const btn of [
        cardEl.querySelector<HTMLElement>('[data-next-quantity-increase]'),
        cardEl.querySelector<HTMLElement>('[data-next-quantity-decrease]'),
      ]) {
        if (!btn) continue;
        const h = this.quantityHandlers.get(btn);
        if (h) { btn.removeEventListener('click', h); this.quantityHandlers.delete(btn); }
      }

      this.items.splice(idx, 1);

      if (this.selectedItemRef.value === removed) {
        this.selectedItemRef.value = null;
        this.element.removeAttribute('data-selected-package');
      }
    }
  }

  // ─── Cart sync ────────────────────────────────────────────────────────────

  private syncWithCart(cartState: CartState): void {
    const ctx = this.makeHandlerContext();

    for (const item of this.items) {
      const inCart = cartState.items.some(
        ci => ci.packageId === item.packageId || ci.originalPackageId === item.packageId
      );
      item.element.classList.toggle('next-in-cart', inCart);
      item.element.setAttribute('data-next-in-cart', String(inCart));

      if (inCart) {
        const ci = cartState.items.find(
          ci => ci.packageId === item.packageId || ci.originalPackageId === item.packageId
        );
        if (ci && item.quantity !== ci.quantity) {
          item.quantity = ci.quantity;
          const displayEl = item.element.querySelector<HTMLElement>('[data-next-quantity-display]');
          if (displayEl) displayEl.textContent = String(item.quantity);
          item.element.setAttribute('data-next-quantity', String(item.quantity));
        }
      }
    }

    if (this.mode === 'swap') {
      const inCartItem = this.items.find(item =>
        cartState.items.some(
          ci => ci.packageId === item.packageId || ci.originalPackageId === item.packageId
        )
      );
      if (inCartItem && this.selectedItemRef.value !== inCartItem) {
        selectItem(inCartItem, ctx);
        return;
      }
    }

    if (!this.selectedItemRef.value) {
      const preSelected = this.items.find(i => i.isPreSelected) ?? this.items[0];
      if (preSelected) {
        selectItem(preSelected, ctx);
        if (this.mode === 'swap' && cartState.isEmpty) {
          void updateCart(null, preSelected, this.items).then(() => {
            if (preSelected.shippingId) {
              void useCartStore.getState().setShippingMethod(
                parseInt(preSelected.shippingId, 10)
              );
            }
          });
        }
      }
    }
  }

  // ─── BaseEnhancer ─────────────────────────────────────────────────────────

  public update(): void {
    if (!this.isUpsellContext) this.syncWithCart(useCartStore.getState());
  }

  public getSelectedItem(): SelectorItem | null {
    return this.selectedItemRef.value;
  }

  protected override cleanupEventListeners(): void {
    this.clickHandlers.forEach((h, el) => el.removeEventListener('click', h));
    this.clickHandlers.clear();
    this.quantityHandlers.forEach((h, el) => el.removeEventListener('click', h));
    this.quantityHandlers.clear();
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
    this.items.forEach(i =>
      i.element.classList.remove('next-selector-card', 'next-selected', 'next-in-cart')
    );
    this.items = [];
    super.destroy();
  }
}
