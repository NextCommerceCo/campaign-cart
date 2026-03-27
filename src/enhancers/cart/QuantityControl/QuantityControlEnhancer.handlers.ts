import { useCartStore } from '@/stores/cartStore';
import type { HandlerContext, QuantityConstraints } from './QuantityControlEnhancer.types';

export async function handleClick(
  event: Event,
  context: HandlerContext,
): Promise<void> {
  event.preventDefault();
  event.stopPropagation();

  const el = event.currentTarget as HTMLElement;
  if (el.classList.contains('disabled') || el.hasAttribute('disabled')) return;

  context.setProcessing(true);
  try {
    await performQuantityUpdate(context);
  } finally {
    context.setProcessing(false);
  }
}

export async function handleQuantityChange(
  event: Event,
  context: HandlerContext,
): Promise<void> {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
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

export function handleNumberInput(
  event: Event,
  constraints: QuantityConstraints,
): void {
  const input = event.target as HTMLInputElement;
  const value = parseInt(input.value, 10);
  if (value < constraints.min) input.value = String(constraints.min);
  if (value > constraints.max) input.value = String(constraints.max);
}

async function performQuantityUpdate(context: HandlerContext): Promise<void> {
  const store = useCartStore.getState();
  const { packageId, action, constraints } = context;
  const { min, max, step } = constraints;
  const currentQuantity = store.getItemQuantity(packageId);
  let newQuantity: number;

  switch (action) {
    case 'increase':
      newQuantity = Math.min(currentQuantity + step, max);
      break;
    case 'decrease':
      newQuantity = Math.max(currentQuantity - step, min);
      break;
    default:
      return; // 'set' is handled by handleQuantityChange
  }

  if (newQuantity === currentQuantity) {
    context.logger.debug('Quantity unchanged, skipping');
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
