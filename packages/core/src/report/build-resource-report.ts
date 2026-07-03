/**
 * Builder and post-ACME budget check for the {@link ResourceReport}.
 *
 * `buildResourceReport` assembles the report from its owners with ownership
 * encoded in the input signature (AR-Q3); `checkBinaryBudget` is the post-ACME
 * half of the R42 budget-timing split (AR-103) — the pre-ACME half (ZP/RAM/
 * stack budgets) already ships in the SFA planner's `budgets` pass.
 *
 * Covers RD-11 §4.7 (builder/check signatures) · R40–R42 · AC-17 (post-ACME
 * half) · AR-Q3/Q4, PF-002.
 */

import type { AllocationPlan } from "../sfa/index.js";
import type { DiagnosticBag } from "../diagnostics/index.js";
import { DiagCode } from "../diagnostics/index.js";
import type { PeepholeStats, ResourceReport, SegmentRange } from "./resource-report.js";

/**
 * Inputs for {@link buildResourceReport} — one field group per owner
 * (R40/R41): the frozen SFA plan, pre-extracted ACME numbers, the profile's
 * binary budget, and the plugin's startup figures.
 */
export interface BuildResourceReportInputs {
  /** Platform name (e.g. `"c64"`). */
  readonly platformName: string;
  /** Output target name (e.g. `"game.prg"`). */
  readonly targetName: string;
  /** The frozen SFA plan; resourceData/zpAllocations/stackAnalysis embed verbatim. */
  readonly plan: AllocationPlan;
  /** `profile.maxBinarySize`. */
  readonly binaryBudget: number;
  /** ACME-owned: code segment size in bytes. */
  readonly codeSize?: number;
  /** ACME-owned: data segment size in bytes. */
  readonly dataSize?: number;
  /** ACME-owned: total binary size in bytes. */
  readonly binarySize?: number;
  /** ACME-owned: code segment range. */
  readonly codeRange?: SegmentRange;
  /** ACME-owned: data segment range. */
  readonly dataRange?: SegmentRange;
  /** ACME-owned: RAM variables range. */
  readonly ramRange?: SegmentRange;
  /** ACME-owned: SFA frame-region range. */
  readonly framesRange?: SegmentRange;
  /** Plugin-owned: startup routine size in bytes. */
  readonly startupSize?: number;
  /** Plugin-owned: startup routine cost in cycles. */
  readonly startupCycles?: number;
  /** RD-08 Phase B: optimizer statistics. */
  readonly peepholeStats?: PeepholeStats;
}

/**
 * Assembles a {@link ResourceReport} from its owners (AR-103).
 *
 * Pure restructuring: the plan's `resourceData`, `zpAllocations`, and
 * `stackAnalysis` are embedded **by reference** (one owner per number,
 * structurally — PF-002); every other input copies through. No I/O, no label
 * parsing (the ACME serializer emits no segment boundary labels — AR-Q3);
 * absent inputs stay absent and render as zeros per AR-102.
 *
 * @param inputs The per-owner report inputs.
 * @returns The assembled report.
 */
export function buildResourceReport(inputs: BuildResourceReportInputs): ResourceReport {
  return {
    platformName: inputs.platformName,
    targetName: inputs.targetName,
    sfa: inputs.plan.resourceData,
    zpAllocations: inputs.plan.zpAllocations,
    stackAnalysis: inputs.plan.stackAnalysis,
    ...(inputs.codeSize !== undefined ? { codeSize: inputs.codeSize } : {}),
    ...(inputs.dataSize !== undefined ? { dataSize: inputs.dataSize } : {}),
    ...(inputs.binarySize !== undefined ? { binarySize: inputs.binarySize } : {}),
    ...(inputs.codeRange !== undefined ? { codeRange: inputs.codeRange } : {}),
    ...(inputs.dataRange !== undefined ? { dataRange: inputs.dataRange } : {}),
    ...(inputs.ramRange !== undefined ? { ramRange: inputs.ramRange } : {}),
    ...(inputs.framesRange !== undefined ? { framesRange: inputs.framesRange } : {}),
    binaryBudget: inputs.binaryBudget,
    ...(inputs.startupSize !== undefined ? { startupSize: inputs.startupSize } : {}),
    ...(inputs.startupCycles !== undefined ? { startupCycles: inputs.startupCycles } : {}),
    ...(inputs.peepholeStats !== undefined ? { peepholeStats: inputs.peepholeStats } : {}),
  };
}

/**
 * The post-ACME half of the binary-budget check (R42, AR-103).
 *
 * No-op when `report.binarySize` is undefined (pre-wiring builds, AR-Q4).
 * When `binarySize > binaryBudget`, emits exactly one E10034 through the bag
 * with a `null` span and the Ch 14 message. A size exactly at the budget
 * passes. RD-15 calls this after `emitBinary`.
 *
 * @param report The assembled report carrying `binarySize`/`binaryBudget`.
 * @param bag The bag receiving the E10034 diagnostic (side effect).
 */
export function checkBinaryBudget(report: ResourceReport, bag: DiagnosticBag): void {
  if (report.binarySize === undefined || report.binarySize <= report.binaryBudget) {
    return;
  }
  bag.addError(
    DiagCode.BinaryTooLarge,
    null,
    `Output binary (${report.binarySize} bytes) exceeds platform ` +
      `'${report.platformName}' maximum binary size (${report.binaryBudget} bytes)`,
  );
}
