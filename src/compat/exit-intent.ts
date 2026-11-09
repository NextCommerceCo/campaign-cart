import type { Engine } from '../engine/engine';
import type { EventMap } from '../engine/events/bus';
import type { Promotion } from '../engine/events/promotions';
import {
  addLegacyEvents,
  type From,
  legacyEvent,
  legacyFire,
  type LegacyPopup,
  legacyRegistry,
} from './legacy/registry';

export interface ExitIntentOptions {
  id?: string;
  name?: string;
  image?: string;
  template?: string;
  action?: () => unknown;
  showCloseButton?: boolean;
  overlayClosable?: boolean;
  imageClickable?: boolean;
  maxTriggers?: number;
  disableOnMobile?: boolean;
  mobileScrollTrigger?: boolean;
}

const OVERLAY = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:999999';
const POPUP =
  'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000000;max-width:90vw;max-height:90vh;overflow:auto';
const CLOSE =
  'position:absolute;top:10px;right:10px;background:none;border:0;font-size:30px;line-height:1;cursor:pointer;color:#666';

const DEFAULTS = {
  showCloseButton: false,
  overlayClosable: true,
  imageClickable: true,
  maxTriggers: 1,
  disableOnMobile: true,
};

type Options = ExitIntentOptions & typeof DEFAULTS;
type Registry = ReturnType<typeof legacyRegistry>;
type Clickable = (el: HTMLElement, run: () => unknown, extra?: { action?: string; coupon_code?: string }) => void;

type PopupEvent = From<'promotion.viewed' | 'promotion.clicked' | 'promotion.closed'>;
type Clicked = EventMap['promotion.clicked'];
const closedFor = (reason: string) => (e: PopupEvent) => (e.data as EventMap['promotion.closed']).reason === reason;

/**
 * @deprecated The popup's 0.4.x `next.on` names, at the moments 0.4.43 sent them: `shown`, and every event of a
 * template popup, name the image and the template; an image popup's other events name the image only.
 * The popup's buttons send `exit-intent:action`.
 */
function exitEvents(popups: Record<string, LegacyPopup>) {
  const popupOf = ({ data }: PopupEvent) => (data.type === 'exit_intent' ? popups[data.id] : undefined);
  const exit = (from: PopupEvent['name'], when: (e: PopupEvent) => boolean, both?: boolean) =>
    legacyEvent<PopupEvent['name']>({
      from: [from],
      when: (e) => !!popupOf(e) && when(e),
      data: (e) => {
        const { imageUrl, template } = popupOf(e)!;
        return both || template ? { imageUrl, template } : { imageUrl };
      },
    });
  return {
    'exit-intent:shown': exit('promotion.viewed', () => true, true),
    'exit-intent:clicked': exit('promotion.clicked', (e) => !(e.data as Clicked).action),
    'exit-intent:dismissed': exit('promotion.closed', closedFor('dismissed')),
    'exit-intent:closed': exit('promotion.closed', closedFor('close_button')),
  };
}

const actionFailed = (engine: Engine, err: unknown) => engine.log.error('exitIntent action failed', err);

function layer(className: string, role: string, css: string): HTMLElement {
  const el = Object.assign(document.createElement('div'), { className });
  el.dataset.exitIntent = role;
  el.style.cssText = css;
  return el;
}

/** A template popup's `data-exit-intent-action` buttons: `close`, `apply-coupon` and `custom`. */
function bindActions(engine: Engine, registry: Registry, popup: HTMLElement, o: Options, clickable: Clickable): void {
  popup.querySelectorAll<HTMLElement>('[data-exit-intent-action]').forEach((button) => {
    const action = button.dataset.exitIntentAction;
    const couponCode = button.dataset.couponCode;
    const acted = (data: object) => legacyFire(engine, 'exit-intent:action', { action, ...data });
    const run = async () => {
      if (action === 'close') acted({});
      if (action === 'apply-coupon' && couponCode) {
        acted({ couponCode });
        void engine.cart.applyCoupon(couponCode).catch((err) => actionFailed(engine, err));
      }
      if (action === 'custom') {
        await o.action?.();
        acted({});
        registry.customAction?.();
      }
    };
    clickable(button, run, { action, coupon_code: couponCode });
  });
}

