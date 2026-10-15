import { describe, expect, it } from "vitest";
import type { SemanticOperation, SemanticTerminator } from "../semantic/operations.js";
import { machineInstruction } from "./lower-control.js";
import { selectRegisterForwarding } from "./lower-register-forwarding.js";
import { appendImmediateByteBitwise } from "./lower-scalar.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  BYTE,
  VOID,
  WORD,
  selectedProfile,
  semanticBlock,
  sourceBinding,
  sourceSpan,
} from "./lowering-test-support.js";

const cpu = selectedProfile().cpu;
const span = sourceSpan(9960);
const count: SemanticOperation = {
  kind: "constant",
  result: "one",
  value: 1n,
  type: BYTE,
  integer: null,
  span,
};
const shift: Extract<SemanticOperation, { kind: "binary" }> = {
  kind: "binary",
  result: "shifted",
  operator: "<<",
  left: "input",
  right: "one",
  type: BYTE,
  integer: null,
  span,
};
const combine: Extract<SemanticOperation, { kind: "binary" }> = {
  kind: "binary",
  result: "combined",
  operator: "|",
  left: "shifted",
  right: "one",
  type: BYTE,
  integer: null,
  span,
};
const cast: Extract<SemanticOperation, { kind: "convert" }> = {
  kind: "convert",
  result: "cast",
  operand: "combined",
  conversion: "reinterpret",
  type: BYTE,
  integer: null,
  span,
};
const store: Extract<SemanticOperation, { kind: "store" }> = {
  kind: "store",
  value: "combined",
  type: BYTE,
  place: { root: sourceBinding(9961), rootType: BYTE, path: [] },
  span,
};

/** Ask the actual adjacency owner with explicit sole-use and block-boundary facts. */
function forward(
  operations: readonly SemanticOperation[],
  uses: readonly string[] = ["shifted", "combined", "cast"],
  terminator: SemanticTerminator = { kind: "return", value: null },
) {
  return selectRegisterForwarding([semanticBlock("entry", operations, terminator)], new Set(uses))
    .forwardedRegisterValues;
}

/** Keep the official opcode state and separate source spans in the byte-tail fixture. */
function pair() {
  return [
    machineInstruction(cpu, "asl", "accumulator", null, [], sourceSpan(9962)),
    machineInstruction(
      cpu,
      "ora",
      "immediate",
      { kind: "immediate", value: 1 },
      [],
      sourceSpan(9963),
    ),
  ] as const;
}

describe("one-bit shift and OR1 handoff", () => {
  it.each(["<<", ">>"])("forwards only the sole count1 %s byte result to OR1", (operator) => {
    expect(forward([count, { ...shift, operator }, combine, store]).has("shifted")).toBe(true);
    expect(
      forward([count, { ...shift, operator }, combine, store], ["combined"]).has("shifted"),
    ).toBe(false);
  });
  it("retains unknown/other counts, operands, operators, widths and clobbering gaps", () => {
    for (const value of [0n, 2n, 3n, 7n, 8n, 255n])
      expect(forward([{ ...count, value }, shift, combine]).has("shifted")).toBe(false);
    expect(forward([shift, combine]).has("shifted")).toBe(false);
    for (const operation of [
      { ...combine, operator: "&" },
      { ...combine, operator: "^" },
      { ...combine, left: "other" },
      { ...combine, right: "runtime" },
      { ...combine, type: WORD },
    ])
      expect(forward([count, shift, operation]).has("shifted")).toBe(false);
    expect(forward([count, { ...shift, type: WORD }, combine]).has("shifted")).toBe(false);
    for (const gap of [
      { kind: "cpu-control" as const, control: "asm_php" as const, span },
      {
        kind: "call" as const,
        result: null,
        callee: sourceBinding(9964),
        arguments: [],
        type: VOID,
        span,
      },
    ])
      expect(forward([count, shift, gap, combine]).has("shifted")).toBe(false);
    const two: SemanticOperation = { ...count, result: "two", value: 2n };
    expect(forward([count, two, shift, { ...combine, right: "two" }]).has("shifted")).toBe(false);
  });
  it.each(["identity", "reinterpret"] as const)(
    "allows one sole %s OR1 cast into a store/return",
    (conversion) => {
      const castOperation = { ...cast, conversion };
      const operations = [count, shift, combine, castOperation];
      const stored = forward([...operations, { ...store, value: "cast" }]);
      const returned = forward(operations, undefined, { kind: "return", value: "cast" });
      for (const selection of [stored, returned]) {
        expect(selection.has("combined")).toBe(true);
        expect(selection.has("cast")).toBe(true);
      }
    },
  );
  it("does not extend other casts, selected destinations or unrelated OR operators", () => {
    for (const conversion of ["truncate", "sign-extend", "zero-extend"] as const)
      expect(
        forward([count, combine, { ...cast, conversion }, { ...store, value: "cast" }]).has(
          "combined",
        ),
      ).toBe(false);
    for (const changed of [
      { ...cast, type: WORD },
      { ...cast, operand: "other" },
    ])
      expect(forward([count, combine, changed, { ...store, value: "cast" }]).has("combined")).toBe(
        false,
      );
    expect(
      forward([count, combine, cast, { ...store, value: "cast" }], ["combined"]).has("combined"),
    ).toBe(false);
    const selected = {
      ...store,
      value: "cast",
      place: { ...store.place, path: [{ kind: "index" as const, value: "index" }] },
    };
    expect(forward([count, combine, cast, selected]).has("combined")).toBe(false);
    expect(
      forward([count, { ...combine, operator: "^" }, cast, { ...store, value: "cast" }]).has(
        "combined",
      ),
    ).toBe(false);
    expect(
      forward([
        count,
        combine,
        cast,
        { kind: "cpu-control", control: "asm_nop", span },
        { ...store, value: "cast" },
      ]).has("combined"),
    ).toBe(false);
  });
});

