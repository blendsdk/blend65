import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import { inventoryStorage } from "../storage/inventory.js";
import { closeStorage } from "../storage/closure.js";
import { bindMachineProgram } from "./bind.js";
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
  selectedProfile,
  wholeProgramFor,
} from "./lowering-test-support.js";

describe("direct value lowering", () => {
  it("should reload a retained boolean after later instructions clobber its flags", () => {
    const condition = sourceParameter(150, BOOLEAN);
    const clobber = sourceParameter(160, BYTE);
    const main = semanticFunction(140, "retained-branch", [condition, clobber], VOID, [
      semanticBlock(
        "branch.entry",
        [loadOperation("condition", condition, 170), loadOperation("clobber", clobber, 171)],
        Object.freeze({
          kind: "branch" as const,
          condition: "condition",
          whenTrue: "branch.true",
          whenFalse: "branch.false",
        }),
      ),
      semanticBlock("branch.true", [], Object.freeze({ kind: "return" as const, value: null })),
      semanticBlock("branch.false", [], Object.freeze({ kind: "return" as const, value: null })),
    ]);
    const result = lowerFunctions([main]);

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected retained branch lowering");
    const entry = result.program.functions[0]!.blocks[0]!;
    expect(entry.terminator).toEqual(expect.objectContaining({ kind: "branch", opcode: "bne" }));
    expect(entry.instructions.at(-1)).toEqual(
      expect.objectContaining({
        opcode: "lda",
        operand: entry.instructions[0]!.operand,
      }),
    );
  });

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
    expect(result.diagnostics.map(({ code }) => code)).toContain("W10172");
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

  it("should report helper selection and uncertain division without inventing a guard", () => {
    const left = sourceParameter(240, BYTE);
    const right = sourceParameter(250, BYTE);
    const operations: readonly SemanticOperation[] = [
      loadOperation("left", left, 260),
      loadOperation("right", right, 261),
      Object.freeze({
        kind: "binary" as const,
        result: "product",
        type: BYTE,
        integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
        operator: "*",
        left: "left",
        right: "right",
        span: sourceSpan(262),
      }),
      Object.freeze({
        kind: "binary" as const,
        result: "quotient",
        type: BYTE,
        integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
        operator: "/",
        left: "product",
        right: "right",
        span: sourceSpan(263),
      }),
    ];
    const main = semanticFunction(230, "runtime-arithmetic", [left, right], BYTE, [
      semanticBlock(
        "arithmetic.entry",
        operations,
        Object.freeze({ kind: "return" as const, value: "quotient" }),
      ),
    ]);
    const result = lowerFunctions([main]);

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected runtime arithmetic lowering");
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["W10170", "W10171", "W10173"]);
    const byteScratch = result.program.requiredStorage.filter(({ id }) =>
      id.includes("multiply:1:"),
    );
    expect(byteScratch.map(({ id }) => id.split("multiply:1:")[1])).toEqual(["left", "right"]);
    expect(byteScratch.every(({ region }) => region === "zero-page-preferred")).toBe(true);
    const semantic = wholeProgramFor([main]);
    const closure = closeStorage(
      inventoryStorage(semantic),
      selectedProfile().storage,
      result.binder,
    );
    expect(closure.kind).toBe("complete");
    if (closure.kind !== "complete") throw new Error("Expected closed helper scratch");
    expect(
      closure.certificate.homes
        .filter(({ requestId }) => requestId.includes("multiply:1:"))
        .map(({ region }) => region),
    ).toEqual(["zero-page", "zero-page"]);
    const bound = bindMachineProgram(result.program, closure.certificate);
    expect(bound.kind).toBe("complete");
    if (bound.kind !== "complete") throw new Error("Expected bound arithmetic helpers");
    const multiplyBlocks = bound.program.functions[0]!.blocks.filter(({ label }) =>
      label.includes(".multiply.1"),
    );
    const helperBytes = multiplyBlocks.reduce(
      (bytes, block) =>
        bytes +
        block.instructions.reduce((sum, instruction) => sum + instruction.cost.bytes, 0) +
        ("cost" in block.terminator ? block.terminator.cost.bytes : 0),
      0,
    );
    expect(helperBytes).toBe(20);
    expect(result.program.functions[0]!.blocks.flatMap(({ instructions }) => instructions)).toEqual(
      expect.arrayContaining([expect.objectContaining({ opcode: "jsr" })]),
    );
  });

  it("does not reuse a quotient after an operand is written", () => {
    const left = sourceParameter(500, BYTE);
    const right = sourceParameter(510, BYTE);
    const integer = Object.freeze({ width: 8 as const, signed: false, wrap: true });
    const main = semanticFunction(490, "changed-dividend", [left, right], BYTE, [
      semanticBlock(
        "changed.entry",
        [
          loadOperation("first-left", left, 520),
          loadOperation("first-right", right, 521),
          Object.freeze({
            kind: "binary" as const,
            result: "quotient",
            type: BYTE,
            integer,
            operator: "/",
            left: "first-left",
            right: "first-right",
            span: sourceSpan(522),
          }),
          Object.freeze({
            kind: "store" as const,
            place: Object.freeze({ root: left.id, path: Object.freeze([]) }),
            value: "quotient",
            type: BYTE,
            span: sourceSpan(523),
          }),
          loadOperation("second-left", left, 524),
          loadOperation("second-right", right, 525),
          Object.freeze({
            kind: "binary" as const,
            result: "remainder",
            type: BYTE,
            integer,
            operator: "%",
            left: "second-left",
            right: "second-right",
            span: sourceSpan(526),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: "remainder" }),
      ),
    ]);
    const lowered = lowerFunctions([main]);
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") throw new Error("Expected divide lowering");
    expect(
      lowered.program.functions[0]!.blocks.flatMap(({ instructions }) => instructions).filter(
        ({ opcode }) => opcode === "jsr",
      ),
    ).toHaveLength(2);
    const stable = semanticFunction(490, "stable-dividend", [left, right], BYTE, [
      semanticBlock(
        "changed.entry",
        main.blocks[0]!.operations.filter((operation) => operation.kind !== "store"),
        Object.freeze({ kind: "return" as const, value: "remainder" }),
      ),
    ]);
    const reused = lowerFunctions([stable]);
    expect(reused.kind).toBe("complete");
    if (reused.kind !== "complete") throw new Error("Expected reused divide lowering");
    expect(
      reused.program.functions[0]!.blocks.flatMap(({ instructions }) => instructions).filter(
        ({ opcode }) => opcode === "jsr",
      ),
    ).toHaveLength(1);
    expect(reused.diagnostics.filter(({ code }) => code === "W10173")).toHaveLength(2);
  });

  it("keeps separate byte multiply bodies when a caller can overlap its callee", () => {
    const outerLeft = sourceParameter(550, BYTE);
    const outerRight = sourceParameter(560, BYTE);
    const innerLeft = sourceParameter(570, BYTE);
    const innerRight = sourceParameter(580, BYTE);
    const integer = Object.freeze({ width: 8 as const, signed: false, wrap: true });
    const product = (left: string, right: string, result: string, at: number) =>
      Object.freeze({
        kind: "binary" as const,
        result,
        type: BYTE,
        integer,
        operator: "*",
        left,
        right,
        span: sourceSpan(at),
      });
    const inner = semanticFunction(540, "inner-product", [innerLeft, innerRight], VOID, [
      semanticBlock(
        "inner.entry",
        [
          loadOperation("inner-left", innerLeft, 590),
          loadOperation("inner-right", innerRight, 591),
          product("inner-left", "inner-right", "inner-product", 592),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const outer = semanticFunction(530, "outer-product", [outerLeft, outerRight], VOID, [
      semanticBlock(
        "outer.entry",
        [
          loadOperation("outer-left", outerLeft, 600),
          loadOperation("outer-right", outerRight, 601),
          product("outer-left", "outer-right", "outer-product", 602),
          Object.freeze({
            kind: "call" as const,
            result: null,
            callee: inner.id,
            arguments: Object.freeze(["outer-left", "outer-right"]),
            type: VOID,
            span: sourceSpan(603),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const semantic = wholeProgramFor([outer, inner]);
    const lowered = lowerFunctions([outer, inner]);
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") throw new Error("Expected two multiply helpers");
    const closure = closeStorage(
      inventoryStorage(semantic),
      selectedProfile().storage,
      lowered.binder,
    );
    expect(closure.kind).toBe("complete");
    if (closure.kind !== "complete") throw new Error("Expected closed nested-call scratch");
    const bound = bindMachineProgram(lowered.program, closure.certificate);
    expect(bound.kind).toBe("complete");
    if (bound.kind !== "complete") throw new Error("Expected bound nested-call helpers");
    expect(
      bound.program.functions
        .flatMap((fn) => fn.blocks)
        .filter(({ label }) => label.endsWith(".multiply.1")),
    ).toHaveLength(2);
  });

  it("should saturate a word-count shift before entering its bounded loop", () => {
    const value = sourceParameter(270, WORD);
    const count = sourceParameter(280, WORD);
    const main = semanticFunction(265, "variable-word-shift", [value, count], WORD, [
      semanticBlock(
        "shift.entry",
        [
          loadOperation("value", value, 290),
          loadOperation("count", count, 291),
          Object.freeze({
            kind: "binary" as const,
            result: "shifted",
            type: WORD,
            integer: Object.freeze({ width: 16 as const, signed: false, wrap: true }),
            operator: ">>",
            left: "value",
            right: "count",
            span: sourceSpan(292),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: "shifted" }),
      ),
    ]);
    const result = lowerFunctions([main]);

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected variable shift lowering");
    const blocks = result.program.functions[0]!.blocks;
    expect(blocks[0]!.terminator).toMatchObject({
      kind: "branch",
      opcode: "bne",
      target: expect.stringContaining(".saturated"),
    });
    expect(blocks.find(({ label }) => label.includes(".shift.0.loop"))).toMatchObject({
      instructions: expect.arrayContaining([expect.objectContaining({ opcode: "dex" })]),
      terminator: { kind: "branch", opcode: "bne" },
    });
  });

  it("should bind byte times three to the expert six-byte, ten-cycle local core", () => {
    const value = sourceParameter(410, BYTE);
    const main = semanticFunction(400, "times-three", [value], BYTE, [
      semanticBlock(
        "scale.entry",
        [
          loadOperation("value", value, 420),
          Object.freeze({
            kind: "constant" as const,
            result: "three",
            type: BYTE,
            integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
            value: 3n,
            span: sourceSpan(421),
          }),
          Object.freeze({
            kind: "binary" as const,
            result: "product",
            type: BYTE,
            integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
            operator: "*",
            left: "value",
            right: "three",
            span: sourceSpan(422),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: "product" }),
      ),
    ]);
    const semantic = wholeProgramFor([main]);
    const lowered = lowerFunctions([main]);
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") throw new Error("Expected constant multiply lowering");
    const closure = closeStorage(
      inventoryStorage(semantic),
      selectedProfile().storage,
      lowered.binder,
    );
    expect(closure.kind).toBe("complete");
    if (closure.kind !== "complete") throw new Error("Expected constant multiply scratch closure");
    const bound = bindMachineProgram(lowered.program, closure.certificate);
    expect(bound.kind).toBe("complete");
    if (bound.kind !== "complete") throw new Error("Expected bound constant multiply");
    const instructions = bound.program.functions[0]!.blocks.flatMap(
      ({ instructions }) => instructions,
    );
    const first = instructions.findIndex(
      (instruction, index) =>
        instruction.opcode === "sta" &&
        instructions[index + 1]?.opcode === "asl" &&
        instructions[index + 2]?.opcode === "clc" &&
        instructions[index + 3]?.opcode === "adc",
    );
    expect(first).toBeGreaterThanOrEqual(0);
    const core = instructions.slice(first, first + 4);
    expect(core.map(({ opcode }) => opcode)).toEqual(["sta", "asl", "clc", "adc"]);
    expect(core.reduce((bytes, instruction) => bytes + instruction.cost.bytes, 0)).toBe(6);
    expect(core.reduce((cycles, instruction) => cycles + instruction.cost.maxCycles, 0)).toBe(10);
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
  it("emits a single four-byte safety stop only when bounds checking is selected", () => {
    const array: SemanticType = Object.freeze({ kind: "array", element: BYTE, length: 4, size: 4 });
    const root = sourceBinding(910);
    const ordinal = sourceParameter(911, BYTE);
    const block = "checked-array.entry";
    const main = semanticFunction(909, "checked-array", [ordinal], VOID, [
      semanticBlock(
        block,
        [
          loadOperation("index", ordinal, 912),
          Object.freeze({
            kind: "load" as const,
            result: "selected",
            place: Object.freeze({
              root,
              rootType: array,
              path: Object.freeze([Object.freeze({ kind: "index" as const, value: "index" })]),
            }),
            type: BYTE,
            span: sourceSpan(913),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const lifetimes = Object.freeze([
      Object.freeze({
        function: main.id,
        value: "index",
        definition: Object.freeze({ block, operation: 0 }),
        liveAt: Object.freeze([Object.freeze({ block, operation: 1 })]),
        callsCrossed: Object.freeze([]),
      }),
    ]);
    const checked = lowerFunctions([main], lifetimes, true);
    const unchecked = lowerFunctions([main], lifetimes);
    expect(checked.kind).toBe("complete");
    expect(unchecked.kind).toBe("complete");
    if (checked.kind !== "complete" || unchecked.kind !== "complete") {
      throw new Error("Expected both machine lowerings");
    }
    const checkedBlocks = checked.program.functions[0]!.blocks;
    const stop = checkedBlocks.find(({ label }) => label.endsWith(".bounds.stop"));
    expect(stop?.instructions.map(({ opcode }) => opcode)).toEqual(["sei"]);
    expect(stop?.terminator).toMatchObject({ kind: "jump", target: stop.label });
    expect(
      checkedBlocks.some(
        ({ terminator }) =>
          terminator.kind === "branch" &&
          terminator.opcode === "bcs" &&
          terminator.target === stop?.label,
      ),
    ).toBe(true);
    expect(
      unchecked.program.functions[0]!.blocks.some(({ label }) => label.endsWith(".bounds.stop")),
    ).toBe(false);
  });

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
          opcode === "lda" &&
          mode === "storage" &&
          operand?.kind === "storage" &&
          operand.offset === 4,
      ),
    ).toBe(true);
    expect(
      instructions.some(
        ({ opcode, mode, operand }) =>
          opcode === "lda" &&
          mode === "storage" &&
          operand?.kind === "storage" &&
          operand.offset === 5,
      ),
    ).toBe(true);
    expect(result.program.requiredStorage.some(({ id }) => id.includes("aggregate-address"))).toBe(
      false,
    );
    expect(
      result.program.requiredStorage.some(({ id }) => id.includes("aggregate-index-candidate")),
    ).toBe(false);
  });

  it("should index byte locals directly while scaling word locals by their element size", () => {
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
    expect(instructions.filter(({ opcode }) => opcode === "asl")).toHaveLength(1);
    expect(instructions.filter(({ opcode }) => opcode === "rol")).toHaveLength(1);
    const addressedRoots = instructions.flatMap(({ mode, operand }) =>
      mode === "immediate" && operand?.kind === "storage" && operand.addressByte === "low"
        ? [operand.requestId]
        : [],
    );
    expect(addressedRoots.filter((id) => id.includes(`:${byteRoot.span.start}:`))).toHaveLength(0);
    expect(addressedRoots.filter((id) => id.includes(`:${wordRoot.span.start}:`))).toHaveLength(1);
    expect(
      instructions.filter(
        ({ opcode, mode }) => (opcode === "lda" || opcode === "sta") && mode === "absolute-y",
      ),
    ).toHaveLength(2);
    expect(
      instructions.filter(
        ({ opcode, mode }) =>
          (opcode === "lda" || opcode === "sta") && mode === "indirect-indexed-y",
      ),
    ).toHaveLength(4);
  });

  it("should directly scale an unsigned byte index for a five-byte packed record", () => {
    const record: SemanticType = Object.freeze({
      kind: "struct",
      binding: sourceBinding(750),
      size: 5,
      fields: Object.freeze([
        Object.freeze({ name: "x", type: WORD, offset: 0 }),
        Object.freeze({ name: "y", type: BYTE, offset: 2 }),
        Object.freeze({ name: "alive", type: BOOLEAN, offset: 3 }),
        Object.freeze({ name: "design", type: BYTE, offset: 4 }),
      ]),
    });
    const records: SemanticType = Object.freeze({
      kind: "array",
      element: record,
      length: 6,
      size: 30,
    });
    const index = sourceParameter(751, BYTE);
    const root = sourceBinding(752);
    const main = semanticFunction(749, "record-stride", [index], VOID, [
      semanticBlock(
        "record-stride.entry",
        [
          loadOperation("index", index, 753),
          Object.freeze({
            kind: "load" as const,
            result: "alive",
            place: Object.freeze({
              root,
              rootType: records,
              path: Object.freeze([
                Object.freeze({ kind: "index" as const, value: "index" }),
                Object.freeze({ kind: "field" as const, name: "alive" }),
              ]),
            }),
            type: BOOLEAN,
            span: sourceSpan(754),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const result = lowerFunctions([main]);

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected packed record lowering");
    const instructions = result.program.functions[0]!.blocks[0]!.instructions;
    expect(instructions.filter(({ opcode }) => opcode === "asl")).toHaveLength(2);
    expect(instructions.filter(({ opcode }) => opcode === "rol")).toHaveLength(2);
    expect(
      instructions.some(
        ({ opcode, mode, operand }) =>
          opcode === "lda" &&
          mode === "immediate" &&
          operand?.kind === "storage" &&
          operand.addressByte === "low" &&
          operand.offset === 0,
      ),
    ).toBe(true);
    expect(
      instructions.some(
        ({ opcode, mode, operand }) =>
          opcode === "ldy" &&
          mode === "immediate" &&
          operand?.kind === "immediate" &&
          operand.value === 3,
      ),
    ).toBe(true);
    expect(
      result.program.requiredStorage.some(({ id }) => id.includes("aggregate-index-result")),
    ).toBe(false);
  });

  it("should reuse an unchanged packed-record base and recompute it after the index changes", () => {
    const record: SemanticType = Object.freeze({
      kind: "struct",
      binding: sourceBinding(760),
      size: 5,
      fields: Object.freeze([
        Object.freeze({ name: "x", type: WORD, offset: 0 }),
        Object.freeze({ name: "y", type: BYTE, offset: 2 }),
        Object.freeze({ name: "alive", type: BOOLEAN, offset: 3 }),
        Object.freeze({ name: "design", type: BYTE, offset: 4 }),
      ]),
    });
    const records: SemanticType = Object.freeze({
      kind: "array",
      element: record,
      length: 6,
      size: 30,
    });
    const index = sourceParameter(761, BYTE);
    const root = sourceBinding(762);
    const unrelated = sourceBinding(771);
    const fieldPlace = (indexValue: string, field: string) =>
      Object.freeze({
        root,
        rootType: records,
        path: Object.freeze([
          Object.freeze({ kind: "index" as const, value: indexValue }),
          Object.freeze({ kind: "field" as const, name: field }),
        ]),
      });
    const fieldLoad = (result: string, indexValue: string, field: string, start: number) =>
      Object.freeze({
        kind: "load" as const,
        result,
        place: fieldPlace(indexValue, field),
        type: BYTE,
        integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
        span: sourceSpan(start),
      });
    const main = semanticFunction(759, "record-address-reuse", [index], VOID, [
      semanticBlock(
        "record-address-reuse.entry",
        [
          loadOperation("first-index", index, 763),
          fieldLoad("alive", "first-index", "alive", 764),
          Object.freeze({
            kind: "constant" as const,
            result: "unrelated-value",
            type: BYTE,
            integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
            value: 9n,
            span: sourceSpan(765),
          }),
          Object.freeze({
            kind: "store" as const,
            place: Object.freeze({ root: unrelated, path: Object.freeze([]) }),
            value: "unrelated-value",
            type: BYTE,
            span: sourceSpan(766),
          }),
          loadOperation("same-index", index, 767),
          fieldLoad("design", "same-index", "design", 768),
          Object.freeze({
            kind: "constant" as const,
            result: "new-y",
            type: BYTE,
            integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
            value: 80n,
            span: sourceSpan(769),
          }),
          Object.freeze({
            kind: "store" as const,
            place: fieldPlace("same-index", "y"),
            value: "new-y",
            type: BYTE,
            span: sourceSpan(770),
          }),
          Object.freeze({
            kind: "constant" as const,
            result: "next-index",
            type: BYTE,
            integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
            value: 1n,
            span: sourceSpan(772),
          }),
          Object.freeze({
            kind: "store" as const,
            place: Object.freeze({ root: index.id, path: Object.freeze([]) }),
            value: "next-index",
            type: BYTE,
            span: sourceSpan(773),
          }),
          loadOperation("changed-index", index, 774),
          fieldLoad("y", "changed-index", "y", 775),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const result = lowerFunctions([main]);

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected reusable packed record address");
    const instructions = result.program.functions[0]!.blocks[0]!.instructions;
    expect(instructions.filter(({ opcode }) => opcode === "asl")).toHaveLength(4);
    expect(instructions.filter(({ opcode }) => opcode === "rol")).toHaveLength(4);
    expect(
      instructions.filter(
        ({ opcode, mode, operand }) =>
          opcode === "lda" &&
          mode === "immediate" &&
          operand?.kind === "storage" &&
          operand.requestId.includes(`:${root.span.start}:`) &&
          operand.addressByte === "low",
      ),
    ).toHaveLength(2);
    expect(
      instructions.flatMap(({ opcode, mode, operand }) =>
        opcode === "ldy" && mode === "immediate" && operand?.kind === "immediate"
          ? [operand.value]
          : [],
      ),
    ).toEqual([3, 4, 2, 2]);
  });

  it("should carry one packed-record base over forward edges and an identical-fact join", () => {
    const record: SemanticType = Object.freeze({
      kind: "struct",
      binding: sourceBinding(780),
      size: 5,
      fields: Object.freeze([
        Object.freeze({ name: "x", type: WORD, offset: 0 }),
        Object.freeze({ name: "alive", type: BOOLEAN, offset: 3 }),
      ]),
    });
    const records: SemanticType = Object.freeze({
      kind: "array",
      element: record,
      length: 6,
      size: 30,
    });
    const index = sourceParameter(781, BYTE);
    const root = sourceBinding(782);
    const fieldLoad = (
      result: string,
      indexValue: string,
      field: string,
      type: SemanticType,
      start: number,
    ) =>
      Object.freeze({
        kind: "load" as const,
        result,
        place: Object.freeze({
          root,
          rootType: records,
          path: Object.freeze([
            Object.freeze({ kind: "index" as const, value: indexValue }),
            Object.freeze({ kind: "field" as const, name: field }),
          ]),
        }),
        type,
        integer: null,
        span: sourceSpan(start),
      });
    const main = semanticFunction(779, "forward-address-fact", [index], VOID, [
      semanticBlock(
        "forward.entry",
        [
          loadOperation("entry-index", index, 783),
          fieldLoad("alive", "entry-index", "alive", BOOLEAN, 784),
        ],
        Object.freeze({
          kind: "branch" as const,
          condition: "alive",
          whenTrue: "forward.true",
          whenFalse: "forward.false",
        }),
      ),
      semanticBlock(
        "forward.true",
        [loadOperation("true-index", index, 785), fieldLoad("x", "true-index", "x", WORD, 786)],
        Object.freeze({ kind: "jump" as const, target: "forward.join" }),
      ),
      semanticBlock(
        "forward.false",
        [],
        Object.freeze({ kind: "jump" as const, target: "forward.join" }),
      ),
      semanticBlock(
        "forward.join",
        [
          loadOperation("join-index", index, 787),
          fieldLoad("joined-x", "join-index", "x", WORD, 788),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const result = lowerFunctions([main]);

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected forward aggregate address fact");
    const blocks = result.program.functions[0]!.blocks;
    const entryAndTrue = blocks
      .filter(({ label }) => label === "forward.entry" || label === "forward.true")
      .flatMap(({ instructions }) => instructions);
    const join = blocks.find(({ label }) => label === "forward.join");
    expect(entryAndTrue.filter(({ opcode }) => opcode === "asl")).toHaveLength(2);
    expect(entryAndTrue.filter(({ opcode }) => opcode === "rol")).toHaveLength(2);
    expect(join?.instructions.filter(({ opcode }) => opcode === "asl")).toHaveLength(0);
    expect(join?.instructions.filter(({ opcode }) => opcode === "rol")).toHaveLength(0);

    const invalidated = semanticFunction(789, "invalidated-join-address-fact", [index], VOID, [
      semanticBlock(
        "invalidated.entry",
        [
          loadOperation("invalidated-entry-index", index, 790),
          fieldLoad("invalidated-alive", "invalidated-entry-index", "alive", BOOLEAN, 791),
        ],
        Object.freeze({
          kind: "branch" as const,
          condition: "invalidated-alive",
          whenTrue: "invalidated.true",
          whenFalse: "invalidated.false",
        }),
      ),
      semanticBlock(
        "invalidated.true",
        [],
        Object.freeze({ kind: "jump" as const, target: "invalidated.join" }),
      ),
      semanticBlock(
        "invalidated.false",
        [
          Object.freeze({
            kind: "constant" as const,
            result: "next-index",
            type: BYTE,
            integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
            value: 1n,
            span: sourceSpan(792),
          }),
          Object.freeze({
            kind: "store" as const,
            place: Object.freeze({ root: index.id, path: Object.freeze([]) }),
            value: "next-index",
            type: BYTE,
            span: sourceSpan(793),
          }),
        ],
        Object.freeze({ kind: "jump" as const, target: "invalidated.join" }),
      ),
      semanticBlock(
        "invalidated.join",
        [
          loadOperation("invalidated-join-index", index, 794),
          fieldLoad("invalidated-x", "invalidated-join-index", "x", WORD, 795),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const invalidatedResult = lowerFunctions([invalidated]);

    expect(invalidatedResult.kind).toBe("complete");
    if (invalidatedResult.kind !== "complete") {
      throw new Error("Expected invalidated aggregate address fact");
    }
    const invalidatedJoin = invalidatedResult.program.functions[0]!.blocks.find(
      ({ label }) => label === "invalidated.join",
    );
    expect(invalidatedJoin?.instructions.filter(({ opcode }) => opcode === "asl")).toHaveLength(2);
    expect(invalidatedJoin?.instructions.filter(({ opcode }) => opcode === "rol")).toHaveLength(2);

    const backedge = semanticFunction(796, "backedge-address-fact", [index], VOID, [
      semanticBlock(
        "backedge.entry",
        [
          loadOperation("backedge-entry-index", index, 797),
          fieldLoad("backedge-alive", "backedge-entry-index", "alive", BOOLEAN, 798),
        ],
        Object.freeze({ kind: "jump" as const, target: "backedge.header" }),
      ),
      semanticBlock(
        "backedge.header",
        [
          loadOperation("backedge-header-index", index, 799),
          fieldLoad("backedge-x", "backedge-header-index", "x", WORD, 800),
        ],
        Object.freeze({
          kind: "branch" as const,
          condition: "backedge-alive",
          whenTrue: "backedge.body",
          whenFalse: "backedge.exit",
        }),
      ),
      semanticBlock("backedge.exit", [], Object.freeze({ kind: "return" as const, value: null })),
      semanticBlock(
        "backedge.body",
        [],
        Object.freeze({ kind: "jump" as const, target: "backedge.header" }),
      ),
    ]);
    const backedgeResult = lowerFunctions([backedge]);

    expect(backedgeResult.kind).toBe("complete");
    if (backedgeResult.kind !== "complete") {
      throw new Error("Expected conservative backedge aggregate address fact");
    }
    const backedgeHeader = backedgeResult.program.functions[0]!.blocks.find(
      ({ label }) => label === "backedge.header",
    );
    expect(backedgeHeader?.instructions.filter(({ opcode }) => opcode === "asl")).toHaveLength(2);
    expect(backedgeHeader?.instructions.filter(({ opcode }) => opcode === "rol")).toHaveLength(2);
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
          opcode === "lda" &&
          mode === "immediate" &&
          operand?.kind === "storage" &&
          operand.addressByte === "low" &&
          operand.offset === 0,
      ),
    ).toBe(true);
    expect(
      instructions.flatMap(({ opcode, mode, operand }) =>
        opcode === "ldy" && mode === "immediate" && operand?.kind === "immediate"
          ? [operand.value]
          : [],
      ),
    ).toEqual([1, 2]);
    expect(
      instructions.filter(({ opcode, mode }) => opcode === "sta" && mode === "indirect-indexed-y"),
    ).toHaveLength(2);
  });
});
