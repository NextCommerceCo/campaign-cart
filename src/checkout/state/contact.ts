import type { CartActions } from '../../engine/cart/cart';
import type { Context } from '../../engine/engine';
import type { User } from '../../engine/events/checkout';
import type { OpenCart } from '../../engine/types';
import { userOf } from './order-body';
import { phoneOf } from './phone';
import { validEmail } from './rules';
import type { CheckoutState } from './types';

/** What the shopper must have entered, with their name, to be saved as a lead: the form's `data-next-lead`. */
export type Lead = 'email' | 'phone' | 'email+phone' | 'off' | 'formStart';

type Entered = Omit<User, 'language' | 'ip' | 'user_agent'>;

export function createContact(ctx: Context, cart: CartActions, lead: Lead, isOpen: () => boolean) {
  const state = () => ctx.getState().checkout!;
  const set = (patch: Partial<CheckoutState>) => ctx.update('checkout', patch);
  let prospecting = false;

  const contactOf = (): Entered | undefined => {
    const { fields, phones } = state();
    const [email = '', first_name = '', last_name = ''] = ['email', 'first_name', 'last_name'].map(
      (n) => fields[n]?.trim() ?? '',
    );
    const phone = phoneOf(state(), 'phone_number');
    const hasEmail = validEmail(email);
    const hasPhone = !!phones.phone_number;
    const named = first_name.length >= 2 && last_name.length >= 2;
    const ready = {
      email: hasEmail && named,
      phone: hasPhone && named,
      'email+phone': hasEmail && hasPhone && named,
      off: false,
      formStart: !!(email || first_name || last_name || phone),
    }[lead];
    if (!ready) return;
    return {
      ...(hasEmail && { email }),
      first_name,
      last_name,
      ...(phone && { phone }),
      accepts_marketing: fields.accepts_marketing !== 'false',
    };
  };
  const contactKey = (entered?: Entered) => JSON.stringify(entered ?? null);
  const recorded = (stored?: OpenCart['user']): Pick<User, 'language' | 'ip' | 'user_agent'> => ({
    language: stored?.language || ctx.getState().campaign?.language || '',
    ...(stored?.ip && { ip: stored.ip }),
    user_agent: stored?.user_agent || ctx.getState().visit.landing?.device || '',
  });
  let contact = state().prospectSaved ? contactKey(contactOf()) : undefined;

  return async (): Promise<void> => {
    const now = contactOf();
    const campaign = ctx.getState().campaign;
    if (!isOpen() || !now || prospecting || !campaign) return;
    if (state().prospectSaved) {
      if (contactKey(now) === contact) return;
      contact = contactKey(now);
      const { language, ip, user_agent } = state().user ?? recorded();
      set({ user: { ...now, language, ...(ip && { ip }), user_agent } });
      ctx.emit('user.updated', state().user!);
      return;
    }
    prospecting = true;
    try {
      const saved = await ctx.api.createCart({
        lines: cart.lines(),
        user: userOf(state().fields, campaign.language, now.phone),
        currency: campaign.currency,
        attribution: ctx.attribution(),
      });
      set({ prospectSaved: true, openCart: saved, user: { ...now, ...recorded(saved.user) } });
      contact = contactKey(now);
      ctx.emit('user.created', state().user!);
    } catch (err) {
      ctx.fail('user.save', err);
    } finally {
      prospecting = false;
    }
  };
}
