/**
 * `SDKInitializer`'s `?reset=true` storage clearing — extracted verbatim from
 * `sdk-initializer.ts`. Not a boot step itself; runs from inside
 * `loadConfiguration`.
 */

import type { Logger } from '@/core/logger';

export async function clearAllStorage(ctx: { logger: Logger }): Promise<void> {
  ctx.logger.info('Clearing all Next Campaign Cart storage...');

  // Clear sessionStorage items
  const sessionKeys = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && (key.startsWith('next-') || key.startsWith('_next'))) {
      sessionKeys.push(key);
    }
  }
  sessionKeys.forEach(key => sessionStorage.removeItem(key));

  // Clear localStorage items
  const localKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('next-') || key.startsWith('_next'))) {
      localKeys.push(key);
    }
  }
  localKeys.forEach(key => localStorage.removeItem(key));

  // Clear cookies (only those we can access)
  document.cookie.split(';').forEach(cookie => {
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
    if (name.startsWith('next_') || name.startsWith('_next')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
    }
  });

  ctx.logger.info(
    `Cleared ${sessionKeys.length} sessionStorage items, ${localKeys.length} localStorage items`
  );
}
