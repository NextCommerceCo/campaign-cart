/**
 * Package Toggle Enhancer
 *
 * Manages independently toggleable package cards. Each card maps to a single
 * package. Clicking a card adds the package to the cart; clicking it again
 * removes it. Any combination of cards can be active simultaneously — unlike
 * PackageSelectorEnhancer (pick exactly one).
 *
 * Also supports single-element toggle mode: place data-next-package-toggle
 * directly on a button/element (with data-next-package-id) when no child cards
 * are needed.
 *
 * ─── Container attributes ────────────────────────────────────────────────────
 *
 *   data-next-package-toggle         — marks the container (or the toggle
 *                                       element itself in single-element mode)
 *
 *   data-next-packages='[…]'         — JSON array of package definitions for
 *                                       auto-render mode (see below)
 *
 *   data-next-toggle-template-id="<id>" — ID of a <template> element whose
 *                                          innerHTML is the card template
 *
 *   data-next-toggle-template="<html>"  — inline card template string
 *
 *   data-next-include-shipping="true"   — include shipping in price calculation
 *
 * ─── Card attributes ─────────────────────────────────────────────────────────
 *
 *   data-next-toggle-card             — marks a card element
 *   data-next-package-id="<id>"       — package ref_id (required per card)
 *   data-next-selected="true"         — pre-selects (auto-adds) on init
 *   data-next-quantity="<n>"          — quantity to add (default 1)
 *   data-next-package-sync="1,2,3"   — sync quantity to sum of listed packages
 *   data-next-is-upsell="true"        — mark as upsell/bump item
 *   data-add-text="<text>"            — button text when not in cart
 *   data-remove-text="<text>"         — button text when in cart
 *
 * ─── Backend price slots ─────────────────────────────────────────────────────
 *
 *   data-next-toggle-price                    — formatted total price (default)
 *   data-next-toggle-price="unitPrice"        — per-unit price
 *   data-next-toggle-price="originalPrice"    — retail/compare-at total price
 *   data-next-toggle-price="originalUnitPrice" — retail/compare-at per-unit price
 *   data-next-toggle-price="discountAmount"   — savings amount
 *   data-next-toggle-price="discountPercentage" — savings percentage
 *   data-next-toggle-price="hasDiscount"      — "true" / "false"
 *   data-next-toggle-price="isRecurring"      — "true" / "false"
 *   data-next-toggle-price="recurringPrice"   — recurring charge total
 *   data-next-toggle-price="frequency"        — "Per month", "Every 3 months", "One time"
 *   data-next-toggle-price="currency"         — ISO currency code
 *
 * ─── Auto-render mode ────────────────────────────────────────────────────────
 *
 *   data-next-packages is a JSON array where every object may contain any
 *   keys — all are exposed as {toggle.<key>} template variables. The
 *   campaign store enriches the following built-ins:
 *
 *     {toggle.packageId}        — package ref_id (required in JSON)
 *     {toggle.name}             — package name
 *     {toggle.image}            — package image URL
 *     {toggle.price}            — campaign per-unit price
 *     {toggle.priceRetail}      — campaign retail/compare price
 *     {toggle.priceRetailTotal} — retail total
 *
 *   Set "selected": true in a JSON object to pre-select that card.
 *
 *   Example:
 *   [
 *     { "packageId": 101, "name": "Extra Battery", "selected": true },
 *     { "packageId": 102, "description": "Full replacement" }
 *   ]
 *
 * ─── CSS classes applied ─────────────────────────────────────────────────────
 *
 *   next-toggle-card   — added to every registered card
 *   next-in-cart       — package is present in the cart
 *   next-not-in-cart   — package is not in the cart
 *   next-selected      — alias for next-in-cart (styling convenience)
 *   next-active        — alias for next-in-cart (styling convenience)
 *   next-loading       — during an async cart operation
 *
 * ─── Events emitted ──────────────────────────────────────────────────────────
 *
 *   toggle:toggled           — card clicked; payload: { packageId, added }
 *   toggle:selection-changed — after cart sync; payload: { selected: number[] }
 *
 * ─── Static card example ─────────────────────────────────────────────────────
 *
 *   <div data-next-package-toggle>
 *     <div data-next-toggle-card data-next-package-id="101" data-next-selected="true">
 *       <span>Extra Battery</span>
 *       <span data-next-toggle-price></span>
 *       <del data-next-toggle-price="originalPrice"></del>
 *     </div>
 *   </div>
 *
 * ─── Single-element toggle example ───────────────────────────────────────────
 *
 *   <button data-next-package-toggle
 *           data-next-package-id="123"
 *           data-add-text="Add to Cart"
 *           data-remove-text="✓ In Cart">
 *     Add to Cart
 *   </button>
 *
 * ─── Auto-render example ─────────────────────────────────────────────────────
 *
 *   <div data-next-package-toggle
 *        data-next-packages='[{"packageId":101,"name":"Battery","selected":true}]'
 *        data-next-toggle-template-id="toggle-tpl">
 *   </div>
 *
 *   <template id="toggle-tpl">
 *     <div data-next-toggle-card>
 *       <strong>{toggle.name}</strong>
 *       <span data-next-toggle-price></span>
 *     </div>
 *   </template>
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCartStore } from '@/stores/cartStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { useCampaignStore } from '@/stores/campaignStore';
import type { CartState } from '@/types/global';
import type { PackageDef, ToggleCard } from './PackageToggleEnhancer.types';
import type { ToggleHandlerContext } from './PackageToggleEnhancer.handlers';
import { renderToggleTemplate, renderToggleImage, renderTogglePrice, updateCardDisplayElements } from './PackageToggleEnhancer.renderer';
import { makeProvisionalPrices } from './PackageToggleEnhancer.state';
import { fetchAndUpdateTogglePrice } from './PackageToggleEnhancer.price';
import {
  autoAddedPackages,
  handleCardClick,
  addToCart,
  updateSyncedQuantity,
  handleSyncUpdate,
} from './PackageToggleEnhancer.handlers';

export class PackageToggleEnhancer extends BaseEnhancer {
  private static _instances = new Set<PackageToggleEnhancer>();

  /**
   * Returns display state for a toggle card by packageId, for use by
   * PackageToggleDisplayEnhancer via toggle.{packageId}.{property} paths.
   */
  static getToggleState(packageId: number): ToggleCard | null {
    for (const inst of PackageToggleEnhancer._instances) {
      const card = inst.cards.find(c => c.packageId === packageId);
      if (card) return card;
    }
    return null;
  }

  private template: string = '';
  private cards: ToggleCard[] = [];
  private clickHandlers = new Map<HTMLElement, (e: Event) => void>();
  private mutationObserver: MutationObserver | null = null;
  private boundCurrencyChangeHandler: (() => void) | null = null;
  private currencyChangeTimeout: ReturnType<typeof setTimeout> | null = null;
  private priceSyncDebounce: ReturnType<typeof setTimeout> | null = null;
  private includeShipping: boolean = false;
  private autoAddInProgress = new Set<number>();
  /** When true, operates in post-purchase upsell context: clicks add to order, not cart. */
  private isUpsellContext: boolean = false;
  private isProcessingRef = { value: false };

  public async initialize(): Promise<void> {
    PackageToggleEnhancer._instances.add(this);
    this.validateElement();

    this.isUpsellContext = this.element.hasAttribute('data-next-upsell-context');
    this.includeShipping = this.getAttribute('data-next-include-shipping') === 'true';

    const templateId = this.getAttribute('data-next-toggle-template-id');
    if (templateId) {
      this.template = document.getElementById(templateId)?.innerHTML.trim() ?? '';
    } else {
      this.template = this.getAttribute('data-next-toggle-template') ?? '';
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
            const el = renderToggleTemplate(this.template, def, this.logger);
            if (el) this.element.appendChild(el);
          }
        }
      } catch {
        this.logger.warn('Invalid JSON in data-next-packages, ignoring auto-render', packagesAttr);
      }
    }

    this.scanCards();
    this.setupMutationObserver();

    for (const card of this.cards) {
      renderToggleImage(card);
    }

    if (!this.isUpsellContext) {
      this.subscribe(useCartStore, this.syncWithCart.bind(this));
      this.syncWithCart(useCartStore.getState());

      let prevVouchers = useCheckoutStore.getState().vouchers;
      this.subscribe(useCheckoutStore, state => {
        const next = state.vouchers;
        if (
          next.length !== prevVouchers.length ||
          next.some((v, i) => v !== prevVouchers[i])
        ) {
          prevVouchers = next;
          for (const card of this.cards) {
            void fetchAndUpdateTogglePrice(card, this.includeShipping, this.logger);
          }
        }
      });
    }

    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null) clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const card of this.cards) {
          void fetchAndUpdateTogglePrice(card, this.includeShipping, this.logger, this.isUpsellContext);
        }
      }, 150);
    };
    document.addEventListener('next:currency-changed', this.boundCurrencyChangeHandler);

    for (const card of this.cards) {
      void fetchAndUpdateTogglePrice(card, this.includeShipping, this.logger, this.isUpsellContext);
    }

    this.logger.debug('PackageToggleEnhancer initialized', {
      cardCount: this.cards.length,
      isUpsellContext: this.isUpsellContext,
    });
  }

  // ─── Context factory ───────────────────────────────────────────────────────

  private makeHandlerContext(): ToggleHandlerContext {
    return {
      logger: this.logger,
      emit: (e, d) => this.emit(e, d),
      autoAddInProgress: this.autoAddInProgress,
      isUpsellContext: this.isUpsellContext,
      isProcessingRef: this.isProcessingRef,
      containerElement: this.element,
    };
  }

  // ─── Card registration ────────────────────────────────────────────────────

  private scanCards(): void {
    this.element.querySelectorAll<HTMLElement>('[data-next-toggle-card]').forEach(el => {
      if (!this.cards.find(c => c.element === el)) this.registerCard(el);
    });

    if (
      this.element.hasAttribute('data-next-package-toggle') &&
      this.cards.length === 0 &&
      (this.element.hasAttribute('data-next-package-id') ||
        this.element.hasAttribute('data-package-id'))
    ) {
      this.registerCard(this.element);
    }
  }

  private registerCard(el: HTMLElement): void {
    const stateContainer = this.findStateContainer(el);

    const packageIdAttr = el.getAttribute('data-next-package-id');
    let packageId: number;

    if (packageIdAttr) {
      const parsed = parseInt(packageIdAttr, 10);
      if (isNaN(parsed)) {
        this.logger.warn('Invalid data-next-package-id on toggle card', packageIdAttr);
        return;
      }
      packageId = parsed;
    } else {
      const resolved = this.resolvePackageId(el, stateContainer);
      if (resolved === null) {
        this.logger.warn('Toggle card is missing data-next-package-id', el);
        return;
      }
      packageId = resolved;
    }

    const isPreSelected =
      el.getAttribute('data-next-selected') === 'true' ||
      stateContainer.getAttribute('data-next-selected') === 'true';

    const packageSyncAttr =
      el.getAttribute('data-next-package-sync') ??
      stateContainer.getAttribute('data-next-package-sync');

    let isSyncMode = false;
    let syncPackageIds: number[] = [];
    let quantity = 1;

    if (packageSyncAttr) {
      syncPackageIds = packageSyncAttr
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id));
      if (syncPackageIds.length > 0) {
        isSyncMode = true;
        quantity = 0;
      }
    } else {
      const qtyAttr =
        el.getAttribute('data-next-quantity') ??
        el.getAttribute('data-quantity') ??
        stateContainer.getAttribute('data-next-quantity');
      quantity = qtyAttr ? parseInt(qtyAttr, 10) : 1;
    }

    const isUpsell =
      el.getAttribute('data-next-is-upsell') === 'true' ||
      stateContainer.hasAttribute('data-next-upsell') ||
      stateContainer.hasAttribute('data-next-bump') ||
      el.closest('[data-next-upsell-section]') !== null ||
      el.closest('[data-next-bump-section]') !== null;

    const pkg = (useCampaignStore.getState().data?.packages ?? []).find(
      p => p.ref_id === packageId,
    );

    const card: ToggleCard = {
      element: el,
      packageId,
      name: pkg?.name ?? '',
      image: pkg?.image ?? '',
      productId: pkg?.product_id ?? null,
      variantId: pkg?.product_variant_id ?? null,
      variantName: pkg?.product_variant_name ?? '',
      productName: pkg?.product_name ?? '',
      sku: pkg?.product_sku ?? null,
      isPreSelected,
      isSelected: false,
      quantity,
      isSyncMode,
      syncPackageIds,
      isUpsell,
      stateContainer,
      addText: el.getAttribute('data-add-text'),
      removeText: el.getAttribute('data-remove-text'),
      ...makeProvisionalPrices(pkg),
      discounts: [],
    };

    this.cards.push(card);
    el.classList.add('next-toggle-card');
    updateCardDisplayElements(card);

    const ctx = this.makeHandlerContext();
    const handler = (e: Event) => void handleCardClick(e, card, ctx);
    this.clickHandlers.set(el, handler);
    el.addEventListener('click', handler);

    this.logger.debug(`Registered toggle card for packageId ${packageId}`, {
      isSyncMode,
      syncPackageIds,
      isUpsell,
      quantity,
    });
  }

  private findStateContainer(el: HTMLElement): HTMLElement {
    let current: HTMLElement | null = el;

    while (current && current !== document.body) {
      if (
        current.hasAttribute('data-next-toggle-container') ||
        current.hasAttribute('data-next-bump') ||
        current.hasAttribute('data-next-upsell-item') ||
        current.classList.contains('upsell') ||
        current.classList.contains('bump')
      ) {
        return current;
      }
      if (
        current.hasAttribute('data-next-package-id') ||
        current.hasAttribute('data-package-id')
      ) {
        return current;
      }
      current = current.parentElement;
    }

    return el;
  }

  private resolvePackageId(el: HTMLElement, stateContainer: HTMLElement): number | null {
    const fromEl =
      el.getAttribute('data-next-package-id') ?? el.getAttribute('data-package-id');
    if (fromEl) {
      const id = parseInt(fromEl, 10);
      return isNaN(id) ? null : id;
    }
    if (stateContainer !== el) {
      const fromContainer =
        stateContainer.getAttribute('data-next-package-id') ??
        stateContainer.getAttribute('data-package-id');
      if (fromContainer) {
        const id = parseInt(fromContainer, 10);
        return isNaN(id) ? null : id;
      }
    }
    return null;
  }

  // ─── Mutation observer ────────────────────────────────────────────────────

  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          if (node.hasAttribute('data-next-toggle-card')) {
            if (!this.cards.find(c => c.element === node)) this.registerCard(node);
          }
          node.querySelectorAll<HTMLElement>('[data-next-toggle-card]').forEach(el => {
            if (!this.cards.find(c => c.element === el)) this.registerCard(el);
          });
        });
      }
    });
    this.mutationObserver.observe(this.element, { childList: true, subtree: true });
  }

  // ─── Cart sync ────────────────────────────────────────────────────────────

  private syncWithCart(cartState: CartState): void {
    const selectedPackageIds: number[] = [];

    for (const card of this.cards) {
      const inCart = cartState.items.some(i => i.packageId === card.packageId);
      card.isSelected = inCart;

      card.element.classList.toggle('next-in-cart', inCart);
      card.element.classList.toggle('next-not-in-cart', !inCart);
      card.element.classList.toggle('next-selected', inCart);
      card.element.setAttribute('data-next-in-cart', String(inCart));

      card.stateContainer.setAttribute('data-in-cart', String(inCart));
      card.stateContainer.setAttribute('data-next-active', String(inCart));
      card.stateContainer.classList.toggle('next-in-cart', inCart);
      card.stateContainer.classList.toggle('next-not-in-cart', !inCart);
      card.stateContainer.classList.toggle('next-active', inCart);
      card.stateContainer.classList.toggle('os--active', inCart);

      if (card.addText && card.removeText) {
        const textSlot = card.element.querySelector<HTMLElement>('[data-next-button-text]');
        if (textSlot) {
          textSlot.textContent = inCart ? card.removeText : card.addText;
        } else if (card.element.childElementCount === 0) {
          card.element.textContent = inCart ? card.removeText : card.addText;
        }
      }

      if (inCart) {
        selectedPackageIds.push(card.packageId);
        if (cartState.summary) {
          const line = cartState.summary.lines.find(l => l.package_id === card.packageId);
          if (line) renderTogglePrice(card, line);
        }
      }

      if (card.isSyncMode) {
        void handleSyncUpdate(card, cartState, this.logger);
      }

      if (
        card.isPreSelected &&
        !inCart &&
        !this.autoAddInProgress.has(card.packageId) &&
        !autoAddedPackages.has(card.packageId)
      ) {
        card.isPreSelected = false;
        autoAddedPackages.add(card.packageId);
        this.autoAddInProgress.add(card.packageId);

        if (card.isSyncMode) updateSyncedQuantity(card, cartState);

        void addToCart(card).finally(() => {
          this.autoAddInProgress.delete(card.packageId);
        });
      }
    }

    this.emit('toggle:selection-changed', { selected: selectedPackageIds });

    if (this.priceSyncDebounce !== null) clearTimeout(this.priceSyncDebounce);
    this.priceSyncDebounce = setTimeout(() => {
      this.priceSyncDebounce = null;
      const currentItems = useCartStore.getState().items;
      for (const card of this.cards) {
        if (!currentItems.some(i => i.packageId === card.packageId)) {
          void fetchAndUpdateTogglePrice(card, this.includeShipping, this.logger);
        }
      }
    }, 150);
  }

  // ─── BaseEnhancer ─────────────────────────────────────────────────────────

  public update(): void {
    if (!this.isUpsellContext) this.syncWithCart(useCartStore.getState());
  }

  protected override cleanupEventListeners(): void {
    this.clickHandlers.forEach((h, el) => el.removeEventListener('click', h));
    this.clickHandlers.clear();
    if (this.priceSyncDebounce !== null) {
      clearTimeout(this.priceSyncDebounce);
      this.priceSyncDebounce = null;
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
    PackageToggleEnhancer._instances.delete(this);
    super.destroy();
    this.cleanupEventListeners();
    this.cards.forEach(c => {
      c.element.classList.remove(
        'next-toggle-card',
        'next-in-cart',
        'next-not-in-cart',
        'next-selected',
        'next-active',
        'next-loading',
      );
      if (c.stateContainer !== c.element) {
        c.stateContainer.classList.remove('next-in-cart', 'next-not-in-cart', 'next-active', 'os--active');
        c.stateContainer.removeAttribute('data-in-cart');
        c.stateContainer.removeAttribute('data-next-active');
      }
    });
    this.cards = [];
  }
}
