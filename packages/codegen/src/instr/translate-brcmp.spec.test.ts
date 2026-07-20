/**
 * Specification tests for fused compare-and-branch translation — the `brcmp`
 * terminator across all five comparison framings.
 *
 * Immutable oracles: every expected sequence is derived from 6502 semantics
 * (the carry framing for unsigned order, the N⊕V correction for signed order,
 * the byte-wise Z chain for 16-bit equality) and from the branch-form contract
 * — the compare's flags feed the branch directly, so a fused block ends in
 * `<branch> trueTarget` + `JMP falseTarget` and materialises no 0/1 anywhere.
 * They are NOT produced by running the translator.
 *
 * Each framing is asserted in BOTH senses (`lt` against `ge`, `eq` against
 * `ne`, and the swapped `gt`/`le` pair). A fused branch that inverted its
 * polarity would still look plausible in isolation; only the pair pins it.
 *
 * The value form of each framing is asserted here too, byte-for-byte, right
 * beside its fused twin: both consume one shared compare core, and keeping
 * the two expectations adjacent is what makes a divergence between them
 * visible at review time.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, type AllocationPlan, type ZpAllocation } from "@blend65/core";

import { imm, loc, temp } from "../il/operand.js";
import type { ILOperand } from "../il/operand.js";
import { IL_BYTE, IL_SBYTE, IL_SWORD, IL_WORD } from "../il/il-type.js";
import type { ILInstruction, ILTerminator } from "../il/instruction.js";
import type { ILType } from "../il/il-type.js";
import type { ILFunction } from "../il/cfg.js";
import { printInstr } from "./print-instr.js";
import { translateFunction } from "./translate.js";

/** The comparison operators a `brcmp` terminator can carry. */
type CmpOp = Extract<ILTerminator, { kind: "brcmp" }>["op"];

/** One matrix row: the operator and the entry block it must translate to. */
type Row = [CmpOp, readonly string[]];

/** A minimal `AllocationPlan` — these cases need no ZP scratch. */
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
 * The shape every fused case is measured in: an entry block ending in the
 * `brcmp`, a filler block, then the two blocks its edges land on. Both targets
 * are real blocks, so the fused terminator is the only thing under test.
 *
 * The filler is load-bearing. A block whose branch target is also the block
 * that follows it needs no jump to reach it — the translator elides the jump
 * and, when it is the *true* edge, inverts the branch. That is correct output,
 * but it is a different question from the one this suite asks: which flags a
 * comparison branches on. Interposing a block neither edge names keeps every
 * expectation below about the fusion alone. The filler survives to the emitted
 * stream because these cases call the translator directly, so nothing removes
 * a block nothing can reach.
 */
function fusedFn(terminator: ILTerminator, instructions: readonly ILInstruction[]): ILFunction {
  return {
    name: "M.f",
    params: [],
    returnType: "void",
    blocks: [
      { label: "_entry", instructions, terminator },
      { label: "_filler", instructions: [], terminator: { kind: "ret" } },
      { label: "_L1", instructions: [], terminator: { kind: "ret" } },
      { label: "_L2", instructions: [], terminator: { kind: "ret" } },
    ],
    tempCount: 8,
    isInterrupt: false,
  };
}

/** A single-block function whose comparison result is returned (the value form). */
function valueFn(instructions: readonly ILInstruction[]): ILFunction {
  return {
    name: "M.f",
    params: [],
    returnType: IL_BYTE,
    blocks: [
      {
        label: "_entry",
        instructions,
        terminator: { kind: "ret", value: temp(0, IL_BYTE) },
      },
    ],
    tempCount: 8,
    isInterrupt: false,
  };
}

/** Translate and render to canonical ACME text. */
function render(fn: ILFunction): { text: string; bag: ReturnType<typeof createDiagnosticBag> } {
  const bag = createDiagnosticBag();
  const stream = translateFunction(fn, makePlan(), "nmos6502", bag);
  return { text: printInstr(stream), bag };
}

