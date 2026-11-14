import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import {
  BYTE,
  VOID,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  sourceSpan,
} from "./lowering-test-support.js";

/** Lower one fixed byte array with exactly the supplied leading elements. */
function lowerPartial(length: number, supplied: number) {
  const type: SemanticType = { kind: "array", element: BYTE, length, size: length };
  const constants: SemanticOperation[] = Array.from({ length: supplied }, (_, index) => ({
    kind: "constant" as const,
    result: `value${index}`,
    value: index + 5,
    type: BYTE,
    integer: null,
    span: sourceSpan(3010 + index),
  }));
  const construction: SemanticOperation = {
    kind: "aggregate",
    result: "array",
    type,
    elements: Array.from({ length: supplied }, (_, index) => ({
      field: null,
      value: `value${index}`,
    })),
    fill: null,
    destination: null,
    integer: null,
    span: sourceSpan(3020),
  };
  const fn = semanticFunction(3000, "partial", [], VOID, [
    semanticBlock("partial.entry", [...constants, construction], { kind: "return", value: null }),
  ]);
  const lowered = lowerFunctions([fn]);
  if (lowered.kind !== "complete") throw new Error("Expected complete partial lowering");
  return lowered.program.functions[0]!.blocks.flatMap(({ instructions }) => instructions);
}

/** Return the store offsets into the constructed array in emission order. */
function storedOffsets(length: number, supplied: number): number[] {
  return lowerPartial(length, supplied)
    .filter(({ opcode }) => opcode === "sta")
    .map(({ operand }) => {
      if (operand?.kind !== "storage" || typeof operand.offset !== "number") {
        throw new TypeError("Expected a direct store into the construction home");
      }
      return operand.offset;
    });
}

describe("partial fixed-array lowering", () => {
  // Omitted elements keep their indeterminate stored bits, so only supplied
  // elements may be written by the construction.
  it("should store only the supplied elements when the array is partially initialized", () => {
    expect(storedOffsets(4, 2)).toEqual([0, 1]);
  });

  // A partial initializer must not become an implicit zero fill.
  it("should emit no zero value or omitted store when one element is supplied", () => {
    const instructions = lowerPartial(2, 1);
    expect(instructions.filter(({ opcode }) => opcode === "sta")).toHaveLength(1);
    const zeroImmediate = instructions.some(
      ({ opcode, operand }) =>
        opcode === "lda" && operand?.kind === "immediate" && operand.value === 0,
    );
    expect(zeroImmediate).toBe(false);
  });
});
