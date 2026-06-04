/**
 * The SFA module-variable layout and zero-page allocator (RD-05 §4.5/§4.7/§4.8,
 * R24–R36; spec Ch 11 §4/§7).
 *
 * Three responsibilities:
 *
 *   1. {@link layoutModuleVariables} — places module-level `let` variables
 *      sequentially in RAM starting at `ramStart` (sum-of-sizes layout, R24).
 *   2. {@link computePeakPointers} — counts the peak number of simultaneously-live
 *      struct/array by-reference pointers, so non-overlapping functions share
 *      pointer slots while nested ones accumulate them (R31/R32).
 *   3. {@link allocateZeroPage} — places zero-page bytes in the fixed priority
 *      order arg-block → user → pointer → temp → irq-temp (R28–R36). On overflow it
 *      emits **E10032** exactly once, sets `overflowed`, and stops (no partial
 *      garbage). The arg-block category is plumbed but its interim floor is 0 (D8 —
 *      RD-17 owns the real ABI floor; raising it is a pure profile change).
 *
 * Imports `@blend65/core` only — never `@blend65/codegen` (R15/AR-20). The ZP
 * allocator is the single emitter of E10032; `checkBudgets` never re-emits it.
 *
 * See plans/rd-05-sfa-frame-planner/03-03-zp-and-layout.md.
 */

import type {
  FunctionInfo,
  InterferenceGraph,
  ModuleVariableAllocation,
  ZpAllocation,
  PlatformProfile,
  DiagnosticBag,
  Type,
} from "@blend65/core";
import { DiagCode } from "@blend65/core";

/** One module-level variable to be laid out in RAM (planner input). */
export interface ModuleVarInput {
  readonly moduleName: string;
  readonly variableName: string;
  readonly type: Type;
  readonly size: number;
}

/**
 * Lays out module-level variables sequentially in RAM (R24, §4.5).
 *
 * Variables occupy `[ramStart, ramStart + totalSize)` in the given order, each at
 * a running byte offset. The absolute `address` is provisional (`ramStart + offset`);
 * authoritative placement is finalized at emit time (AR-67). The pre-ACME budget
 * check needs only the `totalSize`.
 *
 * @param vars Module variables in module-init then declaration order.
 * @param ramStart The RAM segment start (defaults to 0 when laying out offsets only).
 * @returns The placed allocations and the total region size.
 */
export function layoutModuleVariables(
  vars: readonly ModuleVarInput[],
  ramStart = 0,
): { allocations: ModuleVariableAllocation[]; totalSize: number } {
  const allocations: ModuleVariableAllocation[] = [];
  let offset = 0;
  for (const v of vars) {
    allocations.push({
      moduleName: v.moduleName,
      variableName: v.variableName,
      address: ramStart + offset,
      offset,
      size: v.size,
      type: v.type,
    });
    offset += v.size;
  }
  return { allocations, totalSize: offset };
}

/** Counts a function's by-reference (struct/array pointer) parameters. */
function byRefParamCount(fn: FunctionInfo): number {
  let n = 0;
  for (const p of fn.parameters) {
    if (p.byRef) {
      n += 1;
    }
  }
  return n;
}

/**
 * Computes the peak number of simultaneously-live struct/array pointers (R31/R32,
 * §4.7).
 *
 * Each by-reference parameter needs one pointer slot while its function is live.
 * Sequential (non-interfering) functions reuse the same slots; nested (interfering)
 * functions accumulate. The peak is the maximum, over every function `F`, of the
 * sum of by-ref-param counts across `F` and its interfering neighbours — a
 * conservative upper bound (never under-allocates), which satisfies determinism
 * (H5). Exact minimization is a future optimization and does not affect correctness.
 *
 * @param fns The functions (each carrying its by-ref params).
 * @param graph The interference graph from `buildInterferenceGraph`.
 * @returns The peak simultaneous pointer count.
 */
export function computePeakPointers(
  fns: readonly FunctionInfo[],
  graph: InterferenceGraph,
): number {
  const byName = new Map(fns.map((f) => [f.name, f]));
  let peak = 0;

  for (const name of graph.nodes) {
    const self = byName.get(name);
    if (!self) {
      continue;
    }
    // F's own by-ref params plus those of every interfering neighbour are live
    // together at F's deepest point (conservative upper bound).
    let needed = byRefParamCount(self);
    for (const neighbour of graph.edges.get(name) ?? []) {
      const ng = byName.get(neighbour);
      if (ng) {
        needed += byRefParamCount(ng);
      }
    }
    peak = Math.max(peak, needed);
  }
  return peak;
}

