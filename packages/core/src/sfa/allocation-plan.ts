/**
 * The SFA planner's **output record** — the immutable {@link AllocationPlan} and
 * its sub-records.
 *
 * `planAllocation()` (frontend `sfa/plan-allocation.ts`) assembles an
 * `AllocationPlan` from the frame, interference/coloring, module-var-layout,
 * zero-page, stack-analysis, budget, and symbol passes. Every downstream phase
 * (IL generation, codegen, the ACME emitter) only *reads* the plan, so all
 * fields are `readonly` and the assembled plan is frozen.
 *
 * Pure data — lives in `@blend65/core`, shared without importing codegen, so
 * `frontend` and `language-server` can consume the same allocation model.
 */

import type { Type } from "../semantics/type.js";
import type { FunctionFrame } from "./frame.js";

/**
 * A placed module-level `let` variable in RAM.
 *
 * Module variables occupy `[ramStart, ramStart + totalSize)`; the frame region
 * follows. `address` is provisional — authoritative placement is finalized at
 * emit time via the ACME label file; the pre-ACME budget check needs only the
 * sum of sizes.
 */
export interface ModuleVariableAllocation {
  /** The owning module's name. */
  readonly moduleName: string;
  /** The variable's name. */
  readonly variableName: string;
  /** Provisional absolute RAM address (`ramStart + offset`). */
  readonly address: number;
  /** Offset within the module-variable region. */
  readonly offset: number;
  /** Size in bytes. */
  readonly size: number;
  /** The resolved semantic type. */
  readonly type: Type;
}

/**
 * A placed zero-page byte-run.
 *
 * The ZP allocator places categories in a fixed priority order: the deferred
 * runtime-ABI `arg-block` (the platform profile's floor — 4 bytes on the default
 * profile), then user `zeropage` variables, then struct/array pointers, then
 * main expression temps, then IRQ temps.
 */
export interface ZpAllocation {
  /** The user var name, or a generated name (`__zp_ptr_N`/`__zp_tmp_N`/`__zp_irq_tmp_N`). */
  readonly name: string;
  /** The placed zero-page address ($00–$FF). */
  readonly address: number;
  /** Size in bytes (1 for scalars/temps, 2 for pointers). */
  readonly size: number;
  /** The ZP category, fixing this run's place in the priority order. */
  readonly category: "user" | "pointer" | "temp" | "irq-temp" | "arg-block";
}

/**
 * Worst-case hardware-stack analysis.
 *
 * Each JSR consumes 2 bytes (return address). The worst case is the longest call
 * chain from `main` (×2 bytes), plus a one-time interrupt overhead (6 bytes: 3 CPU
 * push + 3 register save) when any interrupt handler exists, plus the deepest IRQ
 * call chain (×2 bytes).
 */
export interface StackAnalysis {
  /** Longest call chain from `main`, in call levels. */
  readonly maxMainDepth: number;
  /** `maxMainDepth × 2` bytes. */
  readonly maxMainStackBytes: number;
  /** Deepest call chain within any interrupt handler, in call levels. */
  readonly maxIrqDepth: number;
  /** `maxIrqDepth × 2` bytes. */
  readonly maxIrqStackBytes: number;
  /** 6 bytes if any interrupt handler exists, else 0. */
  readonly irqOverhead: number;
  /** `maxMainStackBytes + irqOverhead + maxIrqStackBytes`. */
  readonly totalWorstCase: number;
  /** The platform's usable hardware-stack budget (`profile.stackBudget`). */
  readonly platformBudget: number;
  /** `true` once `totalWorstCase ≥ platformBudget × stackWarnThreshold` (W10180). */
  readonly exceedsWarningThreshold: boolean;
}

/**
 * A placed function frame within the shared frame region.
 *
 * The coloring pass assigns each reachable function an `offset` within the frame
 * region such that interfering functions never overlap; `absoluteAddress` is
 * `frameRegionBase + offset`.
 */
export interface FrameAllocation {
  /** Fully-qualified function name. */
  readonly functionName: string;
  /** The function's computed frame (slots + total size). */
  readonly frame: FunctionFrame;
  /** Offset within the frame region (from coloring). */
  readonly offset: number;
  /** `frameRegionBase + offset`. */
  readonly absoluteAddress: number;
}

/**
 * One ACME symbol definition emitted into the `.asm` header.
 *
 * Names use the `__`-prefixed, sanitized scheme (`__frame_*`, `__var_*`, `__zp_*`,
 * …) so they never collide with user labels; values are absolute addresses.
 */
