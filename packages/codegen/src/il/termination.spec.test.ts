/**
 * Specification tests for terminator successor enumeration and the
 * `main`-termination analysis that consumes it.
 *
 * `terminatorTargets` is the single place the branch targets of a terminator
 * are enumerated — the validator and the reachability walk both read it, so a
 * terminator kind it forgets would silently lose control-flow edges. The
 * termination analysis is asymmetric: under-approximating reachability
 * misclassifies a returning `main` as non-returning, which strands the final
 * `RTS` on a wild stack. A fused compare-and-branch therefore contributes
 * BOTH of its edges — it carries no constant to fold.
 *
 * Derived exclusively from the documented contract, never from reading the
 * implementation (immutable oracle rule).
 */

import { describe, expect, it } from "vitest";

import { IL_BYTE } from "./il-type.js";
import { imm, temp } from "./operand.js";
import type { BasicBlock, ILFunction } from "./cfg.js";
import { terminatorTargets } from "./cfg.js";
import { functionCanReturn } from "./termination.js";

/** Wraps blocks into a minimal function whose first block is the entry. */
function fnOf(blocks: BasicBlock[]): ILFunction {
  return {
    name: "Main.main",
    params: [],
    returnType: "void",
    blocks,
    tempCount: 1,
    isInterrupt: false,
  };
}

/**
 * A function whose ONLY `ret` sits behind one edge of a fused
 * compare-and-branch; the other edge spins forever. Reaching the `ret`
 * requires the analysis to follow that specific edge.
 */
function retBehindBrcmpEdge(edge: "true" | "false"): ILFunction {
  return fnOf([
    {
      label: "_entry",
      instructions: [],
      terminator: {
        kind: "brcmp",
        op: "lt",
        left: temp(0, IL_BYTE),
        right: imm(251, IL_BYTE),
        type: IL_BYTE,
        trueTarget: edge === "true" ? "_ret" : "_spin",
        falseTarget: edge === "true" ? "_spin" : "_ret",
      },
    },
    { label: "_ret", instructions: [], terminator: { kind: "ret" } },
    { label: "_spin", instructions: [], terminator: { kind: "br", target: "_spin" } },
  ]);
}

describe("Specification: terminator successors", () => {
  // An unconditional branch has exactly its one target.
  it("should enumerate the single target of an unconditional branch", () => {
    expect(terminatorTargets({ kind: "br", target: "_L0" })).toEqual(["_L0"]);
  });

  // A value-conditional branch has both targets, in declaration order.
  it("should enumerate both targets of a value-conditional branch, true first", () => {
    expect(
      terminatorTargets({
        kind: "brcond",
        cond: temp(0, IL_BYTE),
        trueTarget: "_then",
        falseTarget: "_else",
      }),
    ).toEqual(["_then", "_else"]);
  });

  // A fused compare-and-branch has both targets, in declaration order.
  it("should enumerate both targets of a fused compare-and-branch, true first", () => {
    expect(
      terminatorTargets({
        kind: "brcmp",
        op: "ne",
        left: temp(0, IL_BYTE),
        right: imm(5, IL_BYTE),
        type: IL_BYTE,
        trueTarget: "_body",
        falseTarget: "_end",
      }),
    ).toEqual(["_body", "_end"]);
  });

  // Terminators that leave the function branch nowhere.
  it("should enumerate no targets for a return or an unreachable block", () => {
    expect(terminatorTargets({ kind: "ret" })).toEqual([]);
    expect(terminatorTargets({ kind: "ret", value: temp(0, IL_BYTE) })).toEqual([]);
    expect(terminatorTargets({ kind: "unreachable" })).toEqual([]);
  });
});

describe("Specification: termination analysis across a fused compare-and-branch", () => {
  // The comparison is runtime-valued, so the taken edge is unknowable: both
  // are live, and a `ret` behind either one is reachable.
  it("should reach a return that lies behind the true edge of a fused branch", () => {
    expect(functionCanReturn(retBehindBrcmpEdge("true"))).toBe(true);
  });

  it("should reach a return that lies behind the false edge of a fused branch", () => {
    expect(functionCanReturn(retBehindBrcmpEdge("false"))).toBe(true);
  });

  // No `ret` anywhere behind either edge — the function genuinely cannot return.
  it("should report that a function cannot return when neither fused edge reaches a return", () => {
    const fn = fnOf([
      {
        label: "_entry",
        instructions: [],
        terminator: {
          kind: "brcmp",
          op: "eq",
          left: temp(0, IL_BYTE),
          right: imm(0, IL_BYTE),
          type: IL_BYTE,
          trueTarget: "_a",
          falseTarget: "_b",
        },
      },
      { label: "_a", instructions: [], terminator: { kind: "br", target: "_entry" } },
      { label: "_b", instructions: [], terminator: { kind: "br", target: "_entry" } },
    ]);
    expect(functionCanReturn(fn)).toBe(false);
  });
});
