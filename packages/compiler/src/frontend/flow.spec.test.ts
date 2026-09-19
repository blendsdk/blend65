import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord, SourceSpan } from "../project/types.js";
import { analyzeModules } from "./analyzer.js";
import { indexModules, resolveModules } from "./modules.js";

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function source(text: string): SourceRecord {
  return {
    sourceId: "game.blend",
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/game.blend",
  };
}

function spanWithin(text: string, region: string, fragment: string): SourceSpan {
  const regionStart = text.indexOf(region);
  const relativeStart = region.indexOf(fragment);
  if (regionStart < 0 || relativeStart < 0) throw new Error("Missing fixture call fragment");
  const characterStart = regionStart + relativeStart;
  const start = Buffer.byteLength(text.slice(0, characterStart), "utf8");
  return { sourceId: "game.blend", start, end: start + Buffer.byteLength(fragment, "utf8") };
}

function analyze(text: string): ReturnType<typeof analyzeModules> {
  const manifestText = "{}";
  const project: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "flow-spec",
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
      text: manifestText,
      sha256: hash(manifestText),
      byteLength: Buffer.byteLength(manifestText, "utf8"),
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source(text)],
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
  expect(indexed.diagnostics).toEqual([]);
  expect(resolved.graph).not.toBeNull();
  if (resolved.graph === null) throw new Error("Expected a resolved Game module");
  return analyzeModules(project, resolved.graph);
}

type AnalysisResult = ReturnType<typeof analyzeModules>;

function typedDeclaration(result: AnalysisResult, qualifiedName: string) {
  const foundBinding = result.bindings.find(
    (candidate) => candidate.qualifiedName === qualifiedName,
  );
  expect(foundBinding).toBeDefined();
  if (foundBinding === undefined) throw new Error(`Missing binding ${qualifiedName}`);
  const declaration = result.declarations.find(
    (candidate) =>
      candidate.binding.sourceId === foundBinding.id.sourceId &&
      candidate.binding.span.start === foundBinding.id.span.start,
  );
  expect(declaration?.kind).toBe("typed");
  if (declaration?.kind !== "typed") throw new Error(`Expected typed declaration ${qualifiedName}`);
  return declaration;
}

