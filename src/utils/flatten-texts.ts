/**
 * i18next JSON, nested or already flat, as one text per dotted key:
 * `{ field: { email: { label: 'Email' } } }` → `{ 'field.email.label': 'Email' }`.
 * A value that is neither a string nor an object is dropped.
 */
export function flattenTexts(
  value: unknown,
  prefix = ''
): Record<string, string> {
  const texts: Record<string, string> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return texts;
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === 'string') texts[path] = entry;
    else Object.assign(texts, flattenTexts(entry, path));
  }
  return texts;
}
