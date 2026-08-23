/**
 * Implementation test for the memory-intrinsic effect marker. It verifies the
 * centralized lowering path across byte/word reads and constant/runtime writes.
 */

import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelNeedsPointerScratch,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";
import { describe, expect, it } from "vitest";

import { lowerToIL } from "./lower.js";
import { isLocation } from "./operand.js";

describe("memory intrinsic lowering", () => {
  it("should mark every accessed byte from peek, peekw, poke, and pokew as volatile", () => {
    const source = [
      "module Main;",
      "function main(): void {",
      "  let value: word = $5678;",
      "  peek($D020);",
      "  peekw($D030);",
      "  poke($D040, 1);",
      "  pokew($D050, $1234);",
      "  pokew($D060, value);",
      "}",
    ].join("\n");
    const bag = createDiagnosticBag();
    const { tokens } = lex(1, source, bag);
    const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: 1, bag });
    const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
    const plan = planAllocation(
      {
        functions: modelToFunctionInfo(model),
        moduleVars: modelToModuleVars(model),
        zpUserVars: [],
        upstreamErrors: bag.hasErrors(),
        needsPointerScratch: modelNeedsPointerScratch(model),
      },
      DEFAULT_PROFILE,
      bag,
    );
    const program = lowerToIL({ program: [ast], model, plan }, bag);
    const accesses = (program.functions[0]?.blocks[0]?.instructions ?? []).filter(
      (instruction) =>
        (instruction.op === "load" || instruction.op === "store") &&
        isLocation(instruction.b) &&
        instruction.b.symbol.startsWith("$"),
    );

    expect(bag.getAll()).toEqual([]);
    expect(accesses.map(({ op }) => op)).toEqual([
      "load",
      "load",
      "store",
      "store",
      "store",
      "store",
    ]);
    expect(
      accesses.every(
        (instruction) =>
          (instruction.op === "load" || instruction.op === "store") &&
          instruction.volatile === true,
      ),
    ).toBe(true);
  });
});
