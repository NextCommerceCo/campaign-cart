import { BaseActionEnhancer } from '@/enhancers/base/BaseActionEnhancer';
import { useOrderStore } from '@/stores/orderStore';
import { useConfigStore } from '@/stores/configStore';
import { ApiClient } from '@/api/client';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { acceptUpsell } from './AcceptUpsellEnhancer.handlers';
import type { SelectorItem } from '@/types/global';
import type { UpsellHandlerContext } from './AcceptUpsellEnhancer.types';

export class AcceptUpsellEnhancer extends BaseActionEnhancer {
  private packageId?: number;
  private quantity = 1;
  private selectorId?: string;
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

  public async initialize(): Promise<void> {
    this.validateElement();

    window.addEventListener('pageshow', this.boundHandlePageShow);

    const packageIdAttr = this.getAttribute('data-next-package-id');
    if (packageIdAttr) this.packageId = parseInt(packageIdAttr, 10);

    const quantityAttr = this.getAttribute('data-next-quantity');
    this.quantity = quantityAttr ? parseInt(quantityAttr, 10) : 1;

    const selectorIdAttr = this.getAttribute('data-next-selector-id');
    if (selectorIdAttr) this.selectorId = selectorIdAttr;

    const nextUrlAttr = this.getAttribute('data-next-url');
    if (nextUrlAttr) this.nextUrl = nextUrlAttr;

    this.apiClient = new ApiClient(useConfigStore.getState().apiKey);
    this.element.addEventListener('click', this.boundHandleClick);

    if (this.selectorId) this.setupSelectorListener();

    this.subscribe(useOrderStore, () => this.updateButtonState());
    this.updateButtonState();

    this.logger.debug('Initialized', {
      packageId: this.packageId,
      selectorId: this.selectorId,
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
    const hasPackage = !!(this.packageId ?? this.selectedItemRef.value);
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

    super.destroy();
  }
}
