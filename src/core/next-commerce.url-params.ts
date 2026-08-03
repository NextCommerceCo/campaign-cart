/**
 * `NextCommerce`'s URL Parameters category — extracted verbatim from
 * `next-commerce.ts`. Every function only reads instance state to log, so
 * each takes a bare `logger: Logger`.
 */

import { useParameterStore } from '@/state/parameter';
import type { Logger } from '@/core/logger';

export function setParam(logger: Logger, key: string, value: string): void {
  const paramStore = useParameterStore.getState();
  paramStore.updateParam(key, value);
  logger.debug(`URL parameter set: ${key}=${value}`);
}

export function setParams(
  logger: Logger,
  params: Record<string, string>
): void {
  const paramStore = useParameterStore.getState();
  paramStore.updateParams(params);
  logger.debug('URL parameters set:', params);
}

export function getParam(key: string): string | null {
  const paramStore = useParameterStore.getState();
  const value = paramStore.getParam(key);
  return value !== undefined ? value : null;
}

export function getAllParams(): Record<string, string> {
  const paramStore = useParameterStore.getState();
  return paramStore.params;
}

export function hasParam(key: string): boolean {
  const paramStore = useParameterStore.getState();
  return paramStore.hasParam(key);
}

export function clearParam(logger: Logger, key: string): void {
  const paramStore = useParameterStore.getState();
  const newParams = { ...paramStore.params };
  delete newParams[key];
  paramStore.updateParams(newParams);
  logger.debug(`URL parameter cleared: ${key}`);
}

export function clearAllParams(logger: Logger): void {
  const paramStore = useParameterStore.getState();
  paramStore.updateParams({});
  logger.debug('All URL parameters cleared');
}

export function mergeParams(
  logger: Logger,
  params: Record<string, string>
): void {
  const paramStore = useParameterStore.getState();
  paramStore.mergeParams(params);
  logger.debug('URL parameters merged:', params);
}
