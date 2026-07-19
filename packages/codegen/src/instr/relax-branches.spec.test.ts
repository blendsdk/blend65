/**
 * Specification tests for branch relaxation (`relaxBranches`).
 *
 * Every expectation below is derived exclusively from the specification and
 * from 6502 relative-branch semantics, never from reading the implementation.
 * These are immutable oracles — if the implementation disagrees, the
 * implementation is wrong, not the test.
 *
 * Contract: a conditional branch is a `Relative`-mode entry with a `labelRef`
 * operand. Its displacement is `target − (branch + 2)` in bytes, with offsets
 * accumulated via `instrByteSize` over the branch's OWN stream starting at 0
 * (labels contribute 0 bytes). A displacement outside −128..+127 rewrites the
 * branch in place into three entries — inverted branch to a freshly minted
 * local label, `JMP` to the original target, then the minted label — a net
 * +3 bytes. The pass iterates to a fixpoint (inserted bytes can push other
 * branches out of range). When nothing relaxes anywhere, the input program
 * reference itself is returned. `preamble`, `allocationPlan`, and
 * `preambleOptions` pass through unchanged. Minted labels never collide with
 * any label the stage can see (all stream labels + the preamble), and a
 * `Relative` branch whose target is absent from its own stream is an internal
 * compiler error on the bag, never a silent skip.
 */

import { describe, expect, it } from "vitest";
import {
  createDiagnosticBag,
  IceCode,
  type AllocationPlan,
  type ZpAllocation,
} from "@blend65/core";
import type { PreambleOptions } from "@blend65/core/platform";
import type { InstrStream, StreamEntry } from "./stream.js";
import { directive, instr, isInstr, isLabel, label } from "./stream.js";
import { isLabelRef, labelRef, none } from "./operand.js";
import { instrByteSize } from "./print-instr.js";
import type { InstrProgram } from "./instr-program.js";

// The module under test (does not exist yet — red phase).
import { relaxBranches } from "./relax-branches.js";

// ---------------------------------------------------------------------------
// Fixtures — hand-built InstrPrograms with exact byte-offset control. All
// offset arithmetic is computed through instrByteSize (never hardcoded) and
// self-checked inside each test before the pass runs.
// ---------------------------------------------------------------------------

