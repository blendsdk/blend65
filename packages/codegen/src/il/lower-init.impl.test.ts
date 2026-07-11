/**
 * Implementation tests for module-initializer lowering internals — the temp
 * count the init stream carries into translation, the printed `__init`
 * section (present with initializers, byte-absent without), the loud
 * no-frame-fallback guard inside the init lowering context, the word-store
 * shape, and the instr layer's conditional `__init` stream (present first
 * with initializers; byte-identical stream set without).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, IceCode } from "@blend65/core";
import type {
  Diagnostic,
  DiagnosticBag,
  IdentExprNode,
  LetDeclNode,
  ProgramNode,
  SemanticModel,
} from "@blend65/core";
import {
  analyze,
  lex,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";

import { lowerToIL } from "./lower.js";
import { printIL } from "./print-il.js";
import type { ILProgram } from "./cfg.js";
import { generateInstr } from "../instr/instr-program.js";

/** Parses + analyzes + plans `sources`, returning everything lowering needs. */
function frontend(sources: readonly string[]): {
  programs: ProgramNode[];
  model: SemanticModel;
  plan: ReturnType<typeof planAllocation>;
  bag: DiagnosticBag;
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
  return { programs, model, plan, bag };
}

/** Full frontend + lowering over `sources`. */
function lowerSource(sources: readonly string[]): {
  program: ILProgram;
  diags: Diagnostic[];
} {
  const { programs, model, plan, bag } = frontend(sources);
  const program = lowerToIL({ program: programs, model, plan }, bag);
  return { program, diags: bag.getAll() };
}

const WITH_DEPENDENT_INIT =
  "module Main;\n" +
  "let a: byte = 2;\n" +
  "let b: byte = a + 1;\n" +
  "function main(): void { poke($C000, b); }\n";

const WITHOUT_INIT =
  "module Main;\n" + "let a: byte;\n" + "function main(): void { poke($C000, a); }\n";

describe("module-initializer lowering internals", () => {
  it("carries the init stream's temp count for the translator's prescan", () => {
    const { program, diags } = lowerSource([WITH_DEPENDENT_INIT]);
    expect(diags).toEqual([]);
    // `b`'s initializer loads `a` into a temp and adds into another.
    expect(program.initTempCount).toBeGreaterThanOrEqual(2);
  });

  it("prints an __init section first when initializers exist, and nothing extra when not", () => {
    const withInit = lowerSource([WITH_DEPENDENT_INIT]);
    const text = printIL(withInit.program);
    expect(text.startsWith("function __init(): void {")).toBe(true);
    expect(text).toContain("store 2, __var_Main_a");

    const without = lowerSource([WITHOUT_INIT]);
    expect(printIL(without.program)).not.toContain("__init");
  });

  it("stores a word initializer as one word-typed store inside __init", () => {
    const { program, diags } = lowerSource([
      "module Main;\n" + "let w: word = $0102;\n" + "function main(): void {}\n",
    ]);
    expect(diags).toEqual([]);
    const store = program.initCode[0].instructions.find((i) => i.op === "store");
    if (store === undefined || store.op !== "store") throw new Error("expected a store");
    expect(store.a.kind).toBe("immediate");
    expect(store.a.type.width).toBe(16);
    if (store.b.kind === "location") expect(store.b.symbol).toBe("__var_Main_w");
  });

  it("fails loudly (never the frame path) when an init reference cannot resolve", () => {
    const { programs, model, plan } = frontend([WITH_DEPENDENT_INIT]);

    // Locate the `a` reference inside `b`'s initializer, then present a model
    // whose symbol map cannot resolve it — the init context has no frame, so
    // the lowering must reject rather than fabricate a frame slot.
    const letB = programs[0].items.find(
      (i): i is LetDeclNode => i.kind === "LetDecl" && i.name === "b",
    );
    if (letB?.initialiser == null || letB.initialiser.kind !== "BinaryExpr") {
      throw new Error("fixture must declare 'let b = a + 1'");
    }
    const aRef = letB.initialiser.left as IdentExprNode;
    const doctored: SemanticModel = {
      ...model,
      typeOf: (e) => model.typeOf(e),
      symbolOf: (n) => (n === aRef ? null : model.symbolOf(n)),
      scopeOf: (n) => model.scopeOf(n),
    };

    const bag = createDiagnosticBag();
    lowerToIL({ program: programs, model: doctored, plan }, bag);
    const ices = bag.getAll().filter((d) => d.code === IceCode.Unexpected);
    expect(ices.length).toBeGreaterThanOrEqual(1);
    expect(ices[0].message).toContain("module-initializer reference");
  });

  it("emits the __init stream first at the instr layer only when initializers exist", () => {
    const withInit = lowerSource([WITH_DEPENDENT_INIT]);
    const bag = createDiagnosticBag();
    const instr = generateInstr(withInit.program, "nmos6502", bag);
    expect(instr.streams[0]?.symbol).toBe("__init");

    const without = lowerSource([WITHOUT_INIT]);
    const bag2 = createDiagnosticBag();
    const instr2 = generateInstr(without.program, "nmos6502", bag2);
    expect(instr2.streams.map((s) => s.symbol)).not.toContain("__init");
    expect(instr2.streams).toHaveLength(without.program.functions.length);
  });
});
