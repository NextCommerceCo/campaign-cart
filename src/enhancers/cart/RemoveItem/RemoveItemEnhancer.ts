import { BaseCartEnhancer } from '@/enhancers/base/BaseCartEnhancer';
import { useCartStore } from '@/stores/cartStore';
import type { CartState } from '@/types/global';
import type { HandlerContext } from './RemoveItemEnhancer.types';
import {
  renderButtonState,
  renderCartClasses,
  renderQuantityData,
  renderButtonContent,
  renderRemovalFeedback,
} from './RemoveItemEnhancer.renderer';
import { handleClick } from './RemoveItemEnhancer.handlers';

export class RemoveItemEnhancer extends BaseCartEnhancer {
  private packageId!: number;
  private confirmRemoval = false;
  private confirmMessage = 'Are you sure you want to remove this item?';

  private readonly boundHandleClick = (e: Event) =>
    void handleClick(e, this.makeHandlerContext()).catch(err =>
      this.handleError(err, 'handleClick'),
    );

  public async initialize(): Promise<void> {
    this.validateElement();

    const packageIdAttr = this.getRequiredAttribute('data-package-id');
    const parsedId = parseInt(packageIdAttr, 10);
    if (isNaN(parsedId)) {
      throw new Error(`Invalid package ID: "${packageIdAttr}"`);
    }
    this.packageId = parsedId;

    this.confirmRemoval = this.getAttribute('data-next-confirm') === 'true';
    this.confirmMessage =
      this.getAttribute('data-next-confirm-message') ?? this.confirmMessage;

    this.element.addEventListener('click', this.boundHandleClick);
    this.setupCartSubscription();
    this.handleCartUpdate(useCartStore.getState());

    this.logger.debug(`Initialized for package ${this.packageId}`);
  }

  public update(): void {
    // Reactive updates are driven by the cart store subscription via handleCartUpdate
  }

  protected handleCartUpdate(state: CartState): void {
    this.cartState = state;
    const quantity = this.getCartItem(this.packageId)?.quantity ?? 0;
    const isInCart = quantity > 0;

    renderButtonState(this.element, isInCart);
    renderCartClasses(this.element, isInCart);
    renderQuantityData(this.element, quantity, isInCart);
    renderButtonContent(this.element, quantity);
  }

  protected override cleanupEventListeners(): void {
    this.element.removeEventListener('click', this.boundHandleClick);
  }

  private makeHandlerContext(): HandlerContext {
    return {
      packageId: this.packageId,
      confirmRemoval: this.confirmRemoval,
      confirmMessage: this.confirmMessage,
      logger: this.logger,
      setProcessing: value => this.toggleClass('processing', value),
      emitRemoved: packageId => this.emit('cart:item-removed', { packageId }),
      renderFeedback: () => renderRemovalFeedback(this.element),
    };
  }

  public getCurrentQuantity(): number {
    return this.getCartItem(this.packageId)?.quantity ?? 0;
  }

  public isInCart(): boolean {
    return this.getCurrentQuantity() > 0;
  }

  public setConfirmation(enabled: boolean, message?: string): void {
    this.confirmRemoval = enabled;
    if (message !== undefined) {
      this.confirmMessage = message;
    }
  }
}
