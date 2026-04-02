/**
 * Upsell Enhancer
 * Handles post-purchase upsell functionality for completed orders.
 *
 * Direct mode (single package with yes/no choice):
 * <div data-next-upsell="offer" data-next-package-id="123">
 *   <span data-next-display="package.name">Product Name</span>
 *   <span data-next-display="package.price">$19.99</span>
 *   <button data-next-upsell-action="add">Add to Order</button>
 * </div>
 *
 * Selector mode (multiple options to choose from):
 * <div data-next-upsell-selector data-next-selector-id="protection">
 *   <div data-next-upsell-option data-next-package-id="123">Option 1</div>
 *   <div data-next-upsell-option data-next-package-id="456">Option 2</div>
 *   <button data-next-upsell-action="add">Add Selected</button>
 * </div>
 */
import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useOrderStore } from '@/stores/orderStore';
import { useConfigStore } from '@/stores/configStore';
import { ApiClient } from '@/api/client';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import type { EventMap } from '@/types/global';
import {
  renderQuantityDisplay,
  renderQuantityToggles,
  syncOptionSelectionAcrossContainers,
  syncQuantityAcrossContainers,
  renderProcessingState,
  showUpsellOffer,
  hideUpsellOffer,
  renderError,
} from './UpsellEnhancer.renderer';
import {
  handleActionClick,
  trackUpsellPageView,
} from './UpsellEnhancer.handlers';
import type { UpsellHandlerContext } from './UpsellEnhancer.types';

export class UpsellEnhancer extends BaseEnhancer {
  private apiClient!: ApiClient;
  private packageId?: number;
  private quantity = 1;
  private actionButtons: HTMLElement[] = [];
  private clickHandler?: (event: Event) => void;
  private keydownHandler?: (event: KeyboardEvent) => void;
  private pageShowHandler?: (event: PageTransitionEvent) => void;
  private loadingOverlay: LoadingOverlay;
  private isProcessingRef = { value: false };

  // Selector mode
  private isSelector = false;
  private selectorId?: string;
  private options = new Map<number, HTMLElement>();
  private selectedPackageId?: number;
  private currentPagePath?: string;

  // External PackageSelectorEnhancer integration
  private packageSelectorId?: string;
  // External BundleSelectorEnhancer integration
  private bundleSelectorId?: string;

  // Per-selector quantity tracking
  private quantityBySelectorId = new Map<string, number>();
  private currentQuantitySelectorId?: string;

  constructor(element: HTMLElement) {
    super(element);
    this.loadingOverlay = new LoadingOverlay();
  }

  public async initialize(): Promise<void> {
    this.validateElement();
    this.setupPageShowHandler();
    setTimeout(
      () => trackUpsellPageView(this.logger, (e, d) => this.emit(e, d)),
      100,
    );

    this.selectorId = this.getAttribute('data-next-selector-id') ?? undefined;

    // Auto-detect child selectors, fall back to explicit attributes
    const childBundleSelector = this.element.querySelector<HTMLElement>('[data-next-bundle-selector]');
    this.bundleSelectorId = childBundleSelector?.getAttribute('data-next-selector-id')
      ?? this.getAttribute('data-next-bundle-selector-id') ?? undefined;

    const childPackageSelector = this.element.querySelector<HTMLElement>('[data-next-package-selector]');
    this.packageSelectorId = childPackageSelector?.getAttribute('data-next-selector-id')
      ?? this.getAttribute('data-next-package-selector-id') ?? undefined;
    this.isSelector = !!this.selectorId || !!this.packageSelectorId || !!this.bundleSelectorId;

    if (this.isSelector) {
      this.initializeSelectorMode();
    } else {
      const packageIdAttr = this.getAttribute('data-next-package-id');
      if (!packageIdAttr) {
        throw new Error(
          'UpsellEnhancer requires data-next-package-id (or selector mode with data-next-selector-id)',
        );
      }
      this.packageId = parseInt(packageIdAttr, 10);
      if (isNaN(this.packageId)) throw new Error('Invalid package ID provided');
      const orderStore = useOrderStore.getState();
      if (orderStore.order) orderStore.markUpsellViewed(this.packageId.toString());
    }

    const quantityAttr = this.getAttribute('data-next-quantity');
    if (quantityAttr) this.quantity = parseInt(quantityAttr, 10) || 1;

    const config = useConfigStore.getState();
    this.apiClient = new ApiClient(config.apiKey);

    this.scanUpsellElements();
    this.setupEventHandlers();
    this.subscribe(useOrderStore, state => this.handleOrderUpdate(state));

    this.on('upsell:quantity-changed', data => this.onQuantityChanged(data));
    this.on('upsell:option-selected', data => this.onOptionSelected(data));

    this.updateUpsellDisplay();

    this.logger.debug('UpsellEnhancer initialized', {
      mode: this.isSelector ? 'selector' : 'direct',
      packageId: this.packageId,
      selectorId: this.selectorId,
      quantity: this.quantity,
      actionButtons: this.actionButtons.length,
      options: this.options.size,
    });

    this.emit('upsell:initialized', { packageId: this.packageId ?? 0, element: this.element });
  }

