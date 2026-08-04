import { describe, it, expect, afterEach } from 'vitest';
import { FormatValidator } from '../format-validator';
import { CurrencyFormatter } from '@/core/currency-formatter';
import { useCampaignStore } from '@/state/campaign';
import { useConfigStore } from '@/state/config';

/**
 * The validator exists to tell an author "you put `data-format="currency"` on something
 * that is not a price". It has to stay quiet about prices that are merely written in a
 * locale other than `en-US` — it used to match `$` and comma-thousands literally, so every
 * correctly-formatted European price looked like a mistake.
 */

function renderDisplay(
  value: string,
  format: string,
  formatAttr: 'data-next-format' | 'data-format' = 'data-next-format'
): HTMLElement {
  const el = document.createElement('span');
  el.setAttribute('data-next-display', 'cart.total');
  el.setAttribute(formatAttr, format);
  el.textContent = value;
  document.body.appendChild(el);
  return el;
}

/** Currency mismatches only — the report also carries a11y and performance notes. */
function currencyIssues(): unknown[] {
  return FormatValidator.validateAll().issues.filter(
    i => i.expectedFormat === 'currency'
  );
}

afterEach(() => {
  document.body.innerHTML = '';
  sessionStorage.removeItem('next_selected_locale');
  useConfigStore.setState({ locale: undefined });
  useCampaignStore.setState({ currency: null });
  CurrencyFormatter.clearCache();
});

describe('FormatValidator currency detection', () => {
  it.each([
    ['$69.99', 'a US price'],
    ['-$69.99', 'a negative US price'],
    ['€69.99', 'EUR written the US way'],
    ['69,99 €', 'EUR written the German way'],
    ['1.234,56 €', 'a German price above a thousand'],
    ['£69.99', 'a UK price'],
  ])('accepts %s (%s) as currency', value => {
    renderDisplay(value, 'currency');

    expect(currencyIssues()).toEqual([]);
  });

  it('accepts a German price when the campaign is pinned to de-DE', () => {
    useConfigStore.setState({ locale: 'de-DE' });
    useCampaignStore.setState({ currency: 'EUR' });
    CurrencyFormatter.clearCache();

    renderDisplay(CurrencyFormatter.formatCurrency(69.99, 'EUR'), 'currency');

    expect(currencyIssues()).toEqual([]);
  });

  it('accepts a German thousands-separated number', () => {
    renderDisplay('1.234,5', 'number');

    expect(
      FormatValidator.validateAll().issues.filter(
        i => i.expectedFormat === 'number'
      )
    ).toEqual([]);
  });

  it('still reports a value that genuinely is not a price', () => {
    // The validator has to keep earning its keep — a broadened pattern that matches
    // everything would be no better than deleting it.
    renderDisplay('Free shipping', 'currency');

    expect(currencyIssues()).toHaveLength(1);
  });

  it.each(['data-next-format', 'data-format'] as const)(
    'reads the requested format from %s',
    formatAttr => {
      // Regression: only the legacy `data-format` was read, so the validator was inert on
      // every page written with the current spelling — and every test that used it passed
      // for the wrong reason.
      renderDisplay('Free shipping', 'currency', formatAttr);

      expect(currencyIssues()).toHaveLength(1);
    }
  );
});
