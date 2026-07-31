/// <reference types="vite/client" />

// Vite environment variables.
//
// Read from `.env.local` (gitignored) during development. Credentials belong here
// rather than in `src/config.ts`, which is tracked — see the comment at the top of
// that file.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Campaign API key used by the debug-mode dev config (`src/config.ts`). */
  readonly VITE_API_KEY?: string;
  readonly VITE_CAMPAIGN_ID?: string;
  /**
   * Google Maps key for address autocomplete. Optional and billable: left unset, the
   * SDK falls back to its own autocomplete.
   */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /** Version reported with captured errors (`core/monitoring/error-handler.ts`). */
  readonly VITE_APP_VERSION?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// CSS Module declarations
declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.scss' {
  const content: string;
  export default content;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.sass' {
  const content: string;
  export default content;
}

declare module '*.module.sass' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.less' {
  const content: string;
  export default content;
}

declare module '*.module.less' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.styl' {
  const content: string;
  export default content;
}

declare module '*.module.styl' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.stylus' {
  const content: string;
  export default content;
}

declare module '*.module.stylus' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// Image file declarations
declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.gif' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare module '*.avif' {
  const src: string;
  export default src;
}

declare module '*.ico' {
  const src: string;
  export default src;
}

// Font file declarations
declare module '*.woff' {
  const src: string;
  export default src;
}

declare module '*.woff2' {
  const src: string;
  export default src;
}

declare module '*.eot' {
  const src: string;
  export default src;
}

declare module '*.ttf' {
  const src: string;
  export default src;
}

declare module '*.otf' {
  const src: string;
  export default src;
}

// Other asset declarations
declare module '*.json' {
  const content: any;
  export default content;
}

declare module '*.txt' {
  const content: string;
  export default content;
}

declare module '*.md' {
  const content: string;
  export default content;
}

// Global version constant
declare const __VERSION__: string;