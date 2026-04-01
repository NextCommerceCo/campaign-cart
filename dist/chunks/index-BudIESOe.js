import { B as BaseCartEnhancer } from "./BaseCartEnhancer-BiM3SOiK.js";
import { a as useCartStore } from "./analytics-D4CaGccD.js";
function renderButtonState(element, action, currentQuantity, constraints) {
  const canIncrease = currentQuantity < constraints.max;
  const canDecrease = currentQuantity > constraints.min;
  switch (action) {
    case "increase":
      toggleElementDisabled(element, !canIncrease);
      break;
    case "decrease":
      toggleElementDisabled(element, !canDecrease);
      break;
    case "set":
      if (element instanceof HTMLInputElement) {
        element.min = String(constraints.min);
        element.max = String(constraints.max);
        element.step = String(constraints.step);
      }
      break;
  }
}
function toggleElementDisabled(element, disabled) {
  element.classList.toggle("disabled", disabled);
  element.toggleAttribute("disabled", disabled);
  element.setAttribute("aria-disabled", String(disabled));
}
function renderInputValue(element, quantity) {
  if (element.value !== String(quantity)) {
    element.value = String(quantity);
  }
}
function renderCartClasses(element, isInCart) {
  element.classList.toggle("has-item", isInCart);
  element.classList.toggle("empty", !isInCart);
}
function renderQuantityData(element, quantity, isInCart) {
  element.setAttribute("data-quantity", String(quantity));
  element.setAttribute("data-in-cart", String(isInCart));
}
function renderButtonContent(element, currentQuantity, step) {
  if (!element.hasAttribute("data-original-content")) {
    element.setAttribute("data-original-content", element.innerHTML);
  }
  const originalContent = element.getAttribute("data-original-content") ?? element.innerHTML;
  const newContent = originalContent.replace(/\{quantity\}/g, String(currentQuantity)).replace(/\{step\}/g, String(step));
  if (element.innerHTML !== newContent) {
    element.innerHTML = newContent;
  }
}
async function handleClick(event, context) {
  event.preventDefault();
  event.stopPropagation();
  const el = event.currentTarget;
  if (el.classList.contains("disabled") || el.hasAttribute("disabled")) return;
  context.setProcessing(true);
  try {
    await performQuantityUpdate(context);
  } finally {
    context.setProcessing(false);
  }
}
async function handleQuantityChange(event, context) {
  const target = event.target;
  const { min, max } = context.constraints;
  const newQuantity = parseInt(target.value, 10);
  if (isNaN(newQuantity) || newQuantity < min) {
    target.value = String(min);
    return;
  }
  if (newQuantity > max) {
    target.value = String(max);
    return;
  }
  context.setProcessing(true);
  try {
    const store = useCartStore.getState();
    const oldQuantity = store.getItemQuantity(context.packageId);
    if (newQuantity === 0) {
      await store.removeItem(context.packageId);
    } else {
      await store.updateQuantity(context.packageId, newQuantity);
    }
    context.emitQuantityChanged(oldQuantity, newQuantity);
  } catch (error) {
    const currentQuantity = useCartStore.getState().getItemQuantity(context.packageId);
    target.value = String(currentQuantity);
    throw error;
  } finally {
    context.setProcessing(false);
  }
}
function handleNumberInput(event, constraints) {
  const input = event.target;
  const value = parseInt(input.value, 10);
  if (value < constraints.min) input.value = String(constraints.min);
  if (value > constraints.max) input.value = String(constraints.max);
}
async function performQuantityUpdate(context) {
  const store = useCartStore.getState();
  const { packageId, action, constraints } = context;
  const { min, max, step } = constraints;
  const currentQuantity = store.getItemQuantity(packageId);
  let newQuantity;
  switch (action) {
    case "increase":
      newQuantity = Math.min(currentQuantity + step, max);
      break;
    case "decrease":
      newQuantity = Math.max(currentQuantity - step, min);
      break;
    default:
      return;
  }
  if (newQuantity === currentQuantity) {
    context.logger.debug("Quantity unchanged, skipping");
    return;
  }
  if (newQuantity <= 0) {
    await store.removeItem(packageId);
    context.logger.debug(`Removed item ${packageId} from cart`);
  } else {
    await store.updateQuantity(packageId, newQuantity);
    context.logger.debug(`Updated ${packageId} quantity to ${newQuantity}`);
  }
  context.emitQuantityChanged(currentQuantity, newQuantity);
}
class QuantityControlEnhancer extends BaseCartEnhancer {
  constructor() {
    super(...arguments);
    this.constraints = { min: 0, max: 99, step: 1 };
    this.boundHandleClick = (e) => void handleClick(e, this.makeHandlerContext()).catch(
      (err) => this.handleError(err, "handleClick")
    );
    this.boundHandleChange = (e) => void handleQuantityChange(e, this.makeHandlerContext()).catch(
      (err) => this.handleError(err, "handleQuantityChange")
    );
    this.boundHandleBlur = (e) => void handleQuantityChange(e, this.makeHandlerContext()).catch(
      (err) => this.handleError(err, "handleQuantityChange")
    );
    this.boundHandleInput = (e) => handleNumberInput(e, this.constraints);
  }
  async initialize() {
    this.validateElement();
    const actionAttr = this.getRequiredAttribute("data-next-quantity");
    if (!["increase", "decrease", "set"].includes(actionAttr)) {
      throw new Error(
        `Invalid value for data-next-quantity: "${actionAttr}". Must be 'increase', 'decrease', or 'set'.`
      );
    }
    this.action = actionAttr;
    const packageIdAttr = this.getRequiredAttribute("data-package-id");
    const parsedId = parseInt(packageIdAttr, 10);
    if (isNaN(parsedId)) {
      throw new Error(`Invalid package ID: "${packageIdAttr}"`);
    }
    this.packageId = parsedId;
    this.constraints = {
      step: parseInt(this.getAttribute("data-step") ?? "1", 10) || 1,
      min: parseInt(this.getAttribute("data-min") ?? "0", 10) || 0,
      max: parseInt(this.getAttribute("data-max") ?? "99", 10) || 99
    };
    this.setupEventListeners();
    this.setupCartSubscription();
    this.handleCartUpdate(useCartStore.getState());
    this.logger.debug(
      `Initialized for package ${this.packageId}, action: ${this.action}`,
      this.constraints
    );
  }
  update() {
  }
  makeHandlerContext() {
    return {
      packageId: this.packageId,
      action: this.action,
      constraints: this.constraints,
      logger: this.logger,
      setProcessing: (value) => this.toggleClass("processing", value),
      emitQuantityChanged: (oldQty, newQty) => this.emit("cart:quantity-changed", {
        packageId: this.packageId,
        quantity: newQty,
        oldQuantity: oldQty
      })
    };
  }
  setupEventListeners() {
    if (this.action === "set" && (this.element.tagName === "INPUT" || this.element.tagName === "SELECT")) {
      this.element.addEventListener("change", this.boundHandleChange);
      this.element.addEventListener("blur", this.boundHandleBlur);
      if (this.element instanceof HTMLInputElement && this.element.type === "number") {
        this.element.addEventListener("input", this.boundHandleInput);
      }
    } else {
      this.element.addEventListener("click", this.boundHandleClick);
    }
  }
  handleCartUpdate(state) {
    this.cartState = state;
    const cartItem = this.getCartItem(this.packageId);
    const currentQuantity = cartItem?.quantity ?? 0;
    const isInCart = currentQuantity > 0;
    renderButtonState(this.element, this.action, currentQuantity, this.constraints);
    renderCartClasses(this.element, isInCart);
    renderQuantityData(this.element, currentQuantity, isInCart);
    renderButtonContent(this.element, currentQuantity, this.constraints.step);
    if (this.action === "set" && (this.element instanceof HTMLInputElement || this.element instanceof HTMLSelectElement)) {
      renderInputValue(this.element, currentQuantity);
    }
  }
  cleanupEventListeners() {
    this.element.removeEventListener("click", this.boundHandleClick);
    this.element.removeEventListener("change", this.boundHandleChange);
    this.element.removeEventListener("blur", this.boundHandleBlur);
    this.element.removeEventListener("input", this.boundHandleInput);
  }
  getCurrentQuantity() {
    return useCartStore.getState().getItemQuantity(this.packageId);
  }
  async setQuantity(quantity) {
    const clamped = Math.max(
      this.constraints.min,
      Math.min(this.constraints.max, quantity)
    );
    const store = useCartStore.getState();
    if (clamped <= 0) {
      await store.removeItem(this.packageId);
    } else {
      await store.updateQuantity(this.packageId, clamped);
    }
  }
  getConstraints() {
    return { ...this.constraints };
  }
}
export {
  QuantityControlEnhancer
};
