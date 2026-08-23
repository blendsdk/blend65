/**
 * Implementation tests for the register binder (edge cases & internals).
 *
 * Written AFTER the implementation: these exercise internal behavior the
 * specification cases do not pin — multi-slot spill sequencing, reset
 * idempotence, the `operandFor` reg-as-memory ICE, and `TXA`/`TYA` reloads from
 * the X/Y registers. They complement `register-binding.spec.test.ts`.
 */

import { describe, expect, it } from "vitest";
import {
  createDiagnosticBag,
  IceCode,
  type AllocationPlan,
  type ZpAllocation,
} from "@blend65/core";
import { temp } from "../il/operand.js";
import { IL_BYTE, IL_WORD } from "../il/il-type.js";
import type { StreamEntry } from "./stream.js";
import { isInstr } from "./stream.js";
import { zpSlot } from "./operand.js";
import { createRegisterBinder } from "./register-binding.js";

function makePlan(tempSlotNames: readonly string[]): AllocationPlan {
  const zpAllocations: ZpAllocation[] = tempSlotNames.map((name, i) => ({
    name,
    address: 0x10 + i,
    size: 1,
    category: "temp",
  }));
  return {
    frames: new Map(),
    dataBase: 0,
    frameRegionBase: 0,
    frameRegionSize: 0,
    peakSimultaneous: 0,
    sharingSaved: 0,
    zpAllocations,
    zpUsed: zpAllocations.length,
    zpBudget: 256,
    moduleVariables: [],
    moduleVariablesSize: 0,
    stackAnalysis: {
      maxMainDepth: 0,
      maxMainStackBytes: 0,
      maxIrqDepth: 0,
      maxIrqStackBytes: 0,
      irqOverhead: 0,
      totalWorstCase: 0,
      platformBudget: 256,
      exceedsWarningThreshold: false,
    },
    symbolDefinitions: [],
    resourceData: {
      frameRegionBytes: 0,
      frameRegionPeak: 0,
      frameSharingSaved: 0,
      zpUsed: zpAllocations.length,
      zpBudget: 256,
      ramUsed: 0,
      ramBudget: 0,
      stackWorstCase: 0,
      stackBudget: 256,
    },
    hasErrors: false,
  };
}

function collector(): { out: StreamEntry[]; emit: (e: StreamEntry) => void } {
  const out: StreamEntry[] = [];
  return { out, emit: (e) => out.push(e) };
}

