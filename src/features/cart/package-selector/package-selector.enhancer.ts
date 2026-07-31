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
 *   (Inline fallback) — a direct <template> child of the container element is
 *   used when neither -template-id nor -template is set.
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

import { BaseEnhancer } from '@/core/base/base-enhancer';
import { useCartStore } from '@/state/cart';
import { useCheckoutStore } from '@/state/checkout';
import type { SelectorItem } from '@/types/global';
import type {
  PackageDef,
  SelectorHandlerContext,
} from './package-selector.types';
import { renderPackageTemplate } from './package-selector.renderer';
import { fetchAndUpdatePrice } from './package-selector.price';
import { syncWithCart } from './package-selector.display';
import {
  scanCards,
  registerCard,
  handlePackageIdChange,
  handleCardRemoval,
  initializeSelection,
} from './package-selector.cards';

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

    // Resolution order: id attribute → inline HTML attribute → direct <template>
    // child of the container (`this.element`). The child fallback lets authors
    // write native HTML without assigning template ids.
    const templateId = this.getAttribute('data-next-package-template-id');
    const templateAttr = this.getAttribute('data-next-package-template');
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
            const el = renderPackageTemplate(this.template, def, this.logger);
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

    scanCards(
      this.makeHandlerContext(),
      this.clickHandlers,
      this.quantityHandlers
    );
    this.setupMutationObserver();

    (this.element as any)._getSelectedItem = () => this.selectedItemRef.value;
    (this.element as any)._getSelectedPackageId = () =>
      this.selectedItemRef.value?.packageId;

    if (this.isUpsellContext) {
      // No cart sync in upsell context — just pre-select the default item.
      initializeSelection(this.makeHandlerContext());
    } else {
      this.subscribe(useCartStore, state =>
        syncWithCart(state, this.makeHandlerContext())
      );
      syncWithCart(useCartStore.getState(), this.makeHandlerContext());

      let prevVouchers = useCheckoutStore.getState().vouchers;
      this.subscribe(useCheckoutStore, state => {
        const next = state.vouchers;
        if (
          next.length !== prevVouchers.length ||
          next.some((v, i) => v !== prevVouchers[i])
        ) {
          prevVouchers = next;
          for (const item of this.items) {
            void fetchAndUpdatePrice(item, this.includeShipping, this.logger);
          }
        }
      });
    }

    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null)
        clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const item of this.items) {
          void fetchAndUpdatePrice(
            item,
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

    for (const item of this.items) {
      void fetchAndUpdatePrice(
        item,
        this.includeShipping,
        this.logger,
        this.isUpsellContext
      );
    }

    this.logger.debug('PackageSelectorEnhancer initialized', {
      selectorId: this.selectorId,
      mode: this.mode,
      isUpsellContext: this.isUpsellContext,
      itemCount: this.items.length,
    });
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

  // ─── Mutation observer ────────────────────────────────────────────────────

  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver(mutations => {
      const ctx = this.makeHandlerContext();
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.target instanceof HTMLElement
        ) {
          const target = mutation.target;
          if (
            target.hasAttribute('data-next-selector-card') &&
            mutation.attributeName === 'data-next-package-id'
          ) {
            handlePackageIdChange(
              target,
              ctx,
              this.clickHandlers,
              this.quantityHandlers
            );
          }
        }

        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (!(node instanceof HTMLElement)) return;
            if (node.hasAttribute('data-next-selector-card')) {
              registerCard(
                node,
                ctx,
                this.clickHandlers,
                this.quantityHandlers
              );
            }
            node
              .querySelectorAll<HTMLElement>('[data-next-selector-card]')
              .forEach(el => {
                if (!ctx.items.find(i => i.element === el)) {
                  registerCard(
                    el,
                    ctx,
                    this.clickHandlers,
                    this.quantityHandlers
                  );
                }
              });
          });
          mutation.removedNodes.forEach(node => {
            if (node instanceof HTMLElement) {
              handleCardRemoval(
                node,
                ctx,
                this.clickHandlers,
                this.quantityHandlers
              );
            }
          });
        }
      }
    });

    this.mutationObserver.observe(this.element, {
      attributes: true,
      attributeFilter: [
        'data-next-package-id',
        'data-next-quantity',
        'data-next-selected',
      ],
      childList: true,
      subtree: true,
    });
  }

  // ─── BaseEnhancer ─────────────────────────────────────────────────────────

  public update(): void {
    if (!this.isUpsellContext)
      syncWithCart(useCartStore.getState(), this.makeHandlerContext());
  }

  public getSelectedItem(): SelectorItem | null {
    return this.selectedItemRef.value;
  }

  protected override cleanupEventListeners(): void {
    this.clickHandlers.forEach((h, el) => el.removeEventListener('click', h));
    this.clickHandlers.clear();
    this.quantityHandlers.forEach((h, el) =>
      el.removeEventListener('click', h)
    );
    this.quantityHandlers.clear();
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
    this.cleanupEventListeners();
    this.items.forEach(i =>
      i.element.classList.remove(
        'next-selector-card',
        'next-selected',
        'next-in-cart'
      )
    );
    this.items = [];
    super.destroy();
  }
}