describe("recursion and structured flow", () => {
  // A self-call is direct recursion and retains its concrete call edge.
  it("should reject direct recursion", () => {
    const result = analyze("module Game; function f(): void { f(); } function main(): void {}");
    expect(result.diagnostics).toMatchObject([
      {
        code: "E10180",
        severity: "error",
        message:
          "Direct recursion — function 'f' calls itself; use iteration or an explicit fixed-capacity work structure",
      },
    ]);
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]?.caller).toEqual(result.calls[0]?.callee);
    expect(result.complete).toBe(false);
  });

  // An indirect recursion diagnostic names the complete cycle and orders both edge locations.
  it("should reject an indirect recursion cycle with its ordered path", () => {
    const text =
      "module Game; function f(): void { g(); } function g(): void { f(); } function main(): void {}";
    const result = analyze(text);
    const edgeSpans = [
      spanWithin(text, "function f(): void { g(); }", "g()"),
      spanWithin(text, "function g(): void { f(); }", "f()"),
    ];
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "E10181",
      severity: "error",
      message: "Indirect recursion detected — cycle: f → g → f",
      related: edgeSpans.map((span) => ({ span })),
    });
    expect(result.calls).toHaveLength(2);
    expect(result.calls.map(({ span }) => span)).toEqual(edgeSpans);
    expect(result.complete).toBe(false);
  });

  // Conditions require Boolean values; integers and assignment results are not truthy.
  it("should accept Boolean conditions and reject numeric truthiness", () => {
    const numeric = analyze(
      "module Game; function f(): void { if (1) {} } function main(): void {}",
    );
    expect(numeric.diagnostics).toMatchObject([
      {
        code: "E10100",
        message: "Condition must have type 'boolean' — found 'byte'; use an explicit comparison",
      },
    ]);

    const assignment = analyze(
      "module Game; function f(): void { let x: byte = 0; if (x = 1) {} } function main(): void {}",
    );
    expect(assignment.diagnostics).toMatchObject([
      {
        code: "E10100",
        message: "Condition must have type 'boolean' — found 'byte'; use an explicit comparison",
      },
    ]);

    const valid = analyze(
      "module Game; function f(): void { if (true) {} } function main(): void {}",
    );
    expect(valid.diagnostics).toEqual([]);
  });

  // Every path of a value-returning function must return, while an if-else can complete that proof.
  it("should require all value-returning paths to return", () => {
    const incomplete = analyze(
      "module Game; function f(flag: boolean): byte { if (flag) { return 1; } } function main(): void {}",
    );
    expect(incomplete.diagnostics).toMatchObject([
      { code: "E10102", message: "Not all code paths return a value in function 'f'" },
    ]);

    const complete = analyze(
      "module Game; function f(flag: boolean): byte { if (flag) { return 1; } else { return 2; } } function main(): void {}",
    );
    expect(complete.diagnostics).toEqual([]);
    expect(typedDeclaration(complete, "Game.f").body).toMatchObject({
      statements: [
        {
          kind: "if",
          then: { statements: [{ kind: "return" }] },
          otherwise: { statements: [{ kind: "return" }] },
        },
      ],
    });
  });

  // Return statements must agree with the function's declared result type.
  it("should reject a value from void and a bare return from byte", () => {
    const voidResult = analyze(
      "module Game; function f(): void { return 1; } function main(): void {}",
    );
    expect(voidResult.diagnostics).toMatchObject([
      { code: "E10173", message: "Cannot return a value from void function 'f'" },
    ]);

    const missingValue = analyze(
      "module Game; function f(): byte { return; } function main(): void {}",
    );
    expect(missingValue.diagnostics).toMatchObject([
      {
        code: "E10174",
        message:
          "Missing return value — function 'f' returns 'byte' but this 'return' has no expression",
      },
    ]);
  });

  // A byte induction variable cannot reach 256 before wrapping to zero.
  it("should reject the bounded canonical byte loop", () => {
    const result = analyze(
      "module Game; function f(): void { for (let i: byte = 0; i < 256; i += 1) {} } function main(): void {}",
    );
    expect(result.diagnostics).toMatchObject([
      {
        code: "E10262",
        message:
          "Loop counter 'i' repeats within 0–255 before condition bound 256 can be reached — use 'word' or make deliberate wrap/infinite control explicit",
      },
    ]);
  });

  // A wider counter, an explicit exit, and an intentional endless loop are all legal.
  it("should accept loops whose control makes wrapping safe or deliberate", () => {
    const word = analyze(
      "module Game; function f(): void { for (let i: word = 0; i < 256; i += 1) {} } function main(): void {}",
    );
    expect(word.diagnostics).toEqual([]);

    const breakable = analyze(
      "module Game; function f(): void { for (let i: byte = 0; i < 256; i += 1) { if (i == 2) { break; } continue; } } function main(): void {}",
    );
    expect(breakable.diagnostics).toEqual([]);
    expect(typedDeclaration(breakable, "Game.f").body).toMatchObject({
      statements: [
        {
          kind: "for",
          continueTarget: "update",
          breakTarget: "exit",
          body: { statements: [{ kind: "if" }, { kind: "continue" }] },
        },
      ],
    });

    const endless = analyze(
      "module Game; function f(): void { for (;;) {} } function main(): void {}",
    );
    expect(endless.diagnostics).toEqual([]);
    expect(typedDeclaration(endless, "Game.f").body).toMatchObject({
      statements: [{ kind: "for", condition: null, continueTarget: "update", breakTarget: "exit" }],
    });
  });
});
