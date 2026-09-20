import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import { inventoryStorage } from "../storage/inventory.js";
import {
  BOOLEAN,
  BYTE,
  BYTE_PAIR,
  VOID,
  WORD,
  loadOperation,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceParameter,
  sourceSpan,
  wholeProgramFor,
} from "./lowering-test-support.js";

describe("direct value lowering", () => {
  it("should lower unary, bitwise, and constant scaling paths without a helper", () => {
    const left = sourceParameter(200, WORD);
    const right = sourceParameter(210, WORD);
    const operations: readonly SemanticOperation[] = [
      loadOperation("left", left, 220),
      loadOperation("right", right, 221),
      Object.freeze({
        kind: "unary" as const,
        result: "complement",
        type: WORD,
        integer: Object.freeze({ width: 16 as const, signed: false, wrap: true }),
        operator: "~",
        operand: "left",
        span: sourceSpan(222),
      }),
      Object.freeze({
        kind: "unary" as const,
        result: "negated",
        type: WORD,
        integer: Object.freeze({ width: 16 as const, signed: false, wrap: true }),
        operator: "-",
        operand: "right",
        span: sourceSpan(223),
      }),
      Object.freeze({
        kind: "unary" as const,
        result: "zero",
        type: BOOLEAN,
        integer: null,
        operator: "!",
        operand: "left",
        span: sourceSpan(224),
      }),
      Object.freeze({
        kind: "binary" as const,
        result: "masked",
        type: WORD,
        integer: Object.freeze({ width: 16 as const, signed: false, wrap: true }),
        operator: "&",
        left: "complement",
        right: "right",
        span: sourceSpan(225),
      }),
      Object.freeze({
        kind: "constant" as const,
        result: "scale",
        type: WORD,
        integer: Object.freeze({ width: 16 as const, signed: false, wrap: true }),
        value: 5n,
        span: sourceSpan(226),
      }),
      Object.freeze({
        kind: "binary" as const,
        result: "scaled",
        type: WORD,
        integer: Object.freeze({ width: 16 as const, signed: false, wrap: true }),
        operator: "*",
        left: "masked",
        right: "scale",
        span: sourceSpan(227),
      }),
      Object.freeze({
        kind: "unary" as const,
        result: "high",
        type: BYTE,
        integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
        operator: "hi",
        operand: "scaled",
        span: sourceSpan(228),
      }),
    ];
    const main = semanticFunction(
      190,
      "display-name-does-not-select-the-link-label",
      [left, right],
      BYTE,
      [
        semanticBlock(
          "value.entry",
          operations,
          Object.freeze({ kind: "return" as const, value: "high" }),
        ),
      ],
    );
    const result = lowerFunctions([main]);

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected direct value lowering");
    const instructions = result.program.functions[0]!.blocks.flatMap(
      ({ instructions }) => instructions,
    );
    const opcodes = instructions.map(({ opcode }) => opcode);
    expect(opcodes.filter((opcode) => opcode === "eor").length).toBeGreaterThanOrEqual(5);
    expect(opcodes.filter((opcode) => opcode === "and")).toHaveLength(2);
    expect(opcodes).toContain("asl");
    expect(opcodes).toContain("rol");
    expect(opcodes).toContain("adc");
    expect(opcodes).not.toContain("jsr");
    expect(result.program.requiredStorage.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("unary:complement"),
        expect.stringContaining("unary:negated"),
        expect.stringContaining("bitwise:masked"),
        expect.stringContaining("scale-candidate:scaled"),
        expect.stringContaining("scale-result:scaled"),
      ]),
    );
  });

  it("should copy complete aggregate and merge values on their incoming edges", () => {
    const left = sourceParameter(300, BYTE);
    const right = sourceParameter(310, BYTE);
    const destination = sourceBinding(320);
    const main = semanticFunction(290, "aggregate-merge", [left, right], VOID, [
      semanticBlock(
        "choice.entry",
        [
          loadOperation("left", left, 330),
          loadOperation("right", right, 331),
          Object.freeze({
            kind: "binary" as const,
            result: "less",
            type: BOOLEAN,
            integer: null,
            operator: "<",
            left: "left",
            right: "right",
            span: sourceSpan(332),
          }),
        ],
        Object.freeze({
          kind: "branch" as const,
          condition: "less",
          whenTrue: "choice.true",
          whenFalse: "choice.false",
        }),
      ),
      semanticBlock(
        "choice.true",
        [
          Object.freeze({
            kind: "aggregate" as const,
            result: "true-pair",
            type: BYTE_PAIR,
            integer: null,
            elements: Object.freeze([
              Object.freeze({ field: null, value: "left" }),
              Object.freeze({ field: null, value: "right" }),
            ]),
            fill: null,
            span: sourceSpan(333),
          }),
        ],
        Object.freeze({ kind: "jump" as const, target: "choice.merge" }),
      ),
      semanticBlock(
        "choice.false",
        [
          Object.freeze({
            kind: "aggregate" as const,
            result: "false-pair",
            type: BYTE_PAIR,
            integer: null,
            elements: Object.freeze([
              Object.freeze({ field: null, value: "right" }),
              Object.freeze({ field: null, value: "left" }),
            ]),
            fill: null,
            span: sourceSpan(334),
          }),
        ],
        Object.freeze({ kind: "jump" as const, target: "choice.merge" }),
      ),
      semanticBlock(
        "choice.merge",
        [
          Object.freeze({
            kind: "merge" as const,
            result: "selected-pair",
            type: BYTE_PAIR,
            integer: null,
            incoming: Object.freeze([
              Object.freeze({ block: "choice.true", value: "true-pair" }),
              Object.freeze({ block: "choice.false", value: "false-pair" }),
            ]),
            span: sourceSpan(335),
          }),
          Object.freeze({
            kind: "store" as const,
            place: Object.freeze({ root: destination, path: Object.freeze([]) }),
            value: "selected-pair",
            type: BYTE_PAIR,
            span: sourceSpan(336),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const result = lowerFunctions([main]);

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected aggregate merge lowering");
    const fn = result.program.functions[0]!;
    const mergeRequest = result.program.requiredStorage.find(({ id }) =>
      id.includes("merge:selected-pair"),
    );
    expect(mergeRequest).toEqual(expect.objectContaining({ bytes: 2, storageClass: "temporary" }));
    for (const label of ["choice.true", "choice.false"]) {
      const predecessor = fn.blocks.find((blockValue) => blockValue.label === label)!;
      expect(predecessor.terminator).toEqual(
        expect.objectContaining({ kind: "jump", target: "choice.merge" }),
      );
      expect(
        predecessor.instructions.filter(
          ({ opcode, operand }) =>
            opcode === "sta" &&
            operand?.kind === "storage" &&
            operand.requestId === mergeRequest?.id,
        ),
      ).toHaveLength(2);
    }
    const mergeBlock = fn.blocks.find(({ label }) => label === "choice.merge")!;
    expect(mergeBlock.instructions.filter(({ opcode }) => opcode === "lda")).toHaveLength(2);
    expect(mergeBlock.instructions.filter(({ opcode }) => opcode === "sta")).toHaveLength(2);
  });

  it("should target the callee machine identity rather than its display name", () => {
    const callee = semanticFunction(420, "human-readable-callee", [], VOID, [
      semanticBlock("callee.entry", [], Object.freeze({ kind: "return" as const, value: null })),
    ]);
    const main = semanticFunction(410, "main-display-name", [], VOID, [
      semanticBlock(
        "call.entry",
        [
          Object.freeze({
            kind: "call" as const,
            result: null,
            callee: callee.id,
            arguments: Object.freeze([]),
            type: VOID,
            span: sourceSpan(430),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const result = lowerFunctions([main, callee]);

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected call lowering");
    const calleeMachine = result.program.functions[1]!;
    const call = result.program.functions[0]!.blocks[0]!.instructions[0]!;
    expect(call).toEqual(
      expect.objectContaining({
        opcode: "jsr",
        operand: { kind: "label", label: calleeMachine.id },
      }),
    );
    expect(calleeMachine.id).not.toContain(callee.name!);
  });
});

describe("packed aggregate addressing", () => {
  it("should fold a constant ordinal into the packed byte offset", () => {
    const words: SemanticType = Object.freeze({
      kind: "array",
      element: WORD,
      length: 4,
      size: 8,
    });
    const root = sourceBinding(670);
    const main = semanticFunction(650, "constant-index", [], VOID, [
      semanticBlock(
        "constant-index.entry",
        [
          Object.freeze({
            kind: "constant" as const,
            result: "index",
            type: BYTE,
            integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
            value: 2n,
            span: sourceSpan(671),
          }),
          Object.freeze({
            kind: "load" as const,
            result: "selected",
            place: Object.freeze({
              root,
              rootType: words,
              path: Object.freeze([Object.freeze({ kind: "index" as const, value: "index" })]),
            }),
            type: WORD,
            integer: Object.freeze({ width: 16 as const, signed: false, wrap: true }),
            span: sourceSpan(672),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const result = lowerFunctions([main]);

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected constant packed offset");
    const instructions = result.program.functions[0]!.blocks[0]!.instructions;
    expect(instructions.some(({ opcode }) => opcode === "asl" || opcode === "rol")).toBe(false);
    expect(
      instructions.some(
        ({ opcode, mode, operand }) =>
          opcode === "adc" &&
          mode === "immediate" &&
          operand?.kind === "immediate" &&
          operand.value === 4,
      ),
    ).toBe(true);
    expect(
      result.program.requiredStorage.some(({ id }) => id.includes("aggregate-index-candidate")),
    ).toBe(false);
  });

  it("should allocate and scale byte[4] and word[4] locals by their declared root types", () => {
    const byteArray: SemanticType = Object.freeze({
      kind: "array",
      element: BYTE,
      length: 4,
      size: 4,
    });
    const wordArray: SemanticType = Object.freeze({
      kind: "array",
      element: WORD,
      length: 4,
      size: 8,
    });
    const index = sourceParameter(700, BYTE);
    const byteRoot = sourceBinding(710);
    const wordRoot = sourceBinding(720);
    const indexedPlace = (root: BindingId, rootType: SemanticType) =>
      Object.freeze({
        root,
        rootType,
        path: Object.freeze([Object.freeze({ kind: "index" as const, value: "index" })]),
      });
    const operations: readonly SemanticOperation[] = [
      loadOperation("index", index, 730),
      Object.freeze({
        kind: "constant" as const,
        result: "byte-value",
        type: BYTE,
        integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
        value: 0x12n,
        span: sourceSpan(731),
      }),
      Object.freeze({
        kind: "store" as const,
        place: indexedPlace(byteRoot, byteArray),
        value: "byte-value",
        type: BYTE,
        span: sourceSpan(732),
      }),
      Object.freeze({
        kind: "constant" as const,
        result: "word-value",
        type: WORD,
        integer: Object.freeze({ width: 16 as const, signed: false, wrap: true }),
        value: 0x3456n,
        span: sourceSpan(733),
      }),
      Object.freeze({
        kind: "store" as const,
        place: indexedPlace(wordRoot, wordArray),
        value: "word-value",
        type: WORD,
        span: sourceSpan(734),
      }),
      Object.freeze({
        kind: "load" as const,
        result: "byte-result",
        place: indexedPlace(byteRoot, byteArray),
        type: BYTE,
        integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
        span: sourceSpan(735),
      }),
      Object.freeze({
        kind: "load" as const,
        result: "word-result",
        place: indexedPlace(wordRoot, wordArray),
        type: WORD,
        integer: Object.freeze({ width: 16 as const, signed: false, wrap: true }),
        span: sourceSpan(736),
      }),
    ];
    const main = semanticFunction(690, "array-strides", [index], VOID, [
      semanticBlock(
        "arrays.entry",
        operations,
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const program = wholeProgramFor([main]);
    const inventory = inventoryStorage(program);
    expect(
      inventory.requests
        .filter(({ storageClass }) => storageClass === "local")
        .map(({ binding, bytes }) => ({ start: binding?.span.start, bytes })),
    ).toEqual([
      { start: byteRoot.span.start, bytes: 4 },
      { start: wordRoot.span.start, bytes: 8 },
    ]);

    const result = lowerFunctions([main]);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected packed array lowering");
    const instructions = result.program.functions[0]!.blocks[0]!.instructions;
    expect(instructions.filter(({ opcode }) => opcode === "asl")).toHaveLength(2);
    expect(instructions.filter(({ opcode }) => opcode === "rol")).toHaveLength(2);
    const addressedRoots = instructions.flatMap(({ mode, operand }) =>
      mode === "immediate" && operand?.kind === "storage" && operand.addressByte === "low"
        ? [operand.requestId]
        : [],
    );
    expect(addressedRoots.filter((id) => id.includes(`:${byteRoot.span.start}:`))).toHaveLength(2);
    expect(addressedRoots.filter((id) => id.includes(`:${wordRoot.span.start}:`))).toHaveLength(2);
    expect(
      instructions.filter(
        ({ opcode, mode }) =>
          (opcode === "lda" || opcode === "sta") && mode === "indirect-indexed-y",
      ),
    ).toHaveLength(6);
  });

  it("should combine nested array strides with a packed struct field offset", () => {
    const rows: SemanticType = Object.freeze({
      kind: "array",
      element: WORD,
      length: 3,
      size: 6,
    });
    const record: SemanticType = Object.freeze({
      kind: "struct",
      binding: sourceBinding(800),
      size: 8,
      fields: Object.freeze([
        Object.freeze({ name: "tag", type: BYTE, offset: 0 }),
        Object.freeze({ name: "rows", type: rows, offset: 1 }),
        Object.freeze({ name: "tail", type: BYTE, offset: 7 }),
      ]),
    });
    const records: SemanticType = Object.freeze({
      kind: "array",
      element: record,
      length: 2,
      size: 16,
    });
    const outer = sourceParameter(810, BYTE);
    const inner = sourceParameter(820, BYTE);
    const root = sourceBinding(830);
    const main = semanticFunction(790, "nested-offsets", [outer, inner], VOID, [
      semanticBlock(
        "nested.entry",
        [
          loadOperation("outer", outer, 840),
          loadOperation("inner", inner, 841),
          Object.freeze({
            kind: "constant" as const,
            result: "value",
            type: WORD,
            integer: Object.freeze({ width: 16 as const, signed: false, wrap: true }),
            value: 0xbeefn,
            span: sourceSpan(842),
          }),
          Object.freeze({
            kind: "store" as const,
            place: Object.freeze({
              root,
              rootType: records,
              path: Object.freeze([
                Object.freeze({ kind: "index" as const, value: "outer" }),
                Object.freeze({ kind: "field" as const, name: "rows" }),
                Object.freeze({ kind: "index" as const, value: "inner" }),
              ]),
            }),
            value: "value",
            type: WORD,
            span: sourceSpan(843),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const inventory = inventoryStorage(wholeProgramFor([main]));
    expect(
      inventory.requests.find(({ binding }) => binding?.span.start === root.span.start)?.bytes,
    ).toBe(16);
    const result = lowerFunctions([main]);

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected nested packed addressing");
    const instructions = result.program.functions[0]!.blocks[0]!.instructions;
    expect(instructions.filter(({ opcode }) => opcode === "asl")).toHaveLength(4);
    expect(instructions.filter(({ opcode }) => opcode === "rol")).toHaveLength(4);
    expect(
      instructions.some(
        ({ opcode, mode, operand }) =>
          opcode === "adc" &&
          mode === "immediate" &&
          operand?.kind === "immediate" &&
          operand.value === 1,
      ),
    ).toBe(true);
    expect(
      instructions.filter(({ opcode, mode }) => opcode === "sta" && mode === "indirect-indexed-y"),
    ).toHaveLength(2);
  });
});
