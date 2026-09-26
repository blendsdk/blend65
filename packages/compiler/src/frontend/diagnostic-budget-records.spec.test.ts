import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeModules } from "./analyzer.js";
import { indexModules, resolveModules } from "./modules.js";

/** Reduced counters exercise the production evaluator's boundary records without expensive loops. */
interface BudgetLimits {
  readonly maxSteps: number;
  readonly maxLiveBytes: number;
  readonly maxActiveCalls: number;
}

function hash(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Resolve a real source module before invoking the existing test-only evaluator-limit seam. */
function analyze(text: string, limits?: BudgetLimits) {
  const source: SourceRecord = {
    sourceId: "game.blend",
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text),
    resolvedPath: "/checkout/game.blend",
  };
  const project: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "budget-records",
      sourceRoot: "src",
      entry: "Game",
      target: "test.target",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      sha256: hash("{}"),
      byteLength: 2,
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source],
    inputSha256: hash(text),
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: "test.target",
    effectiveEntry: "Game",
  };
  const indexed = indexModules(project);
  const resolved = resolveModules(project, indexed.index);
  if (resolved.graph === null) throw new Error("Expected a resolved budget-test module");
  return analyzeModules(project, resolved.graph, null, undefined, limits);
}

/** Locate one source spelling as UTF-8 bytes; expected spans never come from evaluator output. */
function span(text: string, proof: string, occurrence = 0) {
  let index = -1;
  for (let count = 0; count <= occurrence; count += 1) index = text.indexOf(proof, index + 1);
  if (index < 0) throw new Error(`Missing proof ${proof}`);
  const start = Buffer.byteLength(text.slice(0, index));
  return { sourceId: "game.blend", start, end: start + Buffer.byteLength(proof) };
}

describe("canonical compile-time budget records", () => {
  // Each literal root costs one selected expression step, in qualified-name order.
  it("should report E10269 before the second root exceeds the shared step counter", () => {
    const source =
      "module Game; const FIRST: byte = 1; const SECOND: byte = 2; function main(): void {}";
    const result = analyze(source, { maxSteps: 1, maxLiveBytes: 16_777_216, maxActiveCalls: 512 });
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.complete).toBe(false);
    expect(errors.map(({ code }) => code)).toEqual(["E10269"]);
    expect(errors[0]).toMatchObject({
      code: "E10269",
      severity: "error",
      pointer: null,
      message: expect.stringMatching(
        /^Compile-time evaluation step budget exceeded — 'comptime-budget-v1' allows 1 steps; attempted step 2 while evaluating root '[^']*SECOND'$/u,
      ),
      primarySpan: span(source, "2"),
    });
    expect(errors[0]?.related.map(({ span: related }) => related)).toEqual([span(source, "2")]);
  });

  // The retained scalar and its literal temporary overlap, giving a logical peak of two bytes.
  it("should report E10270 before allocating the second live scalar byte", () => {
    const source = "module Game; const VALUE: byte = 1; function main(): void {}";
    const result = analyze(source, { maxSteps: 16_777_216, maxLiveBytes: 1, maxActiveCalls: 512 });
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.complete).toBe(false);
    expect(errors.map(({ code }) => code)).toEqual(["E10270"]);
    expect(errors[0]).toMatchObject({
      code: "E10270",
      severity: "error",
      pointer: null,
      message: expect.stringMatching(
        /^Compile-time evaluation memory budget exceeded — 'comptime-budget-v1' allows 1 live logical bytes; allocating 1 bytes would require 2 while evaluating root '[^']*VALUE'$/u,
      ),
      primarySpan: span(source, "1"),
    });
    expect(errors[0]?.related.map(({ span: related }) => related)).toEqual([span(source, "1")]);
  });

  // The rejected nested call is primary; the original root invocation provides the useful context.
  it("should report E10271 at the nested call that would enter depth two", () => {
    const source =
      "module Game; comptime function inner(): byte { return 7; } comptime function outer(): byte { return inner(); } const VALUE: byte = outer(); function main(): void {}";
    const result = analyze(source, {
      maxSteps: 16_777_216,
      maxLiveBytes: 16_777_216,
      maxActiveCalls: 1,
    });
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.complete).toBe(false);
    expect(errors.map(({ code }) => code)).toEqual(["E10271"]);
    expect(errors[0]).toMatchObject({
      code: "E10271",
      severity: "error",
      pointer: null,
      message: expect.stringMatching(
        /^Compile-time call-depth budget exceeded — 'comptime-budget-v1' allows 1 active calls; call to '(?:Game\.)?inner' would enter depth 2 while evaluating root '[^']*VALUE'$/u,
      ),
      primarySpan: span(source, "inner()", 1),
    });
    expect(errors[0]?.related.map(({ span: related }) => related)).toEqual([
      span(source, "outer()", 1),
    ]);
  });

  // The real non-configurable depth limit rejects the 513th activation in an acyclic call chain.
  it("should report E10271 with the production limit and attempted depth 513", () => {
    const functions = Array.from(
      { length: 513 },
      (_, index) =>
        `comptime function depth${index}(): byte { return ${index === 512 ? "7" : `depth${index + 1}()`}; }`,
    );
    const source = [
      "module Game;",
      ...functions,
      "const VALUE: byte = depth0();",
      "function main(): void {}",
    ].join("\n");
    const result = analyze(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.complete).toBe(false);
    expect(errors.map(({ code }) => code)).toEqual(["E10271"]);
    expect(errors[0]).toMatchObject({
      code: "E10271",
      severity: "error",
      pointer: null,
      message: expect.stringMatching(
        /^Compile-time call-depth budget exceeded — 'comptime-budget-v1' allows 512 active calls; call to '(?:Game\.)?depth512' would enter depth 513 while evaluating root '[^']*VALUE'$/u,
      ),
      primarySpan: span(source, "depth512()"),
    });
    expect(errors[0]?.related.map(({ span: related }) => related)).toEqual([
      span(source, "depth0()", 1),
    ]);
  });
});
