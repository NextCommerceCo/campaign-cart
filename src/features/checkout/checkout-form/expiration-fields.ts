/**
 * The credit-card expiry month and year dropdowns.
 *
 * A page author writes two empty `<select>` elements; the SDK fills them, and keeps the
 * year list consistent with the chosen month so a shopper cannot pick a date that has
 * already passed. That last part is the only non-obvious behaviour here and is why the two
 * dropdowns are handled together rather than independently — see
 * {@link populateYearOptions}.
 *
 * Extracted from `checkout-form.enhancer.ts` as the fourth cut out of that file. Needs two
 * things from the form ({@link ExpirationFieldsContext}) for ~155 lines, because it works
 * on the DOM and on one field map.
 */

/**
 * Where the month field may be declared. Checked in order, first match wins.
 *
 * Four spellings plus a bare id, because these fields predate the current attribute and
 * pages exist using each: the modern `data-next-checkout-field`, the legacy
 * `os-checkout-field`, both under two names (`cc-` and `exp-`), and
 * `#credit_card_exp_month` for pages that carry no SDK attribute at all.
 */
const MONTH_SELECTORS = [
  '[data-next-checkout-field="cc-month"]',
  '[data-next-checkout-field="exp-month"]',
  '[os-checkout-field="cc-month"]',
  '[os-checkout-field="exp-month"]',
  '#credit_card_exp_month',
];

/** Where the year field may be declared. Same reasoning as {@link MONTH_SELECTORS}. */
const YEAR_SELECTORS = [
  '[data-next-checkout-field="cc-year"]',
  '[data-next-checkout-field="exp-year"]',
  '[os-checkout-field="cc-year"]',
  '[os-checkout-field="exp-year"]',
  '#credit_card_exp_year',
];

/** Shown in the month dropdown as `(01) January`, so both forms are readable. */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** How many years ahead the year dropdown offers. */
const YEARS_AHEAD = 20;

/**
 * Aborts the month `change` listener from a previous {@link populateExpirationFields} run.
 *
 * Module-level rather than in the context because there is exactly one expiry pair per
 * page — the checkout form is a singleton on a checkout page — and threading it through
 * the context would put a detail of this module into the enhancer's field list for no gain.
 */
let monthChangeAbort: AbortController | null = null;

/**
 * What this module needs from the checkout form: the field map, and nothing else.
 *
 * Deliberately no `logger` — none of these functions log, and the originals did not
 * either. A context field nothing reads is a false claim about what this module is coupled
 * to.
 */
export interface ExpirationFieldsContext {
  /**
   * Checkout fields by name. This module both reads and writes it:
   * {@link scanExpirationFields} registers whichever expiry elements it finds, and
   * {@link populateExpirationFields} reads them back out.
   */
  fields: Map<string, HTMLElement>;
}

/** First element matching any of `selectors`, or `null` when the page has none. */
function findFirst(selectors: string[]): HTMLElement | null {
  return (selectors
    .map(selector => document.querySelector(selector))
    .find(element => element !== null) ?? null) as HTMLElement | null;
}

/**
 * Registers the expiry fields under the name the page actually used.
 *
 * The two accepted names are kept apart rather than normalised: `exp-month` wins when the
 * element declares it, otherwise the element is filed as `cc-month`. Validation and the
 * order payload look the field up by name, so collapsing them here would break whichever
 * name the rest of the code was not expecting.
 *
 * Existing entries are never overwritten — an element registered by the main field scan
 * takes precedence over one found by the id fallback.
 */
export function scanExpirationFields(ctx: ExpirationFieldsContext): void {
  const monthField = findFirst(MONTH_SELECTORS);
  const yearField = findFirst(YEAR_SELECTORS);

  if (monthField) {
    const hasExpMonth =
      monthField.getAttribute('data-next-checkout-field') === 'exp-month' ||
      monthField.getAttribute('os-checkout-field') === 'exp-month';

    if (hasExpMonth && !ctx.fields.has('exp-month')) {
      ctx.fields.set('exp-month', monthField);
    } else if (
      !hasExpMonth &&
      !ctx.fields.has('cc-month') &&
      !ctx.fields.has('exp-month')
    ) {
      ctx.fields.set('cc-month', monthField);
    }
  }

  if (yearField) {
    const hasExpYear =
      yearField.getAttribute('data-next-checkout-field') === 'exp-year' ||
      yearField.getAttribute('os-checkout-field') === 'exp-year';

    if (hasExpYear && !ctx.fields.has('exp-year')) {
      ctx.fields.set('exp-year', yearField);
    } else if (
      !hasExpYear &&
      !ctx.fields.has('cc-year') &&
      !ctx.fields.has('exp-year')
    ) {
      ctx.fields.set('cc-year', yearField);
    }
  }
}

