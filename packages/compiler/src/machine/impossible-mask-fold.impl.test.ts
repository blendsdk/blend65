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
      name: "impossible-mask-fold",
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
function witness(source: string): {
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

/** Count instructions matching one opcode and an immediate value. */
function immediate(list: readonly MachineInstruction[], opcode: string, value: number): number {
  return list.filter(
    (instruction) =>
      instruction.opcode === opcode &&
      instruction.operand?.kind === "immediate" &&
      instruction.operand.value === value,
  ).length;
}

/** Count loads from the fixed CIA2 interrupt-control register. */
function icrReads(list: readonly MachineInstruction[]): number {
  return list.filter(
    (instruction) =>
      instruction.opcode === "lda" &&
      instruction.mode === "absolute" &&
      instruction.operand?.kind === "absolute" &&
      instruction.operand.value === 0xdd0d,
  ).length;
}

const witnessSource = (comparison: "==" | "!=", constant = 3) => `module Game;
let finished: boolean = false;
function main(): void {
  finished = ((peek($DD0D) & 14) ${comparison} ${constant});
  if (finished) { poke($0410, 1); } else { poke($0410, 0); }
}`;

describe("impossible masked comparison fold", () => {
  it("materializes a false equality from one ICR read", () => {
    const { instructions: list } = witness(witnessSource("=="));
    expect(icrReads(list)).toBe(1);
    expect(immediate(list, "lda", 0)).toBeGreaterThanOrEqual(1);
    expect(immediate(list, "and", 14)).toBe(0);
    expect(immediate(list, "eor", 3)).toBe(0);
  });

  it("materializes a true inequality from one ICR read", () => {
    const { instructions: list } = witness(witnessSource("!="));
    expect(icrReads(list)).toBe(1);
    expect(immediate(list, "lda", 1)).toBeGreaterThanOrEqual(1);
    expect(immediate(list, "and", 14)).toBe(0);
    expect(immediate(list, "eor", 3)).toBe(0);
  });

  it("keeps the mask and comparison when the constant is reachable", () => {
    const { instructions: list } = witness(witnessSource("==", 2));
    expect(icrReads(list)).toBe(1);
    expect(immediate(list, "and", 14)).toBe(1);
    expect(immediate(list, "eor", 2)).toBe(1);
  });

  it("does not fold a runtime mask", () => {
    const { instructions: list } = witness(`module Game;
let finished: boolean = false;
function main(): void {
  let mask: byte = peek($0401) & 15;
  finished = ((peek($DD0D) & mask) == 3);
  if (finished) { poke($0410, 1); } else { poke($0410, 0); }
}`);
    expect(immediate(list, "eor", 3)).toBe(1);
  });
});
