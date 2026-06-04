/**
 * The SFA stack-depth analysis pass (RD-05 §4.9, R37–R40; spec Ch 11 §5,
 * Ch 06 §7.8).
 *
 * Estimates the worst-case hardware-stack usage. Each `JSR` pushes a 2-byte return
 * address, so a call chain of N levels consumes `N × 2` bytes. The worst case is:
 *
 *   - the longest call chain from `main` (`maxMainStackBytes`), plus
 *   - a one-time interrupt overhead of 6 bytes (3 CPU push + 3 register save) if
 *     any interrupt handler exists, plus
 *   - the deepest call chain within any interrupt handler (`maxIrqStackBytes`).
 *
 * The call graph is a DAG (recursion rejected upstream, R8); the longest path is
 * found by memoized DFS bounded by a visited set, so malformed cyclic input cannot
 * loop forever. With no entry point the main depth is 0 and a valid record is still
 * returned (error tolerance, R60).
 *
 * Imports `@blend65/core` only — never `@blend65/codegen` (R15/AR-20).
 * See plans/rd-05-sfa-frame-planner/03-04-stack-and-budgets.md.
 */

import type { FunctionInfo, StackAnalysis, PlatformProfile } from "@blend65/core";

/** Bytes pushed by one `JSR` (the return address). */
const BYTES_PER_LEVEL = 2;

/** Interrupt entry overhead: 3 CPU push + 3 register save (Ch 06 §7.8). */
const IRQ_OVERHEAD_BYTES = 6;

/** Returns `true` if `name` denotes the entry point (`main` or `module.main`). */
function isMain(name: string): boolean {
  return name === "main" || name.endsWith(".main");
}

/**
 * Computes the longest call chain (in levels) starting at `start`, where `start`
 * itself counts as level 1. Memoized over the DAG; a visited set on the current
 * path bounds malformed cycles to a finite walk.
 *
 * @param start The function to start from.
 * @param byName Lookup from function name to its record.
 * @param memo Cache of already-computed longest paths.
 * @returns The number of call levels in the deepest chain from `start`.
 */
function longestPathFrom(
  start: string,
  byName: ReadonlyMap<string, FunctionInfo>,
  memo: Map<string, number>,
): number {
  /** Inner DFS carrying the on-path visited set to break cycles defensively. */
  function dfs(name: string, onPath: Set<string>): number {
    const cached = memo.get(name);
    if (cached !== undefined) {
      return cached;
    }
    const fn = byName.get(name);
    if (!fn) {
      return 0; // dangling callee — contributes no depth (R61).
    }
    let deepestCallee = 0;
    onPath.add(name);
    for (const callee of fn.callees) {
      if (onPath.has(callee) || !byName.has(callee)) {
        continue; // skip cycles and dangling names.
      }
      deepestCallee = Math.max(deepestCallee, dfs(callee, onPath));
    }
    onPath.delete(name);
    const result = 1 + deepestCallee;
    memo.set(name, result);
    return result;
  }
  return dfs(start, new Set<string>());
}

/**
 * Analyzes worst-case hardware-stack usage (R37–R40, §4.9).
 *
 * @param fns The functions (each carrying its callees and the interrupt flag).
 * @param profile The platform profile (supplies `stackBudget`/`stackWarnThreshold`).
 * @returns The completed {@link StackAnalysis} record.
 */
export function analyzeStack(
  fns: readonly FunctionInfo[],
  profile: PlatformProfile,
): StackAnalysis {
  const byName = new Map(fns.map((f) => [f.name, f]));
  // The DAG is acyclic, so a single memo is valid across all roots.
  const memo = new Map<string, number>();

  // Main path: the deepest chain from the entry point (0 if none).
  const mainFn = fns.find((f) => isMain(f.name));
  const maxMainDepth = mainFn ? longestPathFrom(mainFn.name, byName, memo) : 0;
  const maxMainStackBytes = maxMainDepth * BYTES_PER_LEVEL;

  // IRQ path: the deepest chain over all interrupt handlers.
  const interrupts = fns.filter((f) => f.isInterrupt);
  let maxIrqDepth = 0;
  for (const irq of interrupts) {
    maxIrqDepth = Math.max(maxIrqDepth, longestPathFrom(irq.name, byName, memo));
  }
  const maxIrqStackBytes = maxIrqDepth * BYTES_PER_LEVEL;

  const irqOverhead = interrupts.length > 0 ? IRQ_OVERHEAD_BYTES : 0;
  const totalWorstCase = maxMainStackBytes + irqOverhead + maxIrqStackBytes;

  const exceedsWarningThreshold =
    totalWorstCase >= profile.stackBudget * profile.stackWarnThreshold;

  return {
    maxMainDepth,
    maxMainStackBytes,
    maxIrqDepth,
    maxIrqStackBytes,
    irqOverhead,
    totalWorstCase,
    platformBudget: profile.stackBudget,
    exceedsWarningThreshold,
  };
}