/** Inputs to the zero-page allocator (the four active categories + arg-block). */
export interface ZpInput {
  /** Zeropage-declared user variables, in declaration order. */
  readonly userVars: readonly { name: string; size: number }[];
  /** Peak struct/array pointer slots (from {@link computePeakPointers}). */
  readonly peakPointers: number;
  /** Main expression-temp bytes (`profile.mainTempBytes`). */
  readonly mainTemps: number;
  /** IRQ temp bytes (`profile.irqTempBytes`). */
  readonly irqTemps: number;
  /** Reserved runtime-ABI arg-block floor (`profile.zpArgBlockMin`; interim 0, D8). */
  readonly argBlockMin: number;
}

/**
 * Allocates zero-page bytes in the fixed priority order (R28–R36, §4.7).
 *
 * Order: arg-block (deferred, interim floor 0 — D8) → user `zeropage` vars →
 * struct/array pointers (`__zp_ptr_N`, 2 bytes each) → main temps (`__zp_tmp_N`) →
 * IRQ temps (`__zp_irq_tmp_N`). The first placement that would push the cursor past
 * `zpEnd` emits **E10032** once, sets `overflowed`, and stops — no partial garbage.
 * Names and order are deterministic (R36).
 *
 * @param input The category sizes and user vars.
 * @param profile The platform profile (supplies `zpStart`/`zpEnd`/`name`).
 * @param bag The diagnostic accumulator (receives E10032 on overflow).
 * @returns The placed allocations, total bytes used, and the overflow flag.
 */
export function allocateZeroPage(
  input: ZpInput,
  profile: PlatformProfile,
  bag: DiagnosticBag,
): { allocations: ZpAllocation[]; used: number; overflowed: boolean } {
  const allocations: ZpAllocation[] = [];
  let cursor = profile.zpStart;
  let overflowed = false;

  /**
   * Places `size` bytes for one named slot of `category`, guarding the budget.
   * Returns `false` (and emits E10032 once) if the slot would overflow `zpEnd`.
   */
  function place(name: string, size: number, category: ZpAllocation["category"]): boolean {
    // Inclusive ZP budget: the last usable byte is zpEnd, so the highest legal
    // end-cursor is zpEnd + 1.
    if (cursor + size > profile.zpEnd + 1) {
      if (!overflowed) {
        overflowed = true;
        const used = cursor - profile.zpStart;
        const budget = profile.zpEnd - profile.zpStart + 1;
        bag.addError(
          DiagCode.ZpBudgetExceeded,
          null,
          `Zero-page budget exceeded — ${used} bytes used, platform '${profile.name}' allows ${budget} bytes`,
        );
      }
      return false;
    }
    allocations.push({ name, address: cursor, size, category });
    cursor += size;
    return true;
  }

  // Reserve runtime-ABI arg-block first (AR-34); interim floor 0 (D8 → RD-17). The
  // loop is plumbed so RD-17 lights it up additively with no code change.
  for (let i = 0; i < input.argBlockMin; i++) {
    if (!place(`__zp_arg_${i}`, 1, "arg-block")) {
      return finish();
    }
  }
  // Priority 1: user zeropage variables (R30), declaration order.
  for (const v of input.userVars) {
    if (!place(v.name, v.size, "user")) {
      return finish();
    }
  }
  // Priority 2: struct/array pointer slots (R31/R32), 2 bytes each.
  for (let n = 0; n < input.peakPointers; n++) {
    if (!place(`__zp_ptr_${n}`, 2, "pointer")) {
      return finish();
    }
  }
  // Priority 3: main expression temps (R33).
  for (let n = 0; n < input.mainTemps; n++) {
    if (!place(`__zp_tmp_${n}`, 1, "temp")) {
      return finish();
    }
  }
  // Priority 4: IRQ temps (R34, separate pool).
  for (let n = 0; n < input.irqTemps; n++) {
    if (!place(`__zp_irq_tmp_${n}`, 1, "irq-temp")) {
      return finish();
    }
  }
  return finish();

  /** Assembles the result with the final used-byte count. */
  function finish(): { allocations: ZpAllocation[]; used: number; overflowed: boolean } {
    return { allocations, used: cursor - profile.zpStart, overflowed };
  }
}
