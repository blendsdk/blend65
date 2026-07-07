/**
 * Specification tests for the SFA ACME symbol generator (spec Ch 11 §3.5).
 *
 * Expectations derive exclusively from the language specification — NOT from
 * implementation logic. Immutable oracle.
 *
 * Spec-tests-first: authored before `symbols.ts`; verified to FAIL (red).
 */

import { describe, expect, it } from "vitest";
import type { FrameAllocation, FunctionFrame, ModuleVariableAllocation, ZpAllocation } from "@blend65/core";
import { primitive } from "@blend65/core";
import { generateSymbolDefinitions } from "./symbols.js";

/** Builds a frame with one slot `dx` of size 2 at offset 2. */
function gameUpdateFrame(): FunctionFrame {
  return {
    functionName: "Game.update",
    slots: [{ name: "dx", kind: "parameter", type: primitive("sword"), size: 2, offset: 2 }],
    totalSize: 4,
    isInterrupt: false,
    isEscaped: false,
    isReachable: true,
  };
}

describe("Specification: SFA ACME symbols (R47/R50, §4.11)", () => {
  // Frame base symbol for Game.update placed at $0810.
  it("should emit the frame-base symbol with the absolute address (ST-A1)", () => {
    const fa: FrameAllocation = {
      functionName: "Game.update",
      frame: gameUpdateFrame(),
      offset: 0x10,
      absoluteAddress: 0x0810,
    };
    const syms = generateSymbolDefinitions({
      frames: new Map([["Game.update", fa]]),
      moduleVariables: [],
      zpAllocations: [],
    });

    expect(syms).toContainEqual({ name: "__frame_Game_update", value: 0x0810 });
  });

  // Slot symbol dx (offset 2) → base + 2 = $0812.
  it("should emit the slot symbol at base + slot offset (ST-A2)", () => {
    const fa: FrameAllocation = {
      functionName: "Game.update",
      frame: gameUpdateFrame(),
      offset: 0x10,
      absoluteAddress: 0x0810,
    };
    const syms = generateSymbolDefinitions({
      frames: new Map([["Game.update", fa]]),
      moduleVariables: [],
      zpAllocations: [],
    });

    expect(syms).toContainEqual({ name: "__frame_Game_update_dx", value: 0x0812 });
  });

  // Module variable Game.score → __var_Game_score at its address.
  it("should emit the module-variable symbol (ST-A3)", () => {
    const mv: ModuleVariableAllocation = {
      moduleName: "Game",
      variableName: "score",
      address: 0x0820,
      offset: 0,
      size: 2,
      type: primitive("word"),
    };
    const syms = generateSymbolDefinitions({
      frames: new Map(),
      moduleVariables: [mv],
      zpAllocations: [],
    });

    expect(syms).toContainEqual({ name: "__var_Game_score", value: 0x0820 });
  });

  // Deterministic order: frames (by name) → module vars → ZP.
  it("should emit symbols in deterministic order: frames, vars, ZP (ST-A4)", () => {
    const fa: FrameAllocation = {
      functionName: "Game.update",
      frame: gameUpdateFrame(),
      offset: 0,
      absoluteAddress: 0x0810,
    };
    const mv: ModuleVariableAllocation = {
      moduleName: "Game",
      variableName: "score",
      address: 0x0820,
      offset: 0,
      size: 2,
      type: primitive("word"),
    };
    const zp: ZpAllocation = { name: "__zp_ptr_0", address: 0x03, size: 2, category: "pointer" };

    const syms = generateSymbolDefinitions({
      frames: new Map([["Game.update", fa]]),
      moduleVariables: [mv],
      zpAllocations: [zp],
    });

    const frameIdx = syms.findIndex((s) => s.name === "__frame_Game_update");
    const varIdx = syms.findIndex((s) => s.name === "__var_Game_score");
    const zpIdx = syms.findIndex((s) => s.name === "__zp_ptr_0");

    expect(frameIdx).toBeGreaterThanOrEqual(0);
    expect(varIdx).toBeGreaterThan(frameIdx);
    expect(zpIdx).toBeGreaterThan(varIdx);
  });
});
