import type { Engine } from '../engine/engine';

export interface ExitIntentOptions {
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
const POPUP = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000000;max-width:90vw;max-height:90vh;overflow:auto';
const CLOSE = 'position:absolute;top:10px;right:10px;background:none;border:0;font-size:30px;line-height:1;cursor:pointer;color:#666';

export function exitIntent(engine: Engine, options: ExitIntentOptions): () => void {
  const o = { showCloseButton: false, overlayClosable: true, imageClickable: true, maxTriggers: 1, disableOnMobile: true, ...options };
  const detail = { imageUrl: o.image, template: o.template };
  const emit = (name: 'shown' | 'clicked' | 'dismissed' | 'closed' | 'action', extra: object = {}) =>
    engine.events.emit(`exit-intent.${name}`, { ...detail, ...extra });
  const mobile = matchMedia('(pointer: coarse)').matches;
  if (mobile && o.disableOnMobile && !o.mobileScrollTrigger) return () => {};

  let open: HTMLElement[] = [];
  const close = (event?: 'dismissed' | 'closed') => {
    open.forEach((el) => el.remove());
    open = [];
    document.removeEventListener('keydown', onKey);
    if (event) emit(event);
  };
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close('dismissed');

  const show = () => {
    const shown = engine.readSession<number>('exit-intent') ?? 0;
    if (open.length || shown >= o.maxTriggers) return;
    engine.writeSession('exit-intent', shown + 1);

    const overlay = Object.assign(document.createElement('div'), { className: 'exit-intent-overlay' });
    overlay.dataset.exitIntent = 'overlay';
    overlay.style.cssText = OVERLAY;
    const popup = Object.assign(document.createElement('div'), { className: 'exit-intent-popup' });
    popup.dataset.exitIntent = 'popup';
    popup.style.cssText = POPUP;

    const template = o.template && document.querySelector<HTMLTemplateElement>(`template[data-template="${o.template}"]`);
    if (template) {
      popup.classList.add('exit-intent-template-popup');
      popup.append(template.content.cloneNode(true));
      popup.querySelectorAll<HTMLElement>('[data-exit-intent-action]').forEach((button) =>
        button.addEventListener('click', async () => {
          const action = button.dataset.exitIntentAction;
          const couponCode = button.dataset.couponCode;
          if (action === 'apply-coupon' && couponCode) await engine.applyCoupon(couponCode);
          if (action === 'custom') await o.action?.();
          emit('action', { action, couponCode });
          close();
        }),
      );
    } else if (o.image) {
      const img = Object.assign(document.createElement('img'), { src: o.image, alt: '' });
      img.style.cssText = `display:block;max-width:100%;${o.imageClickable ? 'cursor:pointer' : ''}`;
      if (o.imageClickable) {
        img.addEventListener('click', async () => {
          emit('clicked');
          await o.action?.();
          close();
        });
      }
      popup.append(img);
    } else {
      return console.warn('[next] exitIntent needs an image or a template');
    }

    if (o.showCloseButton) {
      const button = Object.assign(document.createElement('button'), { className: 'exit-intent-close', textContent: '×' });
      button.dataset.exitIntent = 'close';
      button.style.cssText = CLOSE;
      button.addEventListener('click', () => close('closed'));
      popup.append(button);
    }
    if (o.overlayClosable) overlay.addEventListener('click', () => close('dismissed'));
    document.addEventListener('keydown', onKey);
    document.body.append(overlay, popup);
    open = [overlay, popup];
    emit('shown');
  };

  const onLeave = (e: MouseEvent) => e.clientY <= 0 && !e.relatedTarget && show();
  let deepest = 0;
  const onScroll = () => {
    deepest = Math.max(deepest, scrollY);
    if (deepest > innerHeight * 0.3 && deepest - scrollY > 100) show();
  };
  if (mobile) addEventListener('scroll', onScroll, { passive: true });
  else document.addEventListener('mouseout', onLeave);

  return () => {
    close();
    document.removeEventListener('mouseout', onLeave);
    removeEventListener('scroll', onScroll);
  };
}
