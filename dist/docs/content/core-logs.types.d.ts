export type NotedLevel = 'error' | 'warn';
export interface CoreLogSource {
    prefix: string;
    file: string;
    area: string;
    what: string;
    dynamicPrefix?: boolean;
    prefixFrom?: string;
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
//# sourceMappingURL=core-logs.types.d.ts.map