/**
 * Lay out an expected body the way `printInstr` renders it: instruction lines
 * indent by four, generated labels sit at column 0.
 */
function body(ls: readonly string[]): string[] {
  return ls.map((l) => (l.endsWith(":") ? l : `    ${l}`));
}

/** A `brcmp` from `_entry` to the two target blocks. */
function brcmp(op: CmpOp, left: ILOperand, right: ILOperand, type: ILType): ILTerminator {
  return { kind: "brcmp", op, left, right, type, trueTarget: "_L1", falseTarget: "_L2" };
}

/**
 * Assert a fused entry block translates to exactly `expected`, with both edge
 * blocks rendered behind it and no diagnostics raised.
 */
function expectFused(
  terminator: ILTerminator,
  expected: readonly string[],
  instructions: readonly ILInstruction[] = [],
): void {
  const { text, bag } = render(fusedFn(terminator, instructions));
  expect(bag.hasErrors()).toBe(false);
  expect(text).toBe(
    [
      "M_f:",
      ...body(expected),
      "M_f_filler:",
      "    RTS",
      "M_f_L1:",
      "    RTS",
      "M_f_L2:",
      "    RTS",
    ].join("\n"),
  );
}

/** Assert a value-form comparison translates to exactly `expected` + `RTS`. */
function expectValue(cmp: ILInstruction, expected: readonly string[]): void {
  const { text, bag } = render(valueFn([cmp]));
  expect(bag.hasErrors()).toBe(false);
  expect(text).toBe(["M_f:", ...body(expected), "    RTS"].join("\n"));
}

// The operands every framing is measured against: a memory left-hand side
// against either a memory or an immediate right-hand side. `gt`/`le` compare
// with the operands swapped, which is why their expectations lead with the
// right-hand operand.
const bL = loc("L", IL_BYTE);
const bR = loc("R", IL_BYTE);
const sL = loc("L", IL_SBYTE);
const sR = loc("R", IL_SBYTE);
const wL = loc("L", IL_WORD);
const wR = loc("R", IL_WORD);
const swL = loc("L", IL_SWORD);
const swR = loc("R", IL_SWORD);

describe("Specification: brcmp — 8-bit unsigned and equality framing (ST-10a)", () => {
  // Equality is a bit compare (Z); order is a carry compare. Both branch on
  // the flag the CMP just set — nothing may sit between the two.
  const memory: Row[] = [
    ["eq", ["LDA L", "CMP R", "BEQ M_f_L1", "JMP M_f_L2"]],
    ["ne", ["LDA L", "CMP R", "BNE M_f_L1", "JMP M_f_L2"]],
    ["lt", ["LDA L", "CMP R", "BCC M_f_L1", "JMP M_f_L2"]],
    ["ge", ["LDA L", "CMP R", "BCS M_f_L1", "JMP M_f_L2"]],
    ["gt", ["LDA R", "CMP L", "BCC M_f_L1", "JMP M_f_L2"]],
    ["le", ["LDA R", "CMP L", "BCS M_f_L1", "JMP M_f_L2"]],
  ];

  it.each(memory)("fuses %s against a memory operand", (op, expected) => {
    expectFused(brcmp(op, bL, bR, IL_BYTE), expected);
  });

  const immediate: Row[] = [
    ["eq", ["LDA L", "CMP #$FB", "BEQ M_f_L1", "JMP M_f_L2"]],
    ["ne", ["LDA L", "CMP #$FB", "BNE M_f_L1", "JMP M_f_L2"]],
    ["lt", ["LDA L", "CMP #$FB", "BCC M_f_L1", "JMP M_f_L2"]],
    ["ge", ["LDA L", "CMP #$FB", "BCS M_f_L1", "JMP M_f_L2"]],
    ["gt", ["LDA #$FB", "CMP L", "BCC M_f_L1", "JMP M_f_L2"]],
    ["le", ["LDA #$FB", "CMP L", "BCS M_f_L1", "JMP M_f_L2"]],
  ];

  it.each(immediate)("fuses %s against an immediate operand", (op, expected) => {
    expectFused(brcmp(op, bL, imm(0xfb, IL_BYTE), IL_BYTE), expected);
  });

  // The value form is untouched: the same compare core, then the 0/1 tail.
  it("keeps the value form's Z-based equality tail (ST-6)", () => {
    expectValue({ op: "eq", dest: temp(0, IL_BYTE), left: bL, right: bR, type: IL_BYTE }, [
      "LDA L",
      "CMP R",
      "BEQ _cmp0",
      "LDA #$00",
      "JMP _cmp1",
      "_cmp0:",
      "LDA #$01",
      "_cmp1:",
    ]);
  });

  it("keeps the value form's compact carry tail (ST-6)", () => {
    expectValue({ op: "lt", dest: temp(0, IL_BYTE), left: bL, right: bR, type: IL_BYTE }, [
      "LDA L",
      "CMP R",
      "LDA #$01",
      "BCC _cmp0",
      "LDA #$00",
      "_cmp0:",
    ]);
  });
});

