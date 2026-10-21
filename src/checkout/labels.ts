type Field = HTMLInputElement | HTMLSelectElement;

const FIELD = ['data-next-checkout-field', 'os-checkout-field']
  .flatMap((a) => [`input[${a}]`, `select[${a}]`])
  .join(', ');

const filled = (field: Field) =>
  field instanceof HTMLSelectElement
    ? field.value !== '' && field.value !== field.querySelector('option')?.value
    : field.value.trim() !== '';

const placeholder = (field: Field): field is HTMLInputElement =>
  field instanceof HTMLInputElement && field.getAttribute('data-label-behavior') === 'placeholder';

function float(label: HTMLElement, field: Field, up: boolean, focused = false): void {
  const floating = label.classList.contains('has-value');
  if (up && !floating) {
    label.classList.add('has-value');
    field.style.paddingTop = '14px';
    if (placeholder(field)) {
      field.setAttribute('data-original-placeholder', field.placeholder);
      field.placeholder = '';
    }
  }
  if (up && focused) label.classList.add('is-focused');
  if (!up && floating) {
    label.classList.remove('has-value', 'is-focused');
    field.style.paddingTop = '';
    const original = field.getAttribute('data-original-placeholder');
    if (placeholder(field) && original !== null) field.placeholder = original;
  }
}

function update(label: HTMLElement, field: Field): void {
  const focused = placeholder(field) && document.activeElement === field;
  float(label, field, focused || filled(field), focused);
}

export function bindLabels(form: HTMLFormElement): () => void {
  const pairs: Array<[HTMLElement, Field]> = [];
  for (const group of form.querySelectorAll('.form-group')) {
    const label = group.querySelector<HTMLLabelElement>('label.label-checkout');
    const field = group.querySelector<Field>(FIELD);
    if (!label || !field) continue;
    pairs.push([label, field]);
    label.style.transition ||= 'all 0.15s ease-in-out';
    field.closest<HTMLElement>('.form-input')?.style.setProperty('position', 'relative');
    for (const type of ['input', 'change']) field.addEventListener(type, () => update(label, field));
    field.addEventListener('focus', () => float(label, field, placeholder(field) || filled(field), placeholder(field)));
    field.addEventListener('blur', () => update(label, field));
  }
  const all = () => pairs.forEach(([label, field]) => update(label, field));
  if (pairs.length) {
    const timer = setInterval(() => (form.isConnected ? all() : clearInterval(timer)), 500);
  }
  all();
  return all;
}
