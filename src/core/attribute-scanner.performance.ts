/**
 * `AttributeScanner`'s debug-mode performance instrumentation — extracted
 * verbatim from `attribute-scanner.ts`. The class still owns `enhancerStats`
 * and `isDebugMode`, still decides when to call `enhancer.initialize()` with
 * timing on, and still decides when a report is worth printing; this module
 * only holds the timing math and the console output.
 */

export type EnhancerStats = Map<string, { totalTime: number; count: number }>;

/**
 * Reads `?debug=true` off the current URL. Called once, from the
 * constructor.
 */
export function detectDebugMode(): boolean {
  const isDebugMode =
    new URLSearchParams(location.search).get('debug') === 'true';

  if (isDebugMode) {
    console.log(
      '🐛 AttributeScanner: Debug mode enabled for performance tracking'
    );
  }

  return isDebugMode;
}

export function recordEnhancerTime(
  stats: EnhancerStats,
  type: string,
  time: number
): void {
  const current = stats.get(type) || { totalTime: 0, count: 0 };
  current.totalTime += time;
  current.count += 1;
  stats.set(type, current);
}

export function showEnhancerPerformanceReport(stats: EnhancerStats): void {
  console.group('🚀 Enhancement Performance Report');

  // Convert to array and sort by total time
  const sortedStats = Array.from(stats.entries())
    .map(([type, s]) => ({
      Enhancer: type,
      'Total Time (ms)': s.totalTime.toFixed(2),
      'Average Time (ms)': (s.totalTime / s.count).toFixed(2),
      Count: s.count,
      Impact:
        s.totalTime > 50 ? '🔴 High' : s.totalTime > 20 ? '🟡 Medium' : '🟢 Low',
    }))
    .sort(
      (a, b) =>
        parseFloat(b['Total Time (ms)']) - parseFloat(a['Total Time (ms)'])
    );

  console.table(sortedStats);

  // Show top slowest enhancers
  const topSlow = sortedStats.slice(0, 3);
  if (topSlow.length > 0) {
    console.log('🐌 Slowest enhancers:');
    topSlow.forEach((stat, index) => {
      console.log(
        `${index + 1}. ${stat.Enhancer}: ${stat['Total Time (ms)']}ms (${stat.Count} instances)`
      );
    });
  }

  const totalTime = Array.from(stats.values()).reduce(
    (sum, s) => sum + s.totalTime,
    0
  );
  const totalCount = Array.from(stats.values()).reduce(
    (sum, s) => sum + s.count,
    0
  );

  console.log(
    `📊 Total enhancement time: ${totalTime.toFixed(2)}ms across ${totalCount} enhancers`
  );
  console.groupEnd();
}

/** The `performanceStats` half of `AttributeScanner.getStats()`. */
export function enhancerPerformanceSnapshot(
  stats: EnhancerStats
): Record<string, { totalTime: number; averageTime: number; count: number }> {
  const performanceStats: Record<
    string,
    { totalTime: number; averageTime: number; count: number }
  > = {};

  for (const [type, data] of stats.entries()) {
    performanceStats[type] = {
      totalTime: data.totalTime,
      averageTime: data.totalTime / data.count,
      count: data.count,
    };
  }

  return performanceStats;
}
