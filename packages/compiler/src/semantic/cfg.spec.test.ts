import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeProject } from "../frontend/service.js";
import type { TypedProgram } from "../frontend/service.js";
import { buildSemanticProgram } from "./lower.js";

const PROFILE_ID = "c64-pal-prg-kernal-6581";

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function snapshot(text: string): ProjectSnapshot {
  const source: SourceRecord = {
    sourceId: "src/game.blend",
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/src/game.blend",
  };
  return {
    manifest: {
      schemaVersion: 1,
      name: "semantic-cfg-spec",
      sourceRoot: "src",
      entry: "Game",
      target: PROFILE_ID,
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
    effectiveTarget: PROFILE_ID,
    effectiveEntry: "Game",
  };
}

function sameBinding(
  left: {
    readonly sourceId: string;
    readonly span: { readonly start: number; readonly end: number };
  },
  right: {
    readonly sourceId: string;
    readonly span: { readonly start: number; readonly end: number };
  },
): boolean {
  return (
    left.sourceId === right.sourceId &&
    left.span.start === right.span.start &&
    left.span.end === right.span.end
  );
}

function binding(program: TypedProgram, qualifiedName: string) {
  const found = program.bindings.find((candidate) => candidate.qualifiedName === qualifiedName);
  expect(found).toBeDefined();
  if (found === undefined) throw new Error(`Missing binding ${qualifiedName}`);
  return found.id;
}

function lower(text: string) {
  const analysis = analyzeProject(snapshot(text));
  expect(analysis.kind).toBe("complete");
  expect(analysis.diagnostics).toEqual([]);
  if (analysis.kind !== "complete") throw new Error(`Expected complete, got ${analysis.kind}`);
  const result = buildSemanticProgram(analysis);
  expect(result.kind).toBe("complete");
  if (result.kind !== "complete") throw new Error(`Expected complete, got ${result.kind}`);
  return { frontend: analysis.program, semantic: result.program };
}

describe("explicit control-flow graph", () => {
  // Logical and conditional expressions run effects only in their selected branch.
  it("should represent short circuit and conditional selection with branch-only call blocks", () => {
    const text = [
      "module Game;",
      "function first(): boolean { return true; }",
      "function second(): boolean { return true; }",
      "function yes(): byte { return 1; }",
      "function no(): byte { return 2; }",
      "function main(): void {",
      "  let both: boolean = first() && second();",
      "  let choice: byte = first() ? yes() : no();",
      "}",
    ].join("\n");
    const { frontend, semantic } = lower(text);
    const main = semantic.functions.find((candidate) =>
      sameBinding(candidate.id, binding(frontend, "Game.main")),
    );
    expect(main).toBeDefined();
    if (main === undefined) throw new Error("Missing lowered main");
    const secondId = binding(frontend, "Game.second");
    const yesId = binding(frontend, "Game.yes");
    const noId = binding(frontend, "Game.no");
    const blockCalls = new Map(
      main.blocks.map((block) => [
        block.id,
        block.operations
          .filter((operation) => operation.kind === "call")
          .map(({ callee }) => callee),
      ]),
    );
    const branches = main.blocks.filter((block) => block.terminator.kind === "branch");

    const shortCircuit = branches.find((block) => {
      if (block.terminator.kind !== "branch") return false;
      const selected = blockCalls.get(block.terminator.whenTrue) ?? [];
      const bypassed = blockCalls.get(block.terminator.whenFalse) ?? [];
      return (
        selected.some((callee) => sameBinding(callee, secondId)) &&
        bypassed.every((callee) => !sameBinding(callee, secondId))
      );
    });
    expect(shortCircuit).toBeDefined();

    const conditional = branches.find((block) => {
      if (block.terminator.kind !== "branch") return false;
      const whenTrue = blockCalls.get(block.terminator.whenTrue) ?? [];
      const whenFalse = blockCalls.get(block.terminator.whenFalse) ?? [];
      return (
        whenTrue.some((callee) => sameBinding(callee, yesId)) &&
        whenFalse.some((callee) => sameBinding(callee, noId))
      );
    });
    expect(conditional).toBeDefined();
  });

  // A proved-false branch contributes no operation, while its live sibling keeps provenance.
  it("should exclude constant-false operations and retain the surviving effect span", () => {
    const text = [
      "module Game;",
      "function dead(): void {}",
      "function live(): void {}",
      "function main(): void {",
      "  if (false) { dead(); }",
      "  live();",
      "}",
    ].join("\n");
    const { frontend, semantic } = lower(text);
    const main = semantic.functions.find((candidate) =>
      sameBinding(candidate.id, binding(frontend, "Game.main")),
    );
    expect(main).toBeDefined();
    if (main === undefined) throw new Error("Missing lowered main");
    const deadId = binding(frontend, "Game.dead");
    const liveId = binding(frontend, "Game.live");
    const calls = main.blocks
      .flatMap((block) => block.operations)
      .filter((operation) => operation.kind === "call");

    expect(calls.some(({ callee }) => sameBinding(callee, deadId))).toBe(false);
    const liveCalls = calls.filter(({ callee }) => sameBinding(callee, liveId));
    expect(liveCalls).toHaveLength(1);
    const liveStart = Buffer.byteLength(text.slice(0, text.lastIndexOf("live();")), "utf8");
    expect(liveCalls[0]?.span).toEqual({
      sourceId: "src/game.blend",
      start: liveStart,
      end: liveStart + Buffer.byteLength("live()", "utf8"),
    });
  });

  // Continue enters the update clause; break enters the loop exit; return exits the function.
  it("should lower each for-clause and route continue break and return correctly", () => {
    const text = [
      "module Game;",
      "function init(): void {}",
      "function condition(): boolean { return true; }",
      "function body(): void {}",
      "function update(): void {}",
      "function continueLoop(): void { for (init(); condition(); update()) { body(); continue; } }",
      "function breakLoop(): void { for (init(); condition(); update()) { body(); break; } }",
      "function returnLoop(): void { for (init(); condition(); update()) { body(); return; } }",
      "function main(): void {}",
    ].join("\n");
    const { frontend, semantic } = lower(text);
    const ids = {
      init: binding(frontend, "Game.init"),
      condition: binding(frontend, "Game.condition"),
      body: binding(frontend, "Game.body"),
      update: binding(frontend, "Game.update"),
    };

    function assertLoop(name: string, exit: "continue" | "break" | "return"): void {
      const lowered = semantic.functions.find((candidate) =>
        sameBinding(candidate.id, binding(frontend, `Game.${name}`)),
      );
      expect(lowered).toBeDefined();
      if (lowered === undefined) throw new Error(`Missing lowered ${name}`);
      const callBlock = (callee: typeof ids.init) =>
        lowered.blocks.find((block) =>
          block.operations.some(
            (operation) => operation.kind === "call" && sameBinding(operation.callee, callee),
          ),
        );
      const init = callBlock(ids.init);
      const condition = callBlock(ids.condition);
      const body = callBlock(ids.body);
      const update = callBlock(ids.update);
      expect(init).toBeDefined();
      expect(condition).toBeDefined();
      expect(body).toBeDefined();
      expect(update).toBeDefined();
      if (
        init === undefined ||
        condition === undefined ||
        body === undefined ||
        update === undefined
      ) {
        throw new Error(`Incomplete lowered loop ${name}`);
      }

      expect(init.terminator).toEqual({ kind: "jump", target: condition.id });
      expect(condition.terminator.kind).toBe("branch");
      if (condition.terminator.kind !== "branch") throw new Error("Expected loop branch");
      expect(condition.terminator.whenTrue).toBe(body.id);
      expect(update.terminator).toEqual({ kind: "jump", target: condition.id });

      if (exit === "continue") {
        expect(body.terminator).toEqual({ kind: "jump", target: update.id });
      } else if (exit === "break") {
        expect(body.terminator).toEqual({
          kind: "jump",
          target: condition.terminator.whenFalse,
        });
        expect(body.terminator).not.toEqual({ kind: "jump", target: update.id });
      } else {
        expect(body.terminator).toEqual({ kind: "return", value: null });
        expect(body.terminator).not.toEqual({ kind: "jump", target: update.id });
      }
    }

    assertLoop("continueLoop", "continue");
    assertLoop("breakLoop", "break");
    assertLoop("returnLoop", "return");
  });

  // Constant selectors omit their unchosen calls while retaining one call from each chosen arm.
  it("should execute only selected short-circuit and conditional effects", () => {
    const text = [
      "module Game;",
      "function skipped(): boolean { return true; }",
      "function yes(): byte { return 1; }",
      "function no(): byte { return 2; }",
      "function main(): void {",
      "  let both: boolean = false && skipped();",
      "  let either: boolean = true || skipped();",
      "  let first: byte = true ? yes() : no();",
      "  let second: byte = false ? yes() : no();",
      "}",
    ].join("\n");
    const { frontend, semantic } = lower(text);
    const main = semantic.functions.find((candidate) =>
      sameBinding(candidate.id, binding(frontend, "Game.main")),
    );
    expect(main).toBeDefined();
    if (main === undefined) throw new Error("Missing lowered main");
    const calls = main.blocks
      .flatMap((block) => block.operations)
      .filter((operation) => operation.kind === "call");
    expect(calls.map(({ callee }) => callee)).toEqual([
      binding(frontend, "Game.yes"),
      binding(frontend, "Game.no"),
    ]);
  });

  // The compound target place is fixed before the right operand, and its stored result is reused.
  it("should reuse a compound assignment result without reading its target twice", () => {
    const text = [
      "module Game;",
      "let values: byte[4] = [0; 0];",
      "function index(): word { return 1; }",
      "function delta(): byte { return 2; }",
      "function main(): void { let copy: byte = 0; copy = values[index()] += delta(); }",
    ].join("\n");
    const { frontend, semantic } = lower(text);
    const main = semantic.functions.find((candidate) =>
      sameBinding(candidate.id, binding(frontend, "Game.main")),
    );
    expect(main).toBeDefined();
    if (main === undefined) throw new Error("Missing lowered main");
    const operations = main.blocks.flatMap((block) => block.operations);
    const calls = operations.filter((operation) => operation.kind === "call");
    expect(calls.map(({ callee }) => callee)).toEqual([
      binding(frontend, "Game.index"),
      binding(frontend, "Game.delta"),
    ]);
    const valuesId = binding(frontend, "Game.values");
    const targetAccesses = operations.filter(
      (operation) =>
        (operation.kind === "load" || operation.kind === "store") &&
        sameBinding(operation.place.root, valuesId),
    );
    expect(targetAccesses.map(({ kind }) => kind)).toEqual(["load", "store"]);
    expect(targetAccesses[0]?.place.path).toEqual([{ kind: "index", value: calls[0]?.result }]);
    expect(targetAccesses[1]?.place.path).toEqual([{ kind: "index", value: calls[0]?.result }]);
    const copyStore = operations
      .filter(
        (operation) =>
          operation.kind === "store" &&
          operation.place.path.length === 0 &&
          !sameBinding(operation.place.root, valuesId),
      )
      .at(-1);
    expect(copyStore).toBeDefined();
    expect(copyStore?.kind === "store" ? copyStore.value : undefined).toBeDefined();
    expect(targetAccesses[1]?.kind === "store" ? targetAccesses[1].value : undefined).toBeDefined();
    expect(copyStore?.kind === "store" ? copyStore.value : undefined).toBe(
      targetAccesses[1]?.kind === "store" ? targetAccesses[1].value : undefined,
    );
    const order = [
      operations.indexOf(calls[0]!),
      operations.indexOf(targetAccesses[0]!),
      operations.indexOf(calls[1]!),
      operations.indexOf(targetAccesses[1]!),
      operations.indexOf(copyStore!),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(order.length);
  });
});
