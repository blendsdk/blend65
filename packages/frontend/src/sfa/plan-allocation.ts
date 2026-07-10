/**
 * The SFA planner entry point — `planAllocation`, the 9-step pipeline (spec
 * Ch 11).
 *
 * Orchestrates every SFA pass to turn a {@link PlanInput} into the immutable
 * {@link AllocationPlan} downstream phases consume:
 *
 *   1. computeFrames           — per-function frame sizes
 *   2. buildInterferenceGraph  — which functions are simultaneously live
 *   3. colorFrames             — share frame memory → offsets + region size
 *   4. layoutModuleVariables   — place module `let` vars in RAM
 *   5. frame-region placement  — frameRegionBase + per-function absolute addresses
 *   6. computePeakPointers + allocateZeroPage — zero-page layout
 *   7. analyzeStack            — worst-case hardware-stack usage
 *   8. checkBudgets            — pre-ACME RAM/ZP/stack diagnostics
 *   9. generateSymbolDefinitions + assemble the frozen AllocationPlan
 *
 * The signature is `planAllocation(input, profile, bag)` — an explicit input
 * object mirroring the parser's `parse(ParseInput)` and the analyzer's
 * `analyze(AnalyzeInput)`. The `input.functions` are supplied by fixtures today
 * and by the deferred `modelToFunctionInfo` adapter once the semantic model is
 * fully populated.
 *
 * Never throws: on empty or partial input it returns a valid, empty plan. Imports
 * `@blend65/core` only — never `@blend65/codegen`.
 */

import type {
  FunctionInfo,
  AllocationPlan,
  FrameAllocation,
  PlatformProfile,
  DiagnosticBag,
  Type,
} from "@blend65/core";
import { computeFrames } from "./frame-computation.js";
import { buildInterferenceGraph } from "./interference.js";
import { colorFrames } from "./coloring.js";
import {
  layoutModuleVariables,
  allocateZeroPage,
  computePeakPointers,
  type ModuleVarInput,
} from "./zp-allocator.js";
import { analyzeStack } from "./stack-analysis.js";
import { checkBudgets } from "./budgets.js";
import { generateSymbolDefinitions } from "./symbols.js";

/** A zeropage-declared user variable (name + byte size). */
export interface ZpUserVar {
  readonly name: string;
  readonly size: number;
}

/**
 * Everything `planAllocation` needs (D9). An object — not positional params — so
 * the deferred wiring seam has a single clean call site and future fields can be
 * added without a breaking signature change (F1).
 */
export interface PlanInput {
  /** The functions to plan frames for (fixtures now; `modelToFunctionInfo` later). */
  readonly functions: readonly FunctionInfo[];
  /** Module-level `let` variables to place in RAM, in layout order. */
  readonly moduleVars: readonly ModuleVarInput[];
  /** Zeropage-declared user variables, in declaration order. */
  readonly zpUserVars: readonly ZpUserVar[];
  /** `true` if an earlier stage reported errors — suppresses budget diagnostics. */
  readonly upstreamErrors: boolean;
}

/** Re-export so callers can build the module-var inputs from one place. */
export type { ModuleVarInput };
export type { Type };

/**
 * Runs the full Static Frame Allocation pipeline (§4.1).
 *
 * @param input The functions, module/ZP variables, and the upstream-error flag.
 * @param profile The platform profile (budgets, ZP/RAM ranges, thresholds).
 * @param bag The diagnostic accumulator (receives any budget diagnostics).
 * @returns The immutable {@link AllocationPlan}.
 */
export function planAllocation(
  input: PlanInput,
  profile: PlatformProfile,
  bag: DiagnosticBag,
): AllocationPlan {
  // 1. Per-function frames.
  const frames = computeFrames(input.functions);

  // 2/3. Interference graph → coloring (offsets within the frame region).
  const graph = buildInterferenceGraph(input.functions);
  const coloring = colorFrames(frames, graph);

  // 4. Module variables in RAM (provisional addresses finalized at emit time).
  const moduleLayout = layoutModuleVariables(input.moduleVars, profile.ramStart);

  // 5. Frame-region placement: the region follows the module-variable block.
  const frameRegionBase = profile.ramStart + moduleLayout.totalSize;
  const frameAllocs = new Map<string, FrameAllocation>();
  let sumOfFrameSizes = 0;
  for (const [name, offset] of coloring.offsets) {
    const frame = frames.get(name);
    if (!frame) {
      continue;
    }
    sumOfFrameSizes += frame.totalSize;
    frameAllocs.set(name, {
      functionName: name,
      frame,
      offset,
      absoluteAddress: frameRegionBase + offset,
    });
  }

  // 6. Zero-page: peak pointers + priority allocation. The allocator owns E10032.
  const peakPointers = computePeakPointers(input.functions, graph);
  const zp = allocateZeroPage(
    {
      userVars: input.zpUserVars,
      peakPointers,
      mainTemps: profile.mainTempBytes,
      irqTemps: profile.irqTempBytes,
      argBlockMin: profile.zpArgBlockMin,
    },
    profile,
    bag,
  );

  // 7. Stack-depth analysis.
  const stackAnalysis = analyzeStack(input.functions, profile);

  // 8. Budgets (pre-ACME). E10033 + the three warnings; E10032 already handled.
  const ramBudget = profile.ramEnd - profile.ramStart;
  const zpBudget = profile.zpEnd - profile.zpStart + 1;
  const ramUsed = moduleLayout.totalSize + coloring.frameRegionSize;
  checkBudgets(
    {
      zpUsed: zp.used,
      zpBudget,
      ramUsed,
      ramBudget,
      zpOverflowed: zp.overflowed,
      stack: stackAnalysis,
      upstreamErrors: input.upstreamErrors,
    },
    profile,
    bag,
  );

  // 9. Symbols + assemble the immutable plan.
  const symbolDefinitions = generateSymbolDefinitions({
    frames: frameAllocs,
    moduleVariables: moduleLayout.allocations,
    zpAllocations: zp.allocations,
  });

  const hasErrors = zp.overflowed || ramUsed > ramBudget;
  const sharingSaved = sumOfFrameSizes - coloring.frameRegionSize;

  const plan: AllocationPlan = {
    frames: frameAllocs,
    dataBase: profile.ramStart,
    frameRegionBase,
    frameRegionSize: coloring.frameRegionSize,
    peakSimultaneous: coloring.frameRegionSize,
    sharingSaved,
    zpAllocations: zp.allocations,
    zpUsed: zp.used,
    zpBudget,
    moduleVariables: moduleLayout.allocations,
    moduleVariablesSize: moduleLayout.totalSize,
    stackAnalysis,
    symbolDefinitions,
    resourceData: {
      frameRegionBytes: coloring.frameRegionSize,
      frameRegionPeak: coloring.frameRegionSize,
      frameSharingSaved: sharingSaved,
      zpUsed: zp.used,
      zpBudget,
      ramUsed,
      ramBudget,
      stackWorstCase: stackAnalysis.totalWorstCase,
      stackBudget: profile.stackBudget,
    },
    hasErrors,
  };

  // Freeze the top-level plan so downstream phases can only read it.
  return Object.freeze(plan);
}
