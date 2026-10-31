import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { lowerMachineProgram } from "../machine/lower.js";
import type { MachineFunction, MachineSourceFacts } from "../machine/machine-types.js";
import type { ProjectSnapshot } from "../project/types.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import {
  selectClosedObjectStorage,
  validObjectStorageSelection,
  validObjectStorageBundle,
} from "../storage/selection.js";
import { selectTargetProfile } from "../target/profile.js";
import { deriveClosedObjectFacts } from "./closed-object-facts.js";
import {
  collectSourceLoopNesting,
  deriveFixedLoopFacts,
  fixedLoopValueBounds,
} from "./fixed-loop-facts.js";
import { deriveLocalStorageLifetimes } from "./local-storage-lifetimes.js";
import { buildSemanticProgram } from "./lower.js";
import { closeWholeProgram } from "./whole-program.js";

/** Check actual source before deriving any conditional object representation. */
function prepared(text: string) {
  const sha256 = createHash("sha256").update(text, "utf8").digest("hex");
  const profileId = "c64-pal-prg-kernal-6581";
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "object-implementation",
      sourceRoot: "src",
      entry: "Game",
      target: profileId,
      assetPaths: [],
      outDir: "out",
      optimization: "size",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      byteLength: 2,
      sha256: createHash("sha256").update("{}", "utf8").digest("hex"),
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [
      {
        sourceId: "src/game.blend",
        text,
        sha256,
        byteLength: Buffer.byteLength(text, "utf8"),
        resolvedPath: "/checkout/src/game.blend",
      },
    ],
    inputSha256: sha256,
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: profileId,
    effectiveEntry: "Game",
  };
  const target = selectTargetProfile(profileId);
  if (target.kind !== "complete") throw new Error("Expected fixture profile");
  const analysis = analyzeProject(snapshot);
  if (analysis.kind !== "complete") throw new Error(JSON.stringify(analysis));
  const semantic = buildSemanticProgram(analysis);
  if (semantic.kind !== "complete") throw new Error(JSON.stringify(semantic));
  const closed = closeWholeProgram(
    semantic.program,
    target.profile.interrupts,
    target.profile.storage,
  );
  if (closed.kind !== "complete") throw new Error(JSON.stringify(closed.diagnostics));
  const program = closed.program;
  const loops = deriveFixedLoopFacts(program, collectSourceLoopNesting(program, analysis.program));
  const objects = deriveClosedObjectFacts(
    program,
    target.profile.storage,
    fixedLoopValueBounds(program, loops),
  );
  const lifetimes = deriveLocalStorageLifetimes(program);
  const selections = selectClosedObjectStorage(objects);
  const sourceFacts: MachineSourceFacts = {
    program,
    functions: new Map(
      program.semantic.functions.map((fn) => [
        fn,
        {
          function: fn,
          objects,
          loops: loops.filter((loop) => loop.function === fn),
          lifetimes: new Map([...lifetimes].filter(([, life]) => life.function === fn.id)),
          ...(selections.has(fn) ? { storage: selections.get(fn) } : {}),
        },
      ]),
    ),
  };
  return {
    program,
    profile: target.profile,
    sourceFacts,
    selections,
    names: new Map(
      analysis.program.bindings.map((binding) => [
        bindingIdentityKey(binding.id),
        binding.qualifiedName ?? binding.name,
      ]),
    ),
  };
}

/** Lower without publication; final observers and full resource closure are separate gates. */
function machine(source: ReturnType<typeof prepared>, selected: boolean) {
  const inventory = inventoryStorage(source.program);
  const allocation = allocateStorage(
    inventory,
    buildInterference(inventory),
    source.profile.storage,
  );
  if (allocation.kind !== "complete") throw new Error("Expected provisional fixture storage");
  const lowered = lowerMachineProgram({
    program: source.program,
    profile: source.profile,
    placement: allocation.placement,
    bindingNames: source.names,
    boundsCheck: true,
    divisionZeroCheck: true,
    ...(selected ? { sourceFacts: source.sourceFacts } : {}),
  });
  if (lowered.kind !== "complete") throw new Error(JSON.stringify(lowered));
  return lowered.program;
}

/** Inspect structured operations, not assembly text or guessed source-name optimizations. */
function instructions(fn: MachineFunction) {
  return fn.blocks.flatMap((block) => block.instructions);
}

const declarations = `module Game; struct Pair { a: byte; b: byte; }
place(at: $3200) let item: Pair; place(at: $3400) let answers: byte[4] = [; 0];`;

