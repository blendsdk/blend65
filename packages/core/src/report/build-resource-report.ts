/**
 * Builder and post-ACME budget check for the {@link ResourceReport}.
 *
 * `buildResourceReport` assembles the report from its owners with ownership
 * encoded in the input signature; `checkBinaryBudget` is the post-ACME half of
 * the budget-timing split — the pre-ACME half (ZP/RAM/stack budgets) already
 * ships in the SFA planner's `budgets` pass.
 */

import type { AllocationPlan } from "../sfa/index.js";
import type { DiagnosticBag } from "../diagnostics/index.js";
import { DiagCode } from "../diagnostics/index.js";
import type {
  FunctionCostEstimate,
  PeepholeStats,
  ResourceReport,
  SegmentRange,
} from "./resource-report.js";

/**
 * Inputs for {@link buildResourceReport} — one field group per owner: the
 * frozen SFA plan, pre-extracted ACME numbers, the profile's binary budget,
 * and the plugin's startup figures.
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
  /** Optimizer (peephole pass) statistics. */
  readonly peepholeStats?: PeepholeStats;
  /** Codegen-owned: per-function straight-line estimates. */
  readonly functionCosts?: readonly FunctionCostEstimate[];
  /** Codegen-owned: label replacing cycle figures for variants without timing data. */
  readonly cycleEstimatesUnavailable?: string;
}

/**
 * Assembles a {@link ResourceReport} from its owners.
 *
 * Pure restructuring: the plan's `resourceData`, `zpAllocations`, and
 * `stackAnalysis` are embedded **by reference** (one owner per number,
 * structurally); every other input copies through. No I/O, no label parsing
 * (the ACME serializer emits no segment boundary labels); absent inputs stay
 * absent and render as zeros.
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
    ...(inputs.functionCosts !== undefined ? { functionCosts: inputs.functionCosts } : {}),
    ...(inputs.cycleEstimatesUnavailable !== undefined
      ? { cycleEstimatesUnavailable: inputs.cycleEstimatesUnavailable }
      : {}),
  };
}

/**
 * The post-ACME half of the binary-budget check.
 *
 * No-op when `report.binarySize` is undefined (pre-wiring builds). When
 * `binarySize > binaryBudget`, emits exactly one E10034 through the bag with
 * a `null` span and the Ch 14 message. A size exactly at the budget passes.
 * The build driver calls this after `emitBinary`.
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

/** Inputs for {@link checkDataOverlap} — the binary's placement and the plan's data base. */
export interface DataOverlapInputs {
  /** The binary's load address (from the PRG header's first two bytes). */
  readonly loadAddress: number;
  /** Binary size in bytes, excluding the load header. */
  readonly binarySize: number;
  /** The allocation plan's data-region base (module variables + frames start here). */
  readonly dataBase: number;
}

/** Formats an address as a 4-digit `$XXXX` hex literal for diagnostics. */
function hexAddress(value: number): string {
  return `$${value.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * The post-ACME code/data overlap check.
 *
 * The data region (module variables + function frames) begins at the
 * allocation plan's data base; code that reaches into it would be silently
 * corrupted the moment a variable or frame slot is written. The boundary is
 * half-open: `loadAddress + binarySize <= dataBase` passes, one byte more
 * emits exactly one E10033 (the condition is a RAM-placement failure) through
 * the bag with a `null` span. The build driver calls this unconditionally
 * after reading the binary back.
 *
 * @param inputs The binary's load address/size and the plan's data base.
 * @param bag The bag receiving the E10033 diagnostic (side effect).
 */
export function checkDataOverlap(inputs: DataOverlapInputs, bag: DiagnosticBag): void {
  const end = inputs.loadAddress + inputs.binarySize;
  if (end <= inputs.dataBase) {
    return;
  }
  bag.addError(
    DiagCode.RamBudgetExceeded,
    null,
    `Emitted code (${hexAddress(inputs.loadAddress)}–${hexAddress(end - 1)}) overlaps ` +
      `the RAM data region starting at ${hexAddress(inputs.dataBase)} ` +
      `(module variables and function frames)`,
  );
}
