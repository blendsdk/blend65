import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import { valueLifetimes } from "../semantic/value-lifetimes.js";
import {
  BOOLEAN,
  BYTE,
  WORD,
  VOID,
  loadOperation,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  sourceParameter,
  sourceBinding,
  sourceSpan,
} from "./lowering-test-support.js";

/** Keep branch-only comparisons distinct from returned materialized Boolean values. */
function comparison(
  limit: number,
  operator: "<" | ">=" | ">" | "<=" | "==",
  type = WORD,
  materialized = false,
  call = false,
  realLiveness = false,
) {
  const parameter = sourceParameter(9291, type);
  const operations: SemanticOperation[] = [
    call
      ? {
          kind: "call",
          result: "value",
          callee: sourceBinding(9296),
          arguments: [],
          type,
          span: sourceSpan(9292),
        }
      : loadOperation("value", parameter, 9292),
    {
      kind: "constant",
      result: "limit",
      value: BigInt(limit),
      type,
      integer: null,
      span: sourceSpan(9293),
    },
    {
      kind: "binary",
      result: "comparison",
      operator,
      left: "value",
      right: "limit",
      type: BOOLEAN,
      integer: null,
      span: sourceSpan(9294),
    },
  ];
  const fn = semanticFunction(9290, "comparison", [parameter], materialized ? BOOLEAN : VOID, [
    semanticBlock(
      "entry",
      operations,
      materialized
        ? { kind: "return", value: "comparison" }
        : { kind: "branch", condition: "comparison", whenTrue: "yes", whenFalse: "no" },
    ),
    ...(!materialized
      ? [
          semanticBlock("yes", [], { kind: "return", value: null }),
          semanticBlock("no", [], { kind: "return", value: null }),
        ]
      : []),
  ]);
  const functions = call
    ? [
        fn,
        semanticFunction(9296, "unknown-flags", [], type, [
          semanticBlock(
            "callee",
            [
              {
                kind: "constant",
                result: "one",
                value: 1n,
                type,
                integer: null,
                span: sourceSpan(9295),
              },
            ],
            { kind: "return", value: "one" },
          ),
        ]),
      ]
    : [fn];
  // Direct register/flag tests deliberately omit retention facts. Closed-call
  // tests instead supply real semantic liveness, as the public pipeline does.
  const lowered = lowerFunctions(functions, realLiveness ? functions.flatMap(valueLifetimes) : []);
  if (lowered.kind !== "complete") throw new Error(lowered.reason);
  return lowered.program.functions[0]!.blocks[0]!;
}

describe("local unsigned guard and identity comparison selection", () => {
  it.each(["<", ">="] as const)("uses only high-byte Z for unsigned word %s256", (operator) => {
    const block = comparison(256, operator);
    expect(block.instructions.map(({ opcode }) => opcode)).toEqual(["lda"]);
    expect(block.instructions[0]!.operand).toMatchObject({ kind: "storage", offset: 1 });
    expect(block.terminator).toMatchObject({
      kind: "branch",
      opcode: operator === "<" ? "beq" : "bne",
      uses: { registers: [], flags: ["z"] },
    });
  });

  it.each(["<", ">="] as const)(
    "uses low sign bit and high-byte Z for unsigned word %s128",
    (operator) => {
      const block = comparison(128, operator);
      expect(block.instructions.map(({ opcode }) => opcode)).toEqual(["lda", "and", "ora"]);
      expect(block.instructions[1]!.operand).toEqual({ kind: "immediate", value: 0x80 });
      expect(block.instructions[2]!.operand).toMatchObject({ kind: "storage", offset: 1 });
      for (let value = 0; value <= 0xffff; value += 1)
        expect(((value & 0x80) | (value >>> 8)) === 0).toBe(value < 128);
    },
  );

  it("keeps full-word subtraction for signed values, other limits and materialized Booleans", () => {
    const signed: SemanticType = { kind: "scalar", name: "sword" };
    for (const block of [
      comparison(256, "<", signed),
      comparison(255, "<"),
      comparison(128, "<", WORD, true),
      comparison(256, "<", WORD, true),
    ])
      expect(block.instructions.some(({ opcode }) => opcode === "sbc")).toBe(true);
  });

  it("removes EOR0 only where fresh selected instructions establish Z", () => {
    expect(comparison(0, "==", BYTE).instructions.some(({ opcode }) => opcode === "eor")).toBe(
      false,
    );
    expect(
      comparison(0, "==", BYTE, false, true).instructions.some(({ opcode }) => opcode === "eor"),
    ).toBe(true);
  });

  it.each([
    [128, "<", "bpl"],
    [128, ">=", "bmi"],
    [127, ">", "bmi"],
    [127, "<=", "bpl"],
  ] as const)("uses fresh N for unsigned byte %s %s", (limit, operator, branch) => {
    const block = comparison(limit, operator, BYTE);
    expect(block.instructions.map(({ opcode }) => opcode)).toEqual(["lda"]);
    expect(block.terminator).toMatchObject({
      kind: "branch",
      opcode: branch,
      uses: { registers: [], flags: ["n"] },
    });
  });

  it("keeps comparison instructions for materialized, signed, returned and other-limit bytes", () => {
    const signed: SemanticType = { kind: "scalar", name: "sbyte" };
    for (const block of [
      comparison(128, "<", BYTE, true),
      comparison(127, ">", BYTE, true),
      comparison(128, "<", BYTE, false, true),
      comparison(127, "<", BYTE),
      comparison(128, ">", BYTE),
      comparison(127, "<=", signed),
    ]) {
      expect(block.instructions.some(({ opcode }) => opcode === "cmp")).toBe(true);
      expect(
        block.terminator.kind !== "branch" || !["bmi", "bpl"].includes(block.terminator.opcode),
      ).toBe(true);
    }
  });

  it.each([
    [128, "<"],
    [127, ">"],
  ] as const)(
    "tests returned byte %s %s through its actual retained-home producer",
    (limit, operator) => {
      const block = comparison(limit, operator, BYTE, false, true, true);
      expect(block.instructions.map(({ opcode }) => opcode)).toEqual(["jsr", "sta", "lda"]);
      // STA preserves unrelated call flags. The last LDA must remain and
      // explicitly establishes N from the returned byte, not the callee's P.
      expect(block.instructions[1]!.operand).toEqual(block.instructions[2]!.operand);
      expect(block.terminator).toMatchObject({
        kind: "branch",
        opcode: operator === "<" ? "bpl" : "bmi",
        uses: { registers: [], flags: ["n"] },
      });
    },
  );
});
