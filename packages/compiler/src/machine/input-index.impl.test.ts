import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import { inventoryStorage } from "../storage/inventory.js";
import { closeStorage } from "../storage/closure.js";
import { bindMachineProgram } from "./bind.js";
import { typeBytes } from "./lower-state.js";
import {
  BYTE,
  VOID,
  WORD,
  loadOperation,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceParameter,
  sourceSpan,
  wholeProgramFor,
} from "./lowering-test-support.js";

/** Lower and close one borrowed selection, optionally sampling a fixed store value. */
function indexed(
  options: {
    mask?: bigint;
    columnType?: SemanticType;
    element?: SemanticType;
    bounds?: boolean;
    readAddress?: number;
  } = {},
) {
  const element = options.element ?? BYTE;
  const size = typeBytes(element) * 8;
  const array: SemanticType = { kind: "array", element, length: 8, size };
  const rows = sourceParameter(8010, array);
  const column = sourceParameter(8011, options.columnType ?? WORD);
  const span = sourceSpan(8020);
  const wordFacts = { type: WORD, integer: null, span };
  const operations: SemanticOperation[] = [loadOperation("column", column, 8021)];
  let ordinal = "column";
  if (options.columnType === undefined) {
    ordinal = "masked";
    operations.push(
      {
        kind: "constant",
        result: "mask",
        value: options.mask ?? 7n,
        ...wordFacts,
      },
      {
        kind: "binary",
        result: ordinal,
        operator: "&",
        left: "column",
        right: "mask",
        ...wordFacts,
      },
    );
  }
  const place = {
    root: rows.id,
    rootType: array,
    path: [{ kind: "index" as const, value: ordinal }],
  };
  if (options.readAddress !== undefined) {
    operations.push(
      {
        kind: "constant",
        result: "address",
        value: BigInt(options.readAddress),
        ...wordFacts,
      },
      {
        kind: "memory-read",
        result: "sample",
        address: "address",
        width: 1,
        byteOrder: "low-first",
        volatile: true,
        type: BYTE,
        integer: null,
        span: sourceSpan(8024),
      },
      { kind: "store", place, value: "sample", type: BYTE, span: sourceSpan(8025) },
    );
  } else {
    operations.push({
      kind: "load",
      result: "selected",
      place,
      type: element,
      integer: null,
      span: sourceSpan(8025),
    });
  }
  const value = options.readAddress === undefined ? "selected" : null;
  const fn = semanticFunction(8000, "indexed", [rows, column], value === null ? VOID : element, [
    semanticBlock("entry", operations, { kind: "return", value }),
  ]);
  const lifetimes = operations.flatMap((operation, index) =>
    "result" in operation && typeof operation.result === "string"
      ? [
          {
            function: fn.id,
            value: operation.result,
            definition: { block: "entry", operation: index },
            liveAt: [{ block: "entry", operation: operations.length }],
            callsCrossed: [],
          },
        ]
      : [],
  );
  const lowered = lowerFunctions([fn], lifetimes, options.bounds ?? false);
  if (lowered.kind !== "complete") throw new Error(lowered.reason);
  const closure = closeStorage(
    inventoryStorage(wholeProgramFor([fn], lifetimes)),
    selectedProfile().storage,
    lowered.binder,
  );
  if (closure.kind !== "complete") throw new Error("Expected closed function storage");
  const bound = bindMachineProgram(lowered.program, closure.certificate);
  expect(bound.kind).toBe("complete");
  return {
    request: (suffix: string) => closure.inventory.requests.find(({ id }) => id.includes(suffix)),
    instructions: lowered.program.functions[0]!.blocks.flatMap((block) => block.instructions),
  };
}

describe("masked index selection and storage closure", () => {
  it("should carry the low-byte sum into the full borrowed address without widening storage", () => {
    const { request, instructions } = indexed();
    for (const suffix of ["aggregate-index-candidate", "bitwise:", "retained-value:masked"])
      expect(request(suffix)).toBeUndefined();
    expect(instructions.map(({ opcode }) => opcode)).toEqual(
      "lda and clc adc sta lda adc sta ldy lda".split(" "),
    );
    expect(instructions[6]!.operand).toEqual({ kind: "immediate", value: 0 });
    expect(instructions.at(-1)!.mode).toBe("indirect-indexed-y");
  });

  it("should retain both bytes when the mask permits a nonzero high byte", () => {
    const { request } = indexed({ mask: 511n });
    expect(request("bitwise:")).toMatchObject({ bytes: 2 });
    expect(request("aggregate-index-candidate")).toMatchObject({ bytes: 2 });
  });

  it("should preserve sign-extension storage for a signed byte ordinal", () => {
    const { request } = indexed({ columnType: { kind: "scalar", name: "sbyte" } });
    expect(request("aggregate-index-candidate")).toMatchObject({ bytes: 2 });
  });

  it("should preserve word stride and its two-byte loaded result", () => {
    const { request } = indexed({ element: WORD });
    expect(request("aggregate-index-candidate")).toMatchObject({ bytes: 2 });
    expect(request("aggregate-load:selected")).toMatchObject({ bytes: 2 });
  });

  it.each([2, 255])(
    "should not move a read at zero-page address %s past pointer setup",
    (readAddress) => {
      const { request, instructions } = indexed({ readAddress });
      expect(request("retained-value:masked")).toMatchObject({ bytes: 1 });
      const read = instructions.findIndex(
        ({ source, opcode }) => source?.start === 8024 && opcode === "lda",
      );
      const pointerStore = instructions.findIndex(
        ({ opcode, operand }) =>
          opcode === "sta" &&
          operand?.kind === "storage" &&
          operand.requestId.includes("aggregate-address"),
      );
      expect(read).toBeGreaterThanOrEqual(0);
      expect(pointerStore).toBeGreaterThan(read);
    },
  );

  it("should move only a proved non-aliasing adjacent read after pointer setup", () => {
    const { instructions } = indexed({ readAddress: 0xdc01 });
    const read = instructions.findIndex(
      ({ source, opcode }) => source?.start === 8024 && opcode === "lda",
    );
    expect(instructions.slice(read).map(({ opcode }) => opcode)).toEqual(["lda", "sta"]);
    expect(instructions[read + 1]!.mode).toBe("indirect-indexed-y");
  });

  it("should retain the ordinal and sample when checked guards can clobber A", () => {
    const { request, instructions } = indexed({ readAddress: 0xdc01, bounds: true });
    expect(request("retained-value:masked")).toMatchObject({ bytes: 1 });
    expect(request("retained-value:sample")).toMatchObject({ bytes: 1 });
    expect(
      instructions.filter(
        ({ source, memory }) =>
          source?.start === 8024 && memory.some(({ kind }) => kind === "read"),
      ),
    ).toHaveLength(1);
  });
});
