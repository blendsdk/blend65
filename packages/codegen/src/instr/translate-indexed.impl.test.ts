/**
 * Implementation tests for indexed-translation internals: the TAX fast path
 * (an accumulator-resident scaled index transfers, never reloads), immediate
 * word stores through an index, `!byte` row-capping edges (exactly 16 and
 * 16+1 bytes), and the data segment's byte-size contribution.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { Diagnostic, ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";
import { lowerToIL } from "../il/lower.js";
import { generateInstr } from "./instr-program.js";
import { serializeToAcme } from "./serialize-acme.js";

/** Compiles sources through the real pipeline to ACME text. */
function toAsm(sources: readonly string[]): {
  asm: string;
  hasErrors: boolean;
  diags: Diagnostic[];
} {
  const bag = createDiagnosticBag();
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
      upstreamErrors: bag.hasErrors(),
    },
    DEFAULT_PROFILE,
    bag,
  );
  const il = lowerToIL({ program: programs, model, plan }, bag);
  const program = generateInstr(il, "nmos6502", bag);
  return { asm: serializeToAcme(program), hasErrors: bag.hasErrors(), diags: bag.getAll() };
}

describe("indexed translation — internals", () => {
  it("transfers an accumulator-resident scaled index with TAX (no reload)", () => {
    const { asm, hasErrors } = toAsm([
      "module Main;\nstruct Point { x: byte; y: byte; }\nlet pts: Point[4];\n" +
        "function main(): void { let i: byte = 1; pts[i].x = 5; }\n",
    ]);
    expect(hasErrors).toBe(false);
    // The scale (ASL) leaves the byte offset in A — TAX moves it to X.
    expect(asm).toMatch(/ASL\n\s+TAX/);
  });

  it("stores an immediate word through an index (lo/hi after LDX)", () => {
    const { asm, hasErrors } = toAsm([
      "module Main;\nlet w: word[3] = [; 0];\n" +
        "function main(): void { let i: byte = 1; w[i] = $1234; }\n",
    ]);
    expect(hasErrors).toBe(false);
    expect(asm).toMatch(/LDA #\$34\n\s+STA __var_Main_w,X/);
    expect(asm).toMatch(/LDA #\$12\n\s+STA __var_Main_w\+1,X/);
  });

  it("caps !byte rows at 16 values (exactly 16 → one row; 17 → two rows)", () => {
    const sixteen = toAsm([
      "module Main;\nconst T: byte[16] = [; 1];\n" +
        "function main(): void { let i: byte = 0; poke($C000, T[i]); }\n",
    ]);
    expect(sixteen.hasErrors).toBe(false);
    const rows16 = sixteen.asm.split("\n").filter((l) => l.includes("!byte"));
    expect(rows16).toHaveLength(1);

    const seventeen = toAsm([
      "module Main;\nconst T: byte[17] = [; 1];\n" +
        "function main(): void { let i: byte = 0; poke($C000, T[i]); }\n",
    ]);
    expect(seventeen.hasErrors).toBe(false);
    const rows17 = seventeen.asm.split("\n").filter((l) => l.includes("!byte"));
    expect(rows17).toHaveLength(2);
  });

  it("reads through a const table with a runtime index from the data label", () => {
    const { asm, hasErrors } = toAsm([
      "module Main;\nconst T: byte[4] = [10, 20, 30, 40];\n" +
        "function main(): void { let i: byte = 2; poke($C000, T[i]); }\n",
    ]);
    expect(hasErrors).toBe(false);
    expect(asm).toContain("LDA __data_Main_T,X");
  });
});
