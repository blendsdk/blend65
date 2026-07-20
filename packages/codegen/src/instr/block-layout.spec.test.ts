/**
 * Specification tests for block layout at translation time — fall-through
 * elision and final-branch inversion.
 *
 * The contract under test: the translator emits a trailing jump after every
 * block, and it must NOT when one of the block's two edges is simply the next
 * block in the emitted order — falling through gets there for free. When the
 * false edge is next, the branch keeps its polarity and the jump is dropped;
 * when the true edge is next, the branch inverts to its polarity partner and
 * the jump is dropped; when neither is next (or nothing follows), the output
 * is unchanged. An unconditional branch is the degenerate case: its `JMP` is
 * emitted only when the target is not the next block. Adjacency is decided on
 * IL block order, and only a comparison framing's FINAL branch participates —
 * framing-internal branches never invert.
 *
 * Every expectation here derives from that specification and from 6502
 * semantics (branch polarity partners `BCC`/`BCS`, `BEQ`/`BNE`, `BMI`/`BPL`;
 * instruction byte sizes and cycle counts) — never from reading the
 * implementation. Immutable oracle: a failure after the implementation lands
 * means the implementation is wrong, not this test.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { AllocationPlan, ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";

import { loc } from "../il/operand.js";
import type { ILOperand } from "../il/operand.js";
import { IL_BYTE, IL_SBYTE, IL_SWORD, IL_WORD } from "../il/il-type.js";
import type { ILType } from "../il/il-type.js";
import type { ILTerminator } from "../il/instruction.js";
import type { BasicBlock, ILFunction } from "../il/cfg.js";
import { lowerToIL } from "../il/lower.js";
import { threadJumps } from "../il/optimizer/thread-jumps.js";
import { removeUnreachableBlocks } from "../il/optimizer/remove-unreachable-blocks.js";
import { instrByteSize, printInstr } from "./print-instr.js";
import { isInstr, isLabel } from "./stream.js";
import type { InstrStream, StreamEntry } from "./stream.js";
import { translateFunction } from "./translate.js";

/** The comparison operators a `brcmp` terminator can carry. */
type CmpOp = Extract<ILTerminator, { kind: "brcmp" }>["op"];

/** A conditional branch as observed in the output: its opcode and target label. */
interface BranchShape {
  readonly opcode: string;
  readonly target: string;
}

/**
 * The 6502 branch polarity partners: each conditional branch and the branch
 * that fires exactly when it does not (`BCC`↔`BCS` on the carry, `BEQ`↔`BNE`
 * on zero, `BMI`↔`BPL` on negative, `BVC`↔`BVS` on overflow). Inverting a
 * branch means swapping it for its partner.
 */
const PARTNER: ReadonlyMap<string, string> = new Map([
  ["BCC", "BCS"],
  ["BCS", "BCC"],
  ["BEQ", "BNE"],
  ["BNE", "BEQ"],
  ["BMI", "BPL"],
  ["BPL", "BMI"],
  ["BVC", "BVS"],
  ["BVS", "BVC"],
]);

