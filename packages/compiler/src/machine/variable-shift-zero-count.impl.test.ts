import { createHash } from "node:crypto";
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
      name: "variable-shift-zero-count",
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

/** Lower the source and return the instructions plus branch terminator opcodes. */
function lowerWitness(source: string): {
  readonly instructions: readonly MachineInstruction[];
  readonly opcodes: readonly string[];
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
  const functions = lowered.program.functions;
  return {
    instructions: functions.flatMap((fn) => fn.blocks.flatMap((block) => block.instructions)),
    opcodes: functions.flatMap((fn) =>
      fn.blocks.flatMap((block) => [
        ...block.instructions.map(({ opcode }) => opcode),
        ...("opcode" in block.terminator ? [block.terminator.opcode] : []),
      ]),
    ),
  };
}

/** Count emitted instructions and branch terminators with one opcode. */
function count(opcodes: readonly string[], opcode: string): number {
  return opcodes.filter((candidate) => candidate === opcode).length;
}

describe("variable shift zero-count reuse", () => {
  it("loads an immediate left value before a bounded private count", () => {
    const { instructions: list, opcodes } = lowerWitness(`module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void { let count: byte = seed & 7; answer = 1 << count; }`);
    expect(count(opcodes, "cpx")).toBe(0);
    expect(count(opcodes, "bcs")).toBe(0);
    expect(count(opcodes, "ldx")).toBe(1);
    expect(count(opcodes, "beq")).toBe(1);
    const ldx = list.findIndex(({ opcode }) => opcode === "ldx");
    const immediate = list.findIndex(
      ({ opcode, operand }) => opcode === "lda" && operand?.kind === "immediate",
    );
    expect(immediate).toBeGreaterThanOrEqual(0);
    expect(immediate).toBeLessThan(ldx);
  });

  it("retains both saturation tests for an unbounded private count", () => {
    const { instructions: list, opcodes } = lowerWitness(`module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void { let count: byte = seed; answer = 1 << count; }`);
    expect(count(opcodes, "cpx")).toBe(2);
    expect(count(opcodes, "bcs")).toBe(1);
  });

  it("clears the bound across an escaping raw write", () => {
    const { instructions: list, opcodes } = lowerWitness(`module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void {
  let count: byte = seed & 7;
  poke(peekw($0330), 0);
  answer = 1 << count;
}`);
    expect(count(opcodes, "cpx")).toBe(2);
    expect(count(opcodes, "bcs")).toBe(1);
  });

  it("clears the bound when the count is reassigned", () => {
    const { instructions: list, opcodes } = lowerWitness(`module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void {
  let count: byte = seed & 7;
  count = seed;
  answer = 1 << count;
}`);
    expect(count(opcodes, "cpx")).toBe(2);
    expect(count(opcodes, "bcs")).toBe(1);
  });

  it("keeps the full-width count path for a word count", () => {
    const { instructions: list, opcodes } = lowerWitness(`module Game;
let seed: word = 7;
let answer: byte = 0;
function main(): void { let count: word = seed; answer = 1 << count; }`);
    expect(count(opcodes, "ldy")).toBeGreaterThanOrEqual(1);
    expect(count(opcodes, "cpx")).toBeGreaterThanOrEqual(1);
  });
});
