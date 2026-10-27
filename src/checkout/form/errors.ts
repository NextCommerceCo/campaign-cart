export const option = (text: string, value: string) =>
  Object.assign(document.createElement('option'), { textContent: text, value });

const WRAPPERS =
  '.form-group, .frm-flds, .form-input, .select-form-wrapper, .field-wrapper, .input-wrapper, .form-field';

const wrapperOf = (field: Element) => field.closest(WRAPPERS) ?? field.parentElement;

export function shown(el: Element): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node.hasAttribute('hidden') || getComputedStyle(node).display === 'none') return false;
  }
  return true;
}

export function showField(field: HTMLElement, name: string, state: 'error' | 'valid' | 'neutral', text = ''): void {
  const wrapper = wrapperOf(field);
  field.classList.toggle('has-error', state === 'error');
  field.classList.toggle('next-error-field', state === 'error');
  field.classList.toggle('no-error', state === 'valid');
  wrapper?.classList.toggle('addErrorIcon', state === 'error');
  wrapper?.classList.toggle('addTick', state === 'valid');
  if (state === 'error') field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');

  const host = field.closest('.form-group') ?? wrapper;
  let label = host?.querySelector<HTMLElement>(`.next-error-label[data-next-error-for="${name}"]`);
  if (state !== 'error') return label?.remove();
  if (!label && host) {
    label = Object.assign(document.createElement('div'), { className: 'next-error-label' });
    label.setAttribute('data-next-error-for', name);
    label.setAttribute('role', 'alert');
    label.setAttribute('aria-live', 'polite');
    host.append(label);
  }
  if (label && label.textContent !== text) label.textContent = text;
}

const spellings = (method: string) => [...new Set([method, method.replace(/_/g, '-'), method.replace(/-/g, '_')])];

export function errorBox(root: ParentNode, method: string): HTMLElement | null {
  const selected = root.querySelector('[data-next-payment-method].next-selected') ?? root;
  for (const scope of [selected, root]) {
    for (const name of [...spellings(method), 'credit']) {
      const box = scope.querySelector<HTMLElement>(`[data-next-component="${name}-error"]`);
      if (box) return box;
    }
  }
  return null;
}

export function showBox(box: HTMLElement, text: string | undefined): void {
  const target = box.querySelector<HTMLElement>('[data-next-component$="-error-text"]') ?? box;
  if (text) {
    if (target.textContent !== text) target.textContent = text;
    Object.assign(box.style, { display: 'flex', visibility: 'visible', opacity: '1' });
  } else box.style.display = 'none';
  box.classList.toggle('visible', !!text);
  box.classList.toggle('hidden', !text);
}