/** A minimal `AllocationPlan` — these cases need no ZP scratch or frames. */
function makePlan(): AllocationPlan {
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

/** Build the test function `M.f` over the given blocks. */
function fnOf(blocks: readonly BasicBlock[]): ILFunction {
  return {
    name: "M.f",
    params: [],
    returnType: "void",
    blocks,
    tempCount: 0,
    isInterrupt: false,
  };
}

/** A ret-terminated block with the given label and no instructions. */
function retBlock(label: string): BasicBlock {
  return { label, instructions: [], terminator: { kind: "ret" } };
}

/** A `brcmp` whose true edge is `_L1` and whose false edge is `_L2`. */
function brcmp(op: CmpOp, left: ILOperand, right: ILOperand, type: ILType): ILTerminator {
  return { kind: "brcmp", op, left, right, type, trueTarget: "_L1", falseTarget: "_L2" };
}

/**
 * The layout in which the TRUE edge is the next block: the entry block ends in
 * `term`, and `_L1` (the true target) immediately follows it in block order.
 */
function trueAdjacentFn(term: ILTerminator): ILFunction {
  return fnOf([
    { label: "_entry", instructions: [], terminator: term },
    retBlock("_L1"),
    retBlock("_L2"),
  ]);
}

/**
 * The baseline layout in which NEITHER edge is the next block: a padding block
 * sits between the entry block and the two edge blocks, so no fall-through
 * opportunity exists and the framing must keep its un-inverted shape.
 */
function paddedFn(term: ILTerminator): ILFunction {
  return fnOf([
    { label: "_entry", instructions: [], terminator: term },
    retBlock("_Lp"),
    retBlock("_L1"),
    retBlock("_L2"),
  ]);
}

/** Translate a hand-built function, asserting no diagnostics were raised. */
function translate(fn: ILFunction): { stream: InstrStream; text: string } {
  const bag = createDiagnosticBag();
  const stream = translateFunction(fn, makePlan(), "nmos6502", bag);
  expect(bag.hasErrors()).toBe(false);
  return { stream, text: printInstr(stream) };
}

/**
 * The entries emitted for the entry block: everything after the function's own
 * label and before the first block label (`M_f_L…`). Generated framing labels
 * (`_cmp…`) stay inside the region — they belong to the entry block's code.
 */
function entryRegion(stream: InstrStream): readonly StreamEntry[] {
  const rest = stream.entries.slice(1);
  const end = rest.findIndex((e) => isLabel(e) && e.name.startsWith("M_f_L"));
  return end === -1 ? rest : rest.slice(0, end);
}

/** The conditional branches of a region, in order (opcode + target label). */
function conditionalBranches(region: readonly StreamEntry[]): BranchShape[] {
  const out: BranchShape[] = [];
  for (const entry of region) {
    if (isInstr(entry) && entry.mode === "Relative" && entry.operand.kind === "labelRef") {
      out.push({ opcode: entry.opcode, target: entry.operand.label });
    }
  }
  return out;
}

/** Whether a region contains an absolute `JMP`. */
function hasJmp(region: readonly StreamEntry[]): boolean {
  return region.some((e) => isInstr(e) && e.opcode === "JMP");
}

/** The last element of a sequence — fails loudly when the sequence is empty. */
function lastOf<T>(xs: readonly T[]): T {
  const last = xs[xs.length - 1];
  if (last === undefined) {
    throw new Error("expected a non-empty sequence");
  }
  return last;
}

/** Narrow a stream entry to an instruction, failing loudly otherwise. */
function asInstr(entry: StreamEntry | undefined): Extract<StreamEntry, { type: "instr" }> {
  if (entry === undefined || !isInstr(entry)) {
    throw new Error(`expected an instruction entry, got ${JSON.stringify(entry)}`);
  }
  return entry;
}

/** Narrow a stream entry to a label, failing loudly otherwise. */
function asLabel(entry: StreamEntry | undefined): Extract<StreamEntry, { type: "label" }> {
  if (entry === undefined || !isLabel(entry)) {
    throw new Error(`expected a label entry, got ${JSON.stringify(entry)}`);
  }
  return entry;
}

describe("Specification: block layout — unconditional br to the next block (ST-B22)", () => {
  // The degenerate elision case: a `br` whose target is the very next block
  // needs no jump at all — falling through arrives there for free. The target
  // block's label must still be emitted (it may have other predecessors).
  it("elides the JMP when br targets the block that follows (ST-B22)", () => {
    const fn = fnOf([
      { label: "_entry", instructions: [], terminator: { kind: "br", target: "_L1" } },
      retBlock("_L1"),
    ]);
    const { text } = translate(fn);
    expect(text).toBe(["M_f:", "M_f_L1:", "    RTS"].join("\n"));
  });

  // The guard against over-elision: the specification drops the jump ONLY for
  // the next block, so a br over an intervening block keeps its JMP.
  it("keeps the JMP when br targets a non-adjacent block (ST-B22)", () => {
    const fn = fnOf([
      { label: "_entry", instructions: [], terminator: { kind: "br", target: "_L2" } },
      retBlock("_L1"),
      retBlock("_L2"),
    ]);
    const { text } = translate(fn);
    expect(text).toBe(
      ["M_f:", "    JMP M_f_L2", "M_f_L1:", "    RTS", "M_f_L2:", "    RTS"].join("\n"),
    );
  });
});

describe("Specification: block layout — final-branch inversion per framing (ST-B23)", () => {
  // Each row reaches one of the five comparison framings through the operand
  // type and operator on a fused compare-and-branch terminator. The expected
  // inverted shape is derived by contrast: translate the SAME terminator once
  // with no adjacent edge (the un-inverted baseline) and once with the true
  // edge as the next block, then require that ONLY the final branch flipped
  // to its polarity partner and retargeted the false edge, with the trailing
  // jump gone. Framing-internal branches must be untouched — polarity, target,
  // and position.
  const framings: ReadonlyArray<[string, CmpOp, ILType]> = [
    ["8-bit equality", "eq", IL_BYTE],
    ["8-bit unsigned ordered", "lt", IL_BYTE],
    ["8-bit signed ordered", "lt", IL_SBYTE],
    ["16-bit equality", "eq", IL_WORD],
    ["16-bit unsigned ordered", "lt", IL_WORD],
    ["16-bit signed ordered", "lt", IL_SWORD],
  ];

  it.each(framings)(
    "inverts only the final branch of the %s framing (ST-B23)",
    (_name, op, type) => {
      const term = brcmp(op, loc("L", type), loc("R", type), type);
      const baseline = translate(paddedFn(term));
      const adjacent = translate(trueAdjacentFn(term));

      const baseRegion = entryRegion(baseline.stream);
      const adjRegion = entryRegion(adjacent.stream);
      const baseBranches = conditionalBranches(baseRegion);
      const adjBranches = conditionalBranches(adjRegion);

      // Baseline sanity: with no adjacent edge, the framing ends with its final
      // branch to the true edge followed by the trailing jump to the false edge.
      const baseLast = lastOf(baseBranches);
      expect(baseLast.target).toBe("M_f_L1");
      const baseTail = asInstr(lastOf(baseRegion));
      expect(baseTail.opcode).toBe("JMP");
      expect(baseTail.operand).toEqual({ kind: "labelRef", label: "M_f_L2" });

      // True edge adjacent: every framing-internal branch is byte-identical to
      // the baseline — same opcode, same target, same position.
      expect(adjBranches.length).toBe(baseBranches.length);
      expect(adjBranches.slice(0, -1)).toEqual(baseBranches.slice(0, -1));

      // The final branch flips to its polarity partner and takes the false edge.
      const adjLast = lastOf(adjBranches);
      expect(adjLast.opcode).toBe(PARTNER.get(baseLast.opcode));
      expect(adjLast.target).toBe("M_f_L2");

      // The trailing jump is dropped: the entry block now ENDS at that branch.
      expect(hasJmp(adjRegion)).toBe(false);
      const adjTail = asInstr(lastOf(adjRegion));
      expect(adjTail.mode).toBe("Relative");
      expect(adjTail.opcode).toBe(adjLast.opcode);
    },
  );
});

describe("Specification: block layout — 16-bit unsigned high-byte decisions (ST-B24)", () => {
  // The 16-bit unsigned ordered framing makes three decisions: high byte
  // strictly below, high byte strictly above, then the low-byte carry. Only
  // the LAST of them pairs with the trailing jump; the two high-byte branches
  // jump straight to their verdicts and must never invert or retarget.
  it("flips only the last carry branch of the 16-bit unsigned framing (ST-B24)", () => {
    const term = brcmp("lt", loc("L", IL_WORD), loc("R", IL_WORD), IL_WORD);
    const baseline = translate(paddedFn(term));
    const adjacent = translate(trueAdjacentFn(term));

    const baseBranches = conditionalBranches(entryRegion(baseline.stream));
    const adjRegion = entryRegion(adjacent.stream);
    const adjBranches = conditionalBranches(adjRegion);

    expect(baseBranches.length).toBe(3);
    expect(adjBranches.length).toBe(3);

    // The two high-byte decisions are untouched — opcode and target both.
    expect(adjBranches[0]).toEqual(baseBranches[0]);
    expect(adjBranches[1]).toEqual(baseBranches[1]);

    // The last decision is the low-byte carry branch; it alone participates in
    // the tail decision — partner opcode, false edge target, no trailing jump.
    expect(["BCC", "BCS"]).toContain(baseBranches[2].opcode);
    expect(adjBranches[2].opcode).toBe(PARTNER.get(baseBranches[2].opcode));
    expect(adjBranches[2].target).toBe("M_f_L2");
    expect(hasJmp(adjRegion)).toBe(false);
  });
});

describe("Specification: block layout — the raster-poll loop (ST-B25)", () => {
  // The classic C64 frame-sync idiom, compiled through the real pipeline. The
  // busy-wait on the raster line must come out as the three-instruction loop a
  // 6502 programmer writes by hand: read the register, compare, branch back.
  const source = [
    "module Main;",
    "",
    "let frame: byte = 0;",
    "",
    "function main(): void {",
    "  while (true) {",
    "    while (peek($D012) != 251) { }",
    "",
    "    frame = frame + 1;",
    "    poke($0400, frame);",
    "    poke($D020, frame);",
    "  }",
    "}",
    "",
  ].join("\n");

  /** Frontend → lowering → jump threading → unreachable pruning → `Main.main`. */
  function pollFunctionStream(): InstrStream {
    const bag = createDiagnosticBag();
    const { tokens } = lex(1, source, bag);
    const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: 1, bag });
    const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
    const plan = planAllocation(
      {
        functions: modelToFunctionInfo(model),
        moduleVars: modelToModuleVars(model),
        zpUserVars: [],
        upstreamErrors: bag.hasErrors(),
      },
      DEFAULT_PROFILE,
      bag,
    );
    const il = lowerToIL({ program: [ast], model, plan }, bag);
    const optimized = removeUnreachableBlocks.run(threadJumps.run(il, bag), bag);
    const fn = optimized.functions.find((f) => f.name === "Main.main");
    if (fn === undefined) {
      throw new Error("Main.main missing from the lowered program");
    }
    const stream = translateFunction(fn, optimized.allocationPlan, "nmos6502", bag);
    expect(bag.hasErrors()).toBe(false);
    return stream;
  }

  it("emits the poll loop as exactly LDA / CMP / branch-to-self, 7 bytes (ST-B25)", () => {
    const entries = pollFunctionStream().entries;

    // Find the raster-register read; the poll loop's label must sit directly
    // above it (the branch needs somewhere to land that re-runs the read).
    const i = entries.findIndex(
      (e) =>
        isInstr(e) &&
        e.opcode === "LDA" &&
        e.mode === "Absolute" &&
        e.operand.kind === "symbolRef" &&
        e.operand.name === "$D012",
    );
    expect(i).toBeGreaterThan(0);
    const head = asLabel(entries[i - 1]);

    // Next instruction: the comparison against raster line 251, immediate.
    const cmp = asInstr(entries[i + 1]);
    expect(cmp.opcode).toBe("CMP");
    expect(cmp.mode).toBe("Immediate");
    expect(cmp.operand).toEqual({ kind: "immediate", value: 251 });

    // Then the branch that closes the loop onto its own label: the loop stays
    // while the register differs, so the not-equal branch re-enters, and the
    // equal case falls through to the next block with no jump in between.
    const branch = asInstr(entries[i + 2]);
    expect(branch.opcode).toBe("BNE");
    expect(branch.mode).toBe("Relative");
    expect(branch.operand).toEqual({ kind: "labelRef", label: head.name });

    // Nothing else belongs to the loop: what follows the branch is the next
    // block's label, not a trailing jump.
    expect(asLabel(entries[i + 3]).name).not.toBe(head.name);

    // 7 bytes total: LDA absolute (3) + CMP immediate (2) + branch (2).
    const bytes = entries.slice(i, i + 3).reduce((total, entry) => total + instrByteSize(entry), 0);
    expect(bytes).toBe(7);

    // Taken-path cost, per 6502 timing: LDA absolute = 4 cycles, CMP
    // immediate = 2 cycles, branch taken (same page) = 3 cycles — 9 cycles
    // per poll iteration.
  });
});

describe("Specification: block layout — unreachable-terminated blocks (ST-B26)", () => {
  // A block that provably cannot be reached contributes no instructions: no
  // body, no trailing jump. The block after it is emitted exactly as if the
  // unreachable block were not there.
  it("emits no instructions for an unreachable block and leaves the next block intact (ST-B26)", () => {
    const fn = fnOf([
      retBlock("_entry"),
      { label: "_L1", instructions: [], terminator: { kind: "unreachable" } },
      retBlock("_L2"),
    ]);
    const { stream } = translate(fn);

    // The only instructions in the whole stream are the two returns of the
    // ret-terminated blocks — the unreachable block added nothing.
    const opcodes = stream.entries.filter(isInstr).map((e) => e.opcode);
    expect(opcodes).toEqual(["RTS", "RTS"]);

    // The following block is unaffected: its label is present and its code
    // directly follows it.
    const at = stream.entries.findIndex((e) => isLabel(e) && e.name === "M_f_L2");
    expect(at).toBeGreaterThan(0);
    expect(asInstr(stream.entries[at + 1]).opcode).toBe("RTS");
  });
});
