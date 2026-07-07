/**
 * Implementation tests for CFG lowering: nested loops, `else if` chains,
 * `downto` (ge/sub), and the Pattern-B full-range guard (records an ICE for
 * `0 to 255`, never throws). Covers internals/edges the spec cases do not pin.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, IceCode } from "@blend65/core";
import type { ProgramNode } from "@blend65/core";
import { analyze, lex, modelToFunctionInfo, modelToModuleVars, parse, planAllocation } from "@blend65/frontend";
import { printIL } from "./print-il.js";
import { lowerToIL } from "./lower.js";

function lowerReal(source: string): { text: string; iceCount: number; threw: boolean } {
  const bag = createDiagnosticBag();
  let text = "";
  let threw = false;
  try {
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
    text = printIL(lowerToIL({ program: [ast], model, plan }, bag));
  } catch {
    threw = true;
  }
  const iceCount = bag.getAll().filter((d) => d.code === IceCode.Unexpected).length;
  return { text, iceCount, threw };
}

describe("RD-18 Slice 4a CFG lowering internals (P2)", () => {
  it("lowers nested loops without an ICE (each loop gets its own cond/body/end)", () => {
    const { text, iceCount, threw } = lowerReal(
      "module Main;\nfunction main(): void { let a: byte = 1; let b: byte = 1;" +
        " while (a > 0) { while (b > 0) { b = b - 1; } a = a - 1; } }\n",
    );
    expect(threw).toBe(false);
    expect(iceCount).toBe(0);
    // Two loops → at least two brcond terminators.
    expect((text.match(/brcond/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("lowers an else-if chain to multiple brcond, no ICE", () => {
    const { text, iceCount } = lowerReal(
      "module Main;\nfunction main(): void { let n: byte = 1;" +
        " if (n > 2) { poke(0xC000, 1); } else if (n > 1) { poke(0xC000, 2); } else { poke(0xC000, 3); } }\n",
    );
    expect(iceCount).toBe(0);
    expect((text.match(/brcond/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("lowers a downto for-loop with ge compare + sub increment", () => {
    const { text, iceCount } = lowerReal(
      "module Main;\nlet sum: byte;\nfunction main(): void {" +
        " for (let i: byte = 5 downto 1) { sum = sum + i; } }\n",
    );
    expect(iceCount).toBe(0);
    expect(text).toContain("ge i8u"); // downto → continue while counter >= bound
    expect(text).toContain("sub i8u"); // downto → decrement
  });

  it("records an ICE (never throws) for the Pattern-B full-range 'to 255' (AR-6)", () => {
    const { iceCount, threw } = lowerReal(
      "module Main;\nfunction main(): void { for (let i: byte = 0 to 255) {} }\n",
    );
    expect(threw).toBe(false);
    expect(iceCount).toBeGreaterThanOrEqual(1); // Pattern-B wrap deferred → ICE
  });
});