  private setupPageShowHandler(): void {
    this.pageShowHandler = (event: PageTransitionEvent) => {
      if (event.persisted) {
        this.loadingOverlay.hide(true);
        this.isProcessingRef.value = false;
        renderProcessingState(this.element, this.actionButtons, false);
      }
    };
    window.addEventListener('pageshow', this.pageShowHandler);
  }

  private initializeSelectorMode(): void {
    if (this.selectorId && !this.quantityBySelectorId.has(this.selectorId)) {
      this.quantityBySelectorId.set(this.selectorId, this.quantity);
    }

    this.element.querySelectorAll('[data-next-upsell-option]').forEach(el => {
      if (!(el instanceof HTMLElement)) return;
      const pkgId = parseInt(el.getAttribute('data-next-package-id') ?? '', 10);
      if (isNaN(pkgId)) return;
      this.options.set(pkgId, el);
      el.addEventListener('click', () => this.selectOption(pkgId));
      if (el.getAttribute('data-next-selected') === 'true') this.selectOption(pkgId);
    });

    const selectEl =
      this.element.tagName === 'SELECT'
        ? (this.element as HTMLSelectElement)
        : (this.element.querySelector(
            `[data-next-upsell-select="${this.selectorId}"]`,
          ) as HTMLSelectElement | null);

    if (selectEl) {
      selectEl.addEventListener('change', () => {
        if (selectEl.value) {
          const pkgId = parseInt(selectEl.value, 10);
          if (!isNaN(pkgId)) this.selectOption(pkgId);
        } else {
          this.selectedPackageId = undefined;
          this.packageId = undefined;
        }
      });
      if (selectEl.value) {
        const pkgId = parseInt(selectEl.value, 10);
        if (!isNaN(pkgId)) this.selectOption(pkgId);
      }
    }
  }

  private scanUpsellElements(): void {
    this.element.querySelectorAll('[data-next-upsell-action]').forEach(el => {
      if (el instanceof HTMLElement) this.actionButtons.push(el);
    });

    const incBtn = this.element.querySelector('[data-next-upsell-quantity="increase"]');
    const decBtn = this.element.querySelector('[data-next-upsell-quantity="decrease"]');
    const qtySelectorId =
      incBtn?.getAttribute('data-next-quantity-selector-id') ??
      decBtn?.getAttribute('data-next-quantity-selector-id') ??
      this.selectorId;

    incBtn?.addEventListener('click', () => this.adjustQuantity(1, qtySelectorId));
    decBtn?.addEventListener('click', () => this.adjustQuantity(-1, qtySelectorId));

    this.element.querySelectorAll('[data-next-upsell-quantity-toggle]').forEach(toggle => {
      if (!(toggle instanceof HTMLElement)) return;
      const qty = parseInt(toggle.getAttribute('data-next-upsell-quantity-toggle') ?? '1', 10);
      toggle.addEventListener('click', () => {
        this.quantity = qty;
        renderQuantityDisplay(this.element, this.selectorId, this.quantityBySelectorId, qty);
        renderQuantityToggles(this.element, qty);
        this.emit('upsell:quantity-changed', {
          selectorId: this.selectorId,
          quantity: qty,
          packageId: this.packageId,
        });
      });
      if (qty === this.quantity) toggle.classList.add('next-selected');
    });
  }

