/**
 * Logger utility with different log levels and debugging support
 */

/**
 * Severity levels for the SDK {@link Logger}, ordered most to least severe.
 * Setting the global level (via `Logger.setLogLevel`) suppresses anything less
 * severe — e.g. `WARN` hides `INFO` and `DEBUG`.
 */
export enum LogLevel {
  /** Errors only — failures that need attention. */
  ERROR = 0,
  /** Warnings and errors. */
  WARN = 1,
  /** Informational messages, warnings, and errors. The default level. */
  INFO = 2,
  /** Everything, including verbose debug output. Enabled by `?debug=true`. */
  DEBUG = 3,
}

// Check if we're in production - will be replaced by Vite's define
const isProduction = process.env.NODE_ENV === 'production';

// Check if debug mode is enabled via URL parameters or window.nextConfig
const isDebugModeEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const windowConfig = (window as any).nextConfig;
  return (
    params.get('debug') === 'true' ||
    params.get('debugger') === 'true' ||
    windowConfig?.debug === true ||
    windowConfig?.debugger === true
  );
};

// Interface for logger methods
interface ILogger {
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

/**
 * Leveled, context-scoped logger used throughout the SDK.
 *
 * Each instance carries a context label (usually the class name) that prefixes
 * its output. Messages are gated by a global {@link LogLevel} and are quietened
 * in production unless debug mode is on (`?debug=true` or
 * `window.nextConfig.debug`). Enhancers use the inherited `this.logger` rather
 * than constructing one directly.
 *
 * @example
 * ```ts
 * const logger = new Logger('MyEnhancer');
 * logger.debug('Initialized with package', packageId);
 * Logger.setLogLevel(LogLevel.DEBUG); // raise verbosity globally
 * ```
 */
export class Logger implements ILogger {
  private context: string;
  private static globalLevel: LogLevel = LogLevel.INFO;

  constructor(context: string) {
    this.context = context;
  }

  public static setLogLevel(level: LogLevel): void {
    Logger.globalLevel = level;
  }

  public static getLogLevel(): LogLevel {
    return Logger.globalLevel;
  }

  public error(message: string, ...args: any[]): void {
    // Always log errors, even in production
    if (Logger.globalLevel >= LogLevel.ERROR) {
      console.error(`[${this.context}] ${message}`, ...args);
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (isProduction && !isDebugModeEnabled()) {
      // This will be completely removed by Terser's dead code elimination
      return;
    }
    if (Logger.globalLevel >= LogLevel.WARN) {
      console.warn(`[${this.context}] ${message}`, ...args);
    }
  }

  public info(message: string, ...args: any[]): void {
    if (isProduction && !isDebugModeEnabled()) {
      // This will be completely removed by Terser's dead code elimination
      return;
    }
    if (Logger.globalLevel >= LogLevel.INFO) {
      console.info(`[${this.context}] ${message}`, ...args);
    }
  }

  public debug(message: string, ...args: any[]): void {
    if (isProduction && !isDebugModeEnabled()) {
      // This will be completely removed by Terser's dead code elimination
      return;
    }
    if (Logger.globalLevel >= LogLevel.DEBUG) {
      console.debug(`[${this.context}] ${message}`, ...args);
    }
  }
}

// Production logger that only logs errors (unless debug mode is enabled)
class ProductionLogger extends Logger {
  constructor(context: string) {
    super(context);
  }

  public override warn(message: string, ...args: any[]): void {
    if (isDebugModeEnabled()) {
      super.warn(message, ...args);
    }
    // Otherwise no-op in production
  }

  public override info(message: string, ...args: any[]): void {
    if (isDebugModeEnabled()) {
      super.info(message, ...args);
    }
    // Otherwise no-op in production
  }

  public override debug(message: string, ...args: any[]): void {
    if (isDebugModeEnabled()) {
      super.debug(message, ...args);
    }
    // Otherwise no-op in production
  }
}

// Factory function for creating loggers
export function createLogger(context: string): Logger {
  // In production, use ProductionLogger which respects debug mode
  if (isProduction) {
    return new ProductionLogger(context);
  }
  // In development, use regular logger
  return new Logger(context);
}

export const logger = createLogger('SDK');
