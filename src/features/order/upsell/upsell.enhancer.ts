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
 *
 * This class is the orchestrator only: it owns the lifecycle and the live
 * {@link UpsellState}, and delegates the work — interaction wiring to
 * `upsell.handlers.ts`, value resolution to `upsell.properties.ts`, DOM output
 * to `upsell.display.ts` and `upsell.renderer.ts`.
 */
import { BaseEnhancer } from '@/core/base/base-enhancer';
import { useOrderStore } from '@/state/order';
import { useConfigStore } from '@/state/config';
import { ApiClient } from '@/api/client';
import { LoadingOverlay } from '@/core/ui/loading-overlay';
import { renderProcessingState } from './upsell.renderer';
import { trackUpsellPageView } from './upsell.handlers';
import {
  initializeSelectorMode,
  scanUpsellElements,
  setupEventHandlers,
  onQuantityChanged,
  onOptionSelected,
} from './upsell.interaction-handlers';
import { handleOrderUpdate, updateUpsellDisplay } from './upsell.display';
import {
  resolveExternalSelection,
  resolveExternalBundleItems,
  resolveExternalBundleVouchers,
  collectDefaultProperties,
  resolveProperties,
} from './upsell.properties';
import type {
  UpsellHandlerContext,
  UpsellInteractionContext,
  UpsellState,
} from './upsell.types';

export class UpsellEnhancer extends BaseEnhancer {
  private apiClient!: ApiClient;
  private clickHandler?: (event: Event) => void;
  private keydownHandler?: (event: KeyboardEvent) => void;
  private pageShowHandler?: (event: PageTransitionEvent) => void;
  private loadingOverlay: LoadingOverlay;
  private isProcessingRef = { value: false };

  // Selector mode
  private isSelector = false;
  private currentPagePath?: string;

  // External PackageSelectorEnhancer integration
  private packageSelectorId?: string;
  // External BundleSelectorEnhancer integration
  private bundleSelectorId?: string;

  /**
   * Live state shared by reference with the handlers in `upsell.handlers.ts`.
   * They mutate it in place; never replace this object.
   */
  private state: UpsellState = {
    packageId: undefined,
    quantity: 1,
    selectorId: undefined,
    selectedPackageId: undefined,
    options: new Map<number, HTMLElement>(),
    quantityBySelectorId: new Map<string, number>(),
    currentQuantitySelectorId: undefined,
    actionButtons: [],
  };

  constructor(element: HTMLElement) {
    super(element);
    this.loadingOverlay = new LoadingOverlay();
  }

