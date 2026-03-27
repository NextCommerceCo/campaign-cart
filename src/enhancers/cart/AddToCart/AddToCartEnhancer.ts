import { BaseActionEnhancer } from '@/enhancers/base/BaseActionEnhancer';
import type { EventMap, SelectorItem } from '@/types/global';
import { handleSelectorChange, addToCart } from './AddToCartEnhancer.handlers';
import type { AddToCartHandlerContext } from './AddToCartEnhancer.types';

export class AddToCartEnhancer extends BaseActionEnhancer {
  private packageId?: number;
  private quantity = 1;
  private selectorId?: string;
  private redirectUrl?: string;
  private clearCart = false;
  private selectedItemRef: { value: SelectorItem | null | undefined } = { value: undefined };
  private clickHandler?: (event: Event) => void;
  private selectorChangeHandler?: (event: unknown) => void;

  public async initialize(): Promise<void> {
    this.validateElement();

    const packageIdAttr = this.getAttribute('data-next-package-id');
    if (packageIdAttr) this.packageId = parseInt(packageIdAttr, 10);

    const quantityAttr = this.getAttribute('data-next-quantity');
    this.quantity = quantityAttr ? parseInt(quantityAttr, 10) : 1;

    const selectorIdAttr = this.getAttribute('data-next-selector-id');
    if (selectorIdAttr) this.selectorId = selectorIdAttr;

    const redirectUrlAttr = this.getAttribute('data-next-url');
    if (redirectUrlAttr) this.redirectUrl = redirectUrlAttr;

    const clearCartAttr = this.getAttribute('data-next-clear-cart');
    this.clearCart = clearCartAttr === 'true';

    this.clickHandler = this.handleClick.bind(this);
    this.element.addEventListener('click', this.clickHandler);

    if (this.selectorId) this.setupSelectorListener();

    this.updateButtonState();

    this.logger.debug('AddToCartEnhancer initialized', {
      packageId: this.packageId,
      selectorId: this.selectorId,
      quantity: this.quantity,
      redirectUrl: this.redirectUrl,
      clearCart: this.clearCart,
    });
  }

  private setupSelectorListener(): void {
    const check = (retryCount = 0) => {
      const el = this.findSelectorElement();
      if (!el && retryCount < 5) {
        setTimeout(() => check(retryCount + 1), 50);
        return;
      }
      if (!el) {
        this.logger.warn(`Selector "${this.selectorId}" not found after retries`);
        return;
      }

      let item = this.getSelectedItemFromElement(el);

      if (item && !item.element) {
        const card = el.querySelector<HTMLElement>(
          `[data-next-selector-card][data-next-package-id="${item.packageId}"]`,
        );
        if (card) item = { ...item, element: card };
      }

      if (!item && el.getAttribute('data-next-selection-mode') === 'select') {
        const card = el.querySelector<HTMLElement>(
          '[data-next-selector-card][data-next-selected="true"]',
        );
        const idAttr = card?.getAttribute('data-next-package-id');
        const id = idAttr ? parseInt(idAttr, 10) : NaN;
        if (!isNaN(id)) {
          el.setAttribute('data-selected-package', String(id));
          item = {
            packageId: id,
            quantity: this.quantity,
            element: card ?? (null as unknown as HTMLElement),
            price: undefined,
            name: undefined,
            isPreSelected: false,
            shippingId: undefined,
          };
        }
      }

      this.selectedItemRef.value = item;
      this.updateButtonState();
    };

    check();

    this.selectorChangeHandler = event =>
      handleSelectorChange(
        event as Parameters<typeof handleSelectorChange>[0],
        () => this.findSelectorElement(),
        el => this.getSelectedItemFromElement(el),
        this.makeHandlerContext(),
      );

    this.eventBus.on('selector:item-selected', this.selectorChangeHandler);
    this.eventBus.on('selector:selection-changed', this.selectorChangeHandler);
  }

  private findSelectorElement(): HTMLElement | null {
    return document.querySelector(
      `[data-next-cart-selector][data-next-selector-id="${this.selectorId}"],` +
        `[data-next-package-selector][data-next-selector-id="${this.selectorId}"]`,
    );
  }

  private getSelectedItemFromElement(el: HTMLElement): SelectorItem | null {
    const getter = (el as unknown as Record<string, unknown>)['_getSelectedItem'];
    if (typeof getter === 'function') return getter() as SelectorItem | null;

    const direct = (el as unknown as Record<string, unknown>)['_selectedItem'];
    if (direct) return direct as SelectorItem;

    const attr = el.getAttribute('data-selected-package');
    const id = attr ? parseInt(attr, 10) : NaN;
    if (!isNaN(id)) {
      return {
        packageId: id,
        quantity: 1,
        element: null as unknown as HTMLElement,
        price: undefined,
        name: undefined,
        isPreSelected: false,
        shippingId: undefined,
      };
    }
    return null;
  }

  private updateButtonState(): void {
    if (this.selectorId) {
      const el = this.findSelectorElement();
      const isSelectMode = el?.getAttribute('data-next-selection-mode') === 'select';
      const hasSelection =
        this.selectedItemRef.value != null ||
        (isSelectMode && !!el?.getAttribute('data-selected-package'));
      this.setEnabled(hasSelection);
    } else if (this.packageId) {
      this.setEnabled(true);
    }
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

  private async handleClick(event: Event): Promise<void> {
    event.preventDefault();

    const profileOverride = this.getAttribute('data-next-profile');
    if (profileOverride) {
      const { ProfileManager } = await import('@/core/ProfileManager');
      await ProfileManager.getInstance().applyProfile(profileOverride);
    }

    await this.executeAction(
      async () => {
        const { packageId, quantity } = this.resolveAddTarget();
        if (!packageId) {
          this.logger.warn('No package ID available for add-to-cart action');
          return;
        }
        await addToCart(packageId, quantity, this.makeHandlerContext());
        this.updateButtonState();
      },
      { showLoading: true, disableOnProcess: true },
    );
  }

  private resolveAddTarget(): { packageId?: number; quantity: number } {
    const item = this.selectedItemRef.value;
    if (this.selectorId && item) {
      return { packageId: item.packageId, quantity: item.quantity ?? this.quantity };
    }
    return { packageId: this.packageId, quantity: this.quantity };
  }

  private makeHandlerContext(): AddToCartHandlerContext {
    return {
      selectorId: this.selectorId,
      quantity: this.quantity,
      clearCart: this.clearCart,
      redirectUrl: this.redirectUrl,
      logger: this.logger,
      selectedItemRef: this.selectedItemRef,
      updateButtonState: () => this.updateButtonState(),
      emit: (event, detail) => this.emit(event as keyof EventMap, detail as EventMap[keyof EventMap]),
    };
  }

  public update(_data?: unknown): void {}

  public override destroy(): void {
    if (this.clickHandler) {
      this.element.removeEventListener('click', this.clickHandler);
    }
    if (this.selectorChangeHandler) {
      this.eventBus.off('selector:item-selected', this.selectorChangeHandler);
      this.eventBus.off('selector:selection-changed', this.selectorChangeHandler);
    }
    super.destroy();
  }
}
