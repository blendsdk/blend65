/**
 * The JSON resource-report renderer — the machine-readable build summary.
 *
 * Emits one object mirroring {@link ResourceReport}. Plain objects/arrays
 * only: `peepholeStats.ruleHits` is a Map, and `JSON.stringify` silently
 * drops Map contents to `{}`, so it converts to a **name-sorted** entries
 * array (sorted for H5 determinism regardless of insertion order). Undefined
 * optionals are omitted via native `JSON.stringify` behavior. Serialization
 * is exclusively via `JSON.stringify`.
 */

import type { PeepholeStats, ResourceReport } from "./resource-report.js";

/** `peepholeStats` with `ruleHits` as name-sorted plain entries. */
function mirrorPeepholeStats(stats: PeepholeStats): Record<string, unknown> {
  const entries = [...stats.ruleHits.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return {
    totalApplications: stats.totalApplications,
    ruleHits: entries,
    bytesSaved: stats.bytesSaved,
    cyclesSaved: stats.cyclesSaved,
  };
}

/**
 * Renders the resource report as JSON.
 *
 * @param report The assembled report (see `buildResourceReport`).
 * @returns `JSON.stringify(mirror, null, 2)` plus a trailing newline (pure —
 *   never prints). Absent optional fields are omitted, not `null`.
 */
export function renderReportJson(report: ResourceReport): string {
  const mirror = {
    platformName: report.platformName,
    targetName: report.targetName,
    sfa: report.sfa,
    ...(report.zpAllocations !== undefined ? { zpAllocations: report.zpAllocations } : {}),
    ...(report.stackAnalysis !== undefined ? { stackAnalysis: report.stackAnalysis } : {}),
    ...(report.codeSize !== undefined ? { codeSize: report.codeSize } : {}),
    ...(report.dataSize !== undefined ? { dataSize: report.dataSize } : {}),
    ...(report.binarySize !== undefined ? { binarySize: report.binarySize } : {}),
    ...(report.codeRange !== undefined ? { codeRange: report.codeRange } : {}),
    ...(report.dataRange !== undefined ? { dataRange: report.dataRange } : {}),
    ...(report.ramRange !== undefined ? { ramRange: report.ramRange } : {}),
    ...(report.framesRange !== undefined ? { framesRange: report.framesRange } : {}),
    binaryBudget: report.binaryBudget,
    ...(report.startupSize !== undefined ? { startupSize: report.startupSize } : {}),
    ...(report.startupCycles !== undefined ? { startupCycles: report.startupCycles } : {}),
    ...(report.peepholeStats !== undefined
      ? { peepholeStats: mirrorPeepholeStats(report.peepholeStats) }
      : {}),
    ...(report.functionCosts !== undefined ? { functionCosts: report.functionCosts } : {}),
    ...(report.cycleEstimatesUnavailable !== undefined
      ? { cycleEstimatesUnavailable: report.cycleEstimatesUnavailable }
      : {}),
  };
  return `${JSON.stringify(mirror, null, 2)}\n`;
}
