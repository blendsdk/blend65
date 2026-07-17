/**
 * Specification tests for interrupt-path frame correctness — frozen spec
 * Ch 06 §7.4/§7.5 and Ch 11 §4. An interrupt fires asynchronously, so every
 * function reachable from a handler may run while ANY mainline function is
 * live: handler-subtree frames must never overlap mainline frames, two
 * handlers' subtrees must stay mutually disjoint (an NMI can preempt an
 * IRQ), and a by-ref parameter's zero-page pair on an interrupt-only
 * function must not share bytes with a mainline pair. A function shared by
 * both paths keeps its single static frame — the documented, unenforced
 * reentrancy hazard — and still compiles. Programs with no interrupts
 * classify empty and keep today's layout byte-for-byte.
 *
 * Expectations derive from the frozen spec only. Programs run through the
 * real pipeline: `lex` → `parse` → `analyze` → projection → `planAllocation`.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { AllocationPlan, Diagnostic, ProgramNode } from "@blend65/core";
import { lex, parse } from "../index.js";
import { analyze } from "../semantics/analyze.js";
import {
  modelNeedsPointerScratch,
  modelToFunctionInfo,
  modelToModuleVars,
} from "./model-adapter.js";
import { planAllocation } from "./plan-allocation.js";
import type { FunctionInfo } from "@blend65/core";

/** Analyzes + plans sources through the real pipeline. */
function planReal(sources: string[]): {
  plan: AllocationPlan;
  infos: FunctionInfo[];
  diags: Diagnostic[];
  hasErrors: boolean;
} {
  const bag = createDiagnosticBag();
  const programs: ProgramNode[] = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  const infos = modelToFunctionInfo(model);
  const plan = planAllocation(
    {
      functions: infos,
      moduleVars: modelToModuleVars(model),
      zpUserVars: [],
      upstreamErrors: bag.hasErrors(),
      needsPointerScratch: modelNeedsPointerScratch(model),
    },
    DEFAULT_PROFILE,
    bag,
  );
  return { plan, infos, diags: bag.getAll(), hasErrors: bag.hasErrors() };
}

/** The half-open byte interval a function's frame occupies. */
function frameInterval(plan: AllocationPlan, name: string): { start: number; end: number } {
  const alloc = plan.frames.get(name);
  expect(alloc, `frame for ${name}`).toBeDefined();
  return { start: alloc!.offset, end: alloc!.offset + alloc!.frame.totalSize };
}

/** Whether two half-open intervals overlap. */
function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

describe("interrupt-path frame placement (ST-17..ST-19, ST-23)", () => {
  it("ST-17: a handler's helper frame never overlaps a mainline frame", () => {
    const { plan, infos, hasErrors } = planReal([
      [
        "module Main;",
        "interrupt function h() { bump(); }",
        "function bump(): void { let a: byte = 1; a = a + 1; }",
        "function work(): void { let b: byte = 2; b = b + 1; }",
        "function main(): void { work(); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(infos.find((f) => f.name === "Main.bump")?.isIrqOnly).toBe(true);
    expect(infos.find((f) => f.name === "Main.work")?.isIrqOnly).toBeFalsy();
    expect(
      overlaps(frameInterval(plan, "Main.bump"), frameInterval(plan, "Main.work")),
    ).toBe(false);
  });

  it("ST-18: a function shared by both paths compiles with ONE frame home", () => {
    const { plan, infos, hasErrors } = planReal([
      [
        "module Main;",
        "interrupt function h() { shared(); }",
        "function shared(): void { let s: byte = 1; s = s + 1; }",
        "function main(): void { shared(); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const shared = infos.find((f) => f.name === "Main.shared");
    expect(shared?.isIrqReachable).toBe(true);
    expect(shared?.isIrqOnly).toBeFalsy();
    expect(plan.frames.get("Main.shared")).toBeDefined();
  });

  it("ST-19: two handlers' helper subtrees stay mutually disjoint (NMI can preempt IRQ)", () => {
    const { plan, hasErrors } = planReal([
      [
        "module Main;",
        "interrupt function h1() { g1(); }",
        "interrupt function h2() { g2(); }",
        "function g1(): void { let a: byte = 1; a = a + 1; }",
        "function g2(): void { let b: byte = 2; b = b + 1; }",
        "function main(): void { }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(overlaps(frameInterval(plan, "Main.g1"), frameInterval(plan, "Main.g2"))).toBe(false);
  });

  it("ST-23: a program with no interrupts classifies empty (layout untouched)", () => {
    const { infos, hasErrors } = planReal([
      [
        "module Main;",
        "function work(): void { let b: byte = 2; b = b + 1; }",
        "function main(): void { work(); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    for (const info of infos) {
      expect(info.isIrqReachable).toBeFalsy();
      expect(info.isIrqOnly).toBeFalsy();
    }
  });
});

describe("interrupt-path pointer pairs (ST-24)", () => {
  it("ST-24: an irq-only function's by-ref pair never shares bytes with a mainline pair", () => {
    const { plan, hasErrors } = planReal([
      [
        "module Main;",
        "struct Pos { x: byte; y: byte; }",
        "let hpos: Pos;",
        "let mpos: Pos;",
        "interrupt function h() { g(hpos); }",
        "function g(p: Pos): void { p.x = 1; }",
        "function f(q: Pos): void { q.x = 2; }",
        "function main(): void { f(mpos); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const gPair = plan.symbolDefinitions.find((s) => s.name === "__zp_ptr_Main_g_p");
    const fPair = plan.symbolDefinitions.find((s) => s.name === "__zp_ptr_Main_f_q");
    expect(gPair).toBeDefined();
    expect(fPair).toBeDefined();
    expect(gPair!.value).not.toBe(fPair!.value);
  });
});
