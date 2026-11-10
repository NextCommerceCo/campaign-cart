import { showField } from '../form/errors';
import { fieldControl, option } from '../form/fields';
import { cardText } from '../form/texts';

function monthNames(locale: string): string[] {
  const names = (tag: string) => {
    const format = new Intl.DateTimeFormat(tag, { month: 'long', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, i) => format.format(new Date(Date.UTC(2000, i, 1))));
  };
  try {
    return names(locale);
  } catch {
    return names('en');
  }
}

/** `card.expiry` as typed: "MM/YY", "MM / YY" or "MM/YYYY". */
export function parseExpiry(text: string): { month: string; year: string } | undefined {
  const match = /^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/.exec(text);
  const month = Number(match?.[1]);
  if (!match || month < 1 || month > 12) return undefined;
  return { month: String(month).padStart(2, '0'), year: match[2]!.length === 2 ? `20${match[2]}` : match[2]! };
}

function fillSelects(month: HTMLSelectElement | null, year: HTMLSelectElement | null, locale: string): void {
  if (month && month.options.length <= 1) {
    month.append(
      ...monthNames(locale).map((m, i) =>
        option(`(${String(i + 1).padStart(2, '0')}) ${m}`, String(i + 1).padStart(2, '0')),
      ),
    );
  }
  if (year && year.options.length <= 1) {
    const now = new Date().getFullYear();
    year.append(...Array.from({ length: 20 }, (_, i) => option(String(now + i), String(now + i))));
  }
}

export interface Expiry {
  month(): string;
  year(): string;
  /** Adds the expiry's problems to `errors` under `month` / `year`. */
  check(errors: Map<string, string>): void;
  render(errors: Map<string, string>): void;
  /** Calls `fn` with the error keys a change clears. */
  onChange(fn: (cleared: string[]) => void): void;
}

/** The card's expiry: the `exp-month` + `exp-year` selects, or one `card.expiry` text input. */
export function bindExpiry(form: HTMLFormElement, locale = 'en'): Expiry {
  const text = fieldControl<HTMLInputElement>(form, 'cc-expiry');
  const month = text ? null : fieldControl<HTMLSelectElement>(form, 'exp-month', 'cc-month');
  const year = text ? null : fieldControl<HTMLSelectElement>(form, 'exp-year', 'cc-year');
  fillSelects(month, year, locale);
  const typed = () => (text ? parseExpiry(text.value) : undefined);
  const monthOf = () => (text ? (typed()?.month ?? '') : (month?.value ?? ''));
  const yearOf = () => (text ? (typed()?.year ?? '') : (year?.value ?? ''));

  return {
    month: monthOf,
    year: yearOf,
    check(errors) {
      const now = new Date();
      if (text && !typed()) errors.set('month', cardText('expiry'));
      if (!text && !monthOf()) errors.set('month', cardText('month'));
      if (!text && !yearOf()) errors.set('year', cardText('year'));
      const [m, y] = [Number(monthOf()), Number(yearOf())];
      const past = y === now.getFullYear() ? m < now.getMonth() + 1 : !!text && y < now.getFullYear();
      if (monthOf() && yearOf() && past) errors.set('month', cardText('expired'));
    },
    render(errors) {
      if (text) {
        const problems = [errors.get('month'), errors.get('year')].filter(Boolean);
        showField(text, 'expiry', problems.length ? 'error' : 'neutral', problems.join('. '));
        return;
      }
      for (const [el, field] of [
        [month, 'month'],
        [year, 'year'],
      ] as const) {
        if (el) showField(el, field, errors.has(field) ? 'error' : 'neutral', errors.get(field));
      }
    },
    onChange(fn) {
      month?.addEventListener('change', () => fn(['month']));
      year?.addEventListener('change', () => fn(['year']));
      text?.addEventListener('input', () => fn(['month', 'year']));
    },
  };
}