/**
 * Fills the year dropdown, starting from the earliest year the chosen month can still be
 * valid in.
 *
 * This is the rule that makes the pair work together: a card expiring in a month that has
 * already passed *this* year must expire next year or later. So picking March in June
 * shifts the year list to start at next year, and the currently selected year is dropped
 * if it is no longer offered. Without this a shopper can assemble an already-expired date
 * that the form accepts and the gateway rejects.
 *
 * @param currentMonth 1–12, not the `0`-based value `Date.getMonth()` returns.
 * @param selectedMonth The month now chosen, when the shopper has chosen one.
 */
export function populateYearOptions(
  yearField: HTMLSelectElement,
  currentYear: number,
  currentMonth: number,
  selectedMonth?: number
): void {
  const savedValue = yearField.value;
  yearField.innerHTML = '';

  // `hidden` as well as `disabled` so the prompt is not offered in the open list.
  const yearPlaceholder = document.createElement('option');
  yearPlaceholder.value = '';
  yearPlaceholder.textContent = 'Year';
  yearPlaceholder.disabled = true;
  yearPlaceholder.selected = true;
  yearPlaceholder.hidden = true;
  yearField.appendChild(yearPlaceholder);

  let startYear = currentYear;
  if (selectedMonth && selectedMonth < currentMonth) {
    startYear = currentYear + 1;
  }

  for (let i = 0; i < YEARS_AHEAD; i++) {
    const year = startYear + i;
    const option = document.createElement('option');
    option.value = year.toString();
    option.textContent = year.toString();
    yearField.appendChild(option);
  }

  // Keep the shopper's year if it is still on offer; clear it if the month change pushed
  // it out of range, rather than leaving a selection that no longer exists in the list.
  //
  // Matched by scanning the options rather than `querySelector(\`option[value="…"]\`)`:
  // interpolating the value into a selector is a latent crash, because a value containing
  // a quote builds malformed CSS and a real browser throws `SyntaxError` from it (happy-dom
  // is lenient, so no test would have caught it). Nothing can currently put a quote in a
  // `<select>.value`, but the selector buys nothing over a plain comparison.
  if (savedValue) {
    const stillOffered = Array.from(yearField.options).some(
      option => option.value === savedValue && !option.disabled
    );
    yearField.value = stillOffered ? savedValue : '';
  }
}

/**
 * Fills both expiry dropdowns and wires the month → year dependency.
 *
 * All twelve months are always offered, including ones already past in the current year —
 * the year list is what narrows the choice, so a shopper picking a month first is never
 * blocked. Call after {@link scanExpirationFields} has registered the elements.
 */
export function populateExpirationFields(ctx: ExpirationFieldsContext): void {
  const monthField = ctx.fields.get('cc-month') ?? ctx.fields.get('exp-month');
  const yearField = ctx.fields.get('cc-year') ?? ctx.fields.get('exp-year');

  const now = new Date();
  const currentYear = now.getFullYear();
  // `getMonth()` is 0-based; every comparison here is in 1–12.
  const currentMonth = now.getMonth() + 1;

  if (monthField instanceof HTMLSelectElement) {
    monthField.innerHTML = '';

    const monthPlaceholder = document.createElement('option');
    monthPlaceholder.value = '';
    monthPlaceholder.textContent = 'Month';
    monthPlaceholder.disabled = true;
    monthPlaceholder.selected = true;
    monthPlaceholder.hidden = true;
    monthField.appendChild(monthPlaceholder);

    for (let i = 1; i <= 12; i++) {
      const month = i.toString().padStart(2, '0');
      const option = document.createElement('option');
      option.value = month;
      option.textContent = `(${month}) ${MONTH_NAMES[i - 1]}`;
      monthField.appendChild(option);
    }

    // Replaced, not stacked. `innerHTML = ''` above clears the options but leaves any
    // listener from a previous run attached to the `<select>` itself, so re-running this
    // (a re-render, a second boot) used to add another one each time — each closing over
    // the element references captured at *its* call. Same leak the billing animation had.
    monthChangeAbort?.abort();
    monthChangeAbort = new AbortController();

    monthField.addEventListener(
      'change',
      () => {
        if (yearField instanceof HTMLSelectElement) {
          const selectedMonth = parseInt(monthField.value);
          populateYearOptions(
            yearField,
            currentYear,
            currentMonth,
            selectedMonth
          );
        }
      },
      { signal: monthChangeAbort.signal }
    );
  }

  if (yearField instanceof HTMLSelectElement) {
    populateYearOptions(yearField, currentYear, currentMonth);
  }
}
