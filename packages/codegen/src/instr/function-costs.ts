/**
 * Per-function straight-line cost summaries for the resource report.
 *
 * Walks each code stream's instruction entries and sums the documented NMOS
 * timings into a min–max range per function: every instruction counted once
 * (loops NOT multiplied — these are straight-line estimates, documented as
 * such in the report), min = branches not taken / no page crossings, max =
 * branches taken with every page-cross penalty applied. Byte sizes come from
 * the same size model the emitter uses.
 *
 * The contract keys off the build's DECLARED CPU variant, not the emitted
 * op set: a non-NMOS variant gets byte sizes with an explicit
 * no-timing-data marker — never silently zeroed cycles.
 */

import { getTiming } from "@blend65/core/platform";
import type { CpuVariant, NmosOpcode } from "@blend65/core/platform";
import type { FunctionCostEstimate } from "@blend65/core";
import { isInstr } from "./stream.js";
import { instrByteSize } from "./print-instr.js";
import type { InstrProgram } from "./instr-program.js";

/** The label renderers show in place of cycle figures for non-NMOS variants. */
export const NO_TIMING_DATA_LABEL = "no timing data for this CPU variant";

/** What {@link summarizeFunctionCosts} produces for the report builder. */
export interface FunctionCostSummary {
  /** One estimate per emitted code stream, in stream order. */
  readonly functionCosts: readonly FunctionCostEstimate[];
  /** Present iff the variant has no timing data (cycles are zeros). */
  readonly cycleEstimatesUnavailable?: string;
}

/**
 * Summarize every code stream of an assembled program into per-function
 * straight-line cost estimates.
 *
 * @param program The assembled program (function streams + data streams).
 * @param cpuVariant The build's declared CPU variant.
 * @returns The estimates — with zeroed cycles and the no-timing-data marker
 *   when `cpuVariant` is outside the NMOS timing table's domain.
 * @example
 * const summary = summarizeFunctionCosts(program, plugin.profile.cpu);
 */
export function summarizeFunctionCosts(
  program: InstrProgram,
  cpuVariant: CpuVariant,
): FunctionCostSummary {
  const timingAvailable = cpuVariant === "nmos6502";
  const functionCosts: FunctionCostEstimate[] = [];
  for (const stream of program.streams) {
    if (stream.segment !== "code") {
      continue; // const-data streams carry no executable cost
    }
    let bytes = 0;
    let minCycles = 0;
    let maxCycles = 0;
    for (const entry of stream.entries) {
      bytes += instrByteSize(entry);
      if (!isInstr(entry) || !timingAvailable) {
        continue; // labels/directives cost no cycles
      }
      // On an NMOS build every emitted opcode is NMOS (the validator
      // guarantees it); getTiming throws loudly if that ever breaks.
      const timing = getTiming(entry.opcode as NmosOpcode, entry.mode);
      minCycles += timing.baseCycles;
      maxCycles += timing.baseCycles + timing.pageCrossPenalty + timing.branchTakenPenalty;
    }
    functionCosts.push({ name: stream.symbol, bytes, minCycles, maxCycles });
  }
  return timingAvailable
    ? { functionCosts }
    : { functionCosts, cycleEstimatesUnavailable: NO_TIMING_DATA_LABEL };
}
