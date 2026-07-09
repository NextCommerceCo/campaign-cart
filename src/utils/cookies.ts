/**
 * Read a browser cookie by name. Returns the decoded value, or `null` when the
 * cookie is absent or `document` is unavailable (SSR/tests).
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const nameEQ = `${name}=`;
  for (const raw of document.cookie.split(';')) {
    const cookie = raw.trim();
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length));
    }
  }
  return null;
}
