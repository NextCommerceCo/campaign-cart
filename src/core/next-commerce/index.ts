/**
 * Gate for `core/next-commerce` — re-exports only, no logic.
 *
 * Exists so `@/core/next-commerce` keeps resolving now that the family lives in a folder
 * rather than as loose files in `core/`. Import the folder, not the inner file.
 */
export * from './next-commerce';
