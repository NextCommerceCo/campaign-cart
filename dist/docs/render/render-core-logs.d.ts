import { CoreConsoleLog, CoreLogSource } from '../content/core-logs';
import { LogEntry } from '../schema/doc-types';
export interface CoreLogRow extends LogEntry {
    meaning?: string;
    action?: string;
    unreadable?: 'concatenated' | 'forwarded';
}
export interface CoreLogGroup {
    source: CoreLogSource;
    rows: CoreLogRow[];
}
export declare function renderCoreLogs(groups: CoreLogGroup[], healthyBoot: string[], rawConsoleLogs?: CoreConsoleLog[], whereOf?: (log: CoreConsoleLog) => string): string;
//# sourceMappingURL=render-core-logs.d.ts.map