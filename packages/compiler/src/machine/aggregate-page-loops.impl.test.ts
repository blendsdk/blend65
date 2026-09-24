import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import {
  BYTE,
  VOID,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  sourceParameter,
  sourceBinding,
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
  it("should capture an earlier large member with bounded code before later effects", () => {
    const input = sourceParameter(1900, BUFFER);
    const source = Object.freeze({ root: input.id, rootType: BUFFER, path: Object.freeze([]) });
    const capture = semanticFunction(1899, "capture-large-member", [input], VOID, [
      semanticBlock(
        "capture.entry",
        [
          Object.freeze({
            kind: "place-address" as const,
            result: "earlier",
            place: source,
            captureValue: true as const,
            type: BUFFER,
            integer: null,
            span: sourceSpan(1901),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const lowered = lowerFunctions([capture]);
    expect(functionBytes(lowered)).toBeLessThan(100);
    if (lowered.kind !== "complete") throw new Error("Expected complete value capture");
    expect(
      lowered.program.requiredStorage.some(
        ({ id, bytes }) => id.includes("construct-capture") && bytes === 8192,
      ),
    ).toBe(true);
  });

  it("should construct a large nested member without per-byte code or a full snapshot", () => {
    for (const size of [300, 8192]) {
      const member: SemanticType = Object.freeze({
        kind: "array",
        element: BYTE,
        length: size,
        size,
      });
      const holder: SemanticType = Object.freeze({
        kind: "struct",
        binding: sourceBinding(1800),
        size,
        fields: Object.freeze([{ name: "inner", type: member, offset: 0 }]),
      });
      const input = sourceParameter(1801, member);
      const output = sourceParameter(1802, holder);
      const source = Object.freeze({ root: input.id, rootType: member, path: Object.freeze([]) });
      const target = Object.freeze({ root: output.id, rootType: holder, path: Object.freeze([]) });
      const build = semanticFunction(1799, "build-large-member", [input, output], VOID, [
        semanticBlock(
          "build.entry",
          [
            Object.freeze({
              kind: "place-address" as const,
              result: "member",
              place: source,
              type: member,
              integer: null,
              span: sourceSpan(1803),
            }),
            Object.freeze({
              kind: "aggregate" as const,
              result: "built",
              type: holder,
              elements: Object.freeze([{ field: "inner", value: "member" }]),
              fill: null,
              destination: Object.freeze({ kind: "place" as const, place: target }),
              integer: null,
              span: sourceSpan(1804),
            }),
          ],
          Object.freeze({ kind: "return" as const, value: null }),
        ),
      ]);
      const lowered = lowerFunctions([build]);
      expect(functionBytes(lowered), `${size}-byte member`).toBeLessThan(180);
      if (lowered.kind !== "complete") throw new Error("Expected complete nested lowering");
      expect(
        lowered.program.requiredStorage.some(
          ({ id, bytes }) => id.includes("construct-snapshot") && bytes === size,
        ),
        `${size}-byte member snapshot`,
      ).toBe(false);
    }
  });

  it("should stage a borrowed later member that can alias a direct destination", () => {
    const member: SemanticType = Object.freeze({
      kind: "array",
      element: BYTE,
      length: 16,
      size: 16,
    });
    const holder: SemanticType = Object.freeze({
      kind: "struct",
      binding: sourceBinding(1950),
      size: 32,
      fields: Object.freeze([
        { name: "left", type: member, offset: 0 },
        { name: "right", type: member, offset: 16 },
      ]),
    });
    const borrowed = sourceParameter(1951, member);
    const target = Object.freeze({
      root: sourceBinding(1952),
      rootType: holder,
      path: Object.freeze([]),
    });
    const first = Object.freeze({
      root: target.root,
      rootType: holder,
      path: Object.freeze([{ kind: "field" as const, name: "right" }]),
    });
    const second = Object.freeze({ root: borrowed.id, rootType: member, path: Object.freeze([]) });
    const build = semanticFunction(1949, "build-borrowed-alias", [borrowed], VOID, [
      semanticBlock(
        "alias.entry",
        [
          Object.freeze({
            kind: "place-address" as const,
            result: "first",
            place: first,
            type: member,
            integer: null,
            span: sourceSpan(1953),
          }),
          Object.freeze({
            kind: "place-address" as const,
            result: "second",
            place: second,
            type: member,
            integer: null,
            span: sourceSpan(1954),
          }),
          Object.freeze({
            kind: "aggregate" as const,
            result: "built",
            type: holder,
            elements: Object.freeze([
              { field: "left", value: "first" },
              { field: "right", value: "second" },
            ]),
            fill: null,
            destination: Object.freeze({ kind: "place" as const, place: target }),
            integer: null,
            span: sourceSpan(1955),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const lowered = lowerFunctions([build]);
    if (lowered.kind !== "complete")
      throw new Error("Expected complete alias-safe nested lowering");
    expect(
      lowered.program.requiredStorage.some(
        ({ id, bytes }) => id.includes("construct-snapshot:second") && bytes === 16,
      ),
    ).toBe(true);
  });

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
