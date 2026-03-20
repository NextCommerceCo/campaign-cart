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
 *   data-next-toggle-price            — formatted total price (default)
 *   data-next-toggle-price="compare"  — retail/compare-at price
 *   data-next-toggle-price="savings"  — savings amount
 *   data-next-toggle-price="savingsPercentage" — savings percentage
 *   data-next-toggle-price="subtotal" — formatted subtotal
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
 *       <del data-next-toggle-price="compare"></del>
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
import { useCampaignStore } from '@/stores/campaignStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { calculateBundlePrice } from '@/utils/calculations/CartCalculator';
import type { CartState } from '@/types/global';
import type { SummaryLine } from '@/types/api';

// ─── Global auto-add deduplication ───────────────────────────────────────────

/** Prevents two elements from auto-adding the same package on page load. */
const autoAddedPackages = new Set<number>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => autoAddedPackages.clear());
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface PackageDef {
  packageId: number;
  selected?: boolean;
  [key: string]: unknown;
}

interface ToggleCard {
  element: HTMLElement;
  packageId: number;
  isPreSelected: boolean;
  quantity: number;
  isSyncMode: boolean;
  syncPackageIds: number[];
  isUpsell: boolean;
  stateContainer: HTMLElement;
  addText: string | null;
  removeText: string | null;
}

// ─── Enhancer ─────────────────────────────────────────────────────────────────

export class PackageToggleEnhancer extends BaseEnhancer {
  private template: string = '';
  private cards: ToggleCard[] = [];
  private clickHandlers = new Map<HTMLElement, (e: Event) => void>();
  private mutationObserver: MutationObserver | null = null;
  private boundCurrencyChangeHandler: (() => void) | null = null;
  private currencyChangeTimeout: ReturnType<typeof setTimeout> | null = null;
  private priceSyncDebounce: ReturnType<typeof setTimeout> | null = null;
  private includeShipping: boolean = false;
  private autoAddInProgress = new Set<number>();

