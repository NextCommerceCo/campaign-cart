/**
 * Display Formatting System Exports
 * Central export point for all display formatting enhancements
 */

// Core functionality
export { BaseDisplayEnhancer, DisplayFormatter, PropertyResolver } from './display-core';
export { ProductDisplayEnhancer } from './product-display';
export { CartDisplayEnhancer } from '@/features/cart/cart-summary';
export { SelectionDisplayEnhancer } from './selection-display';
export { OrderDisplayEnhancer } from './order-display';

// Context management
export { DisplayContextProvider, setupContextProviders } from './display-context';
export type { DisplayContext } from './display-context';

// Error handling
export { DisplayErrorBoundary, withErrorBoundary, safeGet } from './display-error-boundary';
export type { ErrorContext, ErrorHandler } from './display-error-boundary';

// Debug tools
export { DisplayDebugPanel } from './display-debug-panel';
export { FormatValidator } from './format-validator';
export type { ValidationIssue, ValidationReport } from './format-validator';

// Types and configuration
export {
  PROPERTY_MAPPINGS,
  getPropertyConfig,
  getPropertyMapping,
  isRawValueProperty,
  isFormattedValueProperty,
  getBasePropertyName,
  supportsExpressions
} from './display-types';

export type {
  FormatType,
  DisplayProperty,
  DisplayValue,
  DisplayState,
  PropertyConfig
} from './display-types';

// Initialize debug tools in development
if (process.env.NODE_ENV === 'development') {
  // Auto-initialize debug panel
  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      // Import dynamically to avoid circular dependencies
      import('./display-debug-panel').then(({ DisplayDebugPanel }) => {
        DisplayDebugPanel.init();
        console.log('[Display System] Debug tools initialized. Press Ctrl+Shift+D for debug panel.');
      });
    });
  }
}