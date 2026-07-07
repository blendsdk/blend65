/**
 * Specification tests for the register binder.
 *
 * These are immutable oracles: if the implementation disagrees, the
 * implementation is wrong.
 *
 * The binder maps IL virtual temps onto the 6502's A/X/Y registers plus ZP
 * scratch slots (`category: "temp"` runs) drawn from the carried `AllocationPlan`.
 * A temp's location is a `TempLocation` union (`reg` | `zp`) — a register
 * is implied by the opcode and is never expressible as an `InstrOperand`.
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

/**
 * Build a minimal `AllocationPlan` exposing the given `category: "temp"` ZP
 * scratch slots (the only field the binder reads). Every other field is a
 * documented zero/empty — the binder never touches them in this slice.
 */
function makePlan(tempSlotNames: readonly string[]): AllocationPlan {
  const zpAllocations: ZpAllocation[] = tempSlotNames.map((name, i) => ({
    name,
    address: 0x10 + i,
    size: 1,
    category: "temp",
  }));
  return {
    frames: new Map(),
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

/** Collect emitted stream entries via a push callback. */
function collector(): { out: StreamEntry[]; emit: (e: StreamEntry) => void } {
  const out: StreamEntry[] = [];
  return { out, emit: (e) => out.push(e) };
}

describe("Specification: register binder — redundant-load suppression (ST-R1, ST-R2)", () => {
  // A already holds the temp, so ensureInA is a no-op.
  it("should emit no LDA when A already holds the temp (ST-R1)", () => {
    const bag = createDiagnosticBag();
    const binder = createRegisterBinder(makePlan(["__zp_tmp_0"]), bag);
    const { out, emit } = collector();

    const t0 = temp(0, IL_BYTE);
    binder.bindResultToA(t0);
    binder.ensureInA(t0, emit);

    expect(out).toHaveLength(0);
    expect(bag.hasErrors()).toBe(false);
  });

  // A holds another temp; ensureInA loads t from its home.
  it("should emit LDA from the temp's home when A holds another temp (ST-R2)", () => {
    const bag = createDiagnosticBag();
    const binder = createRegisterBinder(makePlan(["__zp_tmp_0"]), bag);
    const { out, emit } = collector();

    const t0 = temp(0, IL_BYTE);
    const t1 = temp(1, IL_BYTE);
    // Give t0 a home in ZP, then occupy A with t1.
    binder.bindResultToA(t0);
    binder.spill(t0, emit);
    binder.bindResultToA(t1);
    out.length = 0; // discard the spill STA; assert only the ensureInA emission

    binder.ensureInA(t0, emit);

    expect(out).toHaveLength(1);
    const entry = out[0];
    expect(isInstr(entry)).toBe(true);
    if (isInstr(entry)) {
      expect(entry.opcode).toBe("LDA");
      expect(entry.operand).toEqual(zpSlot("__zp_tmp_0"));
    }
    expect(binder.locationOf(t0)).toEqual({ kind: "reg", reg: "A" });
  });
});

describe("Specification: register binder — A/X roles (ST-R3, ST-R4)", () => {
  // bindResultToA records the temp in A; locationOf ⇒ A.
  it("should report a temp bound to A as a reg/A location (ST-R3)", () => {
    const bag = createDiagnosticBag();
    const binder = createRegisterBinder(makePlan([]), bag);

    const t0 = temp(0, IL_BYTE);
    binder.bindResultToA(t0);

    expect(binder.locationOf(t0)).toEqual({ kind: "reg", reg: "A" });
    expect(bag.hasErrors()).toBe(false);
  });

  // A word value's high byte lives in X.
  it("should report a word's high byte bound to X as a reg/X location (ST-R4)", () => {
    const bag = createDiagnosticBag();
    const binder = createRegisterBinder(makePlan([]), bag);

    const lo = temp(0, IL_WORD);
    const hi = temp(1, IL_WORD);
    binder.bindResultToA(lo);
    binder.bindResultToX(hi);

    expect(binder.locationOf(lo)).toEqual({ kind: "reg", reg: "A" });
    expect(binder.locationOf(hi)).toEqual({ kind: "reg", reg: "X" });
  });
});

describe("Specification: register binder — spills (ST-R5, ST-R6, ST-R7)", () => {
  // Spilling a register temp emits STA to a ZP slot
  // and relocates the temp's home to that slot.
  it("should spill an A-resident temp to the first ZP temp slot (ST-R5)", () => {
    const bag = createDiagnosticBag();
    const binder = createRegisterBinder(makePlan(["__zp_tmp_0"]), bag);
    const { out, emit } = collector();

    const t0 = temp(0, IL_BYTE);
    binder.bindResultToA(t0);
    binder.spill(t0, emit);

    expect(out).toHaveLength(1);
    const entry = out[0];
    expect(isInstr(entry)).toBe(true);
    if (isInstr(entry)) {
      expect(entry.opcode).toBe("STA");
      expect(entry.operand).toEqual(zpSlot("__zp_tmp_0"));
    }
    expect(binder.locationOf(t0)).toEqual({ kind: "zp", slot: "__zp_tmp_0" });
  });

  // Spill selection is deterministic: the same
  // script over a fresh binder yields byte-identical emissions.
  it("should produce identical emissions for an identical spill script (ST-R6)", () => {
    const script = (): StreamEntry[] => {
      const bag = createDiagnosticBag();
      const binder = createRegisterBinder(makePlan(["__zp_tmp_0", "__zp_tmp_1"]), bag);
      const { out, emit } = collector();
      const t0 = temp(0, IL_BYTE);
      const t1 = temp(1, IL_BYTE);
      binder.bindResultToA(t0);
      binder.spill(t0, emit);
      binder.bindResultToA(t1);
      binder.spill(t1, emit);
      return out;
    };

    expect(script()).toEqual(script());
  });

  // Spill demand exceeding the plan's "temp" ZP runs is a
  // codegen/planner contract violation → E90001 ICE, never silent corruption.
  it("should raise an E90001 ICE when spill demand exceeds the ZP temp runs (ST-R7)", () => {
    const bag = createDiagnosticBag();
    const binder = createRegisterBinder(makePlan(["__zp_tmp_0"]), bag);
    const { emit } = collector();

    const t0 = temp(0, IL_BYTE);
    const t1 = temp(1, IL_BYTE);
    binder.bindResultToA(t0);
    binder.spill(t0, emit); // consumes the only slot
    binder.bindResultToA(t1);
    binder.spill(t1, emit); // no slot left → ICE

    expect(bag.hasErrors()).toBe(true);
    expect(bag.getErrors()[0].code).toBe(IceCode.Unexpected);
  });
});

describe("Specification: register binder — block-boundary reset (ST-R8)", () => {
  // reset() clears register knowledge so the
  // next ensureInA reloads from the temp's (surviving) memory home.
  it("should clear register state on reset so the next ensureInA reloads (ST-R8)", () => {
    const bag = createDiagnosticBag();
    const binder = createRegisterBinder(makePlan(["__zp_tmp_0"]), bag);

    const t0 = temp(0, IL_BYTE);
    binder.bindResultToA(t0);
    binder.spill(t0, emitNull); // home = __zp_tmp_0, A freed

    // Bring it back into A, then prove a second ensureInA is suppressed.
    const c1 = collector();
    binder.ensureInA(t0, c1.emit);
    expect(c1.out).toHaveLength(1); // reloaded into A
    const c2 = collector();
    binder.ensureInA(t0, c2.emit);
    expect(c2.out).toHaveLength(0); // already in A → suppressed

    // After reset, A is forgotten → ensureInA reloads again.
    binder.reset();
    const c3 = collector();
    binder.ensureInA(t0, c3.emit);
    expect(c3.out).toHaveLength(1);
    const reentry = c3.out[0];
    expect(isInstr(reentry)).toBe(true);
    if (isInstr(reentry)) {
      expect(reentry.opcode).toBe("LDA");
    }
  });
});

/** A discarding emit sink for setup steps whose emissions are not asserted. */
function emitNull(_e: StreamEntry): void {
  // intentionally empty — setup emissions are not under assertion
}
