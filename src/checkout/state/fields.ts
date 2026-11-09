import type { Context } from '../../engine/engine';
import type { Address, AddressType } from '../../engine/events/checkout';
import type { AddressSuggestion } from '../../engine/types';
import type { CheckoutActions } from './checkout';
import { publicAddress } from './order-body';
import { asciiDigits, countryOf, type createPhoneReads, PHONES, phoneChecked, phoneFieldOf, phoneKey } from './phone';
import { addressValid, fieldError, postcodeChecked, type RulesApi } from './rules';
import type { CheckoutState } from './types';

const checkoutOf = (ctx: Context) => ctx.getState().checkout!;
const setCheckout = (ctx: Context, patch: Partial<CheckoutState>) => ctx.update('checkout', patch);

const isCountry = (name: string) => name === 'country' || name === 'billing_country';

/** The checkout once `name` is `value`: a new country empties its state and forgets the phone read against the old one. */
function withField({ fields, phones, errors }: CheckoutState, name: string, value: string): Partial<CheckoutState> {
  const country = isCountry(name);
  const phone = country ? phoneFieldOf(name) : name;
  const forget =
    country || (PHONES.includes(name) && phoneKey(fields[name] ?? '') !== phoneKey(value)) ? phone : undefined;
  const { [name]: _, ...kept } = errors;
  if (country && kept[phone]?.warning) delete kept[phone];
  const { [forget ?? '']: __, ...read } = phones;
  return {
    fields: { ...fields, [name]: value, ...(country && !!fields[name] && { [name.replace('country', 'state')]: '' }) },
    errors: kept,
    phones: read,
  };
}

type ReadPhone = ReturnType<typeof createPhoneReads>;

export function announceAddresses(ctx: Context): void {
  const checkout = checkoutOf(ctx);
  for (const type of ['shipping', 'billing'] as const) {
    const prefix = type === 'billing' ? 'billing_' : '';
    if ((type === 'billing' && checkout.sameAsShipping) || !addressValid(checkout, prefix)) continue;
    const before = type === 'billing' ? checkout.billingAddress : checkout.shippingAddress;
    const address = publicAddress(checkout, prefix);
    if (JSON.stringify(address) === JSON.stringify(before)) continue;
    setCheckout(ctx, type === 'billing' ? { billingAddress: address } : { shippingAddress: address });
    ctx.emit(before ? 'address.updated' : 'address.entered', { ...address, type });
  }
}

async function verifyPostcode(ctx: Context, rulesApi: RulesApi): Promise<void> {
  const { fields } = checkoutOf(ctx);
  const value = fields.postcode?.trim();
  if (!fields.country || !value) return;
  try {
    const sent = { postcode: value, ...(fields.state && { state: fields.state }) };
    const result = (await rulesApi.validate(fields.country, sent)).postcode;
    const errors = postcodeChecked(checkoutOf(ctx), fields, result);
    if (errors) setCheckout(ctx, { errors });
  } catch {}
}

export async function checkPhone(ctx: Context, readPhone: ReadPhone, name: string, warn = false): Promise<void> {
  const country = countryOf(checkoutOf(ctx).fields, name);
  const typed = asciiDigits(checkoutOf(ctx).fields[name]?.trim() ?? '');
  if (!country || !typed) return;
  const patch = phoneChecked(checkoutOf(ctx), name, country, typed, await readPhone(country, typed), warn);
  if (patch) setCheckout(ctx, patch);
}

function rewritePhone(ctx: Context, name: string): void {
  const { fields, phones } = checkoutOf(ctx);
  const read = phones[name];
  const written = read && (read.country === countryOf(fields, name) ? read.national : read.international);
  if (written && written !== fields[name]) setCheckout(ctx, { fields: { ...fields, [name]: written } });
}

function autofilled(type: AddressType, address: AddressSuggestion['address']) {
  const filled: Partial<Address> = {
    line1: address.line1,
    city: address.city,
    postcode: address.postcode,
    country: address.country_code,
    state: address.state_code,
  };
  return { ...Object.fromEntries(Object.entries(filled).filter(([, value]) => value)), type };
}

interface Form {
  isOpen: () => boolean;
  phone: (name: string, warn?: boolean) => Promise<void>;
  announce: () => void;
  saveContact: () => Promise<void>;
  loadCountry: (country: string) => Promise<unknown>;
}

type FieldActions = 'setField' | 'leave' | 'readPhone' | 'writePhone' | 'setSameAsShipping' | 'autofill';

/** What the shopper types, leaves and picks in the form's fields. */
export function fieldActions(ctx: Context, rulesApi: RulesApi, form: Form): Pick<CheckoutActions, FieldActions> {
  const state = () => checkoutOf(ctx);
  const set = (patch: Partial<CheckoutState>) => setCheckout(ctx, patch);
  const { phone, announce } = form;
  return {
    setField(name, value) {
      if (state().status === 'placed' || state().fields[name] === value) return;
      set(withField(state(), name, value));
      if (isCountry(name)) void form.loadCountry(value).then(() => phone(phoneFieldOf(name), true).then(announce));
    },
    async leave(name) {
      const { fields, rules } = state();
      const code = fieldError(name, fields[name] ?? '', false, rules[countryOf(fields, name) ?? '']);
      if (code) set({ errors: { ...state().errors, [name]: { code } } });
      if (PHONES.includes(name)) await phone(name, true);
      if (name === 'postcode' || name === 'state') await verifyPostcode(ctx, rulesApi);
      announce();
      await form.saveContact();
    },
    readPhone: (name) => phone(name),
    writePhone: (name) => rewritePhone(ctx, name),
    setSameAsShipping(same) {
      if (same === state().sameAsShipping) return;
      set({ sameAsShipping: same });
      if (!same && !state().fields.billing_country && state().fields.country) {
        set({ fields: { ...state().fields, billing_country: state().fields.country! } });
      }
      announce();
    },
    autofill(type, { address }) {
      if (form.isOpen()) ctx.emit('address.autofilled', autofilled(type, address));
    },
  };
}
