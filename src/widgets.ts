const TOOLTIP_CSS = `.next-tooltip{position:fixed;top:0;left:0;z-index:99999;opacity:0;visibility:hidden;transition:opacity .2s ease,visibility .2s ease,transform .2s ease;transform:scale(.95);pointer-events:none}
.next-tooltip--visible{opacity:1;visibility:visible;transform:scale(1);pointer-events:auto}
.next-tooltip__content{background:#333;color:#fff;padding:8px 12px;border-radius:6px;font-size:13px;line-height:1.4;font-weight:400;text-align:center;word-wrap:break-word;box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:200px;white-space:normal}
.next-tooltip__arrow{position:absolute;width:8px;height:8px;background:#333;transform:rotate(45deg)}
@media (prefers-reduced-motion:reduce){.next-tooltip,.next-tooltip--visible{transition:opacity .1s ease,visibility .1s ease;transform:none}}`;

const GAP = 5;

function bindAccordion(container: HTMLElement): void {
  const id = container.getAttribute('data-next-accordion')!;
  const within = (attr: string) => [...container.querySelectorAll<HTMLElement>(`[${attr}="${id}"]`)];
  const triggers = within('data-next-accordion-trigger');
  const panels = within('data-next-accordion-panel');
  const texts = within('data-next-accordion-text');
  const toggleClass = container.getAttribute('data-toggle-class') || 'next-expanded';
  const openText = container.getAttribute('data-open-text') ?? 'Hide';
  const closeText = container.getAttribute('data-close-text') ?? 'Show';
  const duration = Number(container.getAttribute('data-animation-duration')) || 300;
  let open =
    container.getAttribute('data-initial-state') === 'open' ||
    [container, ...panels].some((el) => el.classList.contains(toggleClass));

  panels.forEach((panel, i) => {
    panel.id ||= `${id}-content${i ? `-${i}` : ''}`;
    panel.style.height = open ? 'auto' : '0px';
  });

  const render = () => {
    container.classList.toggle(toggleClass, open);
    for (const panel of panels) panel.classList.toggle(toggleClass, open);
    for (const text of texts) text.textContent = open ? openText : closeText;
    for (const trigger of triggers) trigger.setAttribute('aria-expanded', String(open));
  };

  const toggle = () => {
    open = !open;
    for (const panel of panels) {
      panel.style.height = `${panel.scrollHeight}px`;
      if (!open) requestAnimationFrame(() => (panel.style.height = '0px'));
      else setTimeout(() => open && (panel.style.height = 'auto'), duration);
    }
    render();
  };

  for (const trigger of triggers) {
    trigger.tabIndex = 0;
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('aria-controls', panels.map((p) => p.id).join(' '));
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    trigger.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggle();
    });
  }
  render();
}

function place(tip: HTMLElement, target: Element, offset: number): void {
  const rect = target.getBoundingClientRect();
  const { width, height } = tip.getBoundingClientRect();
  const below = rect.top - height - offset < GAP;
  const top = below ? rect.bottom + offset : rect.top - height - offset;
  const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, GAP), innerWidth - width - GAP);
  tip.dataset.placement = below ? 'bottom' : 'top';
  tip.style.transform = '';
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  const arrow = tip.querySelector<HTMLElement>('.next-tooltip__arrow')!;
  arrow.style.left = `${rect.left + rect.width / 2 - left - 4}px`;
  arrow.style.top = below ? '-4px' : '';
  arrow.style.bottom = below ? '' : '-4px';
}

function bindTooltip(target: HTMLElement): void {
  const delay = Number(target.getAttribute('data-next-tooltip-delay') ?? 500);
  const offset = Number(target.getAttribute('data-next-tooltip-offset') ?? 8);
  let tip: HTMLElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const show = () => {
    tip ??= Object.assign(document.createElement('div'), {
      className: `next-tooltip ${target.getAttribute('data-next-tooltip-class') ?? ''}`.trim(),
      role: 'tooltip',
    });
    const content = Object.assign(document.createElement('div'), {
      className: 'next-tooltip__content',
      textContent: target.getAttribute('data-next-tooltip') ?? '',
    });
    const maxWidth = target.getAttribute('data-next-tooltip-max-width');
    if (maxWidth) content.style.maxWidth = maxWidth;
    tip.replaceChildren(content, Object.assign(document.createElement('div'), { className: 'next-tooltip__arrow' }));
    document.body.append(tip);
    place(tip, target, offset);
    tip.classList.add('next-tooltip--visible');
  };
  const hide = () => {
    clearTimeout(timer);
    tip?.classList.remove('next-tooltip--visible');
    const leaving = tip;
    setTimeout(() => leaving && !leaving.classList.contains('next-tooltip--visible') && leaving.remove(), 200);
  };
  const later = (fn: () => void, ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };

  target.addEventListener('mouseenter', () => later(show, delay));
  target.addEventListener('focus', () => later(show, delay));
  target.addEventListener('mouseleave', () => later(hide, 150));
  target.addEventListener('blur', () => later(hide, 150));
  target.addEventListener('touchstart', () => (tip?.classList.contains('next-tooltip--visible') ? hide() : show()), {
    passive: true,
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hide());
}

const SCROLL_TARGETS = [
  '.cart-items__list',
  '[data-next-cart-items]',
  '[data-next-order-items]',
  '.order-items__list',
  '.scrollable-content',
];

function scrollTarget(hint: HTMLElement): HTMLElement | null {
  const selector = hint.getAttribute('data-next-scroll-target');
  if (selector) return document.querySelector<HTMLElement>(selector);
  const within = (scope: Element | null) =>
    scope && SCROLL_TARGETS.map((s) => scope.querySelector<HTMLElement>(s)).find(Boolean);
  return within(hint.parentElement) || within(hint.closest('.order-summary, .cart-items, .modal-content')) || null;
}

function bindScrollHint(hint: HTMLElement): void {
  const target = scrollTarget(hint);
  if (!target) return;
  const threshold = Number(hint.getAttribute('data-next-scroll-threshold') || 5);
  let frame = 0;
  const update = () => {
    frame = 0;
    const shown = target.scrollHeight > target.clientHeight && target.scrollTop <= threshold;
    hint.classList.toggle('cart-items__scroll-hint--active', shown);
    hint.setAttribute('aria-hidden', String(!shown));
  };
  const later = () => (frame ||= requestAnimationFrame(update));
  target.addEventListener('scroll', later, { passive: true });
  addEventListener('resize', later);
  new MutationObserver(later).observe(target, { childList: true, subtree: true, characterData: true });
  update();
}

export function bindWidgets(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-next-accordion]').forEach(bindAccordion);
  root.querySelectorAll<HTMLElement>('[data-next-component="scroll-hint"]').forEach(bindScrollHint);
  const tips = root.querySelectorAll<HTMLElement>('[data-next-tooltip]');
  if (tips.length && !document.getElementById('next-tooltip-styles')) {
    document.head.append(
      Object.assign(document.createElement('style'), { id: 'next-tooltip-styles', textContent: TOOLTIP_CSS }),
    );
  }
  tips.forEach(bindTooltip);
}
