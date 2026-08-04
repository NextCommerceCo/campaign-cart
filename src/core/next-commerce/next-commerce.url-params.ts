/**
 * `NextCommerce`'s URL Parameters category — extracted verbatim from
 * `next-commerce.ts`. Every function only reads instance state to log, so
 * each takes a bare `logger: Logger`.
 */

import { useParameterStore } from '@/state/parameter';
import type { Logger } from '@/core/logger';

/**
 * Sets one captured URL parameter for the rest of the session. Does not
 * touch the address bar.
 * @category URL Parameters
 */
export function setParam(logger: Logger, key: string, value: string): void {
  const paramStore = useParameterStore.getState();
  paramStore.updateParam(key, value);
  logger.debug(`URL parameter set: ${key}=${value}`);
}

/**
 * Sets several captured URL parameters, replacing the keys named and leaving
 * the rest alone.
 * @category URL Parameters
 */
export function setParams(
  logger: Logger,
  params: Record<string, string>
): void {
  const paramStore = useParameterStore.getState();
  paramStore.updateParams(params);
  logger.debug('URL parameters set:', params);
}

/**
 * Reads one captured URL parameter. `null` when it was never captured.
 * @category URL Parameters
 */
export function getParam(key: string): string | null {
  const paramStore = useParameterStore.getState();
  const value = paramStore.getParam(key);
  return value !== undefined ? value : null;
}

/**
 * Every URL parameter captured for this session.
 * @category URL Parameters
 */
export function getAllParams(): Record<string, string> {
  const paramStore = useParameterStore.getState();
  return paramStore.params;
}

/**
 * Whether a parameter was captured, including one present with an empty
 * value.
 * @category URL Parameters
 */
export function hasParam(key: string): boolean {
  const paramStore = useParameterStore.getState();
  return paramStore.hasParam(key);
}

/**
 * Forgets one captured URL parameter.
 * @category URL Parameters
 */
export function clearParam(logger: Logger, key: string): void {
  const paramStore = useParameterStore.getState();
  const newParams = { ...paramStore.params };
  delete newParams[key];
  paramStore.updateParams(newParams);
  logger.debug(`URL parameter cleared: ${key}`);
}

/**
 * Forgets every captured URL parameter — `utm_*` values included, which
 * attribution reads.
 * @category URL Parameters
 */
export function clearAllParams(logger: Logger): void {
  const paramStore = useParameterStore.getState();
  paramStore.updateParams({});
  logger.debug('All URL parameters cleared');
}

/**
 * Adds parameters to the captured set without disturbing keys it does not
 * name.
 * @category URL Parameters
 */
export function mergeParams(
  logger: Logger,
  params: Record<string, string>
): void {
  const paramStore = useParameterStore.getState();
  paramStore.mergeParams(params);
  logger.debug('URL parameters merged:', params);
}
