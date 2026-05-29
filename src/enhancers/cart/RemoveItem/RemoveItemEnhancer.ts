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

/**
 * Removes a single line item from the cart on click.
 *
 * Activated by `data-next-remove-item`. It binds a click handler that removes
 * the package identified by `data-package-id` from the cart, optionally behind a
 * `confirm()` prompt. It subscribes to the cart store to reflect whether the
 * item is currently in the cart (button enabled/disabled, `next-in-cart` state,
 * quantity data) and shows brief removal feedback on the element.
 *
 * Typically auto-instantiated by `CartItemListEnhancer` on rendered items — do
 * not manually instantiate inside an item template.
 *
 * ## Attributes
 *
 * | Attribute | Type | Required | Default | Description |
 * |---|---|---|---|---|
 * | `data-next-remove-item` | `string` | yes | — | Activation attribute. |
 * | `data-package-id` | `number` | yes | — | Cart line package `ref_id` to remove. Throws if missing or non-numeric. |
 * | `data-next-confirm` | `"true" \| "false"` | no | `false` | When `"true"`, shows a confirmation prompt before removing. |
 * | `data-next-confirm-message` | `string` | no | `Are you sure you want to remove this item?` | Message shown in the confirmation prompt. |
 *
 * @example
 * Plain remove button:
 * ```html
 * <button data-next-remove-item data-package-id="2">Remove</button>
 * ```
 *
 * @example
 * Remove with a confirmation prompt:
 * ```html
 * <button data-next-remove-item data-package-id="2"
 *         data-next-confirm="true"
 *         data-next-confirm-message="Remove this from your cart?">
 *   Remove
 * </button>
 * ```
 */
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