describe("Specification: brcmp — 8-bit signed ordered framing (ST-10a, ST-10b)", () => {
  // SEC/SBC leaves N ⊕ V = "less than"; the BVC-guarded EOR #$80 folds the
  // overflow back into N so BMI/BPL decide directly.
  const memory: Row[] = [
    [
      "lt",
      ["LDA L", "SEC", "SBC R", "BVC _cmp0", "EOR #$80", "_cmp0:", "BMI M_f_L1", "JMP M_f_L2"],
    ],
    [
      "ge",
      ["LDA L", "SEC", "SBC R", "BVC _cmp0", "EOR #$80", "_cmp0:", "BPL M_f_L1", "JMP M_f_L2"],
    ],
    [
      "gt",
      ["LDA R", "SEC", "SBC L", "BVC _cmp0", "EOR #$80", "_cmp0:", "BMI M_f_L1", "JMP M_f_L2"],
    ],
    [
      "le",
      ["LDA R", "SEC", "SBC L", "BVC _cmp0", "EOR #$80", "_cmp0:", "BPL M_f_L1", "JMP M_f_L2"],
    ],
  ];

  it.each(memory)("fuses signed %s against a memory operand", (op, expected) => {
    expectFused(brcmp(op, sL, sR, IL_SBYTE), expected);
  });

  const immediate: Row[] = [
    [
      "lt",
      ["LDA L", "SEC", "SBC #$FB", "BVC _cmp0", "EOR #$80", "_cmp0:", "BMI M_f_L1", "JMP M_f_L2"],
    ],
    [
      "ge",
      ["LDA L", "SEC", "SBC #$FB", "BVC _cmp0", "EOR #$80", "_cmp0:", "BPL M_f_L1", "JMP M_f_L2"],
    ],
    [
      "gt",
      ["LDA #$FB", "SEC", "SBC L", "BVC _cmp0", "EOR #$80", "_cmp0:", "BMI M_f_L1", "JMP M_f_L2"],
    ],
    [
      "le",
      ["LDA #$FB", "SEC", "SBC L", "BVC _cmp0", "EOR #$80", "_cmp0:", "BPL M_f_L1", "JMP M_f_L2"],
    ],
  ];

  it.each(immediate)("fuses signed %s against an immediate operand", (op, expected) => {
    expectFused(brcmp(op, sL, imm(0xfb, IL_SBYTE), IL_SBYTE), expected);
  });

  it("keeps the value form's N-corrected tail (ST-6)", () => {
    expectValue({ op: "lt", dest: temp(0, IL_BYTE), left: sL, right: sR, type: IL_SBYTE }, [
      "LDA L",
      "SEC",
      "SBC R",
      "BVC _cmp0",
      "EOR #$80",
      "_cmp0:",
      "BMI _cmp1",
      "LDA #$00",
      "JMP _cmp2",
      "_cmp1:",
      "LDA #$01",
      "_cmp2:",
    ]);
  });
});

