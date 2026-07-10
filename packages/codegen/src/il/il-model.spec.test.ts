/**
 * Specification tests for the IL data model.
 *
 * Derived exclusively from the documented type-mapping table, the operand
 * constructors/guards, the instruction/terminator construction, that an
 * `ILProgram` carries the `AllocationPlan`, and `ilTypeEquals` — not from
 * implementation logic.
 *
 * Spec-tests-first: authored before the implementation and expected to fail
 * first (red — the `il/` modules do not exist yet), then pass (green).
 * Immutable oracle — a post-implementation failure means the implementation
 * is wrong, not this test.
 */

import { describe, expect, it } from "vitest";
import { createIntrinsicRegistry, makeSpan, primitive } from "@blend65/core";
import type {
  AllocationPlan,
  ArrayType,
  EnumDeclNode,
  EnumType,
  SourceSpan,
  StructDeclNode,
  StructType,
} from "@blend65/core";

import {
  IL_BYTE,
  IL_SBYTE,
  IL_SWORD,
  IL_WORD,
  ilTypeEquals,
  ilTypeOfType,
} from "./il-type.js";
import { imm, isImmediate, isLocation, isTemp, loc, temp } from "./operand.js";
import type { ILInstruction, ILTerminator } from "./instruction.js";
import type { BasicBlock, ILFunction, ILProgram } from "./cfg.js";

/** A zero-width span for the synthetic decl nodes used as type provenance. */
const SPAN: SourceSpan = makeSpan(0, 0, 0);

/** A minimal `StructDeclNode` so a `StructType.decl` has a real AST node. */
const STRUCT_DECL: StructDeclNode = {
  kind: "StructDecl",
  exported: false,
  name: "Point",
  nameSpan: SPAN,
  fields: [],
  span: SPAN,
};

/** A minimal `EnumDeclNode` so an `EnumType.decl` has a real AST node. */
const ENUM_DECL: EnumDeclNode = {
  kind: "EnumDecl",
  exported: false,
  name: "Color",
  nameSpan: SPAN,
  members: [],
  span: SPAN,
};

/**
 * A minimal, fully-typed empty `AllocationPlan`. Used below to verify the plan
 * is carried by reference through `ILProgram`. All figures are zero — the only
 * property under test is identity preservation.
 */
const EMPTY_PLAN: AllocationPlan = {
  frames: new Map(),
  dataBase: 0,
  frameRegionBase: 0,
  frameRegionSize: 0,
  peakSimultaneous: 0,
  sharingSaved: 0,
  zpAllocations: [],
  zpUsed: 0,
  zpBudget: 0,
  moduleVariables: [],
  moduleVariablesSize: 0,
  stackAnalysis: {
    maxMainDepth: 0,
    maxMainStackBytes: 0,
    maxIrqDepth: 0,
    maxIrqStackBytes: 0,
    irqOverhead: 0,
    totalWorstCase: 0,
    platformBudget: 0,
    exceedsWarningThreshold: false,
  },
  symbolDefinitions: [],
  resourceData: {
    frameRegionBytes: 0,
    frameRegionPeak: 0,
    frameSharingSaved: 0,
    zpUsed: 0,
    zpBudget: 0,
    ramUsed: 0,
    ramBudget: 0,
    stackWorstCase: 0,
    stackBudget: 0,
  },
  hasErrors: false,
};

describe("Specification: RD-06 IL type mapping (§4.1)", () => {
  // byte → IL_BYTE {8,false}
  it("should map primitive byte to IL_BYTE (ST-M1, R3/§4.1)", () => {
    expect(ilTypeOfType(primitive("byte"))).toEqual({ width: 8, signed: false });
    expect(ilTypeOfType(primitive("byte"))).toEqual(IL_BYTE);
  });

  // sbyte → IL_SBYTE {8,true}
  it("should map primitive sbyte to IL_SBYTE (ST-M2, §4.1)", () => {
    expect(ilTypeOfType(primitive("sbyte"))).toEqual({ width: 8, signed: true });
    expect(ilTypeOfType(primitive("sbyte"))).toEqual(IL_SBYTE);
  });

  // word → IL_WORD {16,false}
  it("should map primitive word to IL_WORD (ST-M3, §4.1)", () => {
    expect(ilTypeOfType(primitive("word"))).toEqual({ width: 16, signed: false });
    expect(ilTypeOfType(primitive("word"))).toEqual(IL_WORD);
  });

  // sword → IL_SWORD {16,true}
  it("should map primitive sword to IL_SWORD (ST-M4, §4.1)", () => {
    expect(ilTypeOfType(primitive("sword"))).toEqual({ width: 16, signed: true });
    expect(ilTypeOfType(primitive("sword"))).toEqual(IL_SWORD);
  });

  // boolean is erased to IL_BYTE (values 0/1)
  it("should erase boolean to IL_BYTE (ST-M5, R5/§4.1)", () => {
    expect(ilTypeOfType(primitive("boolean"))).toEqual(IL_BYTE);
  });

  // enum identity is erased to IL_BYTE
  it("should erase enum identity to IL_BYTE (ST-M6, R6/§4.1)", () => {
    const en: EnumType = {
      kind: "enum",
      name: "Color",
      decl: ENUM_DECL,
      members: new Map([["Red", 0]]),
    };
    expect(ilTypeOfType(en)).toEqual(IL_BYTE);
  });

  // struct/array are passed by-ref → IL_WORD (16-bit base address)
  it("should map struct and array (by-ref) to IL_WORD (ST-M7, §4.1)", () => {
    const struct: StructType = {
      kind: "struct",
      name: "Point",
      decl: STRUCT_DECL,
      fields: new Map([["x", { type: primitive("byte"), offset: 0 }]]),
      byteSize: 1,
    };
    const arr: ArrayType = { kind: "array", element: primitive("byte"), size: 4 };
    expect(ilTypeOfType(struct)).toEqual(IL_WORD);
    expect(ilTypeOfType(arr)).toEqual(IL_WORD);
  });
});

