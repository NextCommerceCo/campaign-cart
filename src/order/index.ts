import type { Engine } from '../engine/engine';
import { createOrder, type OrderActions, orderValue } from './state';
import { registerValues } from '../engine/values';
import { bindReceipt } from './receipt';
import { bindUpsells } from './upsell';

export async function bindOrder(
  engine: Engine,
  navigate: (url: string) => void = (url) => location.assign(url),
): Promise<OrderActions> {
  const order = engine.attach((ctx) => createOrder(ctx, engine.cart));
  engine.order = order;
  registerValues('order', orderValue);

  const renders = [...bindUpsells(engine, order, navigate), ...bindReceipt(engine)];
  const render = () => renders.forEach((r) => r());
  engine.subscribe(render);

  const { params } = engine.getState().visit;
  const refId = params.ref_id || params.order_ref_id;
  if (refId) await order.load(refId, location.pathname);
  render();
  return order;
}
