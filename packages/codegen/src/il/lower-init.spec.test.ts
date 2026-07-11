/**
 * Specification tests for module-initializer IL production — a module `let`
 * with an initializer lowers into the program's init-code stream (a store of
 * the value to the variable's storage symbol, closed by a `ret` so the
 * generated startup call returns), while an initializer-free program keeps
 * the init stream empty with a zero temp count, byte-identical to today's
 * output.
 *
 * Expectations derive from the frozen spec Ch 10 §5.4 (initializers run once
 * before `main`) — never from the implementation. Exercised through the real
 * frontend (`lex`→`parse`→`analyze`→`planAllocation`) into `lowerToIL`.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";

import { lowerToIL } from "./lower.js";
import type { ILProgram } from "./cfg.js";
import type { ILInstruction } from "./instruction.js";

/** Runs the real frontend over `sources` and lowers the result to IL. */
function lowerSource(sources: readonly string[]): {
  program: ILProgram;
  diags: Diagnostic[];
} {
  const bag: DiagnosticBag = createDiagnosticBag();
  const programs: ProgramNode[] = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  const plan = planAllocation(
    {
      functions: modelToFunctionInfo(model),
      moduleVars: modelToModuleVars(model),
      zpUserVars: [],
      upstreamErrors: false,
    },
    DEFAULT_PROFILE,
    bag,
  );
  const program = lowerToIL({ program: programs, model, plan }, bag);
  return { program, diags: bag.getAll() };
}

/** The direct-memory instruction shape (`load`/`store` share it). */
type MemoryIns = Extract<ILInstruction, { op: "load" | "store" }>;

/** Narrows an instruction to the `store` shape. */
function isStore(ins: ILInstruction): ins is MemoryIns {
  return ins.op === "store";
}

describe("Specification: module-initializer IL production", () => {
  it("should lower a module let initializer into a ret-terminated init stream", () => {
    const { program, diags } = lowerSource([
      "module Main;\n" +
        "let g: byte = 7;\n" +
        "function main(): void { poke($C000, g); }\n",
    ]);
    expect(diags).toEqual([]);

    expect(program.initCode.length).toBeGreaterThan(0);
    const block = program.initCode[0];
    expect(block.terminator.kind).toBe("ret");

    // The initializer is one immediate store to the variable's storage symbol.
    const store = block.instructions.find(isStore);
    expect(store).toBeDefined();
    if (store === undefined) return;
    expect(store.a.kind).toBe("immediate");
    if (store.a.kind === "immediate") expect(store.a.value).toBe(7);
    expect(store.b.kind).toBe("location");
    if (store.b.kind === "location") expect(store.b.symbol).toBe("__var_Main_g");

    // The stream carries its own temp count for the translator's prescan.
    expect(Number.isInteger(program.initTempCount)).toBe(true);
    expect(program.initTempCount).toBeGreaterThanOrEqual(0);
  });

  it("should keep the init stream empty for an initializer-free program", () => {
    const { program, diags } = lowerSource([
      "module Main;\n" +
        "let g: byte;\n" +
        "function main(): void { poke($C000, g); }\n",
    ]);
    expect(diags).toEqual([]);
    expect(program.initCode).toEqual([]);
    expect(program.initTempCount).toBe(0);
  });
});