function image(o: Options, clickable: Clickable): HTMLImageElement {
  const img = Object.assign(document.createElement('img'), { src: o.image, alt: '' });
  img.style.cssText = `display:block;max-width:100%;${o.imageClickable ? 'cursor:pointer' : ''}`;
  if (o.imageClickable) clickable(img, () => o.action?.());
  return img;
}

function closeButton(onClick: () => void): HTMLButtonElement {
  const button = Object.assign(document.createElement('button'), {
    className: 'exit-intent-close',
    textContent: '×',
  });
  button.dataset.exitIntent = 'close';
  button.style.cssText = CLOSE;
  button.addEventListener('click', onClick);
  return button;
}

/** Calls `show` when the pointer leaves through the top of the page, or on mobile once the shopper scrolls back up. */
function onExit(mobile: boolean, show: () => void): () => void {
  const onLeave = (e: MouseEvent) => e.clientY <= 0 && !e.relatedTarget && show();
  let deepest = 0;
  const onScroll = () => {
    deepest = Math.max(deepest, scrollY);
    if (deepest > innerHeight * 0.3 && deepest - scrollY > 100) show();
  };
  if (mobile) addEventListener('scroll', onScroll, { passive: true });
  else document.addEventListener('mouseout', onLeave);
  return () => {
    document.removeEventListener('mouseout', onLeave);
    removeEventListener('scroll', onScroll);
  };
}

/**
 * @deprecated 0.4.x `next.exitIntent(options)`. The function it resolves to closes the popup, with no
 * `promotion.closed`, and stops it opening again.
 */
export function exitIntent(engine: Engine, options: ExitIntentOptions): () => void {
  const registry = legacyRegistry(engine);
  addLegacyEvents(engine, exitEvents(registry.popups));
  const o: Options = { ...DEFAULTS, ...options };
  if (!o.image && !o.template) {
    engine.log.warn('exitIntent needs an image or a template');
    return () => {};
  }
  const mobile = matchMedia('(pointer: coarse)').matches;
  if (mobile && o.disableOnMobile && !o.mobileScrollTrigger) return () => {};

  let open: HTMLElement[] = [];
  let promotion: Promotion;
  const close = (reason?: EventMap['promotion.closed']['reason']) => {
    if (!open.length) return;
    open.forEach((el) => el.remove());
    open = [];
    document.removeEventListener('keydown', onKey);
    if (reason) engine.events.emit('promotion.closed', { ...promotion, reason });
  };
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close('dismissed');

  const show = () => {
    const shown = engine.getState().visit.exitIntentShown;
    if (open.length || shown >= o.maxTriggers) return;

    const overlay = layer('exit-intent-overlay', 'overlay', OVERLAY);
    const popup = layer('exit-intent-popup', 'popup', POPUP);
    const template =
      o.template && document.querySelector<HTMLTemplateElement>(`template[data-template="${o.template}"]`);
    let clicked = false;
    const clickable: Clickable = (el, run, extra) =>
      el.addEventListener('click', async () => {
        if (clicked) return;
        clicked = true;
        engine.events.emit('promotion.clicked', { ...promotion, ...extra });
        try {
          await run();
        } catch (err) {
          actionFailed(engine, err);
        }
        if (open.includes(popup)) close('clicked');
      });
    if (template) {
      popup.classList.add('exit-intent-template-popup');
      popup.append(template.content.cloneNode(true));
      bindActions(engine, registry, popup, o, clickable);
    } else if (o.image) popup.append(image(o, clickable));
    else {
      engine.log.warn(`exitIntent template "${o.template}" is not on the page`);
      return;
    }
    promotion = {
      id: o.id ?? 'exit_intent',
      type: 'exit_intent',
      ...(o.name && { name: o.name }),
      creative: template ? o.template : o.image,
    };
    registry.popups[promotion.id] = { imageUrl: o.image ?? '', template: template ? o.template! : '' };

    if (o.showCloseButton) popup.append(closeButton(() => close('close_button')));
    if (o.overlayClosable) overlay.addEventListener('click', () => close('dismissed'));
    document.addEventListener('keydown', onKey);
    engine.visit.noteExitIntentShown();
    document.body.append(overlay, popup);
    open = [overlay, popup];
    engine.events.emit('promotion.viewed', promotion);
  };

  const stop = onExit(mobile, show);
  return () => {
    close();
    stop();
  };
}
