/**
 * Specification tests for interrupt-path zero-page separation — frozen spec
 * Ch 06 §7.6: the compiler must give interrupt-path code its own ZP
 * workspace. Spills inside an interrupt-only function draw from the
 * `__zp_irq_tmp_*` pool (mainline functions keep `__zp_tmp_*` — separation
 * cuts both ways), and runtime pointer formation inside an interrupt-only
 * function stages through the dedicated `__zp_irq_ptr_scratch` pair while
 * mainline formation keeps `__zp_ptr_scratch`. The irq pair is reserved
 * only when some interrupt-only function actually needs formation.
 *
 * Derived exclusively from the specification — never from reading the
 * implementation (immutable oracle rule).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { AllocationPlan, ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelNeedsIrqPointerScratch,
  modelNeedsPointerScratch,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";
import { IL_BYTE, IL_WORD } from "../il/il-type.js";
import { imm, loc, temp } from "../il/operand.js";
import type { ILFunction, ILProgram } from "../il/cfg.js";
import { printIL } from "../il/print-il.js";
import { lowerToIL } from "../il/lower.js";
import { isInstr } from "./stream.js";
import type { StreamEntry } from "./stream.js";
import { translateFunction } from "./translate.js";

type InstrEntry = Extract<StreamEntry, { type: "instr" }>;

/** A plan carrying both temp pools (and, optionally, an irq-only set). */
function pooledPlan(irqOnlyFunctions?: ReadonlySet<string>): AllocationPlan {
  return {
    frames: new Map(),
    dataBase: 0,
    frameRegionBase: 0,
    frameRegionSize: 0,
    peakSimultaneous: 0,
    sharingSaved: 0,
    zpAllocations: [
      { name: "__zp_tmp_0", address: 0x10, size: 1, category: "temp" },
      { name: "__zp_tmp_1", address: 0x11, size: 1, category: "temp" },
      { name: "__zp_irq_tmp_0", address: 0x12, size: 1, category: "irq-temp" },
      { name: "__zp_irq_tmp_1", address: 0x13, size: 1, category: "irq-temp" },
    ],
    zpUsed: 4,
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
    symbolDefinitions: [],
    resourceData: {
      frameRegionBytes: 0,
      frameRegionPeak: 0,
      frameSharingSaved: 0,
      zpUsed: 4,
      zpBudget: 256,
      ramUsed: 0,
      ramBudget: 0,
      stackWorstCase: 0,
      stackBudget: 256,
    },
    hasErrors: false,
    ...(irqOnlyFunctions !== undefined ? { irqOnlyFunctions } : {}),
  };
}

/**
 * A function whose body forces one spill: a live accumulator-resident
 * constant survives across a multiply (the runtime-routine call clobbers
 * A/X, so the translator spills the live temp to a ZP scratch slot first).
 */
function spillingFn(name: string): ILFunction {
  return {
    name,
    params: [],
    returnType: "void",
    blocks: [
      {
        label: "_entry",
        instructions: [
          { op: "const", dest: temp(0, IL_BYTE), src: imm(5, IL_BYTE) },
          { op: "mul", dest: temp(1, IL_WORD), left: loc("a", IL_BYTE), right: loc("b", IL_BYTE), type: IL_BYTE },
          { op: "store", a: temp(1, IL_WORD), b: loc("r", IL_WORD) },
          { op: "store", a: temp(0, IL_BYTE), b: loc("s", IL_BYTE) },
        ],
        terminator: { kind: "ret" },
      },
    ],
    tempCount: 2,
    isInterrupt: false,
  };
}

/** Translate and return the STA target symbols (the spill destinations). */
function staTargets(fn: ILFunction, plan: AllocationPlan): string[] {
  const bag = createDiagnosticBag();
  const stream = translateFunction(fn, plan, "nmos6502", bag);
  expect(bag.hasErrors()).toBe(false);
  return stream.entries
    .filter(isInstr)
    .filter((i: InstrEntry) => i.opcode === "STA")
    .map((i: InstrEntry) => {
      const op = i.operand;
      return op.kind === "symbolRef" || op.kind === "zpSlot" ? op.name : "";
    });
}

describe("interrupt-only spill pool separation (ST-20, ST-21)", () => {
  it("ST-20: a spill inside an interrupt-only function targets __zp_irq_tmp_*", () => {
    const targets = staTargets(
      spillingFn("Main.g"),
      pooledPlan(new Set(["Main.g"])),
    );
    expect(targets).toContain("__zp_irq_tmp_0");
    expect(targets).not.toContain("__zp_tmp_0");
  });

  it("ST-21: a mainline spill in the same program stays in __zp_tmp_* (separation both ways)", () => {
    const targets = staTargets(spillingFn("Main.work"), pooledPlan(new Set(["Main.g"])));
    expect(targets).toContain("__zp_tmp_0");
    expect(targets).not.toContain("__zp_irq_tmp_0");
  });
});

/** Lowers sources through the real frontend with the irq scratch predicate wired. */
function lowerReal(sources: string[]): {
  text: string;
  il: ILProgram;
  plan: AllocationPlan;
  hasErrors: boolean;
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
      needsPointerScratch: modelNeedsPointerScratch(model),
      needsIrqPointerScratch: modelNeedsIrqPointerScratch(model),
    },
    DEFAULT_PROFILE,
    bag,
  );
  const il = lowerToIL({ program: programs, model, plan }, bag);
  return { text: printIL(il), il, plan, hasErrors: bag.hasErrors() };
}

/** The printed text of one function (from its header to the next function). */
function fnText(text: string, fqName: string): string {
  const start = text.indexOf(`function ${fqName}`);
  expect(start, `function ${fqName} not found in IL text`).toBeGreaterThanOrEqual(0);
  const next = text.indexOf("\nfunction ", start + 1);
  return next === -1 ? text.slice(start) : text.slice(start, next);
}

const FORMATION_PROGRAM = [
  "module Main;",
  "struct Pos { x: byte; y: byte; }",
  "struct Enemy { hp: byte; pos: Pos; }",
  "let boss: Enemy;",
  "let mate: Enemy;",
  "interrupt function h() { g(boss); }",
  "function g(e: Enemy): void { g2(e.pos); }",
  "function f(e: Enemy): void { g2(e.pos); }",
  "function g2(p: Pos): void { p.x = 1; }",
  "function main(): void { f(mate); }",
].join("\n");

describe("interrupt-only formation scratch twin (ST-22)", () => {
  it("ST-22: irq-only formation uses __zp_irq_ptr_scratch; mainline formation keeps __zp_ptr_scratch", () => {
    const { text, plan, hasErrors } = lowerReal([FORMATION_PROGRAM]);
    expect(hasErrors).toBe(false);
    expect(plan.symbolDefinitions.some((s) => s.name === "__zp_irq_ptr_scratch")).toBe(true);
    const g = fnText(text, "Main.g");
    expect(g).toContain("__zp_irq_ptr_scratch");
    expect(g).not.toContain("__zp_ptr_scratch");
    const f = fnText(text, "Main.f");
    expect(f).toContain("__zp_ptr_scratch");
    expect(f).not.toContain("__zp_irq_ptr_scratch");
  });

  it("ST-22: the irq pair is NOT reserved when no interrupt-only function needs formation", () => {
    const { plan, hasErrors } = lowerReal([
      [
        "module Main;",
        "let n: byte = 0;",
        "interrupt function h() { n = n + 1; }",
        "function main(): void { }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(plan.symbolDefinitions.some((s) => s.name === "__zp_irq_ptr_scratch")).toBe(false);
  });
});