/** A minimal, empty allocation plan (same shape as the other codegen spec fixtures). */
function makePlan(): AllocationPlan {
  const zpAllocations: ZpAllocation[] = [];
  return {
    frames: new Map(),
    dataBase: 0,
    frameRegionBase: 0,
    frameRegionSize: 0,
    peakSimultaneous: 0,
    sharingSaved: 0,
    zpAllocations,
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

/**
 * Exactly `bytes` bytes of padding, emitted as 1-byte implied NOPs. The NOP
 * size is taken from `instrByteSize`, so the padding count is verifiable by
 * a reader instead of resting on a hardcoded constant.
 */
function padBytes(bytes: number): StreamEntry[] {
  const nopSize = instrByteSize(instr("NOP", "Implied", none()));
  if (bytes % nopSize !== 0) {
    throw new Error(`padBytes: ${bytes} is not a multiple of the NOP size ${nopSize}`);
  }
  return Array.from({ length: bytes / nopSize }, () => instr("NOP", "Implied", none()));
}

/** Wrap entries as a code-segment stream. */
function codeStream(symbol: string, entries: readonly StreamEntry[]): InstrStream {
  return { symbol, segment: "code", entries };
}

/** Assemble an InstrProgram literal around the given streams. */
function makeProgram(
  streams: readonly InstrStream[],
  extras?: { preamble?: readonly StreamEntry[] },
): InstrProgram {
  return {
    preamble: extras?.preamble ?? [],
    streams,
    allocationPlan: makePlan(),
  };
}

/** Byte offset at which each entry begins — accumulated with instrByteSize from 0. */
function entryOffsets(entries: readonly StreamEntry[]): number[] {
  const offsets: number[] = [];
  let at = 0;
  for (const entry of entries) {
    offsets.push(at);
    at += instrByteSize(entry);
  }
  return offsets;
}

/** Total assembled byte size of an entry list. */
function totalBytes(entries: readonly StreamEntry[]): number {
  return entries.reduce((sum, entry) => sum + instrByteSize(entry), 0);
}

/** Byte offset of the label entry with the given name (a label sits at the point it labels). */
function labelOffset(entries: readonly StreamEntry[], name: string): number {
  const index = entries.findIndex((entry) => isLabel(entry) && entry.name === name);
  if (index < 0) {
    throw new Error(`fixture error: label "${name}" not found`);
  }
  return entryOffsets(entries)[index];
}

/** The set of names appearing as label entries. */
function labelNames(entries: readonly StreamEntry[]): Set<string> {
  const names = new Set<string>();
  for (const entry of entries) {
    if (isLabel(entry)) {
      names.add(entry.name);
    }
  }
  return names;
}

/** Narrow an entry to the instruction variant, failing the test otherwise. */
function mustInstr(entry: StreamEntry | undefined): Extract<StreamEntry, { type: "instr" }> {
  if (entry === undefined || !isInstr(entry)) {
    throw new Error(`expected an instruction entry, got ${JSON.stringify(entry)}`);
  }
  return entry;
}

/** Narrow an entry to the label variant, failing the test otherwise. */
function mustLabel(entry: StreamEntry | undefined): Extract<StreamEntry, { type: "label" }> {
  if (entry === undefined || !isLabel(entry)) {
    throw new Error(`expected a label entry, got ${JSON.stringify(entry)}`);
  }
  return entry;
}

/** The target label name of a labelRef instruction, failing the test otherwise. */
function targetOf(entry: StreamEntry | undefined): string {
  const branch = mustInstr(entry);
  if (!isLabelRef(branch.operand)) {
    throw new Error(`expected a labelRef operand, got ${JSON.stringify(branch.operand)}`);
  }
  return branch.operand.label;
}

/** Indexes of every Relative-mode labelRef branch in an entry list. */
function relativeBranchIndexes(entries: readonly StreamEntry[]): number[] {
  const indexes: number[] = [];
  entries.forEach((entry, index) => {
    if (isInstr(entry) && entry.mode === "Relative" && isLabelRef(entry.operand)) {
      indexes.push(index);
    }
  });
  return indexes;
}

/**
 * Relative displacement of the branch at `branchIndex` to its labelRef target:
 * `targetOffset − (branchOffset + branchSize)`, all through instrByteSize.
 * (A Relative branch is 2 bytes, so `branchSize` is the specification's +2.)
 */
function displacementOf(entries: readonly StreamEntry[], branchIndex: number): number {
  const branch = mustInstr(entries[branchIndex]);
  if (branch.mode !== "Relative" || !isLabelRef(branch.operand)) {
    throw new Error("fixture error: entry is not a Relative labelRef branch");
  }
  const branchOffset = entryOffsets(entries)[branchIndex];
  return labelOffset(entries, branch.operand.label) - (branchOffset + instrByteSize(branch));
}

// ---------------------------------------------------------------------------
// Feature: relaxBranches — out-of-range conditional-branch rewriting
// ---------------------------------------------------------------------------

describe("Specification: relaxBranches — branch relaxation (ST-B28..ST-B35)", () => {
  it("returns the input program reference when every branch is in range (ST-B28)", () => {
    const entries: readonly StreamEntry[] = [
      label("top"), // offset 0
      ...padBytes(3),
      instr("BNE", "Relative", labelRef("top")), // offset 3 → d = 0 − (3+2) = −5
      instr("BEQ", "Relative", labelRef("skip")), // offset 5 → d = 17 − (5+2) = +10
      ...padBytes(10),
      label("skip"), // offset 17
      instr("RTS", "Implied", none()),
    ];
    const branches = relativeBranchIndexes(entries);
    expect(displacementOf(entries, branches[0])).toBe(-5);
    expect(displacementOf(entries, branches[1])).toBe(10);

    const program = makeProgram([codeStream("f", entries)]);
    const bag = createDiagnosticBag();

    const result = relaxBranches(program, "nmos6502", bag);

    // Nothing relaxed anywhere → the very same object comes back, not a copy.
    expect(result).toBe(program);
    expect(bag.hasErrors()).toBe(false);
  });

  it("rewrites a +128 forward branch into inverted branch, JMP, and a minted label (ST-B29)", () => {
    const entries: readonly StreamEntry[] = [
      instr("BEQ", "Relative", labelRef("far")), // offset 0, 2 bytes
      ...padBytes(128), // offsets 2..129
      label("far"), // offset 130 → d = 130 − 2 = +128 (out by 1)
      instr("RTS", "Implied", none()),
    ];
    expect(displacementOf(entries, 0)).toBe(128);

    const program = makeProgram([codeStream("f", entries)]);
    const bag = createDiagnosticBag();

    const result = relaxBranches(program, "nmos6502", bag);
    const out = result.streams[0].entries;

    expect(bag.hasErrors()).toBe(false);

    // In place of the branch: the inverted branch, hopping over a JMP to the
    // original target, landing on a freshly minted label.
    const inverted = mustInstr(out[0]);
    expect(inverted.opcode).toBe("BNE");
    expect(inverted.mode).toBe("Relative");
    const minted = targetOf(out[0]);
    expect(labelNames(entries).has(minted)).toBe(false); // fresh, not an input label

    const jmp = mustInstr(out[1]);
    expect(jmp.opcode).toBe("JMP");
    expect(jmp.mode).toBe("Absolute");
    expect(targetOf(out[1])).toBe("far");

    expect(mustLabel(out[2]).name).toBe(minted);

    // Everything after the rewrite site is untouched, and the rewrite costs
    // exactly 3 bytes net.
    expect(out.slice(3)).toEqual(entries.slice(1));
    expect(totalBytes(out)).toBe(totalBytes(entries) + 3);
  });

  it("rewrites a −129 backward branch into inverted branch, JMP, and a minted label (ST-B30)", () => {
    const entries: readonly StreamEntry[] = [
      label("back"), // offset 0
      ...padBytes(127), // offsets 0..126
      instr("BNE", "Relative", labelRef("back")), // offset 127 → d = 0 − (127+2) = −129
      instr("RTS", "Implied", none()),
    ];
    const branchIndex = relativeBranchIndexes(entries)[0];
    expect(displacementOf(entries, branchIndex)).toBe(-129);

    const program = makeProgram([codeStream("f", entries)]);
    const bag = createDiagnosticBag();

    const result = relaxBranches(program, "nmos6502", bag);
    const out = result.streams[0].entries;

    expect(bag.hasErrors()).toBe(false);

    // Everything before the rewrite site is untouched.
    expect(out.slice(0, branchIndex)).toEqual(entries.slice(0, branchIndex));

    const inverted = mustInstr(out[branchIndex]);
    expect(inverted.opcode).toBe("BEQ");
    expect(inverted.mode).toBe("Relative");
    const minted = targetOf(out[branchIndex]);
    expect(labelNames(entries).has(minted)).toBe(false);

    const jmp = mustInstr(out[branchIndex + 1]);
    expect(jmp.opcode).toBe("JMP");
    expect(jmp.mode).toBe("Absolute");
    expect(targetOf(out[branchIndex + 1])).toBe("back");

    expect(mustLabel(out[branchIndex + 2]).name).toBe(minted);

    expect(out.slice(branchIndex + 3)).toEqual(entries.slice(branchIndex + 1));
    expect(totalBytes(out)).toBe(totalBytes(entries) + 3);
  });

  it("leaves branches at exactly +127 and −128 untouched (ST-B31)", () => {
    const forward: readonly StreamEntry[] = [
      instr("BEQ", "Relative", labelRef("fwd")), // offset 0, 2 bytes
      ...padBytes(127), // offsets 2..128
      label("fwd"), // offset 129 → d = 129 − 2 = +127
      instr("RTS", "Implied", none()),
    ];
    const backward: readonly StreamEntry[] = [
      label("bwd"), // offset 0
      ...padBytes(126), // offsets 0..125
      instr("BNE", "Relative", labelRef("bwd")), // offset 126 → d = 0 − (126+2) = −128
      instr("RTS", "Implied", none()),
    ];
    expect(displacementOf(forward, relativeBranchIndexes(forward)[0])).toBe(127);
    expect(displacementOf(backward, relativeBranchIndexes(backward)[0])).toBe(-128);

    const program = makeProgram([codeStream("f", forward), codeStream("g", backward)]);
    const bag = createDiagnosticBag();

    const result = relaxBranches(program, "nmos6502", bag);

    // Both boundary branches are in range → nothing relaxes → same reference.
    expect(result).toBe(program);
    expect(bag.hasErrors()).toBe(false);
  });

  it("iterates to a fixpoint: relaxing one branch pushes a boundary branch out of range (ST-B32)", () => {
    // Y (BEQ endY) starts at exactly +127 — in range, on the boundary.
    // X (BNE endX) starts at +128 — out of range by 1.
    // Y's span CONTAINS X, so relaxing X inserts 3 bytes inside Y's span and
    // pushes Y to +130; only a second iteration can relax Y.
    const entries: readonly StreamEntry[] = [
      instr("BEQ", "Relative", labelRef("endY")), // Y at offset 0
      instr("BNE", "Relative", labelRef("endX")), // X at offset 2
      ...padBytes(125), // offsets 4..128
      label("endY"), // offset 129 → dY = 129 − 2 = +127
      ...padBytes(3), // offsets 129..131
      label("endX"), // offset 132 → dX = 132 − 4 = +128
      instr("RTS", "Implied", none()),
    ];

    // Property 1 — X is out of range by a small margin; Y sits exactly on the
    // in-range boundary.
    expect(displacementOf(entries, 1)).toBe(128);
    expect(displacementOf(entries, 0)).toBe(127);

    // Property 2 — Y's span contains X's rewrite site: X lies strictly between
    // Y and Y's target, so X's 3 inserted bytes land inside Y's displacement.
    const offsets = entryOffsets(entries);
    expect(offsets[1]).toBeGreaterThan(offsets[0]);
    expect(offsets[1]).toBeLessThan(labelOffset(entries, "endY"));

    const program = makeProgram([codeStream("f", entries)]);
    const bag = createDiagnosticBag();

    // The call returning at all is the termination assertion.
    const result = relaxBranches(program, "nmos6502", bag);
    const out = result.streams[0].entries;

    expect(bag.hasErrors()).toBe(false);

    // Y's in-place rewrite (only reachable via the second iteration).
    const invertedY = mustInstr(out[0]);
    expect(invertedY.opcode).toBe("BNE");
    expect(invertedY.mode).toBe("Relative");
    const mintedY = targetOf(out[0]);
    const jmpY = mustInstr(out[1]);
    expect(jmpY.opcode).toBe("JMP");
    expect(jmpY.mode).toBe("Absolute");
    expect(targetOf(out[1])).toBe("endY");
    expect(mustLabel(out[2]).name).toBe(mintedY);

    // X's in-place rewrite (first iteration).
    const invertedX = mustInstr(out[3]);
    expect(invertedX.opcode).toBe("BEQ");
    expect(invertedX.mode).toBe("Relative");
    const mintedX = targetOf(out[3]);
    const jmpX = mustInstr(out[4]);
    expect(jmpX.opcode).toBe("JMP");
    expect(jmpX.mode).toBe("Absolute");
    expect(targetOf(out[4])).toBe("endX");
    expect(mustLabel(out[5]).name).toBe(mintedX);

    expect(mintedX).not.toBe(mintedY);
    expect(labelNames(entries).has(mintedX)).toBe(false);
    expect(labelNames(entries).has(mintedY)).toBe(false);

    // The tail after both rewrite sites is untouched; two rewrites cost 6 bytes.
    expect(out.slice(6)).toEqual(entries.slice(2));
    expect(totalBytes(out)).toBe(totalBytes(entries) + 6);

    // Fixpoint reached: every remaining Relative branch is back in range.
    for (const stream of result.streams) {
      for (const index of relativeBranchIndexes(stream.entries)) {
        const d = displacementOf(stream.entries, index);
        expect(d).toBeGreaterThanOrEqual(-128);
        expect(d).toBeLessThanOrEqual(127);
      }
    }
  });

  it("mints labels that collide with no stream label and no preamble label (ST-B33)", () => {
    // Bait: the stream and the preamble already carry labels named like the
    // synthetic ones the pass mints. Labels are 0 bytes, so the branch still
    // sits at offset 0 with its target at +128.
    const entries: readonly StreamEntry[] = [
      label("_rlx0"),
      instr("BEQ", "Relative", labelRef("far")), // offset 0 → d = +128
      label("_rlx1"),
      ...padBytes(128),
      label("_rlx2"),
      label("far"), // offset 130
      instr("RTS", "Implied", none()),
    ];
    const preamble: readonly StreamEntry[] = [label("_rlx3")];
    expect(displacementOf(entries, 1)).toBe(128);

    const program = makeProgram([codeStream("f", entries)], { preamble });
    const bag = createDiagnosticBag();

    const result = relaxBranches(program, "nmos6502", bag);
    const out = result.streams[0].entries;

    expect(bag.hasErrors()).toBe(false);

    // The rewrite happened in place of the branch (input index 1).
    const inverted = mustInstr(out[1]);
    expect(inverted.opcode).toBe("BNE");
    expect(inverted.mode).toBe("Relative");
    const jmp = mustInstr(out[2]);
    expect(jmp.opcode).toBe("JMP");
    expect(targetOf(out[2])).toBe("far");

    // The minted name is fresh with respect to EVERY label the stage can see:
    // the stream's own labels and the preamble's.
    const minted = targetOf(out[1]);
    const visible = new Set([...labelNames(entries), ...labelNames(preamble)]);
    expect(visible.has(minted)).toBe(false);
    expect(mustLabel(out[3]).name).toBe(minted);
  });

  it("records an internal compiler error for a Relative branch whose target is absent from its own stream (ST-B34)", () => {
    // The target label exists — but only in ANOTHER stream. Displacements are
    // per-stream, so this branch is unresolvable and must be reported as a
    // compiler bug, not skipped.
    const orphan = codeStream("f", [
      instr("BNE", "Relative", labelRef("elsewhere")),
      instr("RTS", "Implied", none()),
    ]);
    const other = codeStream("g", [label("elsewhere"), instr("RTS", "Implied", none())]);
    const program = makeProgram([orphan, other]);
    const bag = createDiagnosticBag();

    relaxBranches(program, "nmos6502", bag);

    expect(bag.hasErrors()).toBe(true);
    expect(bag.getAll().some((d) => d.code === IceCode.Unexpected)).toBe(true);
  });

  it("passes preamble, allocationPlan, and preambleOptions through unchanged (ST-B35)", () => {
    const entries: readonly StreamEntry[] = [
      instr("BEQ", "Relative", labelRef("far")), // offset 0 → d = +128 (relaxes)
      ...padBytes(128),
      label("far"),
      instr("RTS", "Implied", none()),
    ];
    expect(displacementOf(entries, 0)).toBe(128);

    const plan = makePlan();
    const preamble: readonly StreamEntry[] = [directive({ kind: "origin", address: 0x0801 })];
    const options: PreambleOptions = {
      projectName: "demo",
      shimVariant: "terminating",
      needsBssZero: false,
      needsDataInit: false,
    };
    const program: InstrProgram = {
      preamble,
      streams: [codeStream("f", entries)],
      allocationPlan: plan,
      preambleOptions: options,
    };
    const bag = createDiagnosticBag();

    const result = relaxBranches(program, "nmos6502", bag);

    // The rewrite really happened — this exercises the rebuilt-program path,
    // not the nothing-relaxed passthrough.
    expect(totalBytes(result.streams[0].entries)).toBe(totalBytes(entries) + 3);

    expect(result.preamble).toEqual(preamble);
    expect(result.allocationPlan).toBe(plan);
    expect(result.preambleOptions).toEqual(options);
  });
});