  public async initialize(): Promise<void> {
    this.validateElement();

    this.includeShipping = this.getAttribute('data-next-include-shipping') === 'true';

    // ── Card template ──────────────────────────────────────────────────────────
    const templateId = this.getAttribute('data-next-toggle-template-id');
    if (templateId) {
      this.template = document.getElementById(templateId)?.innerHTML.trim() ?? '';
    } else {
      this.template = this.getAttribute('data-next-toggle-template') ?? '';
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
            const el = this.renderToggleTemplate(def);
            if (el) this.element.appendChild(el);
          }
        }
      } catch {
        this.logger.warn('Invalid JSON in data-next-packages, ignoring auto-render', packagesAttr);
      }
    }

    this.scanCards();
    this.setupMutationObserver();

    this.subscribe(useCartStore, this.syncWithCart.bind(this));
    this.syncWithCart(useCartStore.getState());

    // Re-fetch prices when checkout vouchers change
    let prevVouchers = useCheckoutStore.getState().vouchers;
    this.subscribe(useCheckoutStore, state => {
      const next = state.vouchers;
      if (
        next.length !== prevVouchers.length ||
        next.some((v, i) => v !== prevVouchers[i])
      ) {
        prevVouchers = next;
        for (const card of this.cards) {
          void this.fetchAndUpdateTogglePrice(card);
        }
      }
    });

    // Re-fetch prices when currency changes (debounced)
    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null) clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const card of this.cards) {
          void this.fetchAndUpdateTogglePrice(card);
        }
      }, 150);
    };
    document.addEventListener('next:currency-changed', this.boundCurrencyChangeHandler);

    for (const card of this.cards) {
      void this.fetchAndUpdateTogglePrice(card);
    }

    this.logger.debug('PackageToggleEnhancer initialized', { cardCount: this.cards.length });
  }

  // ─── Template rendering ───────────────────────────────────────────────────────

  private renderToggleTemplate(def: PackageDef): HTMLElement | null {
    const allPackages = useCampaignStore.getState().packages ?? [];
    const pkg = allPackages.find(p => p.ref_id === def.packageId);

    const vars: Record<string, string> = {};
    for (const [key, value] of Object.entries(def)) {
      vars[`toggle.${key}`] = value != null ? String(value) : '';
    }
    // Enrich with campaign package data (only if not already set in JSON)
    if (pkg) {
      vars['toggle.packageId'] ??= String(pkg.ref_id);
      vars['toggle.name'] ??= pkg.name ?? '';
      vars['toggle.image'] ??= pkg.image ?? '';
      vars['toggle.price'] ??= pkg.price ?? '';
      vars['toggle.priceRetail'] ??= pkg.price_retail ?? '';
      vars['toggle.priceRetailTotal'] ??= pkg.price_retail_total ?? '';
    }

    const html = this.template.replace(/\{([^}]+)\}/g, (_, k: string) => vars[k] ?? '');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();

    const firstChild = wrapper.firstElementChild;
    const cardEl =
      wrapper.querySelector<HTMLElement>('[data-next-toggle-card]') ??
      (firstChild instanceof HTMLElement ? firstChild : null);

    if (!cardEl) {
      this.logger.warn('Toggle template produced no root element for packageId', def.packageId);
      return null;
    }

    cardEl.setAttribute('data-next-toggle-card', '');
    cardEl.setAttribute('data-next-package-id', String(def.packageId));
    if (def.selected) {
      cardEl.setAttribute('data-next-selected', 'true');
    }

    return cardEl;
  }

  // ─── State container ──────────────────────────────────────────────────────────

  /**
   * Find the nearest ancestor that should receive state classes.
   * Used for toggle/bump/upsell wrapper elements.
   */
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

  // ─── Card registration ────────────────────────────────────────────────────────

  private scanCards(): void {
    this.element.querySelectorAll<HTMLElement>('[data-next-toggle-card]').forEach(el => {
      if (!this.cards.find(c => c.element === el)) this.registerCard(el);
    });

    // Single-element mode: the container itself is the toggle card
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

    // Sync mode
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

    const addText = el.getAttribute('data-add-text');
    const removeText = el.getAttribute('data-remove-text');

    const card: ToggleCard = {
      element: el,
      packageId,
      isPreSelected,
      quantity,
      isSyncMode,
      syncPackageIds,
      isUpsell,
      stateContainer,
      addText,
      removeText,
    };

    this.cards.push(card);
    el.classList.add('next-toggle-card');

    const handler = (e: Event) => void this.handleCardClick(e, card);
    this.clickHandlers.set(el, handler);
    el.addEventListener('click', handler);

    this.logger.debug(`Registered toggle card for packageId ${packageId}`, {
      isSyncMode,
      syncPackageIds,
      isUpsell,
      quantity,
    });
  }

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

  // ─── Click handler ────────────────────────────────────────────────────────────

  private async handleCardClick(e: Event, card: ToggleCard): Promise<void> {
    e.preventDefault();

    const cartState = useCartStore.getState();
    const isInCart = cartState.items.some(i => i.packageId === card.packageId);

    if (card.isSyncMode) this.updateSyncedQuantity(card, cartState);

    card.element.classList.add('next-loading');
    card.element.setAttribute('data-next-loading', 'true');

    try {
      if (isInCart) {
        await useCartStore.getState().removeItem(card.packageId);
        this.emit('toggle:toggled', { packageId: card.packageId, added: false });
      } else {
        await this.addToCart(card);
        this.emit('toggle:toggled', { packageId: card.packageId, added: true });
      }
    } catch (error) {
      this.handleError(error, 'handleCardClick');
    } finally {
      card.element.classList.remove('next-loading');
      card.element.setAttribute('data-next-loading', 'false');
    }
  }

  private async addToCart(card: ToggleCard): Promise<void> {
    const allPackages = useCampaignStore.getState().packages ?? [];
    const pkg = allPackages.find(p => p.ref_id === card.packageId);

    await useCartStore.getState().addItem({
      packageId: card.packageId,
      quantity: card.quantity || 1,
      title: pkg?.name ?? `Package ${card.packageId}`,
      price: pkg ? parseFloat(pkg.price) : 0,
      isUpsell: card.isUpsell,
    });
  }

  // ─── Cart sync ────────────────────────────────────────────────────────────────

  private syncWithCart(cartState: CartState): void {
    const selectedPackageIds: number[] = [];

    for (const card of this.cards) {
      const inCart = cartState.items.some(i => i.packageId === card.packageId);

      card.element.classList.toggle('next-in-cart', inCart);
      card.element.classList.toggle('next-not-in-cart', !inCart);
      card.element.classList.toggle('next-selected', inCart);
      card.element.setAttribute('data-next-in-cart', String(inCart));

      card.stateContainer.setAttribute('data-in-cart', String(inCart));
      card.stateContainer.setAttribute('data-next-active', String(inCart));
      card.stateContainer.classList.toggle('next-in-cart', inCart);
      card.stateContainer.classList.toggle('next-not-in-cart', !inCart);
      card.stateContainer.classList.toggle('next-active', inCart);
      card.stateContainer.classList.toggle('os--active', inCart); // legacy

      if (card.addText && card.removeText) {
        card.element.textContent = inCart ? card.removeText : card.addText;
      }

      if (inCart) {
        selectedPackageIds.push(card.packageId);
        if (cartState.summary) {
          const line = cartState.summary.lines.find(l => l.package_id === card.packageId) ?? null;
          this.renderTogglePrice(card, line);
        }
      }

      if (card.isSyncMode) {
        void this.handleSyncUpdate(card, cartState);
      }

      // Auto-add pre-selected cards (once only, with global dedup)
      if (
        card.isPreSelected &&
        !inCart &&
        !this.autoAddInProgress.has(card.packageId) &&
        !autoAddedPackages.has(card.packageId)
      ) {
        card.isPreSelected = false;
        autoAddedPackages.add(card.packageId);
        this.autoAddInProgress.add(card.packageId);

        if (card.isSyncMode) this.updateSyncedQuantity(card, cartState);

        void this.addToCart(card).finally(() => {
          this.autoAddInProgress.delete(card.packageId);
        });
      }
    }

    this.emit('toggle:selection-changed', { selected: selectedPackageIds });

    // Re-fetch preview prices for not-in-cart cards (debounced)
    if (this.priceSyncDebounce !== null) clearTimeout(this.priceSyncDebounce);
    this.priceSyncDebounce = setTimeout(() => {
      this.priceSyncDebounce = null;
      const currentItems = useCartStore.getState().items;
      for (const card of this.cards) {
        if (!currentItems.some(i => i.packageId === card.packageId)) {
          void this.fetchAndUpdateTogglePrice(card);
        }
      }
    }, 150);
  }

  // ─── Sync mode helpers ────────────────────────────────────────────────────────

  private updateSyncedQuantity(card: ToggleCard, cartState: CartState): void {
    if (card.syncPackageIds.length === 0) return;

    let totalQuantity = 0;
    card.syncPackageIds.forEach(syncId => {
      const syncedItem = cartState.items.find(
        item => item.packageId === syncId || item.originalPackageId === syncId
      );
      if (syncedItem) {
        const itemsPerPackage = (syncedItem as any).qty ?? 1;
        totalQuantity += syncedItem.quantity * itemsPerPackage;
      }
    });

    card.quantity = totalQuantity;
  }

  private async handleSyncUpdate(card: ToggleCard, cartState: CartState): Promise<void> {
    if (!card.isSyncMode || card.syncPackageIds.length === 0) return;

    let totalSyncQuantity = 0;
    let anySyncedItemExists = false;

    card.syncPackageIds.forEach(syncId => {
      const syncedItem = cartState.items.find(
        item => item.packageId === syncId || item.originalPackageId === syncId
      );
      if (syncedItem) {
        anySyncedItemExists = true;
        const itemsPerPackage = (syncedItem as any).qty ?? 1;
        totalSyncQuantity += syncedItem.quantity * itemsPerPackage;
      }
    });

    const currentItem = cartState.items.find(item => item.packageId === card.packageId);

    if (anySyncedItemExists && totalSyncQuantity > 0) {
      if (currentItem && currentItem.quantity !== totalSyncQuantity) {
        await useCartStore.getState().updateQuantity(card.packageId, totalSyncQuantity);
      }
    } else if (currentItem && !cartState.swapInProgress) {
      if (currentItem.is_upsell) {
        setTimeout(async () => {
          const updatedState = useCartStore.getState();
          const stillNoSyncedPackages = card.syncPackageIds.every(syncId =>
            !updatedState.items.find(
              item => item.packageId === syncId || item.originalPackageId === syncId
            )
          );
          const itemStillExists = updatedState.items.find(i => i.packageId === card.packageId);
          if (stillNoSyncedPackages && itemStillExists && !updatedState.swapInProgress) {
            await useCartStore.getState().removeItem(card.packageId);
          }
        }, 500);
      } else {
        await useCartStore.getState().removeItem(card.packageId);
      }
    }
  }

  // ─── Backend price calculation ────────────────────────────────────────────────

  private async fetchAndUpdateTogglePrice(card: ToggleCard): Promise<void> {
    const cartState = useCartStore.getState();

    // In-cart: use the actual summary line
    if (cartState.items.some(i => i.packageId === card.packageId)) {
      if (cartState.summary) {
        const line = cartState.summary.lines.find(l => l.package_id === card.packageId) ?? null;
        this.renderTogglePrice(card, line);
      }
      return;
    }

    const priceSlots = card.element.querySelectorAll<HTMLElement>('[data-next-toggle-price]');
    if (priceSlots.length === 0) return;

    // Simulate adding this toggle to the current cart for context-aware pricing
    const cartItems = cartState.items.map(i => ({ packageId: i.packageId, quantity: i.quantity }));
    const itemsToCalc = [...cartItems, { packageId: card.packageId, quantity: 1 }];

    const currency = useCampaignStore.getState().data?.currency ?? null;
    const checkoutVouchers = useCheckoutStore.getState().vouchers;
    const vouchers = checkoutVouchers.length ? checkoutVouchers : undefined;

    card.element.classList.add('next-loading');
    card.element.setAttribute('data-next-loading', 'true');

    try {
      const { summary } = await calculateBundlePrice(
        itemsToCalc,
        { currency, exclude_shipping: !this.includeShipping, vouchers }
      );
      const line = summary.lines.find(l => l.package_id === card.packageId) ?? null;
      this.renderTogglePrice(card, line);
    } catch (error) {
      this.logger.warn(`Failed to fetch toggle price for packageId ${card.packageId}`, error);
      this.renderTogglePrice(card, null);
    } finally {
      card.element.classList.remove('next-loading');
      card.element.setAttribute('data-next-loading', 'false');
    }
  }

  private renderTogglePrice(card: ToggleCard, line: SummaryLine | null): void {
    const allPackages = useCampaignStore.getState().packages ?? [];
    const pkg = allPackages.find(p => p.ref_id === card.packageId);

    card.element.querySelectorAll<HTMLElement>('[data-next-toggle-price]').forEach(el => {
      const field = el.getAttribute('data-next-toggle-price') || 'total';
      switch (field) {
        case 'compare':
          el.textContent =
            line?.price_retail_total ??
            line?.original_package_price ??
            pkg?.price_retail_total ??
            pkg?.price_retail ??
            '';
          break;
        case 'savings':
          el.textContent = line?.total_discount ?? '';
          break;
        case 'subtotal':
          el.textContent = line?.subtotal ?? pkg?.price_total ?? '';
          break;
        default:
          el.textContent = line?.package_price ?? pkg?.price_total ?? '';
          break;
      }
    });
  }

  // ─── BaseEnhancer ─────────────────────────────────────────────────────────────

  public update(): void {
    this.syncWithCart(useCartStore.getState());
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
    this.cleanupEventListeners();
    this.cards.forEach(c =>
      c.element.classList.remove(
        'next-toggle-card',
        'next-in-cart',
        'next-not-in-cart',
        'next-selected',
        'next-active',
        'next-loading',
      )
    );
    this.cards = [];
    super.destroy();
  }
}
