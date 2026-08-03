export declare const LOG_LEVELS: readonly ["error", "warn", "info", "debug"];
export type LogLevel = (typeof LOG_LEVELS)[number];
export interface LogMessage {
    level: LogLevel;
    message: string;
    where: string;
    hasContext: boolean;
}
export interface ThrownError {
    message: string;
    where: string;
}
export declare function extractThrows(files: Array<[string, string]>): ThrownError[];
export declare function extractLogs(files: Array<[string, string]>): LogMessage[];
//# sourceMappingURL=extract-logs.d.ts.map