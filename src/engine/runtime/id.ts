/** A UUID v4 as 32 lowercase hex digits, the form campaigns-app accepts for its session ids. */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID().replaceAll('-', '');
  // randomUUID needs a secure context; a page on plain http still has getRandomValues.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
