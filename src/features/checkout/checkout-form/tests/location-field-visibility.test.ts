import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '@/core/events';
import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';
import {
  createLocationFieldVisibility,
  type LocationFieldsContext,
} from '../location-field-visibility';

// Plain object rather than `Logger`, so the spies stay `Mock`s in assertions.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createCtx(html: string): {
  ctx: LocationFieldsContext;
  form: HTMLFormElement;
  logger: ReturnType<typeof createMockLogger>;
  listened: { type: string; target: EventTarget }[];
} {
  document.body.innerHTML = `<form id="checkout">${html}</form>`;
  const form = document.getElementById('checkout') as HTMLFormElement;
  const logger = createMockLogger();
  const listened: { type: string; target: EventTarget }[] = [];

  const fields = new Map<string, HTMLElement>();
  const address1 = form.querySelector('[data-field="address1"]');
  if (address1 instanceof HTMLElement) fields.set('address1', address1);

  const billingFields = new Map<string, HTMLElement>();
  const billingAddress1 = form.querySelector('[data-field="billing-address1"]');
  if (billingAddress1 instanceof HTMLElement) {
    billingFields.set('billing-address1', billingAddress1);
  }

  return {
    form,
    logger,
    listened,
    ctx: {
      form,
      fields,
      billingFields,
      logger: logger as unknown as Logger,
      eventBus: EventBus.getInstance(),
      listen: (target, type, handler) => {
        listened.push({ type, target });
        target.addEventListener(type, handler as EventListener);
      },
    },
  };
}

const SHIPPING_ROWS =
  '<div data-next-component="location" id="rows"><input /></div>';
const BILLING_ROWS =
  '<div data-next-component="billing-location" id="brows"><input /></div>';