describe("register binder — multi-slot spill sequencing", () => {
  it("hands out distinct ZP slots in allocation order", () => {
    const bag = createDiagnosticBag();
    const binder = createRegisterBinder(makePlan(["__zp_tmp_0", "__zp_tmp_1"]), bag);
    const { out, emit } = collector();

    const t0 = temp(0, IL_BYTE);
    const t1 = temp(1, IL_BYTE);
    binder.bindResultToA(t0);
    binder.spill(t0, emit);
    binder.bindResultToA(t1);
    binder.spill(t1, emit);

    expect(binder.locationOf(t0)).toEqual({ kind: "zp", slot: "__zp_tmp_0" });
    expect(binder.locationOf(t1)).toEqual({ kind: "zp", slot: "__zp_tmp_1" });
    expect(out.filter(isInstr).map((e) => (isInstr(e) ? e.operand : null))).toEqual([
      zpSlot("__zp_tmp_0"),
      zpSlot("__zp_tmp_1"),
    ]);
    expect(bag.hasErrors()).toBe(false);
  });

  it("stores a word's A:X bytes in distinct addressable slots", () => {
    const bag = createDiagnosticBag();
    const binder = createRegisterBinder(makePlan(["__zp_tmp_0", "__zp_tmp_1"]), bag);
    const { out, emit } = collector();
    const word = temp(0, IL_WORD);
    binder.bindResultToA(word);
    binder.bindResultToX(word);

    expect(binder.spillWord(word, emit)).toBe(true);
    expect(out.filter(isInstr).map((entry) => (isInstr(entry) ? entry.opcode : null))).toEqual([
      "STA",
      "STX",
    ]);
    expect(binder.operandForByte(word, 0)).toEqual(zpSlot("__zp_tmp_0"));
    expect(binder.operandForByte(word, 1)).toEqual(zpSlot("__zp_tmp_1"));
    expect(bag.hasErrors()).toBe(false);
  });

  it("rejects a word spill before emitting when two slots are unavailable", () => {
    const bag = createDiagnosticBag();
    const binder = createRegisterBinder(makePlan(["__zp_tmp_0"]), bag);
    const { out, emit } = collector();
    const word = temp(0, IL_WORD);
    binder.bindResultToA(word);
    binder.bindResultToX(word);

    expect(binder.spillWord(word, emit)).toBe(false);
    expect(out).toEqual([]);
    expect(bag.getErrors()[0]?.code).toBe(IceCode.Unexpected);
  });

  it("reuses a released word's slots but keeps overlapping words distinct", () => {
    const bag = createDiagnosticBag();
    const binder = createRegisterBinder(
      makePlan(["__zp_tmp_0", "__zp_tmp_1", "__zp_tmp_2", "__zp_tmp_3"]),
      bag,
    );
    const { emit } = collector();
    const first = temp(0, IL_WORD);
    const overlap = temp(1, IL_WORD);
    const reused = temp(2, IL_WORD);

    binder.bindResultToA(first);
    binder.bindResultToX(first);
    expect(binder.spillWord(first, emit)).toBe(true);
    binder.bindResultToA(overlap);
    binder.bindResultToX(overlap);
    expect(binder.spillWord(overlap, emit)).toBe(true);
    expect(binder.operandForByte(first, 0)).toEqual(zpSlot("__zp_tmp_0"));
    expect(binder.operandForByte(overlap, 0)).toEqual(zpSlot("__zp_tmp_2"));

    binder.release(first);
    binder.bindResultToA(reused);
    binder.bindResultToX(reused);
    expect(binder.spillWord(reused, emit)).toBe(true);
    expect(binder.operandForByte(reused, 0)).toEqual(zpSlot("__zp_tmp_0"));
    expect(binder.operandForByte(reused, 1)).toEqual(zpSlot("__zp_tmp_1"));
    expect(binder.operandForByte(overlap, 1)).toEqual(zpSlot("__zp_tmp_3"));
    expect(bag.hasErrors()).toBe(false);
  });
});

describe("register binder — reset idempotence", () => {
  it("is a no-op when called repeatedly on an already-clear binder", () => {
    const bag = createDiagnosticBag();
    const binder = createRegisterBinder(makePlan([]), bag);
    binder.reset();
    binder.reset();
    expect(bag.hasErrors()).toBe(false);
  });
});

describe("register binder — operandFor", () => {
  it("returns a zpSlot operand for a spilled temp", () => {
    const bag = createDiagnosticBag();
    const binder = createRegisterBinder(makePlan(["__zp_tmp_0"]), bag);
    const { emit } = collector();
    const t0 = temp(0, IL_BYTE);
    binder.bindResultToA(t0);
    binder.spill(t0, emit);
    expect(binder.operandFor(t0)).toEqual(zpSlot("__zp_tmp_0"));
    expect(bag.hasErrors()).toBe(false);
  });

  it("raises an E90001 ICE when asked to address a register temp as memory", () => {
    const bag = createDiagnosticBag();
    const binder = createRegisterBinder(makePlan([]), bag);
    const t0 = temp(0, IL_BYTE);
    binder.bindResultToA(t0); // resident in A
    binder.operandFor(t0);
    expect(bag.hasErrors()).toBe(true);
    expect(bag.getErrors()[0].code).toBe(IceCode.Unexpected);
  });
});

describe("register binder — ensureInA from X via TXA", () => {
  it("emits TXA when the wanted temp currently lives in X", () => {
    const bag = createDiagnosticBag();
    const binder = createRegisterBinder(makePlan([]), bag);
    const { out, emit } = collector();
    const t0 = temp(0, IL_BYTE);
    binder.bindResultToX(t0);
    binder.ensureInA(t0, emit);
    expect(out).toHaveLength(1);
    const e = out[0];
    expect(isInstr(e)).toBe(true);
    if (isInstr(e)) expect(e.opcode).toBe("TXA");
    expect(binder.locationOf(t0)).toEqual({ kind: "reg", reg: "A" });
  });
});
