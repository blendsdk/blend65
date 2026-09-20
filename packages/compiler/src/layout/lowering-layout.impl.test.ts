import { describe, expect, it } from "vitest";
import type { SemanticProgram } from "../semantic/operations.js";
import { allocateStorage } from "../storage/allocate.js";
import { closeStorage } from "../storage/closure.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { bindMachineProgram } from "../machine/bind.js";
import { lowerMachineProgram } from "../machine/lower.js";
import {
  BYTE,
  VOID,
  WORD,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceSpan,
  wholeProgramFor,
} from "../machine/lowering-test-support.js";
import { layoutC64Program } from "./c64-layout.js";

describe("lowering through final C64 layout", () => {
  it("keeps a sprite block as an immediate symbolic quotient until final placement", () => {
    const main = semanticFunction(1400, "main", [], VOID, [
      semanticBlock(
        "main.entry",
        [
          Object.freeze({
            kind: "embedded-address" as const,
            result: "address",
            asset: "sprites",
            type: WORD,
            integer: Object.freeze({ width: 16 as const, signed: false, wrap: true }),
            span: sourceSpan(1401),
          }),
          Object.freeze({
            kind: "platform" as const,
            result: "block",
            capability: "c64.vic.vicSpriteBlock",
            arguments: Object.freeze(["address"]),
            type: BYTE,
            effect: "pure" as const,
            span: sourceSpan(1402),
          }),
          Object.freeze({
            kind: "constant" as const,
            result: "index",
            type: BYTE,
            integer: Object.freeze({ width: 8 as const, signed: false, wrap: true }),
            value: 0n,
            span: sourceSpan(1403),
          }),
          Object.freeze({
            kind: "platform" as const,
            result: null,
            capability: "c64.vic.setSpritePointer",
            arguments: Object.freeze(["index", "block"]),
            type: VOID,
            effect: "volatile-write" as const,
            span: sourceSpan(1404),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const base = wholeProgramFor([main]);
    const semantic: SemanticProgram = Object.freeze({
      ...base.semantic,
      assets: Object.freeze([
        Object.freeze({
          id: "sprites",
          sourcePath: "assets/sprites.bin",
          sha256: "0".repeat(64),
          bytes: Object.freeze(new Array<number>(64).fill(0x5a)),
        }),
      ]),
    });
    const program = Object.freeze({
      ...base,
      semantic,
      reachableAssets: Object.freeze(["sprites"]),
    });
    const profile = selectedProfile();
    const inventory = inventoryStorage(program);
    const allocation = allocateStorage(inventory, buildInterference(inventory), profile.storage);
    if (allocation.kind !== "complete") throw new Error("Expected provisional allocation");
    const lowered = lowerMachineProgram({ program, placement: allocation.placement, profile });
    if (lowered.kind !== "complete") throw new Error(`Expected lowering: ${lowered.reason}`);
    const closure = closeStorage(inventory, profile.storage, lowered.binder);
    if (closure.kind !== "complete") throw new Error("Expected storage closure");
    const bound = bindMachineProgram(lowered.program, closure.certificate);
    if (bound.kind !== "complete") throw new Error("Expected machine binding");
    const symbolic = bound.program.functions[0]!.blocks[0]!.instructions.find(
      ({ operand }) => operand?.kind === "label" && operand.transform === "vic-sprite-block",
    );
    expect(symbolic).toEqual(
      expect.objectContaining({
        opcode: "lda",
        mode: "immediate",
        cost: { bytes: 2, minCycles: 2, maxCycles: 2 },
      }),
    );

    const layout = layoutC64Program({
      program: bound.program,
      certificate: closure.certificate,
      profile,
    });
    expect(layout.kind).toBe("complete");
    if (layout.kind !== "complete") throw new Error(`Expected layout: ${layout.reason}`);
    const resolved = layout.program.functions[0]!.blocks[0]!.instructions.find(
      ({ opcode, operand }) =>
        opcode === "lda" && operand?.kind === "immediate" && operand.value === 0x80,
    );
    expect(resolved).toEqual(
      expect.objectContaining({
        mode: symbolic!.mode,
        cost: symbolic!.cost,
        operand: { kind: "immediate", value: 0x80 },
      }),
    );
    expect(layout.intervals.filter(({ id }) => id === "asset.sprites")).toHaveLength(1);
  });
});