  public async initialize(): Promise<void> {
    this.validateElement();
    this.setupPageShowHandler();
    setTimeout(
      () => trackUpsellPageView(this.logger, (e, d) => this.emit(e, d)),
      100
    );

    this.state.selectorId =
      this.getAttribute('data-next-selector-id') ?? undefined;

    // Auto-detect child selectors, fall back to explicit attributes
    const childBundleSelector = this.element.querySelector<HTMLElement>(
      '[data-next-bundle-selector]'
    );
    this.bundleSelectorId =
      childBundleSelector?.getAttribute('data-next-selector-id') ??
      this.getAttribute('data-next-bundle-selector-id') ??
      undefined;

    const childPackageSelector = this.element.querySelector<HTMLElement>(
      '[data-next-package-selector]'
    );
    this.packageSelectorId =
      childPackageSelector?.getAttribute('data-next-selector-id') ??
      this.getAttribute('data-next-package-selector-id') ??
      undefined;
    this.isSelector =
      !!this.state.selectorId ||
      !!this.packageSelectorId ||
      !!this.bundleSelectorId;

    if (this.isSelector) {
      initializeSelectorMode(this.makeInteractionContext());
    } else {
      const packageIdAttr = this.getAttribute('data-next-package-id');
      if (!packageIdAttr) {
        throw new Error(
          'UpsellEnhancer requires data-next-package-id (or selector mode with data-next-selector-id)'
        );
      }
      this.state.packageId = parseInt(packageIdAttr, 10);
      if (isNaN(this.state.packageId))
        throw new Error('Invalid package ID provided');
      const orderStore = useOrderStore.getState();
      if (orderStore.order)
        orderStore.markUpsellViewed(this.state.packageId.toString());
    }

    const quantityAttr = this.getAttribute('data-next-quantity');
    if (quantityAttr) this.state.quantity = parseInt(quantityAttr, 10) || 1;

    const config = useConfigStore.getState();
    this.apiClient = new ApiClient(config.apiKey);

    scanUpsellElements(this.makeInteractionContext());
    const { clickHandler, keydownHandler } = setupEventHandlers(
      this.makeInteractionContext(),
      this.isProcessingRef,
      () => this.makeHandlerContext()
    );
    this.clickHandler = clickHandler;
    this.keydownHandler = keydownHandler;
    this.subscribe(useOrderStore, state =>
      handleOrderUpdate(
        state,
        this.element,
        this.state.actionButtons,
        this.logger
      )
    );

    this.on('upsell:quantity-changed', data =>
      onQuantityChanged(data, this.makeInteractionContext())
    );
    this.on('upsell:option-selected', data =>
      onOptionSelected(data, this.makeInteractionContext())
    );

    updateUpsellDisplay(this.element);

    this.logger.debug('UpsellEnhancer initialized', {
      mode: this.isSelector ? 'selector' : 'direct',
      packageId: this.state.packageId,
      selectorId: this.state.selectorId,
      quantity: this.state.quantity,
      actionButtons: this.state.actionButtons.length,
      options: this.state.options.size,
    });

    this.emit('upsell:initialized', {
      packageId: this.state.packageId ?? 0,
      element: this.element,
    });
  }

  private setupPageShowHandler(): void {
    this.pageShowHandler = (event: PageTransitionEvent) => {
      if (event.persisted) {
        this.loadingOverlay.hide(true);
        this.isProcessingRef.value = false;
        renderProcessingState(this.element, this.state.actionButtons, false);
      }
    };
    window.addEventListener('pageshow', this.pageShowHandler);
  }

  /**
   * Hands the handlers the container plus the live state object — not a copy, so
   * a handler registered now still sees the current values when it runs later.
   */
  private makeInteractionContext(): UpsellInteractionContext {
    return {
      element: this.element,
      state: this.state,
      logger: this.logger,
      emit: (event, detail) => this.emit(event, detail),
    };
  }

  private makeHandlerContext(): UpsellHandlerContext {
    const externalId = resolveExternalSelection(this.packageSelectorId);
    const externalBundleItems = resolveExternalBundleItems(
      this.bundleSelectorId
    );
    return {
      isProcessingRef: this.isProcessingRef,
      element: this.element,
      packageId: externalId ?? this.state.packageId,
      isSelector: this.isSelector,
      selectedPackageId: externalId ?? this.state.selectedPackageId,
      selectorId: this.state.selectorId,
      quantity: this.state.quantity,
      quantityBySelectorId: this.state.quantityBySelectorId,
      currentQuantitySelectorId: this.state.currentQuantitySelectorId,
      bundleItems: externalBundleItems,
      bundleVouchers: resolveExternalBundleVouchers(this.bundleSelectorId),
      defaultProperties: collectDefaultProperties(),
      properties: resolveProperties(this.element),
      actionButtons: this.state.actionButtons,
      loadingOverlay: this.loadingOverlay,
      apiClient: this.apiClient,
      currentPagePath: this.currentPagePath,
      logger: this.logger,
      emit: (event, detail) => this.emit(event, detail),
    };
  }

  public update(): void {
    scanUpsellElements(this.makeInteractionContext());
    updateUpsellDisplay(this.element);
  }

  protected override cleanupEventListeners(): void {
    if (this.clickHandler) {
      this.state.actionButtons.forEach(btn =>
        btn.removeEventListener('click', this.clickHandler!)
      );
    }
    if (this.keydownHandler) {
      this.element.removeEventListener('keydown', this.keydownHandler, true);
    }
  }

  public override destroy(): void {
    if (this.pageShowHandler)
      window.removeEventListener('pageshow', this.pageShowHandler);
    this.state.actionButtons = [];
    super.destroy();
  }
}