describe("adjacent ASL/ORA1 selected as SEC/ROL", () => {
  it("retains complete final values, carry, flags, official costs and source ownership", () => {
    const [shift, or] = pair();
    const prefix = machineInstruction(
      cpu,
      "lda",
      "absolute",
      { kind: "absolute", value: 0x3200 },
      [],
      span,
    );
    const instructions = [prefix, shift];
    appendImmediateByteBitwise(instructions, [or], cpu);
    expect(instructions[0]).toBe(prefix);
    expect(instructions.map((instruction) => instruction.opcode)).toEqual(["lda", "sec", "rol"]);
    const selected = instructions.slice(1);
    expect(selected[0]!.source).toBe(shift.source);
    expect(selected[1]!.source).toBe(or.source);
    expect(selected[0]!.uses).toEqual({ registers: [], flags: [] });
    expect(selected[0]!.defines).toEqual({ registers: [], flags: ["c"] });
    expect(selected[1]!.uses).toEqual({ registers: ["a"], flags: ["c"] });
    expect(selected[1]!.defines).toEqual({ registers: ["a"], flags: ["n", "z", "c"] });
    expect(selected.every((instruction) => instruction.memory.length === 0)).toBe(true);
    expect(selected.reduce((sum, instruction) => sum + instruction.cost.bytes, 0)).toBe(2);
    expect(selected.reduce((sum, instruction) => sum + instruction.cost.minCycles, 0)).toBe(4);
    expect(selected.reduce((sum, instruction) => sum + instruction.cost.maxCycles, 0)).toBe(4);
    for (let input = 0; input <= 255; input += 1) {
      for (const incomingCarry of [0, 1]) {
        const before = { a: ((input * 2) & 255) | 1, c: input >> 7 };
        const seededCarry = 1;
        const after = { a: (input * 2 + seededCarry) & 255, c: input >> 7 };
        expect(after, `input=${input}, incomingCarry=${incomingCarry}`).toEqual(before);
      }
    }
  });
  it("does not replace another shift, immediate value, memory-bearing or malformed operand", () => {
    const [shift, or] = pair();
    const cases: readonly (readonly [MachineInstruction, MachineInstruction])[] = [
      [machineInstruction(cpu, "lsr", "accumulator", null, [], shift.source), or],
      [shift, { ...or, operand: { kind: "immediate", value: 2 } }],
      [shift, { ...or, operand: { kind: "immediate", value: 1.5 } }],
      [shift, { ...or, mode: "absolute", operand: { kind: "absolute", value: 0x3200 } }],
      [{ ...shift, operand: { kind: "register", register: "a" } }, or],
      [
        {
          ...shift,
          memory: [
            {
              kind: "read",
              address: { kind: "absolute", value: 0x3300 },
              width: 1,
              volatile: true,
              order: 0,
            },
          ],
        },
        or,
      ],
      [
        shift,
        {
          ...or,
          memory: [
            {
              kind: "read",
              address: { kind: "absolute", value: 0x3300 },
              width: 1,
              volatile: true,
              order: 0,
            },
          ],
        },
      ],
    ];
    for (const [first, last] of cases) {
      const instructions = [first];
      appendImmediateByteBitwise(instructions, [last], cpu);
      expect(instructions).toEqual([first, last]);
    }
  });
  it("does not cross an instruction, block-prefix absence or a multi-instruction operation", () => {
    const [shift, or] = pair();
    for (const opcode of ["php", "nop", "jsr", "sta"]) {
      const barrier = machineInstruction(
        cpu,
        opcode,
        ["jsr", "sta"].includes(opcode) ? "absolute" : "implied",
        ["jsr", "sta"].includes(opcode) ? { kind: "absolute", value: 0x3300 } : null,
        [],
        span,
      );
      const instructions = [shift, barrier];
      appendImmediateByteBitwise(instructions, [or], cpu);
      expect(instructions).toEqual([shift, barrier, or]);
    }
    const empty: MachineInstruction[] = [];
    appendImmediateByteBitwise(empty, [or], cpu);
    expect(empty).toEqual([or]);
    const multiple = [shift];
    const nop = machineInstruction(cpu, "nop", "implied", null, [], span);
    appendImmediateByteBitwise(multiple, [or, nop], cpu);
    expect(multiple).toEqual([shift, or, nop]);
  });
});
