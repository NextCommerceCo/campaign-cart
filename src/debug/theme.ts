export type Theme = 'light' | 'dark';

/** Draws `host` dark when `picked()` says so, or, with nothing picked, when the system is dark. */
export function followTheme(host: HTMLElement, picked: () => Theme | undefined): () => void {
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => host.classList.toggle('dark', (picked() ?? (scheme.matches ? 'dark' : 'light')) === 'dark');
  scheme.addEventListener('change', apply);
  apply();
  return apply;
}