export interface SymbolDefinition {
  /** The ACME symbol name (e.g. `"__frame_Game_update"`). */
  readonly name: string;
  /** The symbol's address value. */
  readonly value: number;
  /**
   * `true` for symbols used in zero-page-only addressing modes (`(zp),Y`
   * pointer pairs). The assembler infers a symbol's size from its equate's
   * digit count and rejects a 16-bit-hinted symbol in an indirect operand,
   * so these serialize as 2-digit hex. Absent for every other symbol — their
   * 4-digit form is pinned by the committed goldens.
   */
  readonly zeroPage?: boolean;
}

/**
 * Aggregate resource-usage data for the build summary.
 *
 * Carries the frame-region, zero-page, RAM, and stack used-vs-budget figures the
 * compiler reports after planning. `frameRegionPeak === frameRegionBytes` — the
 * region size *is* the peak simultaneous footprint.
 */
export interface SfaResourceData {
  /** Total frame-region size in bytes. */
  readonly frameRegionBytes: number;
  /** Peak simultaneous frame footprint (= `frameRegionBytes`). */
  readonly frameRegionPeak: number;
  /** Bytes saved by frame sharing: Σ frame sizes − region size. */
  readonly frameSharingSaved: number;
  /** Zero-page bytes used. */
  readonly zpUsed: number;
  /** Zero-page budget (`zpEnd − zpStart + 1`, inclusive). */
  readonly zpBudget: number;
  /** RAM bytes used (`moduleVariablesSize + frameRegionSize`). */
  readonly ramUsed: number;
  /** RAM budget (`ramEnd − ramStart`, half-open). */
  readonly ramBudget: number;
  /** Worst-case stack bytes. */
  readonly stackWorstCase: number;
  /** Hardware-stack budget. */
  readonly stackBudget: number;
}

/**
 * The complete, immutable Static Frame Allocation result.
 *
 * Assembled by `planAllocation()` and frozen. Carries the placed frames, the
 * frame-region geometry, the zero-page and module-variable allocations, the stack
 * analysis, the ACME symbol definitions, the aggregate resource data, and a
 * `hasErrors` flag (set when a ZP or RAM budget error was emitted).
 */
export interface AllocationPlan {
  /** Placed frames, keyed by fully-qualified function name. */
  readonly frames: ReadonlyMap<string, FrameAllocation>;
  /**
   * Absolute base address of the whole RAM data region (`profile.ramStart` as
   * planned): module variables start here, the frame region follows. The
   * post-ACME overlap check asserts emitted code ends at or below this base —
   * keyed off the plan, not a profile constant, so it stays correct if a
   * platform's profile places the region elsewhere.
   */
  readonly dataBase: number;
  /** Absolute base address of the frame region (`ramStart + moduleVariablesSize`). */
  readonly frameRegionBase: number;
  /** Total frame-region size (peak simultaneous footprint). */
  readonly frameRegionSize: number;
  /** Peak simultaneous frame footprint (= `frameRegionSize`). */
  readonly peakSimultaneous: number;
  /** Bytes saved by frame sharing (Σ frame sizes − region size). */
  readonly sharingSaved: number;
  /** Placed zero-page allocations, in allocation order. */
  readonly zpAllocations: readonly ZpAllocation[];
  /** Zero-page bytes used. */
  readonly zpUsed: number;
  /** Zero-page budget (inclusive). */
  readonly zpBudget: number;
  /** Placed module-level variables, in layout order. */
  readonly moduleVariables: readonly ModuleVariableAllocation[];
  /** Total module-variable region size in bytes. */
  readonly moduleVariablesSize: number;
  /** Worst-case stack analysis. */
  readonly stackAnalysis: StackAnalysis;
  /** ACME symbol definitions for the `.asm` header, in deterministic order. */
  readonly symbolDefinitions: readonly SymbolDefinition[];
  /**
   * Fully-qualified names of the functions reachable ONLY from interrupt
   * handlers. The instruction layer draws their spill temps from the
   * `irq-temp` pool and stages their pointer formation through the dedicated
   * irq scratch pair, so an interrupt firing mid-expression can never corrupt
   * live mainline zero-page workspace. Absent (older plans / fixtures) means
   * the empty set.
   */
  readonly irqOnlyFunctions?: ReadonlySet<string>;
  /** Aggregate resource-usage data for the build summary. */
  readonly resourceData: SfaResourceData;
  /** `true` if a ZP (E10032) or RAM (E10033) budget error was emitted. */
  readonly hasErrors: boolean;
}
