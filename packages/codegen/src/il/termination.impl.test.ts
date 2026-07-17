/**
 * Implementation tests for the termination walker's mechanics: constant
 * branches follow exactly their taken edge (both polarities), `unreachable`
 * ends a path, an empty function stays conservative, and malformed inputs
 * (dangling branch targets) terminate without throwing.
 */

import { describe, expect, it } from "vitest";
import { IL_BYTE } from "./il-type.js";
import { imm, temp } from "./operand.js";
import type { BasicBlock, ILFunction } from "./cfg.js";
import { functionCanReturn } from "./termination.js";

/** Wraps blocks into a minimal function. */
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

describe("termination walker internals", () => {
  it("follows only the FALSE edge of a constant-false branch", () => {
    // do { } while (false): the back edge is never taken; the exit returns.
    const can = functionCanReturn(
      fnOf([
        {
          label: "_entry",
          instructions: [],
          terminator: { kind: "brcond", cond: imm(0, IL_BYTE), trueTarget: "_entry", falseTarget: "_exit" },
        },
        { label: "_exit", instructions: [], terminator: { kind: "ret" } },
      ]),
    );
    expect(can).toBe(true);
  });

  it("never reaches a ret that only the untaken constant edge could reach", () => {
    const can = functionCanReturn(
      fnOf([
        {
          label: "_entry",
          instructions: [],
          terminator: { kind: "brcond", cond: imm(1, IL_BYTE), trueTarget: "_loop", falseTarget: "_dead" },
        },
        { label: "_loop", instructions: [], terminator: { kind: "br", target: "_loop" } },
        { label: "_dead", instructions: [], terminator: { kind: "ret" } },
      ]),
    );
    expect(can).toBe(false);
  });

  it("keeps both edges live for a runtime condition", () => {
    const can = functionCanReturn(
      fnOf([
        {
          label: "_entry",
          instructions: [],
          terminator: {
            kind: "brcond",
            cond: temp(0, IL_BYTE),
            trueTarget: "_loop",
            falseTarget: "_exit",
          },
        },
        { label: "_loop", instructions: [], terminator: { kind: "br", target: "_entry" } },
        { label: "_exit", instructions: [], terminator: { kind: "ret" } },
      ]),
    );
    expect(can).toBe(true);
  });

  it("treats unreachable as a path end", () => {
    const can = functionCanReturn(
      fnOf([{ label: "_entry", instructions: [], terminator: { kind: "unreachable" } }]),
    );
    expect(can).toBe(false);
  });

  it("stays conservative for an empty function", () => {
    expect(functionCanReturn(fnOf([]))).toBe(true);
  });

  it("ignores a dangling branch target without throwing", () => {
    const can = functionCanReturn(
      fnOf([{ label: "_entry", instructions: [], terminator: { kind: "br", target: "_missing" } }]),
    );
    expect(can).toBe(false);
  });
});
