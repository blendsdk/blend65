import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import {
  BYTE,
  VOID,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceSpan,
} from "./lowering-test-support.js";

describe("fixed aggregate copy lowering", () => {
  const LARGE_ARRAY: SemanticType = Object.freeze({
    kind: "array",
    element: BYTE,
    length: 300,
    size: 300,
  });

  // A page-sized copy should use a short counted loop rather than hundreds of repeated loads.
  it("should keep a 300-byte direct copy near the expert loop's code size", () => {
    const array = LARGE_ARRAY;
    const source = sourceBinding(1200);
    const target = sourceBinding(1201);
    const sourcePlace = Object.freeze({ root: source, rootType: array, path: Object.freeze([]) });
    const targetPlace = Object.freeze({ root: target, rootType: array, path: Object.freeze([]) });
    const main = semanticFunction(1199, "copy-large-array", [], VOID, [
      semanticBlock(
        "copy.entry",
        [
          Object.freeze({
            kind: "place-address" as const,
            result: "source",
            place: sourcePlace,
            type: array,
            integer: null,
            span: sourceSpan(1202),
          }),
          Object.freeze({
            kind: "store" as const,
            place: targetPlace,
            value: "source",
            type: array,
            span: sourceSpan(1203),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const lowered = lowerFunctions([main]);

    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") throw new Error("Expected complete aggregate lowering");
    const blocks = lowered.program.functions[0]!.blocks;
    const codeBytes = blocks.reduce(
      (bytes, block) =>
        bytes +
        block.instructions.reduce((sum, instruction) => sum + instruction.cost.bytes, 0) +
        ("cost" in block.terminator ? block.terminator.cost.bytes : 0),
      0,
    );
    expect(codeBytes).toBeLessThan(60);
    expect(
      blocks.some(({ terminator }) => terminator.kind === "branch" && terminator.opcode === "bne"),
    ).toBe(true);
  });

  it("should keep a large caller-owned return compact", () => {
    const source = sourceBinding(1300);
    const place = Object.freeze({ root: source, rootType: LARGE_ARRAY, path: Object.freeze([]) });
    const returning = semanticFunction(1299, "return-large-array", [], LARGE_ARRAY, [
      semanticBlock(
        "return.entry",
        [
          Object.freeze({
            kind: "place-address" as const,
            result: "source",
            place,
            type: LARGE_ARRAY,
            integer: null,
            span: sourceSpan(1301),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: "source" }),
      ),
    ]);
    const lowered = lowerFunctions([returning]);
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") throw new Error("Expected complete aggregate lowering");
    const blocks = lowered.program.functions[0]!.blocks;
    const codeBytes = blocks.reduce(
      (bytes, block) =>
        bytes +
        block.instructions.reduce((sum, instruction) => sum + instruction.cost.bytes, 0) +
        ("cost" in block.terminator ? block.terminator.cost.bytes : 0),
      0,
    );
    expect(codeBytes).toBeLessThan(70);
    expect(
      blocks.some(({ terminator }) => terminator.kind === "branch" && terminator.opcode === "bne"),
    ).toBe(true);
  });

  it("should fill a large byte array with a counted store loop", () => {
    const target = sourceBinding(1400);
    const place = Object.freeze({ root: target, rootType: LARGE_ARRAY, path: Object.freeze([]) });
    const main = semanticFunction(1399, "fill-large-array", [], VOID, [
      semanticBlock(
        "fill.entry",
        [
          Object.freeze({
            kind: "constant" as const,
            result: "fill-byte",
            value: 7,
            type: BYTE,
            integer: null,
            span: sourceSpan(1401),
          }),
          Object.freeze({
            kind: "aggregate" as const,
            result: "filled",
            type: LARGE_ARRAY,
            elements: Object.freeze([]),
            fill: "fill-byte",
            destination: Object.freeze({ kind: "place" as const, place }),
            integer: null,
            span: sourceSpan(1402),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const lowered = lowerFunctions([main]);
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") throw new Error("Expected complete aggregate lowering");
    const blocks = lowered.program.functions[0]!.blocks;
    const codeBytes = blocks.reduce(
      (bytes, block) =>
        bytes +
        block.instructions.reduce((sum, instruction) => sum + instruction.cost.bytes, 0) +
        ("cost" in block.terminator ? block.terminator.cost.bytes : 0),
      0,
    );
    expect(codeBytes).toBeLessThan(45);
    expect(
      blocks.some(({ terminator }) => terminator.kind === "branch" && terminator.opcode === "bne"),
    ).toBe(true);
  });
});
