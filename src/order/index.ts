import type { Engine } from '../engine/engine';
import { createOrder, type OrderActions } from './state';
import { orderValue } from './values';
import { registerValues } from '../engine/display/values';
import { bindReceipt } from './receipt';
import { bindUpsells } from './upsell';
import { legacyOfferSelector, legacyOrderEvents } from '../compat/order';

export async function bindOrder(
  engine: Engine,
  navigate: (url: string) => void = (url) => location.assign(url),
): Promise<OrderActions> {
  const order = engine.attach((ctx) => createOrder(ctx, engine.cart));
  engine.order = order;
  registerValues('order', orderValue);

  const renders = [...bindUpsells(engine, order, navigate, legacyOfferSelector), ...bindReceipt(engine)];
  legacyOrderEvents(engine);
  const render = () => renders.forEach((r) => r());
  engine.subscribe(render);

  const { params } = engine.getState().visit;
  const refId = params.ref_id || params.order_ref_id;
  if (refId) await order.load(refId);
  else if (params.payment_failed === 'true') order.paymentFailed();
  render();
  return order;
}
