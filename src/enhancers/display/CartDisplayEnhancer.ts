/**
 * Re-export shim for the relocated cart-summary display enhancer.
 *
 * `CartDisplayEnhancer` now lives in `@/enhancers/cart/CartSummary`; this file
 * only re-exports it so older direct imports keep working. It renders cart-level
 * values (`cart.total`, `cart.subtotal`, `cart.count`, etc.) bound via
 * `data-next-display="cart.*"`, which `AttributeScanner` routes to the
 * `CartSummary` implementation.
 *
 * No attributes are defined here — see the `CartSummary` enhancer for the
 * authoritative attribute and behavior reference.
 *
 * @deprecated Import `CartDisplayEnhancer` from `@/enhancers/cart/CartSummary`
 * instead. This file is kept only for backward compatibility with direct imports.
 *
 * @example
 * ```html
 * <span data-next-display="cart.total"></span>
 * ```
 */
export { CartDisplayEnhancer } from '@/enhancers/cart/CartSummary';
