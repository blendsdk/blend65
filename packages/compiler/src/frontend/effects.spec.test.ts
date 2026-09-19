import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeProject } from "./service.js";

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function source(sourceId: string, text: string, checkout = "/checkout"): SourceRecord {
  return {
    sourceId,
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: `${checkout}/${sourceId}`,
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function snapshot(sources: readonly SourceRecord[], checkout = "/checkout"): ProjectSnapshot {
  const manifestText = "{}";
  return deepFreeze({
    manifest: {
      schemaVersion: 1,
      name: "effects-spec",
      sourceRoot: "src",
      entry: "Game",
      target: "test.target",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: source("blend65.json", manifestText, checkout),
    sources,
    inputSha256: hash(JSON.stringify(sources.map(({ sourceId, sha256 }) => [sourceId, sha256]))),
    projectRoot: checkout,
    sourceRoot: `${checkout}/src`,
    assetPaths: [],
    outDir: `${checkout}/out`,
    overrides: { target: null, entry: null },
    effectiveTarget: "test.target",
    effectiveEntry: "Game",
  });
}

type CompleteResult = Extract<ReturnType<typeof analyzeProject>, { kind: "complete" }>;
type Program = CompleteResult["program"];
type Binding = Program["bindings"][number];

function complete(project: ProjectSnapshot): CompleteResult {
  const result = analyzeProject(project);
  expect(result.kind).toBe("complete");
  expect(result.diagnostics).toEqual([]);
  if (result.kind !== "complete") throw new Error(`Expected complete analysis, got ${result.kind}`);
  return result;
}

function binding(program: Program, qualifiedName: string): Binding {
  const found = program.bindings.find((candidate) => candidate.qualifiedName === qualifiedName);
  expect(found, `Missing binding ${qualifiedName}`).toBeDefined();
  if (found === undefined) throw new Error(`Missing binding ${qualifiedName}`);
  return found;
}

function orderNames(program: Program): readonly string[] {
  return program.initializerOrder.map((id) => {
    const found = program.bindings.find(
      (candidate) =>
        candidate.id.sourceId === id.sourceId &&
        candidate.id.span.sourceId === id.span.sourceId &&
        candidate.id.span.start === id.span.start &&
        candidate.id.span.end === id.span.end,
    );
    expect(found, `Initializer binding ${JSON.stringify(id)} must be retained`).toBeDefined();
    return found?.qualifiedName ?? "<missing>";
  });
}

function effect(program: Program, qualifiedName: string) {
  const functionBinding = binding(program, qualifiedName);
  const found = program.effects.find(
    (summary) =>
      summary.function.sourceId === functionBinding.id.sourceId &&
      summary.function.span.sourceId === functionBinding.id.span.sourceId &&
      summary.function.span.start === functionBinding.id.span.start &&
      summary.function.span.end === functionBinding.id.span.end,
  );
  expect(found, `Missing effect summary for ${qualifiedName}`).toBeDefined();
  if (found === undefined) throw new Error(`Missing effect summary for ${qualifiedName}`);
  return found;
}

describe("runtime initializer scheduling", () => {
  // Direct dependencies constrain startup, while ready variables use qualified ASCII names only.
  it("orders dependent and independent initializers without using source paths or input order", () => {
    const gameText = [
      "module Game;",
      "import { x as ax } from A;",
      "import { x as bx } from B;",
      "let z: word = 1;",
      "let a: word = z + 1;",
      "function main(): void {}",
    ].join("\n");
    const aText = "module A; export let x: word = 1;";
    const bText = "module B; export let x: word = 1;";
    const first = complete(
      snapshot([
        source("src/z-game.blend", gameText),
        source("src/y-a.blend", aText),
        source("src/x-b.blend", bText),
      ]),
    ).program;
    const second = complete(
      snapshot(
        [
          source("sources/first-b.blend", bText, "/elsewhere"),
          source("sources/second-game.blend", gameText, "/elsewhere"),
          source("sources/third-a.blend", aText, "/elsewhere"),
        ],
        "/elsewhere",
      ),
    ).program;

    expect(orderNames(first)).toEqual(["A.x", "B.x", "Game.z", "Game.a"]);
    expect(orderNames(second)).toEqual(["A.x", "B.x", "Game.z", "Game.a"]);
  });

  // A call in an initializer carries its transitive reads into the startup graph.
  it("orders a transitive call-read and diagnoses the actual initializer cycle with its path", () => {
    const callText = [
      "module Game;",
      "let a: word = f();",
      "let b: word = 1;",
      "function f(): word { return b; }",
      "function main(): void {}",
    ].join("\n");
    const callProgram = complete(snapshot([source("src/game.blend", callText)])).program;
    const b = binding(callProgram, "Game.b");

    expect(orderNames(callProgram)).toEqual(["Game.b", "Game.a"]);
    expect(effect(callProgram, "Game.f")).toMatchObject({
      function: binding(callProgram, "Game.f").id,
      reads: [{ binding: b.id, path: [], readonly: false }],
      writes: [],
      opaque: false,
    });

    const cycleText = [
      "module Game;",
      "let a: word = b;",
      "let b: word = a;",
      "function main(): void {}",
    ].join("\n");
    const cycle = analyzeProject(snapshot([source("src/game.blend", cycleText)]));
    expect(cycle.kind).toBe("error");
    expect(cycle).not.toHaveProperty("program");
    const diagnostic = cycle.diagnostics.find(({ code }) => code === "E10194");
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.primarySpan).not.toBeNull();
    expect(diagnostic?.related.length).toBeGreaterThan(0);
    expect(JSON.stringify(diagnostic)).toMatch(/a.*b|b.*a/);
  });

  // Import cycles are declarations only and cannot masquerade as runtime initializer cycles.
  it("accepts an import cycle when no initializer read or call closes a cycle", () => {
    const gameText = [
      "module Game;",
      "import { f } from A;",
      "export let seed: byte = 1;",
      "function main(): void { f(); }",
    ].join("\n");
    const aText = ["module A;", "import { seed } from Game;", "export function f(): void {}"].join(
      "\n",
    );
    const result = complete(
      snapshot([source("src/a.blend", aText), source("src/game.blend", gameText)]),
    );

    expect(result.diagnostics.map(({ code }) => code)).not.toContain("E10194");
    expect(orderNames(result.program)).toEqual(["Game.seed"]);
  });

  // Qualified module access works without an import and still schedules solely from semantic names.
  it("keeps qualified cross-module scheduling stable across paths and input order", () => {
    const gameText = [
      "module Game;",
      "let result: word = Math.f();",
      "function main(): void {}",
    ].join("\n");
    const mathText = [
      "module Math;",
      "export let value: word = 1;",
      "export function f(): word { return value; }",
    ].join("\n");
    const first = complete(
      snapshot([source("src/not-math.blend", gameText), source("src/not-game.blend", mathText)]),
    ).program;
    const second = complete(
      snapshot(
        [
          source("renamed/game-looking.blend", mathText, "/moved"),
          source("renamed/math-looking.blend", gameText, "/moved"),
        ],
        "/moved",
      ),
    ).program;

    expect(orderNames(first)).toEqual(["Math.value", "Game.result"]);
    expect(orderNames(second)).toEqual(["Math.value", "Game.result"]);
    expect(effect(first, "Math.f").reads).toEqual([
      { binding: binding(first, "Math.value").id, path: [], readonly: false },
    ]);
  });
});

describe("finite function effects", () => {
  // Calls inherit global effects, aggregate arguments substitute their caller places, and volatile I/O is opaque.
  it("propagates reads writes aggregate places and opaque barriers through direct calls", () => {
    const text = [
      "module Game;",
      "let state: word = 0;",
      "let items: byte[2] = [0, 0];",
      "function mutate(values: byte[2]): void { values[0] = 1; }",
      "function io(address: word): byte { state = 2; poke(address, 1); return peek(address); }",
      "function caller(address: word): byte { mutate(items); return io(address); }",
      "function main(): void {}",
    ].join("\n");
    const program = complete(snapshot([source("src/game.blend", text)])).program;
    const state = binding(program, "Game.state");
    const items = binding(program, "Game.items");
    const values = program.bindings.find(
      (candidate) => candidate.name === "values" && candidate.storage === "parameter",
    );
    expect(values).toBeDefined();
    if (values === undefined) throw new Error("Missing aggregate parameter binding");

    const mutate = effect(program, "Game.mutate");
    expect(mutate.reads).toEqual([]);
    expect(mutate.writes).toHaveLength(1);
    expect(mutate.writes[0]).toMatchObject({ binding: values.id, readonly: false });
    expect(mutate.writes[0]?.path).not.toEqual([]);
    expect(mutate.opaque).toBe(false);

    const io = effect(program, "Game.io");
    expect(io.reads).toEqual([]);
    expect(io.writes).toContainEqual({ binding: state.id, path: [], readonly: false });
    expect(io.opaque).toBe(true);

    const caller = effect(program, "Game.caller");
    expect(caller.reads).toEqual([]);
    expect(caller.writes).toContainEqual({
      binding: items.id,
      path: mutate.writes[0]?.path,
      readonly: false,
    });
    expect(caller.writes).toContainEqual({ binding: state.id, path: [], readonly: false });
    expect(caller.opaque).toBe(true);
  });
});
