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
 *   (Inline fallback) — a direct <template> child of the container element is
 *   used when neither -template-id nor -template is set.
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

import { BaseEnhancer } from '@/core/base/base-enhancer';
import { useCartStore } from '@/state/cart';
import { useCheckoutStore } from '@/state/checkout';
import type { PackageDef, ToggleCard } from './package-toggle.types';
import {
  syncWithCart,
  type ToggleHandlerContext,
  type ToggleSyncContext,
} from './package-toggle.handlers';
import {
  renderToggleTemplate,
  renderToggleImage,
} from './package-toggle.renderer';
import { fetchAndUpdateTogglePrice } from './package-toggle.price';
import {
  scanCards,
  registerCard,
  type CardRegistrationContext,
} from './package-toggle.cards';

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
  /**
   * Holds the property-field listeners each registered card puts on author DOM.
   * They used to be unremovable, so they outlived the enhancer and a re-scan stacked
   * another set (finding 169 in `docs/code-findings.md`).
   */
  private listenerAbort = new AbortController();
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

    this.isUpsellContext = this.element.hasAttribute(
      'data-next-upsell-context'
    );
    this.includeShipping =
      this.getAttribute('data-next-include-shipping') === 'true';

    // Resolution order: id attribute → inline HTML attribute → direct <template>
    // child of the container (`this.element`). The child fallback lets authors
    // write native HTML without assigning template ids.
    const templateId = this.getAttribute('data-next-toggle-template-id');
    const templateAttr = this.getAttribute('data-next-toggle-template');
    if (templateId) {
      this.template =
        document.getElementById(templateId)?.innerHTML.trim() ?? '';
    } else if (templateAttr != null) {
      this.template = templateAttr;
    } else {
      const inline =
        this.element.querySelector<HTMLTemplateElement>(':scope > template');
      this.template = inline?.innerHTML.trim() ?? '';
    }

    const packagesAttr = this.getAttribute('data-next-packages');
    if (packagesAttr && this.template) {
      try {
        const parsed: unknown = JSON.parse(packagesAttr);
        if (!Array.isArray(parsed)) {
          this.logger.warn(
            'data-next-packages must be a JSON array, ignoring auto-render'
          );
        } else {
          this.element.innerHTML = '';
          for (const def of parsed as PackageDef[]) {
            const el = renderToggleTemplate(this.template, def, this.logger);
            if (el) this.element.appendChild(el);
          }
        }
      } catch {
        this.logger.warn(
          'Invalid JSON in data-next-packages, ignoring auto-render',
          packagesAttr
        );
      }
    }

    scanCards(this.element, this.cardContext());
    this.setupMutationObserver();

    for (const card of this.cards) {
      renderToggleImage(card);
    }

    if (!this.isUpsellContext) {
      this.subscribe(useCartStore, state =>
        syncWithCart(state, this.syncContext())
      );
      syncWithCart(useCartStore.getState(), this.syncContext());
    }

    // Re-fetch prices whenever user-entered coupons change.
    // Runs in both normal and upsell contexts so exit-intent vouchers
    // trigger a price recalculation on upsell pages too.
    let prevVouchers = useCheckoutStore.getState().vouchers;
    this.subscribe(useCheckoutStore, state => {
      const next = state.vouchers;
      if (
        next.length !== prevVouchers.length ||
        next.some((v, i) => v !== prevVouchers[i])
      ) {
        prevVouchers = next;
        for (const card of this.cards) {
          void fetchAndUpdateTogglePrice(
            card,
            this.includeShipping,
            this.logger,
            this.isUpsellContext
          );
        }
      }
    });

    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null)
        clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const card of this.cards) {
          void fetchAndUpdateTogglePrice(
            card,
            this.includeShipping,
            this.logger,
            this.isUpsellContext
          );
        }
      }, 150);
    };
    document.addEventListener(
      'next:currency-changed',
      this.boundCurrencyChangeHandler
    );

    for (const card of this.cards) {
      void fetchAndUpdateTogglePrice(
        card,
        this.includeShipping,
        this.logger,
        this.isUpsellContext
      );
    }

    this.logger.debug('PackageToggleEnhancer initialized', {
      cardCount: this.cards.length,
      isUpsellContext: this.isUpsellContext,
    });
  }

  // ─── Context factories ──────────────────────────────────────────────────────

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

  private cardContext(): CardRegistrationContext {
    return {
      cards: this.cards,
      clickHandlers: this.clickHandlers,
      listenerSignal: this.listenerAbort.signal,
      logger: this.logger,
      makeHandlerContext: () => this.makeHandlerContext(),
    };
  }

  private syncContext(): ToggleSyncContext {
    return {
      cards: this.cards,
      autoAddInProgress: this.autoAddInProgress,
      emit: (e, d) => this.emit(e, d),
      logger: this.logger,
      includeShipping: this.includeShipping,
      getPriceSyncDebounce: () => this.priceSyncDebounce,
      setPriceSyncDebounce: v => {
        this.priceSyncDebounce = v;
      },
    };
  }

  // ─── Mutation observer ────────────────────────────────────────────────────

  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver(mutations => {
      const ctx = this.cardContext();
      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          if (node.hasAttribute('data-next-toggle-card')) {
            if (!this.cards.find(c => c.element === node))
              registerCard(node, ctx);
          }
          node
            .querySelectorAll<HTMLElement>('[data-next-toggle-card]')
            .forEach(el => {
              if (!this.cards.find(c => c.element === el))
                registerCard(el, ctx);
            });
        });
      }
    });
    this.mutationObserver.observe(this.element, {
      childList: true,
      subtree: true,
    });
  }

  // ─── BaseEnhancer ─────────────────────────────────────────────────────────

  public update(): void {
    if (!this.isUpsellContext)
      syncWithCart(useCartStore.getState(), this.syncContext());
  }

  protected override cleanupEventListeners(): void {
    this.clickHandlers.forEach((h, el) => el.removeEventListener('click', h));
    this.clickHandlers.clear();
    this.listenerAbort.abort();
    if (this.priceSyncDebounce !== null) {
      clearTimeout(this.priceSyncDebounce);
      this.priceSyncDebounce = null;
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
        'next-loading'
      );
      if (c.stateContainer !== c.element) {
        c.stateContainer.classList.remove(
          'next-in-cart',
          'next-not-in-cart',
          'next-active',
          'os--active'
        );
        c.stateContainer.removeAttribute('data-in-cart');
        c.stateContainer.removeAttribute('data-next-active');
      }
    });
    this.cards = [];
  }
}
