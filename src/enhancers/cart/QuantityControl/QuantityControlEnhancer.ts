import { BaseCartEnhancer } from '@/enhancers/base/BaseCartEnhancer';
import { useCartStore } from '@/stores/cartStore';
import type { CartState } from '@/types/global';
import type {
  QuantityAction,
  QuantityConstraints,
  HandlerContext,
} from './QuantityControlEnhancer.types';
import {
  renderButtonState,
  renderCartClasses,
  renderInputValue,
  renderQuantityData,
  renderButtonContent,
} from './QuantityControlEnhancer.renderer';
import {
  handleClick,
  handleNumberInput,
  handleQuantityChange,
} from './QuantityControlEnhancer.handlers';

export class QuantityControlEnhancer extends BaseCartEnhancer {
  private action!: QuantityAction;
  private packageId!: number;
  private constraints: QuantityConstraints = { min: 0, max: 99, step: 1 };

  // Stable references for removeEventListener symmetry in cleanupEventListeners()
  private readonly boundHandleClick = (e: Event) =>
    void handleClick(e, this.makeHandlerContext()).catch(err =>
      this.handleError(err, 'handleClick'),
    );
  private readonly boundHandleChange = (e: Event) =>
    void handleQuantityChange(e, this.makeHandlerContext()).catch(err =>
      this.handleError(err, 'handleQuantityChange'),
    );
  private readonly boundHandleBlur = (e: Event) =>
    void handleQuantityChange(e, this.makeHandlerContext()).catch(err =>
      this.handleError(err, 'handleQuantityChange'),
    );
  private readonly boundHandleInput = (e: Event) =>
    handleNumberInput(e, this.constraints);

  public async initialize(): Promise<void> {
    this.validateElement();

    const actionAttr = this.getRequiredAttribute('data-next-quantity');
    if (!(['increase', 'decrease', 'set'] as const).includes(actionAttr as QuantityAction)) {
      throw new Error(
        `Invalid value for data-next-quantity: "${actionAttr}". Must be 'increase', 'decrease', or 'set'.`,
      );
    }
    this.action = actionAttr as QuantityAction;

    const packageIdAttr = this.getRequiredAttribute('data-package-id');
    const parsedId = parseInt(packageIdAttr, 10);
    if (isNaN(parsedId)) {
      throw new Error(`Invalid package ID: "${packageIdAttr}"`);
    }
    this.packageId = parsedId;

    this.constraints = {
      step: parseInt(this.getAttribute('data-step') ?? '1', 10) || 1,
      min: parseInt(this.getAttribute('data-min') ?? '0', 10) || 0,
      max: parseInt(this.getAttribute('data-max') ?? '99', 10) || 99,
    };

    this.setupEventListeners();
    this.setupCartSubscription();
    this.handleCartUpdate(useCartStore.getState());

    this.logger.debug(
      `Initialized for package ${this.packageId}, action: ${this.action}`,
      this.constraints,
    );
  }

  public update(): void {
    // Reactive updates are driven by the cart store subscription via handleCartUpdate
  }

  private makeHandlerContext(): HandlerContext {
    return {
      packageId: this.packageId,
      action: this.action,
      constraints: this.constraints,
      logger: this.logger,
      setProcessing: value => this.toggleClass('processing', value),
      emitQuantityChanged: (oldQty, newQty) =>
        this.emit('cart:quantity-changed', {
          packageId: this.packageId,
          quantity: newQty,
          oldQuantity: oldQty,
        }),
    };
  }

  private setupEventListeners(): void {
    if (
      this.action === 'set' &&
      (this.element.tagName === 'INPUT' || this.element.tagName === 'SELECT')
    ) {
      this.element.addEventListener('change', this.boundHandleChange);
      this.element.addEventListener('blur', this.boundHandleBlur);
      if (
        this.element instanceof HTMLInputElement &&
        this.element.type === 'number'
      ) {
        this.element.addEventListener('input', this.boundHandleInput);
      }
    } else {
      this.element.addEventListener('click', this.boundHandleClick);
    }
  }

  protected handleCartUpdate(state: CartState): void {
    this.cartState = state;
    const cartItem = this.getCartItem(this.packageId);
    const currentQuantity = cartItem?.quantity ?? 0;
    const isInCart = currentQuantity > 0;

    renderButtonState(this.element, this.action, currentQuantity, this.constraints);
    renderCartClasses(this.element, isInCart);
    renderQuantityData(this.element, currentQuantity, isInCart);
    renderButtonContent(this.element, currentQuantity, this.constraints.step);

    if (
      this.action === 'set' &&
      (this.element instanceof HTMLInputElement ||
        this.element instanceof HTMLSelectElement)
    ) {
      renderInputValue(this.element, currentQuantity);
    }
  }

  protected override cleanupEventListeners(): void {
    this.element.removeEventListener('click', this.boundHandleClick);
    this.element.removeEventListener('change', this.boundHandleChange);
    this.element.removeEventListener('blur', this.boundHandleBlur);
    this.element.removeEventListener('input', this.boundHandleInput);
  }

  public getCurrentQuantity(): number {
    return useCartStore.getState().getItemQuantity(this.packageId);
  }

  public async setQuantity(quantity: number): Promise<void> {
    const clamped = Math.max(
      this.constraints.min,
      Math.min(this.constraints.max, quantity),
    );
    const store = useCartStore.getState();
    if (clamped <= 0) {
      await store.removeItem(this.packageId);
    } else {
      await store.updateQuantity(this.packageId, clamped);
    }
  }

  public getConstraints(): QuantityConstraints {
    return { ...this.constraints };
  }
}