  private adjustQuantity(delta: number, qtySelectorId: string | undefined): void {
    if (qtySelectorId) {
      const next = Math.min(10, Math.max(1, (this.quantityBySelectorId.get(qtySelectorId) ?? 1) + delta));
      this.quantityBySelectorId.set(qtySelectorId, next);
      this.currentQuantitySelectorId = qtySelectorId;
      this.emit('upsell:quantity-changed', { selectorId: qtySelectorId, quantity: next, packageId: this.packageId });
    } else {
      this.quantity = Math.min(10, Math.max(1, this.quantity + delta));
      this.emit('upsell:quantity-changed', { quantity: this.quantity, packageId: this.packageId });
    }
    renderQuantityDisplay(this.element, qtySelectorId ?? this.selectorId, this.quantityBySelectorId, this.quantity);
    syncQuantityAcrossContainers(qtySelectorId, this.packageId, this.quantityBySelectorId, this.quantity);
  }

  private selectOption(packageId: number): void {
    this.options.forEach((el, id) => {
      el.classList.toggle('next-selected', id === packageId);
      el.setAttribute('data-next-selected', (id === packageId).toString());
    });
    this.selectedPackageId = packageId;
    this.packageId = packageId;

    let actualSelectorId = this.selectorId;
    const selectedEl = this.options.get(packageId);
    if (selectedEl) {
      const parent = selectedEl.closest('[data-next-selector-id]');
      actualSelectorId =
        parent?.getAttribute('data-next-selector-id') ?? this.selectorId;
    }

    const sid = actualSelectorId ?? '';
    this.emit('upsell-selector:item-selected', { selectorId: sid, packageId });
    this.emit('upsell:option-selected', { selectorId: sid, packageId });

    if (actualSelectorId) syncOptionSelectionAcrossContainers(actualSelectorId, packageId);
    (this.element as unknown as Record<string, unknown>)['_selectedPackageId'] = packageId;
    this.logger.debug('Upsell option selected:', { packageId, selectorId: actualSelectorId });
  }

