import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindLabels } from '../../../src/checkout/form/labels';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('checkout form labels', () => {
  it('re-reads a field autofill filled without an event, and stops once the form has left the page', () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<form><div class="form-group">
      <label class="label-checkout">Email</label>
      <input data-next-checkout-field="email">
    </div></form>`;
    const form = document.querySelector('form')!;
    const label = form.querySelector('label')!;
    const field = form.querySelector('input')!;
    bindLabels(form);
    expect(label.classList.contains('has-value')).toBe(false);

    field.value = 'jane@example.com';
    vi.advanceTimersByTime(500);
    expect(label.classList.contains('has-value')).toBe(true);

    form.remove();
    field.value = '';
    vi.advanceTimersByTime(500);
    expect(vi.getTimerCount()).toBe(1);
    expect(label.classList.contains('has-value')).toBe(true);
  });
});
