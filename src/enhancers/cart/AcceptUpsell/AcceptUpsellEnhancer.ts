import { BaseActionEnhancer } from '@/enhancers/base/BaseActionEnhancer';
import { useOrderStore } from '@/stores/orderStore';
import { useConfigStore } from '@/stores/configStore';
import { ApiClient } from '@/api/client';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { acceptUpsell } from './AcceptUpsellEnhancer.handlers';
import type { SelectorItem } from '@/types/global';
import type { BundleLineItem, UpsellHandlerContext } from './AcceptUpsellEnhancer.types';

export class AcceptUpsellEnhancer extends BaseActionEnhancer {
  private packageId?: number;
  private quantity = 1;
  private selectorId?: string;
  private bundleSelectorId?: string;
  private bundleItemsRef: { value: BundleLineItem[] | null } = { value: null };
  private nextUrl?: string;
  private apiClient!: ApiClient;
  private loadingOverlay = new LoadingOverlay();
  private selectedItemRef: { value: SelectorItem | null } = { value: null };

  // Stable bound references for add/remove listener symmetry
  private readonly boundHandleClick = (e: Event) => void this.handleClick(e);
  private readonly boundHandlePageShow = (e: PageTransitionEvent) =>
    this.handlePageShow(e);
  private readonly boundHandleSelectorChange = (e: any) =>
    this.handleSelectorChange(e);
  private readonly boundHandleBundleSelectionChange = () =>
    this.handleBundleSelectionChange();

  public async initialize(): Promise<void> {
    this.validateElement();

    window.addEventListener('pageshow', this.boundHandlePageShow);

    const packageIdAttr = this.getAttribute('data-next-package-id');
    if (packageIdAttr) this.packageId = parseInt(packageIdAttr, 10);

    const quantityAttr = this.getAttribute('data-next-quantity');
    this.quantity = quantityAttr ? parseInt(quantityAttr, 10) : 1;

    const selectorIdAttr = this.getAttribute('data-next-selector-id');
    if (selectorIdAttr) this.selectorId = selectorIdAttr;

    const bundleSelectorIdAttr = this.getAttribute('data-next-upsell-action-for');
    if (bundleSelectorIdAttr) this.bundleSelectorId = bundleSelectorIdAttr;

    const nextUrlAttr = this.getAttribute('data-next-url');
    if (nextUrlAttr) this.nextUrl = nextUrlAttr;

    this.apiClient = new ApiClient(useConfigStore.getState().apiKey);
    this.element.addEventListener('click', this.boundHandleClick);

    if (this.selectorId) this.setupSelectorListener();
    if (this.bundleSelectorId) this.setupBundleSelectorListener();

    this.subscribe(useOrderStore, () => this.updateButtonState());
    this.updateButtonState();

    this.logger.debug('Initialized', {
      packageId: this.packageId,
      selectorId: this.selectorId,
      bundleSelectorId: this.bundleSelectorId,
      quantity: this.quantity,
    });
  }

  private setupSelectorListener(): void {
    // Delay so that the selector enhancer has time to initialize first
    setTimeout(() => {
      const el = this.findSelectorElement();
      if (!el) {
        this.logger.warn(`Selector "${this.selectorId}" not found`);
        return;
      }
      this.selectedItemRef.value = this.readSelectedItem(el);
      this.updateButtonState();
    }, 100);

    this.eventBus.on(
      'upsell-selector:item-selected',
      this.boundHandleSelectorChange,
    );
    this.eventBus.on('selector:item-selected', this.boundHandleSelectorChange);
    this.eventBus.on(
      'selector:selection-changed',
      this.boundHandleSelectorChange,
    );
  }

  private setupBundleSelectorListener(): void {
    // Delay so that BundleSelectorEnhancer has time to initialize first
    setTimeout(() => {
      const el = this.findBundleSelectorElement();
      if (!el) {
        this.logger.warn(`Bundle selector "${this.bundleSelectorId}" not found`);
        return;
      }
      this.readBundleItems(el);
      this.updateButtonState();
    }, 100);

    this.eventBus.on('bundle:selected', this.boundHandleBundleSelectionChange);
    this.eventBus.on('bundle:selection-changed', this.boundHandleBundleSelectionChange);
  }

  private findBundleSelectorElement(): HTMLElement | null {
    return document.querySelector<HTMLElement>(
      `[data-next-bundle-selector][data-next-selector-id="${this.bundleSelectorId}"]`,
    );
  }

