import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import { appendConstantConstruction } from "./lower-aggregate-members.js";
import { machineInstruction } from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  BYTE,
  VOID,
  lowerFunctions,
  selectedProfile,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceParameter,
  sourceSpan,
} from "./lowering-test-support.js";

const source = sourceSpan(3100);
const cpu = selectedProfile().cpu;

/** Select a nested literal through the real inventory, allocator and machine binder. */
function nested(width: number, prefix: number, borrowed = false, fresh = true) {
  const rows: SemanticType = { kind: "array", element: BYTE, length: width, size: width };
  const pad: SemanticType = { kind: "array", element: BYTE, length: prefix, size: prefix };
  const rootType: SemanticType = {
    kind: "struct",
    binding: sourceBinding(3101),
    size: prefix + width + 1,
    fields: [
      { name: "pad", type: pad, offset: 0 },
      { name: "rows", type: rows, offset: prefix },
      { name: "tag", type: BYTE, offset: prefix + width },
    ],
  };
  const root = sourceParameter(3102, rootType);
  const place = { root: root.id, rootType, path: [] };
  const destination = {
    kind: "place" as const,
    place,
    ...(fresh ? { freshConstant: true as const } : {}),
  };
  const operations: SemanticOperation[] = [
    { kind: "constant", result: "zero", value: 0n, type: BYTE, integer: null, span: source },
    {
      kind: "aggregate",
      result: "pad",
      type: pad,
      elements: [],
      fill: "zero",
      destination: { ...destination, place: { ...place, path: [{ kind: "field", name: "pad" }] } },
      integer: null,
      span: source,
    },
    {
      kind: "aggregate",
      result: "rows",
      type: rows,
      elements: Array.from({ length: width }, () => ({ field: null, value: "zero" })),
      fill: null,
      destination: { ...destination, place: { ...place, path: [{ kind: "field", name: "rows" }] } },
      integer: null,
      span: source,
    },
    {
      kind: "aggregate",
      result: "root",
      type: rootType,
      elements: [
        { field: "pad", value: "pad" },
        { field: "rows", value: "rows" },
        { field: "tag", value: "zero" },
      ],
      fill: null,
      destination,
      integer: null,
      span: source,
    },
    { kind: "store", place, value: "root", type: rootType, span: source },
  ];
  const fn = semanticFunction(3100, "main", borrowed ? [root] : [], VOID, [
    semanticBlock("entry", operations, { kind: "return", value: null }),
  ]);
  const lowered = lowerFunctions([fn]);
  if (lowered.kind !== "complete") throw new Error("Expected valid nested literal lowering");
  return lowered.program;
}

/** Official load/store operations let the proof inspect real A/N/Z effects and costs. */
function load(value: number) {
  return machineInstruction(cpu, "lda", "immediate", { kind: "immediate", value }, [], source);
}

/** A private write preserves A/N/Z, unlike an unrelated home or volatile observer. */
function store(requestId = "local") {
  return machineInstruction(
    cpu,
    "sta",
    "storage",
    { kind: "storage", requestId, offset: 0 },
    [],
    source,
  );
}

describe("constant construction machine internals", () => {
  it.each([
    [2, 0],
    [8, 0],
    [8, 256],
  ])("should use only the certified final home for width %i after prefix %i", (width, prefix) => {
    const program = nested(width, prefix);
    expect(
      program.requiredStorage.filter(({ region }) => region === "zero-page-required"),
    ).toHaveLength(0);
    expect(program.requiredStorage.filter(({ role }) => role === "temporary")).toHaveLength(0);
    const writes = program.functions[0]!.blocks.flatMap(({ instructions }) => instructions)
      .filter(({ opcode, operand }) => opcode === "sta" && operand?.kind === "storage")
      .map(({ operand }) => (operand?.kind === "storage" ? operand.offset : -1));
    for (let offset = prefix; offset < prefix + width; offset += 1)
      expect(writes.filter((value) => value === offset)).toHaveLength(1);
  });

  it.each([true, false])("should retain pointer/copy fallback when borrowed is %s", (borrowed) => {
    const program = nested(8, 0, borrowed, false);
    expect(program.requiredStorage.some(({ region }) => region === "zero-page-required")).toBe(
      true,
    );
  });

  it("should remove only an identical immediate load across the same private stores", () => {
    const target: MachineInstruction[] = [];
    expect(
      appendConstantConstruction(target, [load(7), store(), load(7), store()], null, "local"),
    ).toBe(7);
    expect(target.map(({ opcode }) => opcode)).toEqual(["lda", "sta", "sta"]);
    expect(target.reduce((sum, { cost }) => sum + cost.bytes, 0)).toBe(8);
  });

  it.each(["ldy", "sec", "cld"])("should drop the proof across a non-construction %s", (opcode) => {
    const barrier = machineInstruction(
      cpu,
      opcode,
      opcode === "ldy" ? "immediate" : "implied",
      opcode === "ldy" ? { kind: "immediate", value: 1 } : null,
      [],
      source,
    );
    const target: MachineInstruction[] = [];
    appendConstantConstruction(target, [load(7), barrier, load(7)], null, "local");
    expect(target.filter(({ opcode }) => opcode === "lda")).toHaveLength(2);
  });

  it("should not reuse across a different home, volatile store or changed immediate", () => {
    const volatile = {
      ...store(),
      memory: [
        {
          kind: "write" as const,
          address: { kind: "storage" as const, requestId: "local", offset: 0 },
          width: 1 as const,
          volatile: true,
          order: 0,
        },
      ],
    };
    for (const barrier of [store("other"), volatile]) {
      const target: MachineInstruction[] = [];
      appendConstantConstruction(target, [load(7), barrier, load(7), load(8)], null, "local");
      expect(target.filter(({ opcode }) => opcode === "lda")).toHaveLength(3);
    }
  });
});
