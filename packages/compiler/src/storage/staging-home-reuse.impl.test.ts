import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeProject } from "../frontend/service.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "./allocate.js";
import { closeStorage } from "./closure.js";
import { buildInterference } from "./interference.js";
import { inventoryStorage } from "./inventory.js";
import { selectedProfile } from "../machine/lowering-test-support.js";
import { lowerMachineProgram } from "../machine/lower.js";

/** Lower one real source file without host I/O or generated output. */
function lowerSource(text: string) {
  const source: SourceRecord = {
    sourceId: "src/game.blend",
    text,
    sha256: createHash("sha256").update(text).digest("hex"),
    byteLength: Buffer.byteLength(text),
    resolvedPath: "/checkout/src/game.blend",
  };
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "staging-home-reuse",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      sha256: createHash("sha256").update("{}").digest("hex"),
      byteLength: 2,
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source],
    inputSha256: source.sha256,
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: "c64-pal-prg-kernal-6581",
    effectiveEntry: "Game",
  };
  const analyzed = analyzeProject(snapshot);
  if (analyzed.kind !== "complete") throw new Error(JSON.stringify(analyzed.diagnostics));
  return buildSemanticProgram(analyzed, { boundsCheck: true });
}

/** Lower and close the witness, returning the planned and projected storage. */
function closeWitness(source: string) {
  const loweredSource = lowerSource(source);
  if (loweredSource.kind !== "complete") throw new Error(JSON.stringify(loweredSource.diagnostics));
  const closed = closeWholeProgram(loweredSource.program);
  if (closed.kind !== "complete") throw new Error(JSON.stringify(closed.diagnostics));
  const profile = selectedProfile();
  const inventory = inventoryStorage(closed.program);
  const allocation = allocateStorage(inventory, buildInterference(inventory), profile.storage);
  if (allocation.kind !== "complete") throw new Error("Expected provisional allocation");
  const lowered = lowerMachineProgram({
    program: closed.program,
    placement: allocation.placement,
    logicalStorage: inventory,
    profile,
  });
  if (lowered.kind !== "complete") throw new Error(`Expected lowering: ${lowered.reason}`);
  const closure = closeStorage(lowered.inventory, profile.storage, lowered.binder);
  if (closure.kind !== "complete") throw new Error("Expected closed storage");
  return { inventory, lowered, closure };
}

describe("planned call staging homes", () => {
  it("reuses the planned return-stage home instead of a second machine home", () => {
    const { inventory, lowered, closure } = closeWitness(`module Game;
function helper(): byte { return 5; }
function main(): void { poke($C000, helper() + helper()); }`);
    const planned = inventory.requests.find((request) => request.storageClass === "return-stage");
    expect(planned).toBeDefined();
    if (planned === undefined) return;
    expect(closure.inventory.requests.some((request) => request.id === planned.id)).toBe(true);
    expect(
      closure.inventory.requests.some((request) =>
        request.id.includes(`:retained-value:${planned.value}`),
      ),
    ).toBe(false);
    expect(JSON.stringify(lowered.program)).toContain(planned.id);
  });

  it("reuses the planned argument-stage home across a nested call", () => {
    const { inventory, closure } = closeWitness(`module Game;
function helper(value: byte): byte { return value; }
function main(): void { poke($C000, peek($C001) + helper(peek($C002))); }`);
    const planned = inventory.requests.find((request) => request.storageClass === "argument-stage");
    expect(planned).toBeDefined();
    if (planned === undefined) return;
    expect(closure.inventory.requests.some((request) => request.id === planned.id)).toBe(true);
    expect(
      closure.inventory.requests.some((request) =>
        request.id.includes(`:retained-value:${planned.value}`),
      ),
    ).toBe(false);
  });
});