  private readBundleItems(el: HTMLElement): void {
    const getItems = (el as unknown as Record<string, unknown>)['_getSelectedBundleItems'];
    if (typeof getItems === 'function') {
      this.bundleItemsRef.value = getItems() as BundleLineItem[] | null;
    }
  }

  private handleBundleSelectionChange(): void {
    const el = this.findBundleSelectorElement();
    if (el) this.readBundleItems(el);
    this.updateButtonState();
  }

  private findSelectorElement(): HTMLElement | null {
    return document.querySelector(
      `[data-next-upsell-selector][data-next-selector-id="${this.selectorId}"],` +
        `[data-next-upsell-select="${this.selectorId}"],` +
        `[data-next-upsell][data-next-selector-id="${this.selectorId}"]`,
    );
  }

  private readSelectedItem(el: HTMLElement): SelectorItem | null {
    const getPackageId = (el as any)._getSelectedPackageId;
    const packageId =
      typeof getPackageId === 'function'
        ? getPackageId()
        : (el as any)._selectedPackageId;

    if (!packageId) return null;

    return {
      packageId,
      quantity: 1,
      element: null as any,
      price: undefined,
      name: undefined,
      isPreSelected: false,
      shippingId: undefined,
    };
  }

  private handleSelectorChange(event: any): void {
    if (event.selectorId !== this.selectorId) return;

    const el = this.findSelectorElement();
    if (el) {
      this.selectedItemRef.value = this.readSelectedItem(el);
    } else if (event.packageId) {
      this.selectedItemRef.value = {
        packageId: event.packageId,
        quantity: event.quantity ?? 1,
        element: null as any,
        price: undefined,
        name: undefined,
        isPreSelected: false,
        shippingId: undefined,
      };
    } else {
      this.selectedItemRef.value = null;
    }

    this.updateButtonState();
  }

  private handlePageShow(event: PageTransitionEvent): void {
    if (event.persisted) {
      // Page restored from bfcache — clear loading state left by a previous click
      this.loadingOverlay.hide(true);
      this.setEnabled(true);
    }
  }

  private updateButtonState(): void {
    const { canAddUpsells } = useOrderStore.getState();
    const hasPackage = !!(
      this.packageId ??
      this.selectedItemRef.value ??
      (this.bundleItemsRef.value?.length ? this.bundleItemsRef.value : null)
    );
    this.setEnabled(canAddUpsells() && hasPackage);
  }

  private setEnabled(enabled: boolean): void {
    if (enabled) {
      this.element.removeAttribute('disabled');
      this.removeClass('next-disabled');
    } else {
      this.element.setAttribute('disabled', 'true');
      this.addClass('next-disabled');
    }
  }

  private makeContext(): UpsellHandlerContext {
    return {
      packageId: this.packageId,
      selectorId: this.selectorId,
      selectedItemRef: this.selectedItemRef,
      quantity: this.quantity,
      bundleSelectorId: this.bundleSelectorId,
      bundleItemsRef: this.bundleItemsRef,
      nextUrl: this.nextUrl,
      apiClient: this.apiClient,
      loadingOverlay: this.loadingOverlay,
      logger: this.logger,
      emit: (event, detail) => this.emit(event as any, detail as any),
    };
  }

  private async handleClick(event: Event): Promise<void> {
    event.preventDefault();
    await this.executeAction(() => acceptUpsell(this.makeContext()), {
      showLoading: false,
      disableOnProcess: true,
    });
  }

  /**
   * Trigger upsell acceptance programmatically (e.g. from window.next.addUpsell).
   */
  public async triggerAcceptUpsell(): Promise<void> {
    await this.executeAction(() => acceptUpsell(this.makeContext()), {
      showLoading: false,
      disableOnProcess: true,
    });
  }

  public update(_data?: unknown): void {
    // No-op — button state is driven by the order store subscription
  }

  public override destroy(): void {
    this.element.removeEventListener('click', this.boundHandleClick);
    window.removeEventListener('pageshow', this.boundHandlePageShow);

    if (this.selectorId) {
      this.eventBus.off(
        'upsell-selector:item-selected',
        this.boundHandleSelectorChange,
      );
      this.eventBus.off('selector:item-selected', this.boundHandleSelectorChange);
      this.eventBus.off(
        'selector:selection-changed',
        this.boundHandleSelectorChange,
      );
    }

    if (this.bundleSelectorId) {
      this.eventBus.off('bundle:selected', this.boundHandleBundleSelectionChange);
      this.eventBus.off('bundle:selection-changed', this.boundHandleBundleSelectionChange);
    }

    super.destroy();
  }
}
