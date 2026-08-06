export type EnhancerStats = Map<string, {
    totalTime: number;
    count: number;
}>;
export declare function detectDebugMode(): boolean;
export declare function recordEnhancerTime(stats: EnhancerStats, type: string, time: number): void;
export declare function showEnhancerPerformanceReport(stats: EnhancerStats): void;
export declare function enhancerPerformanceSnapshot(stats: EnhancerStats): Record<string, {
    totalTime: number;
    averageTime: number;
    count: number;
}>;
//# sourceMappingURL=attribute-scanner.performance.d.ts.map