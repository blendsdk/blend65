/**
 * Specification tests for the interrupt-handler codegen ABI — frozen spec
 * Ch 06 §7.4. A handler saves all three CPU registers on entry
 * (`PHA/TXA/PHA/TYA/PHA`), runs its body, and restores them in reverse order
 * before returning with `RTI` (`PLA/TAY/PLA/TAX/PLA/RTI`). The CPU stacks
 * the status register automatically on interrupt entry and `RTI` restores
 * it, so no explicit P handling appears. EVERY exit path carries the full
 * restore sequence — an early return is a complete interrupt exit.
 *
 * Derived exclusively from the specification — never from reading the
 * implementation (immutable oracle rule).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag } from "@blend65/core";
import type { AllocationPlan } from "@blend65/core";
import { IL_BYTE } from "../il/il-type.js";
import { imm, loc } from "../il/operand.js";
import type { BasicBlock, ILFunction } from "../il/cfg.js";
import { isInstr } from "./stream.js";
import type { StreamEntry } from "./stream.js";
import { translateFunction } from "./translate.js";

/** An instruction entry of the stream (the `isInstr`-narrowed member). */
type InstrEntry = Extract<StreamEntry, { type: "instr" }>;

/** A minimal empty allocation plan (the hand-built IL references symbols directly). */
function emptyPlan(): AllocationPlan {
  return {
    frames: new Map(),
    dataBase: 0,
    frameRegionBase: 0,
    frameRegionSize: 0,
    peakSimultaneous: 0,
    sharingSaved: 0,
    zpAllocations: [],
    zpUsed: 0,
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
      zpUsed: 0,
      zpBudget: 256,
      ramUsed: 0,
      ramBudget: 0,
      stackWorstCase: 0,
      stackBudget: 256,
    },
    hasErrors: false,
  };
}

/** Build a handler (or plain function) around the given blocks. */
function fnOf(blocks: readonly BasicBlock[], isInterrupt: boolean): ILFunction {
  return {
    name: "Main.onIRQ",
    params: [],
    returnType: "void",
    blocks: [...blocks],
    tempCount: 4,
    isInterrupt,
  };
}

/** Translate and return the emitted opcode list (labels stripped). */
function opcodesOf(fn: ILFunction): string[] {
  const bag = createDiagnosticBag();
  const stream = translateFunction(fn, emptyPlan(), "nmos6502", bag);
  expect(bag.hasErrors()).toBe(false);
  return stream.entries.filter(isInstr).map((i: InstrEntry) => i.opcode);
}

/** One `poke($D019, $FF)`-shaped body instruction. */
const ACK: BasicBlock["instructions"][number] = {
  op: "store",
  a: imm(0xff, IL_BYTE),
  b: loc("$D019", IL_BYTE),
};

const SAVE = ["PHA", "TXA", "PHA", "TYA", "PHA"];
const RESTORE = ["PLA", "TAY", "PLA", "TAX", "PLA", "RTI"];

describe("interrupt handler ABI (ST-14, ST-15)", () => {
  it("ST-14: a handler body sits between the register save and the restore+RTI", () => {
    const ops = opcodesOf(
      fnOf([{ label: "_entry", instructions: [ACK], terminator: { kind: "ret" } }], true),
    );
    expect(ops.slice(0, 5)).toEqual(SAVE);
    expect(ops.slice(-6)).toEqual(RESTORE);
    // The body's store executes between the two sequences.
    expect(ops.slice(5, -6)).toContain("STA");
    expect(ops).not.toContain("RTS");
  });

  it("ST-15: EVERY exit path carries the full restore+RTI", () => {
    const ops = opcodesOf(
      fnOf(
        [
          { label: "_entry", instructions: [], terminator: { kind: "ret" } },
          { label: "L1", instructions: [ACK], terminator: { kind: "ret" } },
        ],
        true,
      ),
    );
    expect(ops.filter((o) => o === "RTI")).toHaveLength(2);
    expect(ops.filter((o) => o === "PLA")).toHaveLength(6);
    expect(ops.filter((o) => o === "TAY")).toHaveLength(2);
    expect(ops.filter((o) => o === "TAX")).toHaveLength(2);
    // Each RTI is the tail of one complete restore sequence.
    for (let i = 0; i < ops.length; i++) {
      if (ops[i] === "RTI") {
        expect(ops.slice(i - 5, i + 1)).toEqual(RESTORE);
      }
    }
  });

  it("a plain function keeps the RTS convention with no register save", () => {
    const ops = opcodesOf(
      fnOf([{ label: "_entry", instructions: [ACK], terminator: { kind: "ret" } }], false),
    );
    expect(ops[0]).not.toBe("PHA");
    expect(ops).toContain("RTS");
    expect(ops).not.toContain("RTI");
  });
});