describe("Specification: brcmp — 16-bit equality framing (ST-10a)", () => {
  // A differing low byte already settles equality, so the fused form sends it
  // straight to the edge it decided — `eq` to false, `ne` to true — instead of
  // rejoining to re-test Z. Equal low bytes let the high byte decide.
  const memory: Row[] = [
    ["eq", ["LDA L", "CMP R", "BNE M_f_L2", "LDA L+1", "CMP R+1", "BEQ M_f_L1", "JMP M_f_L2"]],
    ["ne", ["LDA L", "CMP R", "BNE M_f_L1", "LDA L+1", "CMP R+1", "BNE M_f_L1", "JMP M_f_L2"]],
  ];

  it.each(memory)("fuses word %s against a memory operand", (op, expected) => {
    expectFused(brcmp(op, wL, wR, IL_WORD), expected);
  });

  const immediate: Row[] = [
    ["eq", ["LDA L", "CMP #$34", "BNE M_f_L2", "LDA L+1", "CMP #$12", "BEQ M_f_L1", "JMP M_f_L2"]],
    ["ne", ["LDA L", "CMP #$34", "BNE M_f_L1", "LDA L+1", "CMP #$12", "BNE M_f_L1", "JMP M_f_L2"]],
  ];

  it.each(immediate)("fuses word %s against an immediate operand", (op, expected) => {
    expectFused(brcmp(op, wL, imm(0x1234, IL_WORD), IL_WORD), expected);
  });

  it("keeps the value form's equality tail (ST-6)", () => {
    expectValue({ op: "eq", dest: temp(0, IL_BYTE), left: wL, right: wR, type: IL_WORD }, [
      "LDA L",
      "CMP R",
      "BNE _cmp0",
      "LDA L+1",
      "CMP R+1",
      "_cmp0:",
      "BEQ _cmp1",
      "LDA #$00",
      "JMP _cmp2",
      "_cmp1:",
      "LDA #$01",
      "_cmp2:",
    ]);
  });
});

