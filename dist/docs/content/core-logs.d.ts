export type NotedLevel = 'error' | 'warn';
export interface CoreLogSource {
    prefix: string;
    file: string;
    area: string;
    what: string;
    dynamicPrefix?: boolean;
    prefixNote?: string;
}
export interface CoreLogNote {
    level: NotedLevel;
    message: string;
    meaning: string;
    action: string;
}
export interface CoreUnreadableLog extends CoreLogNote {
    file: string;
    anchor: string;
    hasContext?: boolean;
    forwarded?: boolean;
}
export interface CoreConsoleLog extends CoreLogNote {
    file: string;
    anchor: string;
    hasContext?: boolean;
}
export interface CoreHealthyLine {
    prefix: string;
    message: string;
}
export declare const CORE_HEALTHY_BOOT: CoreHealthyLine[];
export declare const CORE_LOG_SOURCES: CoreLogSource[];
export declare const CORE_LOG_NOTES: CoreLogNote[];
export declare const CORE_UNREADABLE_LOGS: CoreUnreadableLog[];
export declare const CORE_CONSOLE_LOGS: CoreConsoleLog[];
//# sourceMappingURL=core-logs.d.ts.map