import { B as BaseCartEnhancer } from "./BaseCartEnhancer-LBUyGRo1.js";
import { a as useCartStore } from "./analytics-Ci0jTs8y.js";
function renderButtonState(element, isInCart) {
  element.classList.toggle("disabled", !isInCart);
  element.toggleAttribute("disabled", !isInCart);
  element.setAttribute("aria-disabled", String(!isInCart));
}
function renderCartClasses(element, isInCart) {
  element.classList.toggle("has-item", isInCart);
  element.classList.toggle("empty", !isInCart);
}
function renderQuantityData(element, quantity, isInCart) {
  element.setAttribute("data-quantity", String(quantity));
  element.setAttribute("data-in-cart", String(isInCart));
}
function renderButtonContent(element, quantity) {
  if (!element.hasAttribute("data-original-content")) {
    element.setAttribute("data-original-content", element.innerHTML);
  }
  const originalContent = element.getAttribute("data-original-content") ?? element.innerHTML;
  const newContent = originalContent.replace(/\{quantity\}/g, String(quantity));
  if (element.innerHTML !== newContent) {
    element.innerHTML = newContent;
  }
}
function renderRemovalFeedback(element) {
  element.classList.add("item-removed");
  const cartItem = element.closest("[data-cart-item-id], .cart-item");
  if (cartItem instanceof HTMLElement) {
    cartItem.classList.add("removing");
    setTimeout(() => cartItem.classList.remove("removing"), 300);
  }
  setTimeout(() => element.classList.remove("item-removed"), 300);
}
async function handleClick(event, ctx) {
  event.preventDefault();
  event.stopPropagation();
  const target = event.currentTarget;
  if (target.classList.contains("disabled") || target.hasAttribute("disabled")) {
    return;
  }
  if (ctx.confirmRemoval && !confirm(ctx.confirmMessage)) {
    return;
  }
  ctx.setProcessing(true);
  try {
    await removeItem(ctx);
  } finally {
    ctx.setProcessing(false);
  }
}
async function removeItem(ctx) {
  const store = useCartStore.getState();
  if (store.getItemQuantity(ctx.packageId) === 0) {
    ctx.logger.debug(`Item ${ctx.packageId} not in cart, nothing to remove`);
    return;
  }
  await store.removeItem(ctx.packageId);
  ctx.logger.debug(`Removed item ${ctx.packageId} from cart`);
  ctx.emitRemoved(ctx.packageId);
  ctx.renderFeedback();
}
class RemoveItemEnhancer extends BaseCartEnhancer {
  constructor() {
    super(...arguments);
    this.confirmRemoval = false;
    this.confirmMessage = "Are you sure you want to remove this item?";
    this.boundHandleClick = (e) => void handleClick(e, this.makeHandlerContext()).catch(
      (err) => this.handleError(err, "handleClick")
    );
  }
  async initialize() {
    this.validateElement();
    const packageIdAttr = this.getRequiredAttribute("data-package-id");
    const parsedId = parseInt(packageIdAttr, 10);
    if (isNaN(parsedId)) {
      throw new Error(`Invalid package ID: "${packageIdAttr}"`);
    }
    this.packageId = parsedId;
    this.confirmRemoval = this.getAttribute("data-next-confirm") === "true";
    this.confirmMessage = this.getAttribute("data-next-confirm-message") ?? this.confirmMessage;
    this.element.addEventListener("click", this.boundHandleClick);
    this.setupCartSubscription();
    this.handleCartUpdate(useCartStore.getState());
    this.logger.debug(`Initialized for package ${this.packageId}`);
  }
  update() {
  }
  handleCartUpdate(state) {
    this.cartState = state;
    const quantity = this.getCartItem(this.packageId)?.quantity ?? 0;
    const isInCart = quantity > 0;
    renderButtonState(this.element, isInCart);
    renderCartClasses(this.element, isInCart);
    renderQuantityData(this.element, quantity, isInCart);
    renderButtonContent(this.element, quantity);
  }
  cleanupEventListeners() {
    this.element.removeEventListener("click", this.boundHandleClick);
  }
  makeHandlerContext() {
    return {
      packageId: this.packageId,
      confirmRemoval: this.confirmRemoval,
      confirmMessage: this.confirmMessage,
      logger: this.logger,
      setProcessing: (value) => this.toggleClass("processing", value),
      emitRemoved: (packageId) => this.emit("cart:item-removed", { packageId }),
      renderFeedback: () => renderRemovalFeedback(this.element)
    };
  }
  getCurrentQuantity() {
    return this.getCartItem(this.packageId)?.quantity ?? 0;
  }
  isInCart() {
    return this.getCurrentQuantity() > 0;
  }
  setConfirmation(enabled, message) {
    this.confirmRemoval = enabled;
    if (message !== void 0) {
      this.confirmMessage = message;
    }
  }
}
export {
  RemoveItemEnhancer
};
