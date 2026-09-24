import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord, SourceSpan } from "../project/types.js";
import { analyzeModules } from "./analyzer.js";
import * as flowFacts from "./flow-facts.js";
import { indexModules, resolveModules } from "./modules.js";
import type {
  InitializedRange,
  ScalarScope,
  ScalarValueState,
  SemanticType,
} from "./semantic-types.js";

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

  // A ring cursor has an explicit exit and is allowed to pass through byte wrap.
  it("should accept an intentional byte ring cursor", () => {
    const result = analyze(
      "module Game; function f(): void { for (let cursor: byte = 254; ; cursor += 1) { if (cursor == 1) { break; } } } function main(): void {}",
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.complete).toBe(true);
  });

  // The header, body, and surrounding block each have their own declaration identity.
  it("should allow a for header and its body to shadow an outer name", () => {
    const result = analyze(
      "module Game; function f(): word { let i: word = 2; for (let i: word = i; i < 4; i += 1) { let i: word = i + 100; i; } return i; } function main(): void {}",
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.complete).toBe(true);
  });

  // A dynamic write may select either element; it cannot establish element zero on every path.
  it("should report declaration and read warnings independently for a may-alias array write", () => {
    const result = analyze(
      "module Game; function f(index: byte): byte { let values: byte[2]; values[index] = 7; return values[0]; } function main(): void {}",
    );
    expect(
      result.diagnostics.map(({ code, severity, message }) => ({ code, severity, message })),
    ).toEqual([
      {
        code: "W10141",
        severity: "warning",
        message: "Array 'values' is uninitialized — all 2 elements are indeterminate",
      },
      {
        code: "W10190",
        severity: "warning",
        message: "Variable 'values' may be read before initialization — its value is indeterminate",
      },
    ]);
  });

  // Enum members share one case body, and a default handles every unmatched value.
  it("should accept an enum switch with an ordered multi-value case and one default", () => {
    const result = analyze(
      [
        "module Game;",
        "enum Direction { Up, Down, Left }",
        "function f(direction: Direction): byte {",
        "  let result: byte = 0;",
        "  switch (direction) {",
        "    case Direction.Up, Direction.Down: result = 1;",
        "    case Direction.Left: result = 2;",
        "    default: result = 3;",
        "  }",
        "  return result;",
        "}",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.complete).toBe(true);
  });

  // An enum case from a different declaration cannot match the switch's nominal type.
  it("should reject a case value from another enum", () => {
    const result = analyze(
      "module Game; enum Direction { Up } enum State { Up } function f(direction: Direction): void { switch (direction) { case State.Up: return; } } function main(): void {}",
    );
    expect(result.diagnostics).toMatchObject([
      {
        code: "E10072",
        severity: "error",
        message: "Case value type 'State' does not match switch expression type 'Direction'",
      },
    ]);
    expect(result.complete).toBe(false);
  });

  // Each invalid switch form has its own stable root diagnostic.
  it.each([
    ["duplicate value", "switch (value) { case 1: value = 2; case 1: value = 3; }", "E10070", null],
    [
      "nonconstant value",
      "switch (value) { case value: value = 2; }",
      "E10071",
      "Case value must be a compile-time constant — 'value' cannot be evaluated at compile time",
    ],
    [
      "boolean selector",
      "switch (true) { case 1: value = 2; }",
      "E10075",
      "Cannot switch on type 'boolean' — use an integer or enum expression",
    ],
    [
      "second default",
      "switch (value) { default: value = 1; default: value = 2; }",
      "E10076",
      "Only one 'default' clause is allowed per switch statement",
    ],
    [
      "terminal fallthrough",
      "switch (value) { case 1: fallthrough; }",
      "E10073",
      "'fallthrough' has no effect in the last case of a switch",
    ],
    [
      "nonterminal fallthrough",
      "switch (value) { case 1: fallthrough; value = 2; case 2: value = 3; }",
      "E10074",
      "'fallthrough' must be the last statement in a case body and cannot be nested in another control-flow block",
    ],
  ])("should diagnose a switch with %s", (_name, statement, code, message) => {
    const result = analyze(
      `module Game; function f(value: byte): void { ${statement} } function main(): void {}`,
    );
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ code, severity: "error" });
    if (message === null) {
      expect(result.diagnostics[0]?.message).toMatch(
        /^Duplicate case value 1 — already used at .+$/,
      );
      expect(result.diagnostics[0]?.related).toHaveLength(1);
    } else {
      expect(result.diagnostics[0]?.message).toBe(message);
    }
    expect(result.complete).toBe(false);
  });
});

