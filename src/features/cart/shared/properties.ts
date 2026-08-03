/**
 * Parses a `data-next-exclude-property` attribute value into a usable exclude rule:
 *   - `"*"` → `'all'` (exclude everything)
 *   - `"team, number"` → `Set { "team", "number" }` (exclude specific keys)
 *   - null/empty → `undefined` (exclude nothing)
 */
export function parseExcludeProperty(attr: string | null | undefined): Set<string> | 'all' | undefined {
  if (!attr) return undefined;
  const trimmed = attr.trim();
  if (!trimmed) return undefined;
  if (trimmed === '*') return 'all';
  const keys = trimmed.split(',').map(s => s.trim()).filter(Boolean);
  return keys.length > 0 ? new Set(keys) : undefined;
}

/**
 * Filters a merged properties object by an exclude rule produced by
 * `parseExcludeProperty`. Returns `undefined` when the result is empty or all
 * keys are excluded.
 */
export function applyPropertyExclusion(
  properties: Record<string, string> | undefined,
  exclude: Set<string> | 'all' | undefined,
): Record<string, string> | undefined {
  if (!exclude || !properties) return properties;
  if (exclude === 'all') return undefined;
  const result = Object.fromEntries(Object.entries(properties).filter(([k]) => !(exclude as Set<string>).has(k)));
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Reads all `[data-next-default-property]` inputs on the page and returns
 * their current values. These are page-level defaults applied to every line
 * item, merged with (and overridden by) any per-item properties.
 */
export function collectDefaultProperties(): Record<string, string> {
  const result: Record<string, string> = {};
  document
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      '[data-next-default-property]',
    )
    .forEach(el => {
      const key = el.getAttribute('data-next-default-property');
      if (key && el.value) result[key] = el.value;
    });
  return result;
}

/** Merges page-level default properties with per-item properties (item overrides defaults). */
export function mergeWithDefaults(
  itemProperties: Record<string, string> | undefined,
): Record<string, string> | undefined {
  const defaults = collectDefaultProperties();
  const merged = { ...defaults, ...(itemProperties ?? {}) };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Attaches live `input` and `blur` listeners to all `[data-next-property]`
 * inputs within `containerEl`. On each keystroke the current value is written
 * into `properties` (or the key is removed when the field is cleared). On blur
 * the optional `onBlur` callback is called so the caller can sync the cart.
 *
 * The fields are the page author's, not the enhancer's, so `signal` is required
 * rather than optional: without it these listeners survived `destroy()` and
 * re-enhancing the same card stacked another set on top of the first (finding 169
 * in `docs/code-findings.md`). Pass the signal of a controller the calling enhancer
 * aborts from its `cleanupEventListeners()`.
 *
 * @example
 * // Inside an enhancer holding `private listenerAbort = new AbortController()`:
 * attachPropertyListeners(cardEl, card.properties, this.listenerAbort.signal, () =>
 *   void updateCartItemProperties(card)
 * );
 */
export function attachPropertyListeners(
  containerEl: HTMLElement,
  properties: Record<string, string>,
  signal: AbortSignal,
  onBlur?: () => void,
): void {
  containerEl
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input[data-next-property], textarea[data-next-property], select[data-next-property]',
    )
    .forEach(el => {
      const key = el.getAttribute('data-next-property');
      if (!key) return;
      el.addEventListener(
        'input',
        () => {
          if (el.value) {
            properties[key] = el.value;
          } else {
            delete properties[key];
          }
        },
        { signal },
      );
      if (onBlur) el.addEventListener('blur', onBlur, { signal });
    });
}