describe("conditional fixed object recipes", () => {
  it("should encode a unique whole-object field while retaining ordinary direct calls", () => {
    const source = prepared(`${declarations}
function first(p: const Pair): byte { return p.a; }
function relay(p: const Pair): byte { return first(p); }
function main(): void { answers[0] = relay(item); }`);
    const selected = machine(source, true);
    for (const name of ["first", "relay"]) {
      const fn = selected.functions.find((fn) => fn.sourceName === `Game.${name}`)!;
      expect(
        instructions(fn).some((instruction) => instruction.mode === "indirect-indexed-y"),
      ).toBe(false);
    }
    const relay = selected.functions.find((fn) => fn.sourceName === "Game.relay")!;
    expect(instructions(relay).filter((instruction) => instruction.opcode === "jsr")).toHaveLength(
      1,
    );
  });

  it("should construct a fixed result with direct stores and no hidden result marshalling", () => {
    const source = prepared(`${declarations}
function make(): Pair { return { a: 7, b: 9 }; }
function relay(): Pair { return make(); }
function main(): void { item = relay(); }`);
    const selected = machine(source, true);
    const make = selected.functions.find((fn) => fn.sourceName === "Game.make")!;
    expect(instructions(make).map(({ opcode, mode }) => [opcode, mode])).toEqual([
      ["lda", "immediate"],
      ["sta", "absolute"],
      ["lda", "immediate"],
      ["sta", "absolute"],
    ]);
    expect(
      instructions(make)
        .filter(({ opcode }) => opcode === "sta")
        .map(({ operand }) => (operand?.kind === "label" ? operand.offset : null)),
    ).toEqual([0, 1]);
    expect(
      selected.functions
        .flatMap(instructions)
        .some(
          ({ operand }) =>
            operand?.kind === "storage" &&
            operand.requestId.endsWith(":pointer:aggregate-return-destination"),
        ),
    ).toBe(false);
    const partial = new Map(
      [...source.sourceFacts.functions].filter(([fn]) => fn.name !== "Game.relay"),
    );
    expect(validObjectStorageBundle(partial)).toBe(false);
    expect(validObjectStorageBundle(source.sourceFacts.functions, false)).toBe(false);
  });

  it("should bind a complete returned local without treating its word index as narrowed", () => {
    const source = prepared(`module Game; struct Payload { rows: byte[8]; quality: byte; }
place(at: $3200) let item: Payload;
function acquire(): Payload { let result: Payload = { rows: [; 0], quality: 0 };
  for (let i: word = 0; i < 8; i += 1) { result.rows[i] = byte(i); }
  result.quality = 7; return result; }
function main(): void { item = acquire(); }`);
    const fn = source.program.semantic.functions.find((fn) => fn.name === "Game.acquire")!;
    expect(source.selections.get(fn)?.resultLocal).toBeDefined();
    expect(source.selections.get(fn)?.resultLocal).not.toBeNull();
    const selected = machine(source, true).functions.find(
      (fn) => fn.sourceName === "Game.acquire",
    )!;
    expect(
      instructions(selected).some(
        ({ operand }) =>
          operand?.kind === "storage" &&
          operand.requestId.endsWith(":pointer:aggregate-return-destination"),
      ),
    ).toBe(false);
    expect(
      instructions(selected).some(
        ({ opcode, operand }) =>
          opcode === "sta" && operand?.kind === "label" && operand.offset === 8,
      ),
    ).toBe(true);
  });

  it("should reject incomplete returned-local initialization rather than manufacture missing bytes", () => {
    const source = prepared(`module Game; let item: byte[2];
function make(): byte[2] { let result: byte[2] = [7]; return result; }
function main(): void { item = make(); }`);
    const fn = source.program.semantic.functions.find((fn) => fn.name === "Game.make")!;
    expect(source.selections.get(fn)?.result ?? null).toBeNull();
  });

  it("should retain generic output when different objects reach the same parameter", () => {
    const source = prepared(`${declarations} let other: Pair;
function first(p: const Pair): byte { return p.a; }
function main(): void { answers[0] = first(item); answers[1] = first(other); }`);
    expect(machine(source, true)).toEqual(machine(source, false));
  });

  it("should reject altered returned-local and complete root replacement recipes", () => {
    const source = prepared(`${declarations}
function make(): Pair { let result: Pair = { a: 7, b: 9 }; return result; }
function main(): void { item = make(); }`);
    const fn = source.program.semantic.functions.find((fn) => fn.name === "Game.make")!;
    const selected = source.selections.get(fn)!;
    expect(validObjectStorageSelection(selected, selected.facts, fn)).toBe(true);
    expect(
      validObjectStorageSelection({ ...selected, resultLocal: fn.id }, selected.facts, fn),
    ).toBe(false);
    const altered = new Map(selected.resultRoots);
    altered.set(bindingIdentityKey(fn.id), selected.result!.origin);
    expect(
      validObjectStorageSelection({ ...selected, resultRoots: altered }, selected.facts, fn),
    ).toBe(false);
    const missing = new Map(selected.resultRoots);
    missing.delete(bindingIdentityKey(selected.resultLocal!));
    expect(
      validObjectStorageSelection({ ...selected, resultRoots: missing }, selected.facts, fn),
    ).toBe(false);
    const changedOrigin = new Map(selected.resultRoots);
    const origin = selected.result!.origin;
    changedOrigin.set(bindingIdentityKey(selected.resultLocal!), {
      ...origin,
      type: { ...origin.type, size: origin.type.size + 1 },
    });
    expect(
      validObjectStorageSelection({ ...selected, resultRoots: changedOrigin }, selected.facts, fn),
    ).toBe(false);
  });

  it("should deliver the fixed destination when a relay forwards a generic aggregate result", () => {
    const source = prepared(`${declarations}
place(at: $3600) let seed: Pair = { a: 7, b: 9 };
function make(): Pair { return seed; }
function relay(): Pair { return make(); }
function main(): void { item = relay(); }`);
    const selected = machine(source, true);
    const fn = source.program.semantic.functions.find((fn) => fn.name === "Game.relay")!;
    const relay = selected.functions.find((fn) => fn.sourceName === "Game.relay")!;
    const ownerPointer = `${bindingIdentityKey(fn.id)}:pointer:aggregate-return-destination`;
    expect(
      instructions(relay).some(
        ({ operand }) => operand?.kind === "storage" && operand.requestId === ownerPointer,
      ),
    ).toBe(false);
    expect(
      instructions(relay)
        .filter(
          ({ opcode, mode, operand }) =>
            opcode === "lda" && mode === "immediate" && operand?.kind === "label",
        )
        .map(({ operand }) => (operand?.kind === "label" ? operand.addressByte : null)),
    ).toEqual(["low", "high"]);
  });
});
