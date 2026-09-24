import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import {
  BYTE,
  VOID,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  sourceParameter,
  sourceSpan,
} from "./lowering-test-support.js";

const BUFFER: SemanticType = Object.freeze({
  kind: "array",
  element: BYTE,
  length: 8192,
  size: 8192,
});

/** Count the selected machine bytes, including branch terminators. */
function functionBytes(functions: ReturnType<typeof lowerFunctions>): number {
  if (functions.kind !== "complete") throw new Error("Expected complete large-buffer lowering");
  return functions.program.functions[0]!.blocks.reduce(
    (bytes, block) =>
      bytes +
      block.instructions.reduce((sum, instruction) => sum + instruction.cost.bytes, 0) +
      ("cost" in block.terminator ? block.terminator.cost.bytes : 0),
    0,
  );
}

describe("large borrowed aggregate loops", () => {
  it("should keep an 8 KiB borrowed copy bounded in code and scratch", () => {
    const input = sourceParameter(1600, BUFFER);
    const output = sourceParameter(1601, BUFFER);
    const source = Object.freeze({ root: input.id, rootType: BUFFER, path: Object.freeze([]) });
    const target = Object.freeze({ root: output.id, rootType: BUFFER, path: Object.freeze([]) });
    const copy = semanticFunction(1599, "copy-eight-kib", [input, output], VOID, [
      semanticBlock(
        "copy.entry",
        [
          Object.freeze({
            kind: "place-address" as const,
            result: "source",
            place: source,
            type: BUFFER,
            integer: null,
            span: sourceSpan(1602),
          }),
          Object.freeze({
            kind: "store" as const,
            place: target,
            value: "source",
            type: BUFFER,
            span: sourceSpan(1603),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const lowered = lowerFunctions([copy]);
    expect(functionBytes(lowered)).toBeLessThan(180);
    if (lowered.kind !== "complete") throw new Error("Expected complete copy lowering");
    expect(
      lowered.program.requiredStorage.some(({ id }) => id.includes("aggregate-snapshot")),
    ).toBe(false);
  });

  it("should keep an 8 KiB borrowed fill under one hundred body bytes", () => {
    const output = sourceParameter(1700, BUFFER);
    const target = Object.freeze({ root: output.id, rootType: BUFFER, path: Object.freeze([]) });
    const fill = semanticFunction(1699, "fill-eight-kib", [output], VOID, [
      semanticBlock(
        "fill.entry",
        [
          Object.freeze({
            kind: "constant" as const,
            result: "byte",
            value: 7,
            type: BYTE,
            integer: null,
            span: sourceSpan(1701),
          }),
          Object.freeze({
            kind: "aggregate" as const,
            result: "filled",
            type: BUFFER,
            elements: Object.freeze([]),
            fill: "byte",
            destination: Object.freeze({ kind: "place" as const, place: target }),
            integer: null,
            span: sourceSpan(1702),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    expect(functionBytes(lowerFunctions([fill]))).toBeLessThan(100);
  });
});
