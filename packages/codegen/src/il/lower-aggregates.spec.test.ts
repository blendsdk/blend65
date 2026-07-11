/**
 * Specification tests for aggregate IL lowering: constant indexes fold to
 * plain offset loads/stores (zero runtime cost), runtime indexes emit the
 * indexed memory ops with lowering-owned scaling (the index operand is a
 * BYTE offset — translate stays arithmetic-free), and const aggregates land
 * in the program's const-data channel as fully-evaluated images while module
 * const SCALARS keep inlining as immediates.
 *
 * Expectations derive from the documented lowering shapes and the frozen
 * spec's array semantics — never from reading the implementation. Programs
 * lower end-to-end through the real frontend.
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
import type { ILProgram } from "./cfg.js";
import { printIL } from "./print-il.js";
import { lowerToIL } from "./lower.js";

/** Lowers `source` end-to-end through the REAL frontend. */
function lowerRealSource(source: string): {
  text: string;
  il: ILProgram;
  hasErrors: boolean;
  diags: Diagnostic[];
} {
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
    },
    DEFAULT_PROFILE,
    bag,
  );
  const il = lowerToIL({ program: [ast], model, plan }, bag);
  return { text: printIL(il), il, hasErrors: bag.hasErrors(), diags: bag.getAll() };
}

describe("Specification: aggregate lowering (ST-49..ST-52)", () => {
  it("ST-49: a constant index is a plain offset store — no indexed op, no scaling", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let a: byte[10] = [; 0]; a[2] = 7; }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("+2"); // the element's compile-time offset
    expect(text).not.toContain("store_indexed");
    expect(text).not.toContain("load_indexed");
  });

  it("ST-50: a runtime byte index on byte elements emits load_indexed", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void {" +
        " let a: byte[10] = [; 0]; let i: byte = 1; let v: byte = a[i]; poke($C000, v); }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("load_indexed");
  });

  it("ST-51: 2-byte elements scale the index through the mul path, then index", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nstruct Point { x: byte; y: byte; }\n" +
        "function main(): void {" +
        " let pts: Point[2] = [Point { x: 1, y: 2 }, Point { x: 3, y: 4 }];" +
        " let i: byte = 1; pts[i].x = 5; }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("mul"); // index temp = i × 2 — lowering owns scaling
    expect(text).toContain("store_indexed");
  });

  it("ST-52: a const aggregate lands in constData as its image; const scalars still inline", () => {
    const { text, il, hasErrors } = lowerRealSource(
      "module Main;\n" +
        "const TABLE: byte[6] = [1, 2, 3; 0];\n" +
        "const K: byte = 5;\n" +
        "function main(): void { let i: byte = 1; poke($C000, TABLE[i]); poke($C001, K); }\n",
    );
    expect(hasErrors).toBe(false);
    expect(il.constData).toHaveLength(1);
    const entry = il.constData[0]!;
    expect(entry.symbol).toBe("__data_Main_TABLE");
    expect([...entry.data]).toEqual([1, 2, 3, 0, 0, 0]);
    expect(entry.type).toBe("array");
    // The scalar const K owns no data label — it inlines as an immediate.
    expect(text).not.toContain("__data_Main_K");
    // The table read resolves to the data label.
    expect(text).toContain("__data_Main_TABLE");
  });
});