describe("Specification: brcmp — 16-bit unsigned ordered framing (ST-10a)", () => {
  // The framing's own true/false joins become the block edges: a decided high
  // byte branches straight to a target, and the 0/1 tail disappears entirely.
  const memory: Row[] = [
    [
      "lt",
      [
        "LDA L+1",
        "CMP R+1",
        "BCC M_f_L1",
        "BNE M_f_L2",
        "LDA L",
        "CMP R",
        "BCC M_f_L1",
        "JMP M_f_L2",
      ],
    ],
    [
      "ge",
      [
        "LDA L+1",
        "CMP R+1",
        "BCC M_f_L2",
        "BNE M_f_L1",
        "LDA L",
        "CMP R",
        "BCS M_f_L1",
        "JMP M_f_L2",
      ],
    ],
    [
      "gt",
      [
        "LDA R+1",
        "CMP L+1",
        "BCC M_f_L1",
        "BNE M_f_L2",
        "LDA R",
        "CMP L",
        "BCC M_f_L1",
        "JMP M_f_L2",
      ],
    ],
    [
      "le",
      [
        "LDA R+1",
        "CMP L+1",
        "BCC M_f_L2",
        "BNE M_f_L1",
        "LDA R",
        "CMP L",
        "BCS M_f_L1",
        "JMP M_f_L2",
      ],
    ],
  ];

  it.each(memory)("fuses word unsigned %s against a memory operand", (op, expected) => {
    expectFused(brcmp(op, wL, wR, IL_WORD), expected);
  });

  const immediate: Row[] = [
    [
      "lt",
      [
        "LDA L+1",
        "CMP #$12",
        "BCC M_f_L1",
        "BNE M_f_L2",
        "LDA L",
        "CMP #$34",
        "BCC M_f_L1",
        "JMP M_f_L2",
      ],
    ],
    [
      "ge",
      [
        "LDA L+1",
        "CMP #$12",
        "BCC M_f_L2",
        "BNE M_f_L1",
        "LDA L",
        "CMP #$34",
        "BCS M_f_L1",
        "JMP M_f_L2",
      ],
    ],
    [
      "gt",
      [
        "LDA #$12",
        "CMP L+1",
        "BCC M_f_L1",
        "BNE M_f_L2",
        "LDA #$34",
        "CMP L",
        "BCC M_f_L1",
        "JMP M_f_L2",
      ],
    ],
    [
      "le",
      [
        "LDA #$12",
        "CMP L+1",
        "BCC M_f_L2",
        "BNE M_f_L1",
        "LDA #$34",
        "CMP L",
        "BCS M_f_L1",
        "JMP M_f_L2",
      ],
    ],
  ];

  it.each(immediate)("fuses word unsigned %s against an immediate operand", (op, expected) => {
    expectFused(brcmp(op, wL, imm(0x1234, IL_WORD), IL_WORD), expected);
  });

  it("keeps the value form's three-label 0/1 tail (ST-6)", () => {
    expectValue({ op: "lt", dest: temp(0, IL_BYTE), left: wL, right: wR, type: IL_WORD }, [
      "LDA L+1",
      "CMP R+1",
      "BCC _cmp1",
      "BNE _cmp0",
      "LDA L",
      "CMP R",
      "BCC _cmp1",
      "_cmp0:",
      "LDA #$00",
      "JMP _cmp2",
      "_cmp1:",
      "LDA #$01",
      "_cmp2:",
    ]);
  });
});

describe("Specification: brcmp — 16-bit signed ordered framing (ST-10a)", () => {
  // The low CMP seeds the borrow, the high SBC produces N/V, and the same
  // BVC-guarded EOR correction leaves N holding the true sign of the difference.
  const memory: Row[] = [
    [
      "lt",
      [
        "LDA L",
        "CMP R",
        "LDA L+1",
        "SBC R+1",
        "BVC _cmp0",
        "EOR #$80",
        "_cmp0:",
        "BMI M_f_L1",
        "JMP M_f_L2",
      ],
    ],
    [
      "ge",
      [
        "LDA L",
        "CMP R",
        "LDA L+1",
        "SBC R+1",
        "BVC _cmp0",
        "EOR #$80",
        "_cmp0:",
        "BPL M_f_L1",
        "JMP M_f_L2",
      ],
    ],
    [
      "gt",
      [
        "LDA R",
        "CMP L",
        "LDA R+1",
        "SBC L+1",
        "BVC _cmp0",
        "EOR #$80",
        "_cmp0:",
        "BMI M_f_L1",
        "JMP M_f_L2",
      ],
    ],
    [
      "le",
      [
        "LDA R",
        "CMP L",
        "LDA R+1",
        "SBC L+1",
        "BVC _cmp0",
        "EOR #$80",
        "_cmp0:",
        "BPL M_f_L1",
        "JMP M_f_L2",
      ],
    ],
  ];

  it.each(memory)("fuses word signed %s against a memory operand", (op, expected) => {
    expectFused(brcmp(op, swL, swR, IL_SWORD), expected);
  });

  const immediate: Row[] = [
    [
      "lt",
      [
        "LDA L",
        "CMP #$34",
        "LDA L+1",
        "SBC #$12",
        "BVC _cmp0",
        "EOR #$80",
        "_cmp0:",
        "BMI M_f_L1",
        "JMP M_f_L2",
      ],
    ],
    [
      "ge",
      [
        "LDA L",
        "CMP #$34",
        "LDA L+1",
        "SBC #$12",
        "BVC _cmp0",
        "EOR #$80",
        "_cmp0:",
        "BPL M_f_L1",
        "JMP M_f_L2",
      ],
    ],
    [
      "gt",
      [
        "LDA #$34",
        "CMP L",
        "LDA #$12",
        "SBC L+1",
        "BVC _cmp0",
        "EOR #$80",
        "_cmp0:",
        "BMI M_f_L1",
        "JMP M_f_L2",
      ],
    ],
    [
      "le",
      [
        "LDA #$34",
        "CMP L",
        "LDA #$12",
        "SBC L+1",
        "BVC _cmp0",
        "EOR #$80",
        "_cmp0:",
        "BPL M_f_L1",
        "JMP M_f_L2",
      ],
    ],
  ];

  it.each(immediate)("fuses word signed %s against an immediate operand", (op, expected) => {
    expectFused(brcmp(op, swL, imm(0x1234, IL_SWORD), IL_SWORD), expected);
  });

  it("keeps the value form's N-corrected word tail (ST-6)", () => {
    expectValue({ op: "lt", dest: temp(0, IL_BYTE), left: swL, right: swR, type: IL_SWORD }, [
      "LDA L",
      "CMP R",
      "LDA L+1",
      "SBC R+1",
      "BVC _cmp0",
      "EOR #$80",
      "_cmp0:",
      "BMI _cmp1",
      "LDA #$00",
      "JMP _cmp2",
      "_cmp1:",
      "LDA #$01",
      "_cmp2:",
    ]);
  });
});

