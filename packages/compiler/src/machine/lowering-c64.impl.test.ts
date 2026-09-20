import { describe, expect, it } from "vitest";
import type { SemanticOperation } from "../semantic/operations.js";
import { lowerC64Operation } from "./lower-c64.js";
import {
  BOOLEAN,
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
} from "./lowering-test-support.js";

describe("dynamic C64 sprite lowering", () => {
  it("should index sprite registers directly and preserve unrelated shared-register bits", () => {
    const index = sourceParameter(500, BYTE);
    const enabled = sourceParameter(510, BOOLEAN);
    const x = sourceParameter(520, WORD);
    const y = sourceParameter(530, BYTE);
    const pointer = sourceParameter(540, BYTE);
    const color = sourceParameter(550, BYTE);
    const operations: SemanticOperation[] = [
      loadOperation("index", index, 560),
      loadOperation("enabled", enabled, 561),
      loadOperation("x", x, 562),
      loadOperation("y", y, 563),
      loadOperation("pointer", pointer, 564),
      loadOperation("color", color, 565),
    ];
    const platform = (
      capability: string,
      args: readonly string[],
      start: number,
    ): SemanticOperation =>
      Object.freeze({
        kind: "platform" as const,
        result: null,
        capability,
        arguments: Object.freeze(args),
        type: VOID,
        effect: "volatile-write" as const,
        span: sourceSpan(start),
      });
    operations.push(
      platform("c64.vic.setSpriteEnabled", ["index", "enabled"], 566),
      platform("c64.vic.setSpritePosition", ["index", "x", "y"], 567),
      platform("c64.vic.setSpritePointer", ["index", "pointer"], 568),
      platform("c64.vic.setSpriteColor", ["index", "color"], 569),
    );
    const main = semanticFunction(
      490,
      "dynamic-sprites",
      [index, enabled, x, y, pointer, color],
      VOID,
      [
        semanticBlock(
          "sprites.entry",
          operations,
          Object.freeze({ kind: "return" as const, value: null }),
        ),
      ],
    );
    const result = lowerFunctions([main]);

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected dynamic sprite lowering");
    const instructions = result.program.functions[0]!.blocks[0]!.instructions;
    const indexedStores = instructions.filter(
      ({ opcode, mode }) => opcode === "sta" && mode === "absolute-x",
    );
    expect(indexedStores.map(({ operand }) => operand)).toEqual(
      expect.arrayContaining([
        { kind: "absolute", value: 0xd000 },
        { kind: "absolute", value: 0xd001 },
        { kind: "absolute", value: 0x07f8 },
        { kind: "absolute", value: 0xd027 },
      ]),
    );
    const effects = instructions.flatMap(({ memory }) => memory);
    for (const address of [0xd010, 0xd015]) {
      expect(
        effects.filter(
          (effect) =>
            effect.kind === "read" &&
            effect.address.kind === "absolute" &&
            effect.address.value === address,
        ),
      ).toHaveLength(1);
      expect(
        effects.filter(
          (effect) =>
            effect.kind === "write" &&
            effect.address.kind === "absolute" &&
            effect.address.value === address,
        ),
      ).toHaveLength(1);
    }
    expect(result.program.data.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "compiler.c64.sprite-bit-clear",
        "compiler.c64.sprite-bit-selection",
      ]),
    );
    expect(
      result.program.requiredStorage
        .filter(({ id }) => id.includes("sprite-"))
        .map(({ bytes }) => bytes),
    ).toEqual([2, 2]);
    expect(instructions.some(({ opcode }) => opcode === "jsr")).toBe(false);

    for (const address of [0xd010, 0xd015]) {
      const writeIndex = instructions.findIndex(
        ({ opcode, operand }) =>
          opcode === "sta" && operand?.kind === "absolute" && operand.value === address,
      );
      expect(writeIndex).toBeGreaterThan(1);
      expect(instructions.slice(writeIndex - 2, writeIndex).map(({ opcode }) => opcode)).toEqual([
        "and",
        "ora",
      ]);
    }

    const masks = instructions.filter(
      ({ opcode, operand }) =>
        opcode === "and" && operand?.kind === "immediate" && operand.value === 0x07,
    );
    expect(masks.length).toBeGreaterThanOrEqual(6);
    for (const instruction of instructions.filter(({ mode }) => mode === "absolute-x")) {
      const index = instructions.indexOf(instruction);
      expect(
        instructions
          .slice(0, index)
          .some(
            ({ opcode, operand }) =>
              opcode === "and" && operand?.kind === "immediate" && operand.value === 0x07,
          ),
      ).toBe(true);
    }
  });

  it("keeps an imported sprite address as a symbolic layout quotient", () => {
    const operation = Object.freeze({
      kind: "platform" as const,
      result: "block",
      capability: "c64.vic.vicSpriteBlock",
      arguments: Object.freeze(["sprite"]),
      type: BYTE,
      effect: "pure" as const,
      span: sourceSpan(700),
    });
    const lowered = lowerC64Operation(
      operation,
      new Map([
        [
          "sprite",
          Object.freeze({
            kind: "label" as const,
            label: "asset.sprite",
            bytes: 2,
            signed: false,
          }),
        ],
      ]),
      selectedProfile(),
      {
        requestScratch: () => {
          throw new Error("Pure placement transform must not request storage");
        },
      },
    );

    expect(lowered.instructions).toEqual([]);
    expect(lowered.result).toEqual({
      kind: "label",
      label: "asset.sprite",
      bytes: 1,
      signed: false,
      transform: "vic-sprite-block",
    });
  });
});
