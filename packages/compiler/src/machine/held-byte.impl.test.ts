import { createHash } from "node:crypto";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeProject } from "../frontend/service.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { lowerMachineProgram } from "./lower.js";
import { selectedProfile } from "./lowering-test-support.js";
import type { MachineInstruction } from "./machine-types.js";

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
      name: "held-byte",
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

/** Lower the source and return the selected machine function for `Game.work`. */
function workFunction(source: string): {
  readonly instructions: readonly MachineInstruction[];
  readonly seedLabel: string | null;
} {
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
  const semantic = loweredSource.program.functions.find(
    (candidate) => candidate.name === "Game.work",
  );
  if (semantic === undefined) throw new Error("Missing semantic Game.work");
  const id = `fn.${bindingIdentityKey(semantic.id)}`;
  const fn = lowered.program.functions.find((candidate) => candidate.id === id);
  if (fn === undefined) throw new Error(`Missing lowered ${id}`);
  const seed = loweredSource.program.globals.find((candidate) => candidate.name === "seed");
  return {
    instructions: fn.blocks.flatMap((block) => block.instructions),
    seedLabel: seed === undefined ? null : `global.${bindingIdentityKey(seed.id)}`,
  };
}

/** Count instructions with one opcode and an immediate operand of a value. */
function immediateCount(
  list: readonly MachineInstruction[],
  opcode: string,
  value: number,
): number {
  return list.filter(
    (instruction) =>
      instruction.opcode === opcode &&
      instruction.operand?.kind === "immediate" &&
      instruction.operand.value === value,
  ).length;
}

/** Count loads of the whole `seed` global through a label operand. */
function seedLoadCount(list: readonly MachineInstruction[], label: string): number {
  return list.filter(
    (instruction) =>
      instruction.opcode === "lda" &&
      instruction.operand?.kind === "label" &&
      instruction.operand.label === label,
  ).length;
}

const denseChain = (type: string) => `module Game;
let data: byte[8] = [0; 8];
let seed: ${type} = 1;
let answer: byte = 0;
function work(): byte {
  for (let i: word = 0; i < 8; i += 1) { data[i] = byte(i); }
  if (seed == 0) { return 0; }
  if (seed == 1) { return 127; }
  if (seed == 2) { return 255; }
  if (seed == 3) { return 0; }
  if (seed == 4) { return 127; }
  if (seed == 5) { return 255; }
  if (seed == 6) { return 0; }
  if (seed == 7) { return 127; }
  return 255;
}
function main(): void { answer = work(); }`;

describe("held byte classifier chain", () => {
  it("reuses one stable byte load across a dense equality chain", () => {
    const { instructions: list, seedLabel } = workFunction(denseChain("byte"));
    if (seedLabel === null) throw new Error("Missing seed label");
    expect(seedLoadCount(list, seedLabel)).toBe(1);
    expect(list.filter(({ opcode }) => opcode === "eor")).toHaveLength(0);
    for (let value = 1; value <= 7; value += 1) expect(immediateCount(list, "cmp", value)).toBe(1);
  });

  it("reuses one signed byte load across the same chain", () => {
    const { instructions: list, seedLabel } = workFunction(denseChain("sbyte"));
    if (seedLabel === null) throw new Error("Missing seed label");
    expect(seedLoadCount(list, seedLabel)).toBe(1);
    expect(list.filter(({ opcode }) => opcode === "eor")).toHaveLength(0);
    expect(immediateCount(list, "cmp", 5)).toBe(1);
  });

  it("reuses one enum load across a dense equality chain", () => {
    const { instructions: list } = workFunction(`module Game;
enum Mode { A, B, C }
let mode: Mode = Mode.A;
let answer: byte = 0;
function work(): byte {
  if (mode == Mode.A) { return 0; }
  if (mode == Mode.B) { return 127; }
  if (mode == Mode.C) { return 255; }
  return 255;
}
function main(): void { answer = work(); }`);
    expect(list.filter(({ opcode }) => opcode === "eor")).toHaveLength(0);
    expect(immediateCount(list, "cmp", 1)).toBe(1);
    expect(immediateCount(list, "cmp", 2)).toBe(1);
  });

  it("does not chain across a skipped comparison", () => {
    const { instructions: list } = workFunction(`module Game;
let seed: byte = 1;
function work(): byte {
  if (seed == 0) { return 0; }
  if (seed == 2) { return 127; }
  return 255;
}
function main(): void { poke($C000, work()); }`);
    expect(immediateCount(list, "eor", 2)).toBe(1);
    expect(immediateCount(list, "cmp", 2)).toBe(0);
  });

  it("does not chain across an intervening store", () => {
    const { instructions: list } = workFunction(`module Game;
let seed: byte = 1;
function work(): byte {
  if (seed == 0) { return 0; }
  seed = 3;
  if (seed == 1) { return 127; }
  return 255;
}
function main(): void { poke($C000, work()); }`);
    expect(immediateCount(list, "eor", 1)).toBe(1);
  });

  it("does not chain across a control-flow merge", () => {
    const { instructions: list } = workFunction(`module Game;
let seed: byte = 1;
function work(): byte {
  if (seed == 0) { return 0; }
  if (peek($0400) != 0) { seed = 1; } else { seed = 2; }
  if (seed == 1) { return 127; }
  return 255;
}
function main(): void { poke($C000, work()); }`);
    expect(immediateCount(list, "eor", 1)).toBe(1);
  });

  it("does not chain through an inequality comparison", () => {
    const { instructions: list } = workFunction(`module Game;
let seed: byte = 1;
function work(): byte {
  if (seed == 0) { return 0; }
  if (seed != 1) { return 127; }
  return 255;
}
function main(): void { poke($C000, work()); }`);
    expect(immediateCount(list, "eor", 1)).toBe(1);
  });
});