  private setupEventHandlers(): void {
    this.clickHandler = (event: Event) =>
      void handleActionClick(event, this.makeHandlerContext());
    this.actionButtons.forEach(btn => btn.addEventListener('click', this.clickHandler!));

    this.keydownHandler = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && this.isProcessingRef.value) {
        event.preventDefault();
        event.stopPropagation();
        this.logger.debug('Enter key blocked - upsell is processing');
      }
    };
    this.element.addEventListener('keydown', this.keydownHandler, true);
  }

  private onQuantityChanged(data: EventMap['upsell:quantity-changed']): void {
    const shouldSync =
      (!!this.selectorId && data.selectorId === this.selectorId) ||
      (!this.selectorId && !data.selectorId && this.packageId !== undefined && data.packageId === this.packageId);
    if (!shouldSync) return;

    if (this.selectorId) {
      this.quantityBySelectorId.set(this.selectorId, data.quantity);
      this.currentQuantitySelectorId = this.selectorId;
    } else {
      this.quantity = data.quantity;
    }
    renderQuantityDisplay(
      this.element,
      this.currentQuantitySelectorId ?? this.selectorId,
      this.quantityBySelectorId,
      this.quantity,
    );
  }

  private onOptionSelected(data: EventMap['upsell:option-selected']): void {
    let shouldUpdate = this.selectorId === data.selectorId;
    if (!shouldUpdate) {
      this.element.querySelectorAll('[data-next-selector-id]').forEach(sel => {
        if (sel.getAttribute('data-next-selector-id') === data.selectorId) shouldUpdate = true;
      });
    }
    if (!shouldUpdate) return;

    this.selectedPackageId = data.packageId;
    this.packageId = data.packageId;
    this.options.forEach((el, id) => {
      el.classList.toggle('next-selected', id === data.packageId);
      el.setAttribute('data-next-selected', (id === data.packageId).toString());
    });
  }

  private handleOrderUpdate(orderState: { isProcessingUpsell: boolean; upsellError?: string | null }): void {
    this.updateUpsellDisplay();
    renderProcessingState(this.element, this.actionButtons, orderState.isProcessingUpsell);
    if (orderState.upsellError) {
      renderError(this.element, orderState.upsellError, this.logger);
    }
  }

  private updateUpsellDisplay(): void {
    if (useOrderStore.getState().canAddUpsells()) {
      showUpsellOffer(this.element);
    } else {
      hideUpsellOffer(this.element);
    }
  }

  /**
   * Resolve the selected package from a linked PackageSelectorEnhancer element
   * (data-next-package-selector-id="<id>"). Called at click time so it always
   * reflects the current selection.
   */
  private resolveExternalSelection(): number | undefined {
    if (!this.packageSelectorId) return undefined;
    const el = document.querySelector<HTMLElement>(
      `[data-next-package-selector][data-next-selector-id="${this.packageSelectorId}"]`,
    );
    if (!el) return undefined;
    const fn = (el as unknown as Record<string, unknown>)['_getSelectedPackageId'];
    return typeof fn === 'function' ? (fn() as number | undefined) : undefined;
  }

  private resolveExternalBundleItems(): { packageId: number; quantity: number }[] | null {
    if (!this.bundleSelectorId) return null;
    const el = document.querySelector<HTMLElement>(
      `[data-next-bundle-selector][data-next-selector-id="${this.bundleSelectorId}"]`,
    );
    if (!el) return null;
    const fn = (el as unknown as Record<string, unknown>)['_getSelectedBundleItems'];
    return typeof fn === 'function'
      ? (fn() as { packageId: number; quantity: number }[] | null)
      : null;
  }

  private makeHandlerContext(): UpsellHandlerContext {
    const externalId = this.resolveExternalSelection();
    const externalBundleItems = this.resolveExternalBundleItems();
    return {
      isProcessingRef: this.isProcessingRef,
      element: this.element,
      packageId: externalId ?? this.packageId,
      isSelector: this.isSelector,
      selectedPackageId: externalId ?? this.selectedPackageId,
      selectorId: this.selectorId,
      quantity: this.quantity,
      quantityBySelectorId: this.quantityBySelectorId,
      currentQuantitySelectorId: this.currentQuantitySelectorId,
      bundleItems: externalBundleItems,
      actionButtons: this.actionButtons,
      loadingOverlay: this.loadingOverlay,
      apiClient: this.apiClient,
      currentPagePath: this.currentPagePath,
      logger: this.logger,
      emit: (event, detail) => this.emit(event, detail),
    };
  }

  public update(): void {
    this.scanUpsellElements();
    this.updateUpsellDisplay();
  }

  protected override cleanupEventListeners(): void {
    if (this.clickHandler) {
      this.actionButtons.forEach(btn => btn.removeEventListener('click', this.clickHandler!));
    }
    if (this.keydownHandler) {
      this.element.removeEventListener('keydown', this.keydownHandler, true);
    }
  }

  public override destroy(): void {
    if (this.pageShowHandler) window.removeEventListener('pageshow', this.pageShowHandler);
    this.actionButtons = [];
    super.destroy();
  }
}
