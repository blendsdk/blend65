/**
 * Public barrel for the Blend65 resource-report module.
 *
 * Re-exports the report record types, the builder + post-ACME budget check,
 * and the two renderers. Downstream packages import everything report-related
 * from `@blend65/core` (which re-exports this module) rather than reaching
 * into individual files.
 */

export type { ResourceReport, PeepholeStats, SegmentRange } from "./resource-report.js";

export type { BuildResourceReportInputs } from "./build-resource-report.js";
export { buildResourceReport, checkBinaryBudget } from "./build-resource-report.js";

export { renderReportTerminal } from "./render-report-terminal.js";
export { renderReportJson } from "./render-report-json.js";
