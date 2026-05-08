import { useCartStore } from '@/stores/cartStore';
import type { HandlerContext } from './RemoveItemEnhancer.types';

export async function handleClick(event: Event, ctx: HandlerContext): Promise<void> {
  event.preventDefault();
  event.stopPropagation();

  const target = event.currentTarget as HTMLElement;
  if (target.classList.contains('disabled') || target.hasAttribute('disabled')) {
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

async function removeItem(ctx: HandlerContext): Promise<void> {
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
