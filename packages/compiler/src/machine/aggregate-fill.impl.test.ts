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

/** Lower the same byte fill into a private temporary or an externally borrowed destination. */
function lowerFill(length: number, prefix: number | null = 7, borrowed = false) {
  const type: SemanticType = { kind: "array", element: BYTE, length, size: length };
  const parameter = sourceParameter(2001, type);
  const fn = semanticFunction(2000, "main", borrowed ? [parameter] : [], VOID, [
    semanticBlock(
      "fill.entry",
      [
        {
          kind: "constant",
          result: "prefix",
          value: prefix ?? 0,
          type: BYTE,
          integer: null,
          span: sourceSpan(2002),
        },
        {
          kind: "constant",
          result: "fill",
          value: 7,
          type: BYTE,
          integer: null,
          span: sourceSpan(2003),
        },
        {
          kind: "aggregate",
          result: "filled",
          type,
          elements: prefix === null ? [] : [{ field: null, value: "prefix" }],
          fill: "fill",
          destination: borrowed
            ? { kind: "place", place: { root: parameter.id, rootType: type, path: [] } }
            : null,
          integer: null,
          span: sourceSpan(2004),
        },
      ],
      { kind: "return", value: null },
    ),
  ]);
  const lowered = lowerFunctions([fn]);
  if (lowered.kind !== "complete") throw new Error("Expected complete fill lowering");
  return { blocks: lowered.program.functions[0]!.blocks, storage: lowered.program.requiredStorage };
}

describe("direct byte-fill selection", () => {
  it.each([null, 7])(
    "uses the same 74-byte kernel for a 5000-byte fill with prefix %s",
    (prefix) => {
      const { blocks, storage } = lowerFill(5000, prefix);
      const loops = blocks.filter(({ terminator }) => terminator.kind === "branch");
      expect(loops).toHaveLength(2);
      expect(loops.map(({ instructions }) => instructions.map(({ opcode }) => opcode))).toEqual([
        [...Array.from({ length: 19 }, () => "sta"), "iny"],
        ["sta", "iny", "cpy"],
      ]);
      const instructions = blocks.flatMap((block) => block.instructions);
      expect(instructions.map(({ opcode }) => opcode)).toEqual([
        "lda",
        "ldy",
        ...Array.from({ length: 19 }, () => "sta"),
        "iny",
        "ldy",
        "sta",
        "iny",
        "cpy",
      ]);
      expect(
        instructions.reduce((bytes, instruction) => bytes + instruction.cost.bytes, 0) + 4,
      ).toBe(74);
      expect(storage.filter(({ bytes }) => bytes === 5000)).toHaveLength(1);
      expect(storage.filter(({ region }) => region === "zero-page-required")).toHaveLength(0);
      // Independent NMOS costs: STA abs,Y=5, INY=2, CPY #=2; BNE=3 taken/2 final.
      // This excludes branch-page penalties and C64 DMA stalls, not hidden execution overhead.
      const fullPageCycles = 2 + 2 + 256 * (19 * 5 + 2) + 255 * 3 + 2;
      const tailCycles = 2 + 136 * (5 + 2 + 2) + 135 * 3 + 2;
      expect(fullPageCycles + tailCycles).toBe(27_236);
    },
  );

  it.each([255, 256, 257, 5000, 41 * 256, 42 * 256])(
    "covers exactly %i bytes with legal short back edges",
    (length) => {
      const { blocks } = lowerFill(length);
      const writes: number[] = [];
      for (const block of blocks.filter(({ terminator }) => terminator.kind === "branch")) {
        const compare = block.instructions.find(({ opcode }) => opcode === "cpy");
        const count = compare?.operand?.kind === "immediate" ? compare.operand.value : 256;
        expect(
          block.instructions.reduce((size, instruction) => size + instruction.cost.bytes, 2),
        ).toBeLessThanOrEqual(128);
        for (const instruction of block.instructions.filter(({ opcode }) => opcode === "sta")) {
          expect(instruction.mode).toBe("absolute-y");
          if (instruction.operand?.kind !== "storage") throw new Error("Expected private store");
          for (let index = 0; index < count; index += 1)
            writes.push(instruction.operand.offset + index);
        }
      }
      expect(writes.sort((left, right) => left - right)).toEqual(
        Array.from({ length }, (_, index) => index),
      );
    },
  );

  it("does not discard an unequal explicit prefix", () => {
    const { blocks } = lowerFill(16, 9);
    expect(blocks.some(({ terminator }) => terminator.kind === "branch")).toBe(false);
    const loads = blocks
      .flatMap(({ instructions }) => instructions)
      .filter(({ opcode }) => opcode === "lda");
    expect(loads.map(({ operand }) => operand)).toEqual([
      { kind: "immediate", value: 9 },
      ...Array.from({ length: 15 }, () => ({ kind: "immediate", value: 7 })),
    ]);
  });

  it("keeps borrowed fills on the ascending pointer loop", () => {
    const { blocks } = lowerFill(5000, 7, true);
    const stores = blocks
      .flatMap(({ instructions }) => instructions)
      .filter(({ opcode }) => opcode === "sta");
    const byteStores = stores.filter(({ mode }) => mode === "indirect-indexed-y");
    expect(byteStores).toHaveLength(2);
    expect(stores.some(({ mode }) => mode === "absolute-y")).toBe(false);
    expect(blocks.filter(({ terminator }) => terminator.kind === "branch")).toHaveLength(3);
  });
});
