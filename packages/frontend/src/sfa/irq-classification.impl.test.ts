/**
 * Implementation tests for the interrupt-reachability classification
 * internals: installing a handler with `&` must NOT drain the
 * interrupt-only set (taking a handler's address is how it gets installed —
 * handlers are excluded from the mainline escape roots), an exported helper
 * whose only caller is a handler stays interrupt-only, an escaped PLAIN
 * function is a mainline root (its address may be called from mainline
 * through a platform seam), and the irq scratch predicate's arms.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { FunctionInfo, ProgramNode } from "@blend65/core";
import { lex, parse } from "../index.js";
import { analyze } from "../semantics/analyze.js";
import { modelNeedsIrqPointerScratch, modelToFunctionInfo } from "./model-adapter.js";

/** Analyzes sources and projects the planner inputs. */
function project(sources: string[]): {
  infos: FunctionInfo[];
  needsIrqScratch: boolean;
  hasErrors: boolean;
} {
  const bag = createDiagnosticBag();
  const programs: ProgramNode[] = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  return {
    infos: modelToFunctionInfo(model),
    needsIrqScratch: modelNeedsIrqPointerScratch(model),
    hasErrors: bag.hasErrors(),
  };
}

/** The projected info for one fully-qualified name, or a loud failure. */
function infoOf(infos: FunctionInfo[], name: string): FunctionInfo {
  const info = infos.find((f) => f.name === name);
  if (info === undefined) throw new Error(`no projection for ${name}`);
  return info;
}

describe("irq-classification internals", () => {
  it("installing a handler with & keeps its helpers interrupt-only (escaped handlers are not mainline roots)", () => {
    const { infos, hasErrors } = project([
      [
        "module Main;",
        "interrupt function onIRQ() { bump(); }",
        "function bump(): void { let a: byte = 1; a = a + 1; }",
        "function main(): void { pokew($FFFE, &onIRQ); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(infoOf(infos, "Main.onIRQ").isEscaped).toBe(true);
    expect(infoOf(infos, "Main.onIRQ").isIrqReachable).toBe(true);
    expect(infoOf(infos, "Main.bump").isIrqOnly).toBe(true);
  });

  it("an exported helper whose only caller is a handler stays interrupt-only", () => {
    const { infos, hasErrors } = project([
      ["module Snd;", "export function tick(): void { let a: byte = 1; a = a + 1; }"].join("\n"),
      [
        "module Main;",
        "import { tick } from Snd;",
        "interrupt function onIRQ() { tick(); }",
        "function main(): void { }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(infoOf(infos, "Snd.tick").isIrqOnly).toBe(true);
  });

  it("an escaped PLAIN function is a mainline root — its subtree is never interrupt-only", () => {
    const { infos, hasErrors } = project([
      [
        "module Main;",
        "interrupt function onIRQ() { helper(); }",
        "function helper(): void { leaf(); }",
        "function leaf(): void { let a: byte = 1; a = a + 1; }",
        "function main(): void { let h: word = &helper; }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(infoOf(infos, "Main.helper").isIrqOnly).toBeFalsy();
    expect(infoOf(infos, "Main.leaf").isIrqOnly).toBeFalsy();
    expect(infoOf(infos, "Main.helper").isIrqReachable).toBe(true);
  });

  it("the irq scratch predicate stays false without interrupt-only formation demand", () => {
    const noIrq = project([
      ["module Main;", "function main(): void { let a: byte = 1; a = a + 1; }"].join("\n"),
    ]);
    expect(noIrq.needsIrqScratch).toBe(false);

    const irqNoFormation = project([
      [
        "module Main;",
        "let n: byte = 0;",
        "interrupt function h() { n = n + 1; }",
        "function main(): void { }",
      ].join("\n"),
    ]);
    expect(irqNoFormation.needsIrqScratch).toBe(false);
  });

  it("the irq scratch predicate's conservative arm fires on big-array storage with interrupt-only code", () => {
    const { needsIrqScratch, hasErrors } = project([
      [
        "module Main;",
        "let big: byte[300];",
        "let n: byte = 0;",
        "interrupt function h() { bump(); }",
        "function bump(): void { n = n + 1; }",
        "function main(): void { }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(needsIrqScratch).toBe(true);
  });
});