describe("Specification: brcmp — fused output materialises nothing (ST-10a)", () => {
  // The whole point of the fused form: no 0/1 byte exists on any path, at any
  // width or signedness, in either branch sense.
  const framings: ReadonlyArray<[string, ILTerminator]> = [
    ["8-bit equality", brcmp("eq", bL, bR, IL_BYTE)],
    ["8-bit unsigned order", brcmp("lt", bL, bR, IL_BYTE)],
    ["8-bit unsigned order, inverted", brcmp("ge", bL, bR, IL_BYTE)],
    ["8-bit signed order", brcmp("lt", sL, sR, IL_SBYTE)],
    ["8-bit signed order, inverted", brcmp("ge", sL, sR, IL_SBYTE)],
    ["16-bit equality", brcmp("eq", wL, wR, IL_WORD)],
    ["16-bit unsigned order", brcmp("lt", wL, wR, IL_WORD)],
    ["16-bit unsigned order, inverted", brcmp("ge", wL, wR, IL_WORD)],
    ["16-bit signed order", brcmp("lt", swL, swR, IL_SWORD)],
    ["16-bit signed order, inverted", brcmp("ge", swL, swR, IL_SWORD)],
  ];

  it.each(framings)("emits no 0/1 materialisation for the %s framing", (_name, terminator) => {
    const { text, bag } = render(fusedFn(terminator, []));
    expect(bag.hasErrors()).toBe(false);
    expect(text).not.toContain("LDA #$00");
    expect(text).not.toContain("LDA #$01");
  });
});

describe("Specification: brcmp — deferred load folds into the compare (ST-10c)", () => {
  // A single-use load is deferred and folded at its consumer. The consumer
  // being a terminator changes nothing: the poll reads its register once,
  // straight into the compare, with no temp traffic in between.
  it("folds a single-use load of a hardware register into the fused compare", () => {
    expectFused(
      brcmp("lt", temp(0, IL_BYTE), imm(0xfb, IL_BYTE), IL_BYTE),
      ["LDA VIC_RASTER", "CMP #$FB", "BCC M_f_L1", "JMP M_f_L2"],
      [{ op: "load", a: temp(0, IL_BYTE), b: loc("VIC_RASTER", IL_BYTE) }],
    );
  });
});
