import { describe, it, expect } from 'vitest';
import {
  scanExpirationFields,
  populateYearOptions,
  populateExpirationFields,
  type ExpirationFieldsContext,
} from '../expiration-fields';

// ─── populateYearOptions — the month→year rule ─────────────────────────────
//
// This is the module's reason to exist: a card expiring in a month that has
// already passed *this* year must expire next year or later. It is pure and
// takes `currentYear`/`currentMonth` explicitly, so these tests use fixed
// numbers instead of faking the clock.

describe('populateYearOptions — the month→year rule', () => {
  it('starts the list at next year once the selected month has already passed this year, otherwise at this year', () => {
    const yearField = document.createElement('select');

    populateYearOptions(yearField, 2026, 6, 3); // March already passed in June
    expect(yearField.options[1]?.value).toBe('2027');

    populateYearOptions(yearField, 2026, 6, 9); // September is still ahead
    expect(yearField.options[1]?.value).toBe('2026');

    populateYearOptions(yearField, 2026, 6); // no month chosen yet
    expect(yearField.options[1]?.value).toBe('2026');
  });

  it('clears the selected year when a later re-populate pushes it out of the offered range', () => {
    const yearField = document.createElement('select');
    populateYearOptions(yearField, 2026, 6);
    yearField.value = '2026';

    // Choosing a passed month shifts the list to start at 2027 — 2026 is no
    // longer an option, so the stale selection must not survive.
    populateYearOptions(yearField, 2026, 6, 3);

    expect(yearField.value).toBe('');
  });

  it('preserves a selected year that is still within the offered range', () => {
    const yearField = document.createElement('select');
    populateYearOptions(yearField, 2026, 6);
    yearField.value = '2030';

    // Still-ahead month — the range does not shift, so 2030 remains valid.
    populateYearOptions(yearField, 2026, 6, 9);

    expect(yearField.value).toBe('2030');
  });

  it('renders a disabled, hidden, empty-valued placeholder followed by exactly 20 real years', () => {
    const yearField = document.createElement('select');
    populateYearOptions(yearField, 2026, 6);

    const placeholder = yearField.options[0];
    expect(placeholder.value).toBe('');
    expect(placeholder.disabled).toBe(true);
    expect(placeholder.hidden).toBe(true);

    const realOptions = Array.from(yearField.options).slice(1);
    expect(realOptions).toHaveLength(20);
    expect(realOptions[0]?.value).toBe('2026');
    expect(realOptions[19]?.value).toBe('2045');
  });
});

// ─── populateExpirationFields ──────────────────────────────────────────────

describe('populateExpirationFields', () => {
  it('offers all 12 months as "(01) January" … "(12) December", plus a placeholder', () => {
    const monthField = document.createElement('select');
    const yearField = document.createElement('select');
    const ctx: ExpirationFieldsContext = {
      fields: new Map([
        ['cc-month', monthField],
        ['cc-year', yearField],
      ]),
    };

    populateExpirationFields(ctx);

    expect(monthField.options).toHaveLength(13);
    const placeholder = monthField.options[0];
    expect(placeholder.value).toBe('');
    expect(placeholder.disabled).toBe(true);
    expect(placeholder.hidden).toBe(true);

    expect(monthField.options[1]?.value).toBe('01');
    expect(monthField.options[1]?.textContent).toBe('(01) January');
    expect(monthField.options[12]?.value).toBe('12');
    expect(monthField.options[12]?.textContent).toBe('(12) December');
  });

  it('changing the month re-populates the year list start (month → year wiring)', () => {
    const monthField = document.createElement('select');
    const yearField = document.createElement('select');
    const ctx: ExpirationFieldsContext = {
      fields: new Map([
        ['cc-month', monthField],
        ['cc-year', yearField],
      ]),
    };

    populateExpirationFields(ctx);

    // Mirror the module's own rule to get a clock-independent expectation —
    // this test is about the *wiring* (does a month change reach the year
    // list at all), not the rule itself, which is already covered above.
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const pastMonth = currentMonth > 1 ? currentMonth - 1 : 12;
    const expectedStartYear =
      pastMonth < currentMonth ? currentYear + 1 : currentYear;

    monthField.value = pastMonth.toString().padStart(2, '0');
    monthField.dispatchEvent(new Event('change'));

    expect(yearField.options[1]?.value).toBe(expectedStartYear.toString());
  });

  it('does not throw when the month and year fields are absent from the map', () => {
    const ctx: ExpirationFieldsContext = { fields: new Map() };

    expect(() => populateExpirationFields(ctx)).not.toThrow();
  });
});

