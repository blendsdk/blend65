/**
 * Implementation tests for aggregate lowering internals: the place-resolution
 * matrix (constant/runtime indexes × field nesting), image → constData byte
 * equality, module-initializer ordering with aggregate initialisers, and the
 * whole-struct copy unroll.
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

/** Lowers sources end-to-end through the REAL frontend. */
function lowerReal(sources: readonly string[]): {
  text: string;
  il: ILProgram;
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
  return { text: printIL(il), il, hasErrors: bag.hasErrors(), diags: bag.getAll() };
}

describe("aggregate lowering — place matrix", () => {
  it("folds a nested constant chain to ONE static offset (rooms[1].door.keys[2])", () => {
    const { text, hasErrors } = lowerReal([
      "module Main;\n" +
        "struct Door { keys: byte[4]; locked: boolean; }\n" +
        "struct Room { door: Door; id: byte; }\n" +
        "let rooms: Room[3];\n" +
        // Room = 6 bytes (4 keys + locked + id); rooms[1].door.keys[2] = 6 + 0 + 2 = +8
        "function main(): void { rooms[1].door.keys[2] = 9; }\n",
    ]);
    expect(hasErrors).toBe(false);
    expect(text).toContain("__var_Main_rooms+8");
    expect(text).not.toContain("store_indexed");
  });

  it("chains a runtime index with a following constant field offset", () => {
    const { text, hasErrors } = lowerReal([
      "module Main;\n" +
        "struct Point { x: byte; y: byte; }\n" +
        "let pts: Point[4];\n" +
        "function main(): void { let i: byte = 2; pts[i].y = 7; }\n",
    ]);
    expect(hasErrors).toBe(false);
    // The scaled runtime index rides the indexed op; the .y offset (+1) is
    // compile-time and lands on the base location.
    expect(text).toContain("mul");
    expect(text).toContain("store_indexed");
    expect(text).toContain("__var_Main_pts+1");
  });

  it("keeps a byte-element runtime index unscaled (no mul for elemSize 1)", () => {
    const { text, hasErrors } = lowerReal([
      "module Main;\nlet a: byte[10];\n" +
        "function main(): void { let i: byte = 1; a[i] = 3; }\n",
    ]);
    expect(hasErrors).toBe(false);
    expect(text).toContain("store_indexed");
    expect(text).not.toContain("mul");
  });

  it("unrolls a whole-struct copy into per-byte load/store pairs at 0..N-1", () => {
    const { text, hasErrors } = lowerReal([
      "module Main;\n" +
        "struct P { x: byte; y: byte; z: byte; }\n" +
        "let a: P;\nlet b: P;\n" +
        "function main(): void { b = a; }\n",
    ]);
    expect(hasErrors).toBe(false);
    expect(text).toContain("__var_Main_a+1");
    expect(text).toContain("__var_Main_a+2");
    expect(text).toContain("__var_Main_b+1");
    expect(text).toContain("__var_Main_b+2");
  });
});

describe("aggregate lowering — const data & init stream", () => {
  it("constData bytes equal the frontend image exactly (word little-endian)", () => {
    const { il, hasErrors } = lowerReal([
      "module Main;\nconst W: word[2] = [$1234, 5];\n" +
        "function main(): void { let i: byte = 0; poke($C000, <byte>(W[i])); }\n",
    ]);
    expect(hasErrors).toBe(false);
    expect(il.constData).toHaveLength(1);
    expect([...il.constData[0]!.data]).toEqual([0x34, 0x12, 0x05, 0x00]);
  });

  it("lowers module-level aggregate initialisers into the __init stream in order", () => {
    const { text, hasErrors } = lowerReal([
      "module Main;\n" +
        "let first: byte = 1;\n" +
        "let arr: byte[3] = [7, 8; 9];\n" +
        "function main(): void { poke($C000, arr[0]); }\n",
    ]);
    expect(hasErrors).toBe(false);
    // The init stream stores the scalar, then the array's elements + fill.
    expect(text).toContain("__init");
    expect(text).toContain("__var_Main_arr");
    expect(text).toContain("__var_Main_arr+1");
    expect(text).toContain("__var_Main_arr+2");
    const firstPos = text.indexOf("__var_Main_first");
    const arrPos = text.indexOf("__var_Main_arr");
    expect(firstPos).toBeGreaterThanOrEqual(0);
    expect(firstPos).toBeLessThan(arrPos);
  });
});
