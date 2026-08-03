import type { CoreHealthyLine } from './core-logs.types';

/**
 * What a healthy boot prints, in order, with debug mode on.
 *
 * Every line is checked against the extracted messages, so this cannot become a sample
 * of output the SDK no longer produces. The **order** is not derivable from the source
 * — it is the call order inside `SDKInitializer.initialize()` — so it is maintained by
 * hand: configuration, location and currency, attribution, campaign data, analytics,
 * cart rehydration, order, DOM scan, debug tools, done.
 */
export const CORE_HEALTHY_BOOT: CoreHealthyLine[] = [
  {
    prefix: 'SDKInitializer',
    message: 'Initializing NextCommerce Campaign Cart SDK v2...',
  },
  {
    prefix: 'SDKInitializer',
    message: 'Initializing location and currency detection...',
  },
  { prefix: 'SDKInitializer', message: 'User location detected:' },
  { prefix: 'SDKInitializer', message: 'Using detected currency:' },
  { prefix: 'SDKInitializer', message: 'Initializing attribution...' },
  { prefix: 'SDKInitializer', message: 'Attribution initialized' },
  { prefix: 'SDKInitializer', message: 'Campaign data loaded' },
  { prefix: 'SDKInitializer', message: 'Initializing analytics v2...' },
  {
    prefix: 'NextAnalytics',
    message: 'NextAnalytics initialized successfully',
  },
  { prefix: 'SDKInitializer', message: 'Cart store rehydration complete' },
  {
    prefix: 'AttributeScanner',
    message: '🔍 Starting DOM scan for data attributes...',
  },
  {
    prefix: 'AttributeScanner',
    message: 'Enhanced {enhancedCount} elements successfully',
  },
  {
    prefix: 'AttributeScanner',
    message: 'Added next-display-ready class to HTML element',
  },
  {
    prefix: 'SDKInitializer',
    message: 'DOM scanning and enhancement complete',
  },
  { prefix: 'SDKInitializer', message: 'SDK initialization complete ✅' },
];