describe("stored conditional effect facts", () => {
  // A stored Boolean keeps its selected destination through agreeing paths and credits only proved success.
  it("should retain one captured range across agreeing joins and discard a conflicting capture", () => {
    type Effect = {
      readonly resultId: string;
      readonly destination: ScalarValueState;
      readonly capturedRange: InitializedRange;
    };
    type EffectState = ScalarValueState & { conditionalEffect?: Effect | null };
    const planned = flowFacts as typeof flowFacts & {
      creditConditionalSuccess(result: ScalarValueState, resultId: string): void;
    };
    const arrayType: SemanticType = {
      kind: "array",
      element: { kind: "scalar", name: "byte" },
      length: 3,
      size: 3,
    };
    /** Create an independent reaching value for the synthetic branch facts. */
    function value(name: string, start: number, type: SemanticType): EffectState {
      const span = { sourceId: "synthetic.blend", start, end: start + name.length };
      return {
        binding: {
          id: { sourceId: span.sourceId, span },
          name,
          qualifiedName: null,
          declaration: span,
          exported: false,
          storage: "local",
          type,
        },
        nameSpan: span,
        readonly: false,
        known: null,
        initialized: false,
        initializedRanges: [],
        initializedPaths: [],
        conditionalEffect: null,
      };
    }
    const destination = value("destination", 0, arrayType);
    const unrelated = value("unrelated", 20, arrayType);
    unrelated.initializedRanges = [{ start: 0, end: 1 }];
    const result = value("loaded", 40, { kind: "scalar", name: "boolean" });
    result.initialized = true;
    const capturedRange = { start: 1, end: 2 };
    const effect = { resultId: "stored-load", destination, capturedRange };
    result.conditionalEffect = effect;
    const scope: ScalarScope = {
      parent: null,
      values: new Map([
        ["destination", destination],
        ["unrelated", unrelated],
        ["loaded", result],
      ]),
    };

    const baseline = flowFacts.snapshotScalarFacts(scope);
    expect(baseline.get(result)).toMatchObject({ conditionalEffect: effect });
    const agreeingLeft = flowFacts.captureBranchFacts(baseline);
    flowFacts.restoreScalarFacts(baseline);
    result.conditionalEffect = {
      resultId: "stored-load",
      destination,
      capturedRange: { start: 1, end: 2 },
    };
    const agreeingRight = flowFacts.captureBranchFacts(baseline);
    flowFacts.mergeScalarFacts(baseline, [agreeingLeft, agreeingRight]);
    expect(result.conditionalEffect).toEqual(effect);
    result.known = true;
    planned.creditConditionalSuccess(result, "stored-load");
    expect(destination.initializedRanges).toEqual([capturedRange]);
    expect(destination.initialized).toBe(false);
    expect(unrelated.initializedRanges).toEqual([{ start: 0, end: 1 }]);

    flowFacts.restoreScalarFacts(baseline);
    result.known = false;
    planned.creditConditionalSuccess(result, "stored-load");
    expect(destination.initializedRanges).toEqual([]);

    flowFacts.restoreScalarFacts(baseline);
    result.known = true;
    planned.creditConditionalSuccess(result, "another-result");
    expect(destination.initializedRanges).toEqual([]);

    flowFacts.restoreScalarFacts(baseline);
    const disagreeingLeft = flowFacts.captureBranchFacts(baseline);
    flowFacts.restoreScalarFacts(baseline);
    result.conditionalEffect = {
      resultId: "stored-load",
      destination,
      capturedRange: { start: 2, end: 3 },
    };
    const disagreeingRight = flowFacts.captureBranchFacts(baseline);
    flowFacts.mergeScalarFacts(baseline, [disagreeingLeft, disagreeingRight]);
    expect(result.conditionalEffect).toBeNull();
    result.known = true;
    planned.creditConditionalSuccess(result, "stored-load");
    expect(destination.initializedRanges).toEqual([]);
    expect(unrelated.initializedRanges).toEqual([{ start: 0, end: 1 }]);
  });
});