function rows(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

beforeEach(() => {
  document.body.innerHTML = '';
  useCheckoutStore.getState().reset();
});

// ─── Starting state ───────────────────────────────────────────────────────────

describe('initialize: what the shopper sees first', () => {
  it('hides both sets of rows when no address exists yet', () => {
    const { ctx } = createCtx(SHIPPING_ROWS + BILLING_ROWS);

    createLocationFieldVisibility(ctx).initialize();

    expect(rows('rows').style.display).toBe('none');
    expect(rows('rows').classList.contains('next-location-hidden')).toBe(true);
    expect(rows('brows').style.display).toBe('none');
  });

  it('reveals the shipping rows straight away when the address input already has a value', () => {
    const { ctx } = createCtx(
      SHIPPING_ROWS + '<input data-field="address1" value="10 Downing St" />'
    );

    createLocationFieldVisibility(ctx).initialize();

    expect(rows('rows').style.display).toBe('flex');
    expect(rows('rows').classList.contains('next-location-hidden')).toBe(false);
  });

  it('reveals the shipping rows when only the store holds the address', () => {
    useCheckoutStore.getState().updateFormData({ address1: '10 Downing St' });
    const { ctx } = createCtx(SHIPPING_ROWS);

    createLocationFieldVisibility(ctx).initialize();

    expect(rows('rows').style.display).toBe('flex');
  });

  it('reveals the billing rows when the billing address input already has a value', () => {
    const { ctx } = createCtx(
      BILLING_ROWS +
        '<input data-field="billing-address1" value="1 Billing Way" />'
    );

    createLocationFieldVisibility(ctx).initialize();

    expect(rows('brows').style.display).toBe('flex');
  });

  it('says so in the log when a page has no location rows at all', () => {
    const { ctx, logger } = createCtx('');

    createLocationFieldVisibility(ctx).initialize();

    expect(logger.debug).toHaveBeenCalledWith(
      'No shipping location elements found'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'No billing location elements found'
    );
  });

  // DEFECT (left as found): billing values live on `checkoutStore.billingAddress` under
  // API names (`address1`), never on `formData['billing-address1']` — nothing in the SDK
  // writes that key. So this store-side check for billing can never be true, and the
  // billing rows are revealed only because `restoreBillingAddress` has already put the
  // value into the input by the time this runs. Remove that ordering and a returning
  // shopper's billing city/state/postcode stay hidden.
  it('DEFECT: the billing store check reads a key nothing ever writes', () => {
    useCheckoutStore.getState().setBillingAddress({
      first_name: '',
      last_name: '',
      address1: '1 Billing Way',
      city: '',
      province: '',
      postal: '',
      country: 'US',
      phone: '',
    });
    const { ctx } = createCtx(BILLING_ROWS);

    createLocationFieldVisibility(ctx).initialize();

    expect(rows('brows').style.display).toBe('none');
  });
});

// ─── Reacting to the shopper ──────────────────────────────────────────────────

describe('reacting to an address being typed', () => {
  it('reveals the rows on input, change and blur', () => {
    const { ctx, listened } = createCtx(
      SHIPPING_ROWS + '<input data-field="address1" />'
    );
    createLocationFieldVisibility(ctx).initialize();

    expect(listened.map(l => l.type)).toEqual(['input', 'change', 'blur']);

    const address = ctx.fields.get('address1') as HTMLInputElement;
    address.value = '10 Downing St';
    address.dispatchEvent(new Event('input'));

    expect(rows('rows').style.display).toBe('flex');
  });

  it('does nothing while the address is only whitespace', () => {
    const { ctx } = createCtx(
      SHIPPING_ROWS + '<input data-field="address1" />'
    );
    createLocationFieldVisibility(ctx).initialize();

    const address = ctx.fields.get('address1') as HTMLInputElement;
    address.value = '   ';
    address.dispatchEvent(new Event('input'));

    expect(rows('rows').style.display).toBe('none');
  });

  it('announces the reveal once, on the bus and on the form', () => {
    const { ctx, form } = createCtx(SHIPPING_ROWS);
    const onBus = vi.fn();
    const onForm = vi.fn();
    const unsubscribe = EventBus.getInstance().on(
      'checkout:location-fields-shown',
      onBus
    );
    form.addEventListener('checkout:location-fields-shown', onForm);

    const visibility = createLocationFieldVisibility(ctx);
    visibility.initialize();
    visibility.showLocationFields();
    visibility.showLocationFields();

    expect(onBus).toHaveBeenCalledTimes(1);
    expect(onForm).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('keeps the shipping and billing latches apart', () => {
    const { ctx } = createCtx(SHIPPING_ROWS + BILLING_ROWS);
    const visibility = createLocationFieldVisibility(ctx);
    visibility.initialize();

    visibility.showLocationFields();

    expect(rows('rows').style.display).toBe('flex');
    expect(rows('brows').style.display).toBe('none');
  });

  it('does nothing before initialize, so an early store update cannot half-open the form', () => {
    const { ctx } = createCtx(SHIPPING_ROWS);

    createLocationFieldVisibility(ctx).showLocationFields();

    expect(rows('rows').style.display).toBe('');
  });

  // DEFECT (left as found): revealing a row forces `display: flex`, whatever the page had.
  // A location row laid out as a grid or a plain block is re-laid-out as a flex row the
  // moment the shopper types an address, so the city/state/postcode fields can jump into
  // a different arrangement than the rest of the form.
  it('DEFECT: forces display:flex regardless of the page layout', () => {
    const { ctx } = createCtx(
      '<div data-next-component="location" id="rows" style="display: grid"></div>'
    );
    const visibility = createLocationFieldVisibility(ctx);
    visibility.initialize();

    visibility.showLocationFields();

    expect(rows('rows').style.display).toBe('flex');
  });

  // DEFECT (left as found): the shipping rows are found under either
  // `data-next-component="location"` or `data-next-component-location="location"`, but the
  // billing rows only under `data-next-component="billing-location"`. A page that spells
  // its billing rows the second way is silently never managed — they stay visible from
  // first paint while the shipping ones collapse.
  it('DEFECT: the second spelling is accepted for shipping rows but not billing ones', () => {
    const { ctx } = createCtx(
      '<div data-next-component-location="location" id="rows"></div>' +
        '<div data-next-component-location="billing-location" id="brows"></div>'
    );

    createLocationFieldVisibility(ctx).initialize();

    expect(rows('rows').style.display).toBe('none');
    expect(rows('brows').style.display).toBe('');
  });
});
