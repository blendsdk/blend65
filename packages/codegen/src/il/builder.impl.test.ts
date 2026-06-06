/**
 * Implementation tests for `IlFunctionBuilder` (RD-06 §4.4).
 *
 * Edge cases and internals NOT pinned by a spec oracle: monotonic temp ids,
 * sequential block labels, the frozen/immutable output, `tempCount`, and the
 * fallback-terminator behaviour. Written AFTER the implementation (testing.md
 * Rule 6/10).
 */

import { describe, expect, it } from "vitest";

import { IL_BYTE, IL_WORD } from "./il-type.js";
import { loc } from "./operand.js";
import { IlFunctionBuilder } from "./builder.js";

describe("IlFunctionBuilder — temp & label sequencing", () => {
  it("should mint temps with monotonically increasing ids from 0", () => {
    const b = new IlFunctionBuilder("M.f", [], "void", false);
    const t0 = b.newTemp(IL_BYTE);
    const t1 = b.newTemp(IL_WORD);
    const t2 = b.newTemp(IL_BYTE);
    expect(t0).toEqual({ kind: "temp", id: 0, type: IL_BYTE });
    expect(t1).toEqual({ kind: "temp", id: 1, type: IL_WORD });
    expect(t2).toEqual({ kind: "temp", id: 2, type: IL_BYTE });
  });

  it("should reserve labels _L0, _L1, … in call order", () => {
    const b = new IlFunctionBuilder("M.f", [], "void", false);
    expect(b.reserveLabel()).toBe("_L0");
    expect(b.reserveLabel()).toBe("_L1");
  });

  it("should report tempCount as the number of temps minted", () => {
    const b = new IlFunctionBuilder("M.f", [], "void", false);
    b.newTemp(IL_BYTE);
    b.newTemp(IL_BYTE);
    const fn = b.finish({ kind: "ret" });
    expect(fn.tempCount).toBe(2);
  });
});

describe("IlFunctionBuilder — block construction", () => {
  it("should start with an _entry block as blocks[0] (R16)", () => {
    const b = new IlFunctionBuilder("M.f", [], "void", false);
    const fn = b.finish({ kind: "ret" });
    expect(fn.blocks[0].label).toBe("_entry");
  });

  it("should apply the fallback terminator to an un-terminated block", () => {
    const b = new IlFunctionBuilder("M.f", [], "void", false);
    const fn = b.finish({ kind: "ret" });
    expect(fn.blocks[0].terminator).toEqual({ kind: "ret" });
  });

  it("should keep an explicit terminator over the fallback", () => {
    const b = new IlFunctionBuilder("M.f", [], IL_BYTE, false);
    const t = b.newTemp(IL_BYTE);
    b.terminate({ kind: "ret", value: t });
    expect(b.isTerminated()).toBe(true);
    const fn = b.finish({ kind: "ret" });
    expect(fn.blocks[0].terminator).toEqual({ kind: "ret", value: t });
  });

  it("should append further blocks after openBlock, entry first", () => {
    const b = new IlFunctionBuilder("M.f", [], "void", false);
    const label = b.reserveLabel();
    b.terminate({ kind: "br", target: label });
    b.openBlock(label);
    const fn = b.finish({ kind: "ret" });
    expect(fn.blocks.map((bl) => bl.label)).toEqual(["_entry", "_L0"]);
  });
});

describe("IlFunctionBuilder — immutability & params", () => {
  it("should freeze the produced function, its blocks, and instruction lists", () => {
    const b = new IlFunctionBuilder("M.f", [], "void", false);
    b.emit({ op: "store", a: { kind: "immediate", value: 1, type: IL_BYTE }, b: loc("$1", IL_WORD) });
    const fn = b.finish({ kind: "ret" });
    expect(Object.isFrozen(fn)).toBe(true);
    expect(Object.isFrozen(fn.blocks)).toBe(true);
    expect(Object.isFrozen(fn.blocks[0].instructions)).toBe(true);
  });

  it("should carry params and returnType through unchanged", () => {
    const params = [loc("__frame_M_f_a", IL_BYTE)];
    const b = new IlFunctionBuilder("M.f", params, IL_BYTE, false);
    const fn = b.finish({ kind: "ret" });
    expect(fn.params).toEqual(params);
    expect(fn.returnType).toBe(IL_BYTE);
    expect(fn.isInterrupt).toBe(false);
  });
});