describe("Specification: RD-06 IL operands (§4.2)", () => {
  // constructors build the correct discriminated operands; guards classify each.
  it("should build immediate/temp/location operands and classify them (ST-M8, R7–R11)", () => {
    const i = imm(42, IL_BYTE);
    const t = temp(0, IL_WORD);
    const l = loc("__var_x", IL_WORD);

    expect(i).toEqual({ kind: "immediate", value: 42, type: IL_BYTE });
    expect(t).toEqual({ kind: "temp", id: 0, type: IL_WORD });
    expect(l).toEqual({ kind: "location", symbol: "__var_x", type: IL_WORD });

    // Guards classify exactly one kind each.
    expect(isImmediate(i)).toBe(true);
    expect(isTemp(i)).toBe(false);
    expect(isLocation(i)).toBe(false);

    expect(isTemp(t)).toBe(true);
    expect(isImmediate(t)).toBe(false);

    expect(isLocation(l)).toBe(true);
    expect(isTemp(l)).toBe(false);
  });
});

describe("Specification: RD-06 IL instructions & terminators (§4.3)", () => {
  // One representative of each instruction family + each terminator builds
  // a well-typed record carrying its `op` / `kind` discriminant.
  it("should construct one of each instruction family and terminator (ST-M9, R17–R28)", () => {
    const d = temp(0, IL_BYTE);
    const x = temp(1, IL_BYTE);
    const y = temp(2, IL_BYTE);

    const instrs: ILInstruction[] = [
      { op: "add", dest: d, left: x, right: y, type: IL_BYTE },
      { op: "neg", dest: d, src: x, type: IL_BYTE },
      { op: "and", dest: d, left: x, right: y, type: IL_BYTE },
      { op: "not", dest: d, src: x, type: IL_BYTE },
      { op: "eq", dest: d, left: x, right: y, type: IL_BYTE },
      { op: "zext", dest: temp(3, IL_WORD), src: x },
      { op: "load", a: d, b: loc("__var_x", IL_BYTE) },
      { op: "store", a: x, b: loc("__var_x", IL_BYTE) },
      { op: "load_indexed", value: d, base: loc("__var_a", IL_WORD), index: x },
      { op: "load_indirect", value: d, ptr: temp(4, IL_WORD), offset: imm(0, IL_BYTE) },
      { op: "copy", dest: d, src: x },
      { op: "const", dest: d, src: imm(5, IL_BYTE) },
      { op: "call", target: "Main.helper", args: [x, y] },
      {
        op: "intrinsic",
        name: "poke",
        args: [x, y],
        // The descriptor is the canonical core type.
        descriptor: createIntrinsicRegistry().get("poke")!,
      },
      { op: "source_span", span: SPAN },
    ];

    // Every record exposes its `op` discriminant.
    expect(instrs.map((n) => n.op)).toEqual([
      "add",
      "neg",
      "and",
      "not",
      "eq",
      "zext",
      "load",
      "store",
      "load_indexed",
      "load_indirect",
      "copy",
      "const",
      "call",
      "intrinsic",
      "source_span",
    ]);

    const terms: ILTerminator[] = [
      { kind: "br", target: "_L1" },
      { kind: "brcond", cond: d, trueTarget: "_L1", falseTarget: "_L2" },
      { kind: "ret", value: d },
      { kind: "unreachable" },
    ];
    expect(terms.map((t) => t.kind)).toEqual(["br", "brcond", "ret", "unreachable"]);
  });
});

describe("Specification: RD-06 CFG records (§4.4–§4.5)", () => {
  // An `ILProgram` carries the `AllocationPlan` it was built with (by reference).
  it("should carry the AllocationPlan on the ILProgram (ST-M10, R66)", () => {
    const entry: BasicBlock = {
      label: "_entry",
      instructions: [],
      terminator: { kind: "ret" },
    };
    const fn: ILFunction = {
      name: "Main.main",
      params: [],
      returnType: "void",
      blocks: [entry],
      tempCount: 0,
      isInterrupt: false,
    };
    const program: ILProgram = {
      functions: [fn],
      initCode: [],
      constData: [],
      allocationPlan: EMPTY_PLAN,
    };

    expect(program.allocationPlan).toBe(EMPTY_PLAN);
    expect(program.functions[0].blocks[0].label).toBe("_entry");
  });
});

describe("Specification: RD-06 ilTypeEquals (§4.1)", () => {
  // Structural equality on ILType.
  it("should compare ILTypes structurally (ST-M11, R3)", () => {
    expect(ilTypeEquals(IL_BYTE, IL_BYTE)).toBe(true);
    expect(ilTypeEquals(IL_BYTE, IL_WORD)).toBe(false);
    expect(ilTypeEquals(IL_SBYTE, { width: 8, signed: true })).toBe(true);
    expect(ilTypeEquals(IL_WORD, IL_SWORD)).toBe(false);
  });
});
