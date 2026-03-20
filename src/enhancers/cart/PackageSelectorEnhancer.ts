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
import { calculateBundlePrice, buildCartTotals } from '@/utils/calculations/CartCalculator';
import type { CartState, SelectorItem } from '@/types/global';

// ─── Internal types ───────────────────────────────────────────────────────────

interface PackageDef {
  packageId: number;
  selected?: boolean;
  [key: string]: unknown;
}

// ─── Enhancer ─────────────────────────────────────────────────────────────────

export class PackageSelectorEnhancer extends BaseEnhancer {
  private selectorId: string = '';
  private mode: 'swap' | 'select' = 'swap';
  private template: string = '';
  private items: SelectorItem[] = [];
  private selectedItem: SelectorItem | null = null;
  private clickHandlers = new Map<HTMLElement, (e: Event) => void>();
  private quantityHandlers = new Map<HTMLElement, (e: Event) => void>();
  private mutationObserver: MutationObserver | null = null;
  private boundCurrencyChangeHandler: (() => void) | null = null;
  private currencyChangeTimeout: ReturnType<typeof setTimeout> | null = null;
  private includeShipping: boolean = false;

  public async initialize(): Promise<void> {
    this.validateElement();

    this.selectorId =
      this.getAttribute('data-next-selector-id') ??
      this.getAttribute('data-next-id') ??
      `selector-${Date.now()}`;

    this.mode = (this.getAttribute('data-next-selection-mode') ?? 'swap') as 'swap' | 'select';
    this.includeShipping = this.getAttribute('data-next-include-shipping') === 'true';

    // ── Card template ──────────────────────────────────────────────────────────
    const templateId = this.getAttribute('data-next-package-template-id');
    if (templateId) {
      this.template = document.getElementById(templateId)?.innerHTML.trim() ?? '';
    } else {
      this.template = this.getAttribute('data-next-package-template') ?? '';
    }

    // ── Auto-render cards from JSON ────────────────────────────────────────────
    const packagesAttr = this.getAttribute('data-next-packages');
    if (packagesAttr && this.template) {
      try {
        const parsed: unknown = JSON.parse(packagesAttr);
        if (!Array.isArray(parsed)) {
          this.logger.warn('data-next-packages must be a JSON array, ignoring auto-render');
        } else {
          this.element.innerHTML = '';
          for (const def of parsed as PackageDef[]) {
            const el = this.renderPackageTemplate(def);
            if (el) this.element.appendChild(el);
          }
        }
      } catch {
        this.logger.warn('Invalid JSON in data-next-packages, ignoring auto-render', packagesAttr);
      }
    }

    this.scanCards();
    this.setupMutationObserver();

    // Expose selection API on the element (used by AddToCartEnhancer)
    (this.element as any)._getSelectedItem = () => this.selectedItem;
    (this.element as any)._getSelectedPackageId = () => this.selectedItem?.packageId;

    this.subscribe(useCartStore, this.syncWithCart.bind(this));
    this.syncWithCart(useCartStore.getState());

    // Re-fetch prices when checkout vouchers change
    let prevVouchers = useCheckoutStore.getState().vouchers;
    this.subscribe(useCheckoutStore, state => {
      const next = state.vouchers;
      if (next.length !== prevVouchers.length || next.some((v, i) => v !== prevVouchers[i])) {
        prevVouchers = next;
        for (const item of this.items) {
          void this.fetchAndUpdatePrice(item);
        }
      }
    });

    // Re-fetch prices when currency changes (debounced)
    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null) clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const item of this.items) {
          void this.fetchAndUpdatePrice(item);
        }
      }, 150);
    };
    document.addEventListener('next:currency-changed', this.boundCurrencyChangeHandler);

    for (const item of this.items) {
      void this.fetchAndUpdatePrice(item);
    }

    this.logger.debug('PackageSelectorEnhancer initialized', {
      selectorId: this.selectorId,
      mode: this.mode,
      itemCount: this.items.length,
    });
  }

  // ─── Template rendering ───────────────────────────────────────────────────────

  private renderPackageTemplate(def: PackageDef): HTMLElement | null {
    const allPackages = useCampaignStore.getState().packages ?? [];
    const pkg = allPackages.find(p => p.ref_id === def.packageId);

    const vars: Record<string, string> = {};
    for (const [key, value] of Object.entries(def)) {
      vars[`package.${key}`] = value != null ? String(value) : '';
    }
    // Enrich with campaign package data (only if not already set in JSON)
    if (pkg) {
      vars['package.packageId'] ??= String(pkg.ref_id);
      vars['package.name'] ??= pkg.name ?? '';
      vars['package.image'] ??= pkg.image ?? '';
      vars['package.price'] ??= pkg.price ?? '';
      vars['package.priceRetail'] ??= pkg.price_retail ?? '';
      vars['package.priceTotal'] ??= pkg.price_total ?? '';
    }

    const html = this.template.replace(/\{([^}]+)\}/g, (_, k: string) => vars[k] ?? '');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();

    const firstChild = wrapper.firstElementChild;
    const cardEl =
      wrapper.querySelector<HTMLElement>('[data-next-selector-card]') ??
      (firstChild instanceof HTMLElement ? firstChild : null);

    if (!cardEl) {
      this.logger.warn('Package template produced no root element for packageId', def.packageId);
      return null;
    }

    cardEl.setAttribute('data-next-selector-card', '');
    cardEl.setAttribute('data-next-package-id', String(def.packageId));
    if (def.selected) {
      cardEl.setAttribute('data-next-selected', 'true');
    }

    return cardEl;
  }

  // ─── Card registration ────────────────────────────────────────────────────────

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

    // Update existing registration if element already tracked
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

    const handler = (e: Event) => void this.handleCardClick(e, item);
    this.clickHandlers.set(el, handler);
    el.addEventListener('click', handler);

    this.setupQuantityControls(item);

    this.logger.debug(`Registered selector card for package ${packageId}`);
  }

  private updateItemPackageData(item: SelectorItem): void {
    const pkg = useCampaignStore.getState().getPackage(item.packageId);
    if (pkg) {
      item.price = pkg.price ? parseFloat(pkg.price) : item.price;
      item.name = pkg.name ?? item.name;
    }
  }

  // ─── Quantity controls ────────────────────────────────────────────────────────

  private setupQuantityControls(item: SelectorItem): void {
    const el = item.element;
    const increaseBtn = el.querySelector<HTMLElement>('[data-next-quantity-increase]');
    const decreaseBtn = el.querySelector<HTMLElement>('[data-next-quantity-decrease]');
    const displayEl = el.querySelector<HTMLElement>('[data-next-quantity-display]');

    if (!increaseBtn && !decreaseBtn) return;

    const min = parseInt(el.getAttribute('data-next-min-quantity') ?? '1', 10);
    const max = parseInt(el.getAttribute('data-next-max-quantity') ?? '999', 10);

    const updateDisplay = () => {
      if (displayEl) displayEl.textContent = String(item.quantity);
      el.setAttribute('data-next-quantity', String(item.quantity));
      if (decreaseBtn) {
        const atMin = item.quantity <= min;
        decreaseBtn.toggleAttribute('disabled', atMin);
        decreaseBtn.classList.toggle('next-disabled', atMin);
      }
      if (increaseBtn) {
        const atMax = item.quantity >= max;
        increaseBtn.toggleAttribute('disabled', atMax);
        increaseBtn.classList.toggle('next-disabled', atMax);
      }
    };

    if (increaseBtn) {
      const h = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        if (item.quantity < max) {
          item.quantity++;
          updateDisplay();
          void this.handleQuantityChange(item);
        }
      };
      this.quantityHandlers.set(increaseBtn, h);
      increaseBtn.addEventListener('click', h);
    }

    if (decreaseBtn) {
      const h = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        if (item.quantity > min) {
          item.quantity--;
          updateDisplay();
          void this.handleQuantityChange(item);
        }
      };
      this.quantityHandlers.set(decreaseBtn, h);
      decreaseBtn.addEventListener('click', h);
    }

    updateDisplay();
  }

  private async handleQuantityChange(item: SelectorItem): Promise<void> {
    this.emit('selector:quantity-changed', {
      selectorId: this.selectorId,
      packageId: item.packageId,
      quantity: item.quantity,
    });

    if (this.selectedItem === item && this.mode === 'swap') {
      const cartStore = useCartStore.getState();
      if (cartStore.hasItem(item.packageId)) {
        await cartStore.updateQuantity(item.packageId, item.quantity);
      } else {
        await cartStore.addItem({ packageId: item.packageId, quantity: item.quantity, isUpsell: false });
      }
    }
  }

  // ─── Mutation observer ────────────────────────────────────────────────────────

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

    if (this.selectedItem === item && this.mode === 'swap') {
      void this.updateCart({ ...item, packageId: oldId }, item);
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

      if (this.selectedItem === removed) {
        this.selectedItem = null;
        this.element.removeAttribute('data-selected-package');
      }
    }
  }

  // ─── Selection & cart update ──────────────────────────────────────────────────

  private async handleCardClick(e: Event, item: SelectorItem): Promise<void> {
    e.preventDefault();
    if (this.selectedItem === item) return;

    const previous = this.selectedItem;
    this.selectItem(item);

    this.emit('selector:item-selected', {
      selectorId: this.selectorId,
      packageId: item.packageId,
      previousPackageId: previous?.packageId,
      mode: this.mode,
      pendingAction: this.mode === 'select' ? true : undefined,
    });

    if (this.mode === 'swap') {
      await this.updateCart(previous, item);
      if (item.shippingId) await this.setShippingMethod(item.shippingId);
    }
  }

  private selectItem(item: SelectorItem): void {
    for (const i of this.items) {
      i.element.classList.remove('next-selected');
      i.element.setAttribute('data-next-selected', 'false');
    }
    item.element.classList.add('next-selected');
    item.element.setAttribute('data-next-selected', 'true');
    this.selectedItem = item;
    this.element.setAttribute('data-selected-package', String(item.packageId));

    this.emit('selector:selection-changed', {
      selectorId: this.selectorId,
      packageId: item.packageId,
      quantity: item.quantity,
      item,
    });
  }

  private async updateCart(_previous: SelectorItem | null, selected: SelectorItem): Promise<void> {
    const cartStore = useCartStore.getState();

    // Find any item from this selector currently in the cart
    const existingCartItem = cartStore.items.find(ci =>
      this.items.some(
        si => ci.packageId === si.packageId || ci.originalPackageId === si.packageId
      )
    );

    if (existingCartItem) {
      if (existingCartItem.packageId !== selected.packageId) {
        await cartStore.swapPackage(existingCartItem.packageId, {
          packageId: selected.packageId,
          quantity: selected.quantity,
          isUpsell: false,
        });
      }
    } else if (!cartStore.hasItem(selected.packageId)) {
      await cartStore.addItem({
        packageId: selected.packageId,
        quantity: selected.quantity,
        isUpsell: false,
      });
    }
  }

  private async setShippingMethod(shippingId: string): Promise<void> {
    const id = parseInt(shippingId, 10);
    if (isNaN(id)) {
      this.logger.warn('Invalid shipping ID:', shippingId);
      return;
    }
    await useCartStore.getState().setShippingMethod(id);
  }

  // ─── Backend price calculation ────────────────────────────────────────────────

  private async fetchAndUpdatePrice(item: SelectorItem): Promise<void> {
    const currency = useCampaignStore.getState().data?.currency ?? null;
    const checkoutVouchers = useCheckoutStore.getState().vouchers;
    const vouchers = checkoutVouchers.length ? checkoutVouchers : undefined;

    const priceSlots = item.element.querySelectorAll<HTMLElement>('[data-next-package-price]');
    if (priceSlots.length === 0) return;

    item.element.classList.add('next-loading');
    item.element.setAttribute('data-next-loading', 'true');

    try {
      const { totals, summary } = await calculateBundlePrice(
        [{ packageId: item.packageId, quantity: item.quantity }],
        { currency, exclude_shipping: !this.includeShipping, vouchers }
      );

      // Use retail price as compare-at for savings calculation
      const campaignPackages = useCampaignStore.getState().packages;
      const pkg = campaignPackages.find(p => p.ref_id === item.packageId);
      const retailCompareTotal = pkg?.price_retail
        ? parseFloat(pkg.price_retail) * item.quantity
        : 0;

      const effectiveTotals = retailCompareTotal > 0
        ? buildCartTotals(summary, { exclude_shipping: !this.includeShipping, compareTotal: retailCompareTotal })
        : totals;

      priceSlots.forEach(el => {
        const field = el.getAttribute('data-next-package-price') || 'total';
        switch (field) {
          case 'subtotal':           el.textContent = effectiveTotals.subtotal.formatted; break;
          case 'compare':            el.textContent = effectiveTotals.compareTotal.formatted; break;
          case 'savings':            el.textContent = effectiveTotals.totalSavings.formatted; break;
          case 'savingsPercentage':  el.textContent = effectiveTotals.totalSavingsPercentage.formatted; break;
          default:                   el.textContent = effectiveTotals.total.formatted; break;
        }
      });
    } catch (error) {
      this.logger.warn(`Failed to fetch price for package ${item.packageId}`, error);
    } finally {
      item.element.classList.remove('next-loading');
      item.element.setAttribute('data-next-loading', 'false');
    }
  }

  // ─── Cart sync ────────────────────────────────────────────────────────────────

  private syncWithCart(cartState: CartState): void {
    for (const item of this.items) {
      const inCart = cartState.items.some(
        ci => ci.packageId === item.packageId || ci.originalPackageId === item.packageId
      );
      item.element.classList.toggle('next-in-cart', inCart);
      item.element.setAttribute('data-next-in-cart', String(inCart));

      // Sync quantity from cart
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

    // Auto-select item that's in cart (swap mode)
    if (this.mode === 'swap') {
      const inCartItem = this.items.find(item =>
        cartState.items.some(
          ci => ci.packageId === item.packageId || ci.originalPackageId === item.packageId
        )
      );
      if (inCartItem && this.selectedItem !== inCartItem) {
        this.selectItem(inCartItem);
        return;
      }
    }

    // Auto-select pre-selected card (no selection yet)
    if (!this.selectedItem) {
      const preSelected = this.items.find(i => i.isPreSelected) ?? this.items[0];
      if (preSelected) {
        this.selectItem(preSelected);
        if (this.mode === 'swap' && cartState.isEmpty) {
          void this.updateCart(null, preSelected).then(() => {
            if (preSelected.shippingId) void this.setShippingMethod(preSelected.shippingId);
          });
        }
      }
    }
  }

  // ─── BaseEnhancer ──────────────────────────────────────────────────────────────

  public update(): void {
    this.syncWithCart(useCartStore.getState());
  }

  public getSelectedItem(): SelectorItem | null {
    return this.selectedItem;
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