// ─── scanExpirationFields ───────────────────────────────────────────────────

describe('scanExpirationFields', () => {
  it('files a field under the name it declares, and one declaring neither name under the cc- fallback', () => {
    const monthEl = document.createElement('select');
    monthEl.setAttribute('data-next-checkout-field', 'exp-month');
    document.body.appendChild(monthEl);

    const yearEl = document.createElement('select');
    yearEl.id = 'credit_card_exp_year'; // no data-next-checkout-field / os-checkout-field
    document.body.appendChild(yearEl);

    const ctx: ExpirationFieldsContext = { fields: new Map() };
    scanExpirationFields(ctx);

    expect(ctx.fields.get('exp-month')).toBe(monthEl);
    expect(ctx.fields.has('cc-month')).toBe(false);
    expect(ctx.fields.get('cc-year')).toBe(yearEl);
  });

  it('never overwrites an entry already registered under the same name', () => {
    const originalMonthEl = document.createElement('select');
    const ctx: ExpirationFieldsContext = {
      fields: new Map([['cc-month', originalMonthEl]]),
    };

    const pageMonthEl = document.createElement('select');
    pageMonthEl.id = 'credit_card_exp_month';
    document.body.appendChild(pageMonthEl);

    scanExpirationFields(ctx);

    expect(ctx.fields.get('cc-month')).toBe(originalMonthEl);
  });

  // The test above covers the `cc-` fallback branch. This covers the `exp-` branch,
  // which has its own separate guard — removing that one left every test green until
  // this case existed.
  it('never overwrites an existing exp- entry either', () => {
    const originalMonthEl = document.createElement('select');
    const ctx: ExpirationFieldsContext = {
      fields: new Map([['exp-month', originalMonthEl]]),
    };

    const pageMonthEl = document.createElement('select');
    pageMonthEl.setAttribute('data-next-checkout-field', 'exp-month');
    document.body.appendChild(pageMonthEl);

    scanExpirationFields(ctx);

    expect(ctx.fields.get('exp-month')).toBe(originalMonthEl);
  });

  it('does not throw when the page has no expiry elements', () => {
    const ctx: ExpirationFieldsContext = { fields: new Map() };

    expect(() => scanExpirationFields(ctx)).not.toThrow();
    expect(ctx.fields.size).toBe(0);
  });
});

// ─── Listener lifecycle ───────────────────────────────────────────────────────

describe('month change listener lifecycle', () => {
  it('replaces the previous listener instead of stacking one per call', () => {
    const monthEl = document.createElement('select');
    monthEl.setAttribute('data-next-checkout-field', 'cc-month');
    const yearEl = document.createElement('select');
    yearEl.setAttribute('data-next-checkout-field', 'cc-year');
    document.body.append(monthEl, yearEl);

    const ctx: ExpirationFieldsContext = {
      fields: new Map<string, HTMLElement>([
        ['cc-month', monthEl],
        ['cc-year', yearEl],
      ]),
    };

    // Capture the AbortSignal each run registers its listener with.
    const signals: AbortSignal[] = [];
    const realAdd = monthEl.addEventListener.bind(monthEl);
    monthEl.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) => {
      if (type === 'change' && typeof options === 'object' && options?.signal) {
        signals.push(options.signal);
      }
      realAdd(type, listener, options);
    }) as typeof monthEl.addEventListener;

    // Three runs — a re-render used to leave three live listeners on the <select>.
    populateExpirationFields(ctx);
    populateExpirationFields(ctx);
    populateExpirationFields(ctx);

    // Asserted on the abort signals rather than by counting handler runs: a
    // `MutationObserver` fires on a microtask under happy-dom, so a synchronous
    // assertion sees nothing, and every stacked handler produces an identical year list
    // so the result is indistinguishable. The signals are the mechanism, and they are
    // deterministic.
    expect(signals).toHaveLength(3);
    const live = signals.filter(signal => !signal.aborted);
    expect(live).toHaveLength(1);
    // The surviving one is the newest, so the live handler closes over this run's
    // elements rather than a stale pair.
    expect(signals[2]?.aborted).toBe(false);
  });
});
