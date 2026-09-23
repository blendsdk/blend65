import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import {
  BOOLEAN,
  BYTE,
  VOID,
  loadOperation,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceSpan,
} from "./lowering-test-support.js";

describe("loop-carried packed aggregate addressing", () => {
  it("should initialize one record pointer and advance it by the fixed stride at the latch", () => {
    const record: SemanticType = Object.freeze({
      kind: "struct",
      binding: sourceBinding(900),
      size: 5,
      fields: Object.freeze([
        Object.freeze({ name: "x", type: BYTE, offset: 0 }),
        Object.freeze({ name: "alive", type: BOOLEAN, offset: 3 }),
      ]),
    });
    const records: SemanticType = Object.freeze({
      kind: "array",
      element: record,
      length: 6,
      size: 30,
    });
    const index = sourceBinding(901);
    const root = sourceBinding(902);
    const initial: readonly SemanticOperation[] = [
      Object.freeze({
        kind: "constant" as const,
        result: "initial-index",
        type: BYTE,
        integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
        value: 0n,
        span: sourceSpan(903),
      }),
      Object.freeze({
        kind: "store" as const,
        place: Object.freeze({ root: index, path: Object.freeze([]) }),
        value: "initial-index",
        type: BYTE,
        span: sourceSpan(904),
      }),
    ];
    const condition: readonly SemanticOperation[] = [
      Object.freeze({
        ...loadOperation("condition-index", Object.freeze({ id: index, type: BYTE }), 905),
      }),
      Object.freeze({
        kind: "constant" as const,
        result: "bound",
        type: BYTE,
        integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
        value: 6n,
        span: sourceSpan(906),
      }),
      Object.freeze({
        kind: "binary" as const,
        result: "within-bound",
        type: BOOLEAN,
        integer: null,
        operator: "<",
        left: "condition-index",
        right: "bound",
        span: sourceSpan(907),
      }),
    ];
    const body: readonly SemanticOperation[] = [
      Object.freeze({
        ...loadOperation("body-index", Object.freeze({ id: index, type: BYTE }), 908),
      }),
      Object.freeze({
        kind: "load" as const,
        result: "alive",
        place: Object.freeze({
          root,
          rootType: records,
          path: Object.freeze([
            Object.freeze({ kind: "index" as const, value: "body-index" }),
            Object.freeze({ kind: "field" as const, name: "alive" }),
          ]),
        }),
        type: BOOLEAN,
        integer: null,
        span: sourceSpan(909),
      }),
    ];
    const latch: readonly SemanticOperation[] = [
      Object.freeze({
        ...loadOperation("latch-index", Object.freeze({ id: index, type: BYTE }), 910),
      }),
      Object.freeze({
        kind: "constant" as const,
        result: "step",
        type: BYTE,
        integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
        value: 1n,
        span: sourceSpan(911),
      }),
      Object.freeze({
        kind: "binary" as const,
        result: "next-index",
        type: BYTE,
        integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
        operator: "+",
        left: "latch-index",
        right: "step",
        span: sourceSpan(912),
      }),
      Object.freeze({
        kind: "store" as const,
        place: Object.freeze({ root: index, path: Object.freeze([]) }),
        value: "next-index",
        type: BYTE,
        span: sourceSpan(913),
      }),
    ];
    const main = semanticFunction(899, "record-induction", [], VOID, [
      semanticBlock(
        "induction.entry",
        initial,
        Object.freeze({ kind: "jump" as const, target: "induction.header" }),
      ),
      semanticBlock(
        "induction.header",
        condition,
        Object.freeze({
          kind: "branch" as const,
          condition: "within-bound",
          whenTrue: "induction.body",
          whenFalse: "induction.exit",
        }),
      ),
      semanticBlock(
        "induction.body",
        body,
        Object.freeze({ kind: "jump" as const, target: "induction.latch" }),
      ),
      semanticBlock("induction.exit", [], Object.freeze({ kind: "return" as const, value: null })),
      semanticBlock(
        "induction.latch",
        latch,
        Object.freeze({ kind: "jump" as const, target: "induction.header" }),
      ),
    ]);
    const result = lowerFunctions([main]);

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected loop-carried address lowering");
    const blocks = result.program.functions[0]!.blocks;
    const entry = blocks.find(({ label }) => label === "induction.entry")!;
    const bodyBlock = blocks.find(({ label }) => label === "induction.body")!;
    const latchBlock = blocks.find(({ label }) => label === "induction.latch")!;
    const addressLow = ({ opcode, mode, operand }: (typeof entry.instructions)[number]) =>
      opcode === "lda" &&
      mode === "immediate" &&
      operand?.kind === "storage" &&
      operand.requestId.includes(`:${root.span.start}:`) &&
      operand.addressByte === "low";

    expect(entry.instructions.filter(addressLow)).toHaveLength(1);
    expect(bodyBlock.instructions.filter(addressLow)).toHaveLength(0);
    expect(
      blocks.flatMap(({ instructions }) => instructions).filter(({ opcode }) => opcode === "asl"),
    ).toHaveLength(0);
    expect(
      blocks.flatMap(({ instructions }) => instructions).filter(({ opcode }) => opcode === "rol"),
    ).toHaveLength(0);
    expect(
      latchBlock.instructions.some(
        ({ opcode, mode, operand }) =>
          opcode === "adc" &&
          mode === "immediate" &&
          operand?.kind === "immediate" &&
          operand.value === 5,
      ),
    ).toBe(true);

    const wrappingLatch = latch.map((operation) =>
      operation.kind === "constant" && operation.result === "step"
        ? Object.freeze({ ...operation, value: 255n })
        : operation,
    );
    const fallback = semanticFunction(
      920,
      "wrapping-record-induction",
      [],
      VOID,
      main.blocks.map((block) =>
        block.id === "induction.latch"
          ? semanticBlock(block.id, wrappingLatch, block.terminator)
          : block,
      ),
    );
    const fallbackResult = lowerFunctions([fallback]);

    expect(fallbackResult.kind).toBe("complete");
    if (fallbackResult.kind !== "complete") throw new Error("Expected conservative loop fallback");
    const fallbackBlocks = fallbackResult.program.functions[0]!.blocks;
    const fallbackEntry = fallbackBlocks.find(({ label }) => label === "induction.entry")!;
    const fallbackBody = fallbackBlocks.find(({ label }) => label === "induction.body")!;
    expect(fallbackEntry.instructions.filter(addressLow)).toHaveLength(0);
    expect(fallbackBody.instructions.filter(({ opcode }) => opcode === "asl")).toHaveLength(2);
    expect(fallbackBody.instructions.filter(({ opcode }) => opcode === "rol")).toHaveLength(2);
  });
});
