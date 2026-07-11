/**
 * Specification golden for end-to-end runtime assembly.
 *
 * Written from the requirement, never from the implementation: a program
 * exercising a byte `*`, a word `/`, and a byte `%` assembles through the real
 * ACME to a binary with zero unresolved symbols (ACME fails on any unresolved
 * reference, so a successful exit is itself the oracle), with all three
 * referenced runtime routines embedded and the unreferenced one dead-stripped.
 *
 * Skip-if-no-ACME mirrors the ACME process-layer convention used elsewhere in
 * this package.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createDiagnosticBag, RT_ROUTINES } from "@blend65/core";
import type { AllocationPlan, SymbolDefinition } from "@blend65/core";
import {
  IL_BYTE,
  IL_WORD,
  assembleProgram,
  buildRuntimeSection,
  collectReferencedRoutines,
  loc,
  serializeToAcme,
  temp,
  type ILInstruction,
  type ILProgram,
} from "@blend65/codegen";
import { c64Plugin } from "@blend65/platforms";

/** Resolve ACME from PATH (null → tests are skipped). */
function findAcme(): string | null {
  try {
    const out = execFileSync("which", ["acme"], { encoding: "utf8" }).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

const ACME = findAcme();
const WORK_DIR = mkdtempSync(join(tmpdir(), "blend65-rt-golden-"));

afterAll(() => {
  rmSync(WORK_DIR, { recursive: true, force: true });
});

/** Every symbol the hand-built IL references, at arbitrary distinct addresses. */
const SYMBOLS: readonly SymbolDefinition[] = [
  { name: "__zp_arg_0", value: 0x02 },
  { name: "__zp_arg_1", value: 0x03 },
  { name: "__zp_arg_2", value: 0x04 },
  { name: "__zp_arg_3", value: 0x05 },
  { name: "a", value: 0xc000 },
  { name: "b", value: 0xc001 },
  { name: "r", value: 0xc002 }, // word
  { name: "c", value: 0xc004 }, // word
  { name: "d", value: 0xc006 }, // word
  { name: "q", value: 0xc008 }, // word
  { name: "e", value: 0xc00a },
  { name: "f", value: 0xc00b },
  { name: "m", value: 0xc00c },
];

/** A plan whose symbol header defines everything the code references. */
function planOf(): AllocationPlan {
  return {
    frames: new Map(),
    dataBase: 0,
    frameRegionBase: 0,
    frameRegionSize: 0,
    peakSimultaneous: 0,
    sharingSaved: 0,
    zpAllocations: [],
    zpUsed: 0,
    zpBudget: 256,
    moduleVariables: [],
    moduleVariablesSize: 0,
    stackAnalysis: {
      maxMainDepth: 0,
      maxMainStackBytes: 0,
      maxIrqDepth: 0,
      maxIrqStackBytes: 0,
      irqOverhead: 0,
      totalWorstCase: 0,
      platformBudget: 256,
      exceedsWarningThreshold: false,
    },
    symbolDefinitions: [...SYMBOLS],
    resourceData: {
      frameRegionBytes: 0,
      frameRegionPeak: 0,
      frameSharingSaved: 0,
      zpUsed: 0,
      zpBudget: 256,
      ramUsed: 0,
      ramBudget: 0,
      stackWorstCase: 0,
      stackBudget: 256,
    },
    hasErrors: false,
  };
}

/** `r = a * b` (bytes), `q = c / d` (words), `m = e % f` (bytes). */
const BODY: readonly ILInstruction[] = [
  { op: "mul", dest: temp(0, IL_WORD), left: loc("a", IL_BYTE), right: loc("b", IL_BYTE), type: IL_BYTE },
  { op: "store", a: temp(0, IL_WORD), b: loc("r", IL_WORD) },
  { op: "div", dest: temp(1, IL_WORD), left: loc("c", IL_WORD), right: loc("d", IL_WORD), type: IL_WORD },
  { op: "store", a: temp(1, IL_WORD), b: loc("q", IL_WORD) },
  { op: "mod", dest: temp(2, IL_BYTE), left: loc("e", IL_BYTE), right: loc("f", IL_BYTE), type: IL_BYTE },
  { op: "store", a: temp(2, IL_BYTE), b: loc("m", IL_BYTE) },
];

function ilProgram(): ILProgram {
  return {
    functions: [
      {
        name: "main",
        params: [],
        returnType: "void",
        blocks: [{ label: "_entry", instructions: [...BODY], terminator: { kind: "ret" } }],
        tempCount: 8,
        isInterrupt: false,
      },
    ],
    initCode: [], initTempCount: 0,
    constData: [],
    allocationPlan: planOf(),
  };
}

describe.skipIf(ACME === null)("Specification: RD-17 E2E runtime assembly (ST-33, AC-19)", () => {
  it("byte *, word /, byte % assemble via ACME to a binary with zero unresolved symbols", () => {
    const bag = createDiagnosticBag();
    const program = assembleProgram(ilProgram(), c64Plugin, bag);
    expect(bag.getAll().filter((d) => d.code.startsWith("E9"))).toEqual([]);

    // Exactly the three used routines are referenced; mul16 is dead-stripped.
    const referenced = collectReferencedRoutines(program, RT_ROUTINES);
    expect([...referenced].sort()).toEqual(["__rt_div16", "__rt_div8", "__rt_mul8"]);

    const section = buildRuntimeSection(referenced, RT_ROUTINES);
    const text = serializeToAcme(program, { runtimeSection: section ?? "" });
    expect(text).not.toContain("__rt_mul16:"); // dead-strip: unreferenced routines are not embedded

    // Assemble for real: ACME exits non-zero on any unresolved symbol.
    const asmPath = join(WORK_DIR, "rt-golden.asm");
    writeFileSync(asmPath, text, "utf8");
    execFileSync(ACME ?? "acme", [asmPath], { cwd: WORK_DIR, encoding: "utf8" });

    // The c64 `!to` directive names the binary; it must exist and be non-empty.
    const prg = join(WORK_DIR, "main.prg");
    expect(existsSync(prg), "expected ACME to produce main.prg").toBe(true);
    expect(statSync(prg).size).toBeGreaterThan(2); // beyond the PRG load header
  });
});
