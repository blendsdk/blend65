/**
 * Specification tests for expression IL lowering: comparison operand-type
 * stamping (all three compare-emission sites), the short-circuit/ternary
 * slot diamonds over synthetic frame slots, the signed-division guard, and
 * non-constant `lo`/`hi`.
 *
 * Expectations derive exclusively from the documented lowering shapes and the
 * frozen spec's operator semantics — never from reading the implementation
 * (immutable oracle). Each program lowers end-to-end through the real
 * frontend so operands carry real types + frames; the printed IL is inspected
 * structurally. Authored before the lowering exists (red first, then green).
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
import { printIL } from "./print-il.js";
import { lowerToIL } from "./lower.js";

/** Lowers `source` end-to-end through the REAL frontend; returns printed IL + diagnostics. */
function lowerRealSource(source: string): {
  text: string;
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
  return { text: printIL(il), hasErrors: bag.hasErrors(), diags: bag.getAll() };
}

describe("Specification: comparisons carry the operand type (all three emission sites)", () => {
  it("should stamp a word while-condition compare as i16u", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let w: word = 1000;" +
        " while (w > 500) { w = w - 1; } }\n",
    );
    expect(hasErrors).toBe(false);
    // The compare reads 16-bit operands — the result flag stays a byte temp,
    // but the instruction's type field is the OPERAND type.
    expect(text).toContain("gt i16u");
    expect(text).not.toContain("gt i8u");
  });

  it("should stamp a word for-loop counter compare as i16u", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void {" +
        " for (let i: word = 1 to 1000) { poke($C000, 1); } }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("le i16u"); // Pattern-A continue predicate at word width
    expect(text).not.toContain("le i8u");
  });

  it("should stamp a word switch-dispatch compare as i16u", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let w: word = 1000;" +
        " switch (w) { case 1000: poke($C000, 1); default: poke($C000, 2); } }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("eq i16u");
    expect(text).not.toContain("eq i8u");
  });

  it("should keep byte-operand compares stamped i8u (prior shapes unchanged)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let b: byte = 10;" +
        " while (b > 5) { b = b - 1; } }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("gt i8u");
  });
});

describe("Specification: short-circuit lowering (slot diamond, call only in the rhs block)", () => {
  it("should lower a && call() through a synthetic slot with the call in its own block", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\n" +
        "function bump(): boolean { poke($C005, 1); return true; }\n" +
        "function main(): void { let a: boolean = true;" +
        " let r: boolean = a && bump(); }\n",
    );
    expect(hasErrors).toBe(false);

    // The result flows through the synthetic frame slot: one store on the
    // short-circuit path, one on the rhs path, then the join reloads it.
    const slotStores = text.match(/store .*__frame_Main_main_0sc0/g) ?? [];
    expect(slotStores).toHaveLength(2);
    expect(text).toMatch(/load i8u __frame_Main_main_0sc0/);

    // Short-circuit is a guarantee: the rhs call sits ONLY in a branch-target
    // block, strictly after the dispatching brcond.
    const callMatches = text.match(/call Main\.bump/g) ?? [];
    expect(callMatches).toHaveLength(1);
    expect(text.indexOf("call Main.bump")).toBeGreaterThan(text.indexOf("brcond"));
  });
});

describe("Specification: ternary lowering (diamond; arms coerce to the result type)", () => {
  it("should widen the byte arm with zext before its slot store", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let cond: boolean = true;" +
        " let bv: byte = 1; let wv: word = 1000; let r: word = cond ? bv : wv; }\n",
    );
    expect(hasErrors).toBe(false);

    // Diamond over the synthetic slot: two arm stores + the join load.
    const slotStores = text.match(/store .*__frame_Main_main_0sc0/g) ?? [];
    expect(slotStores).toHaveLength(2);
    expect(text).toMatch(/load i16u __frame_Main_main_0sc0/);
    // The byte arm widens (zero-extend — unsigned source) to the word result.
    expect(text).toContain("zext");
    expect(text).toContain("brcond");
  });
});

describe("Specification: signed division/modulo is rejected loudly", () => {
  it("should raise an internal error naming signed division and emit nothing for it", () => {
    const { diags } = lowerRealSource(
      "module Main;\nfunction main(): void { let a: sbyte = -4; let b: sbyte = 2;" +
        " let q: sbyte = a / b; }\n",
    );
    const ice = diags.find((d) => d.code === "E90001");
    expect(ice).toBeDefined();
    expect(ice?.message).toContain("signed division");
  });
});

describe("Specification: non-constant lo()/hi() lower without errors", () => {
  it("should lower lo(word) to trunc and hi(word) to a high-byte load at +1", () => {
    const { text, hasErrors, diags } = lowerRealSource(
      "module Main;\nfunction main(): void { let w: word = $1234;" +
        " let l: byte = lo(w); let h: byte = hi(w); poke($C000, l); poke($C001, h); }\n",
    );
    expect(hasErrors).toBe(false);
    expect(diags.map((d) => d.code)).not.toContain("E10045");

    // lo(w): the 16-bit operand truncates to its low byte.
    expect(text).toContain("trunc");
    // hi(w): a byte load from the variable's storage location, offset +1 —
    // the high byte of a little-endian word.
    expect(text).toMatch(/load i8u __frame_Main_main_w\+1/);
  });

  it("should treat lo() of a byte value as the value itself (identity)", () => {
    const { hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let b: byte = 5;" +
        " let l: byte = lo(b); poke($C000, l); }\n",
    );
    expect(hasErrors).toBe(false);
  });
});
