import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProjectOverlay, loadProject } from "../frontend/index.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import type { LoadOperation, SemanticBlock, SemanticOperation } from "../semantic/operations.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { selectTargetProfile } from "../target/profile.js";
import {
  BYTE,
  VOID,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceSpan,
} from "./lowering-test-support.js";
import { boundedCounterLoads, proveSpritePublications } from "./sprite-publication-proof.js";

describe("bounded publication proof scaling", () => {
  it("should replay a common counter suffix only when its joined fact changes", () => {
    const root = sourceBinding(81000);
    const span = sourceSpan(81001);
    const loads: LoadOperation[] = Array.from({ length: 5000 }, (_, index) => ({
      kind: "load",
      result: `sample.${index}`,
      place: { root, path: [] },
      type: BYTE,
      integer: { width: 8, signed: false, wrap: true },
      span,
    }));
    const entry: SemanticOperation[] = [
      {
        kind: "constant",
        result: "zero",
        value: 0n,
        type: BYTE,
        integer: { width: 8, signed: false, wrap: true },
        span,
      },
      {
        kind: "constant",
        result: "choice",
        value: true,
        type: { kind: "scalar", name: "boolean" },
        integer: null,
        span,
      },
      { kind: "store", place: { root, path: [] }, value: "zero", type: BYTE, span },
    ];
    const branches: SemanticBlock[] = Array.from({ length: 500 }, (_, index) =>
      semanticBlock(`choice.${index}`, [], {
        kind: "branch",
        condition: "choice",
        whenTrue: "suffix",
        whenFalse: index === 499 ? "suffix" : `choice.${index + 1}`,
      }),
    );
    const source = semanticFunction(81000, "main", [], VOID, [
      semanticBlock("entry", entry, { kind: "jump", target: "choice.0" }),
      ...branches,
      semanticBlock("suffix", loads, { kind: "return", value: null }),
    ]);
    let visits = 0;
    const certified = boundedCounterLoads(source, root, 4n, () => {
      visits += 1;
      return false;
    });
    expect(certified.size).toBe(loads.length);
    // One converged transfer and one recording walk suffice for this unchanged join.
    expect(visits).toBe(2 * (entry.length + loads.length));
  });

  it("should prove a chain of private roots across separate conditional blocks", async () => {
    const project = fileURLToPath(
      new URL("../../../../examples/boing-ball/blend65.json", import.meta.url),
    );
    const loaded = await loadProject({ project });
    if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
    const roots = Array.from(
      { length: 600 },
      (_, index) => `
      let r${index}: byte = ${index === 0 ? "base" : `r${index - 1}`};
      if (peek($DC00) != 0) { poke($D020, 0); }`,
    ).join("\n");
    const text = `module Main;
      const BALL: byte[] = embed("ball.bin");
      function main(): void {
        let base: byte = c64.vic.vicSpriteBlock(&BALL);
        ${roots}
        poke($07F8, r599); poke($D015, 1);
        while (peek($D012) != 251) {}
      }`;
    const analysis = await analyzeProjectOverlay(loaded.snapshot, [
      { sourceId: "src/main.blend", text },
    ]);
    if (analysis.kind !== "complete") throw new Error(JSON.stringify(analysis.diagnostics));
    const semantic = buildSemanticProgram(analysis);
    if (semantic.kind !== "complete") throw new Error(JSON.stringify(semantic));
    const selected = selectTargetProfile(loaded.snapshot.effectiveTarget);
    if (selected.kind !== "complete") throw new Error("Expected a cooperative profile");
    const closed = closeWholeProgram(
      semantic.program,
      selected.profile.interrupts,
      selected.profile.storage,
    );
    if (closed.kind !== "complete") throw new Error(JSON.stringify(closed.diagnostics));
    const source = closed.program.semantic.functions[0]!;
    expect(
      proveSpritePublications({ program: closed.program, profile: selected.profile }, source) !==
        null,
    ).toBe(true);
  });
});
