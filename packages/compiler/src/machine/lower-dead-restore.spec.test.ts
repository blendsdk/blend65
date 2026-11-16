import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProjectOverlay, loadProject } from "../frontend/index.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { selectTargetProfile } from "../target/profile.js";
import type { TargetProfile } from "../target/profile.js";
import { lowerMachineProgram } from "./lower.js";
import type { MachineFunction, MachineTerminator } from "./machine-types.js";

const PROJECT = fileURLToPath(
  new URL("../../../../examples/boing-ball/blend65.json", import.meta.url),
);

/** Close real source before changing any optional ownership facts in a negative control. */
async function closeSource(source?: string) {
  const loaded = await loadProject({ project: PROJECT });
  if (loaded.kind !== "success") throw new Error("Fixture project must load");
  const selected = selectTargetProfile(loaded.snapshot.effectiveTarget);
  if (selected.kind !== "complete") throw new Error("Fixture profile must exist");
  const analysis = await analyzeProjectOverlay(
    loaded.snapshot,
    source === undefined ? [] : [{ sourceId: "src/main.blend", text: source }],
  );
  if (analysis.kind !== "complete") throw new Error("Fixture source must analyze");
  const semantic = buildSemanticProgram(analysis);
  if (semantic.kind !== "complete") throw new Error("Fixture source must lower semantically");
  const closed = closeWholeProgram(
    semantic.program,
    selected.profile.interrupts,
    selected.profile.storage,
  );
  if (closed.kind !== "complete") throw new Error("Fixture source must close");
  return { program: closed.program, profile: selected.profile };
}

/** Supply the real provisional allocation required by source-observation eligibility. */
function lower(program: WholeProgram, profile: TargetProfile) {
  const logicalStorage = inventoryStorage(program);
  const edges = buildInterference(logicalStorage);
  const allocation = allocateStorage(logicalStorage, edges, profile.storage);
  if (allocation.kind !== "complete") throw new Error("Fixture storage must allocate");
  const result = lowerMachineProgram({
    program,
    profile,
    logicalStorage,
    placement: allocation.placement,
    boundsCheck: true,
    divisionZeroCheck: true,
  });
  if (result.kind !== "complete") throw new Error("Accepted fixture must lower to machine code");
  return result.program;
}

/** Enumerate the actual selected edges, including repaired long branches and fallthroughs. */
function successors(terminator: MachineTerminator): readonly string[] {
  switch (terminator.kind) {
    case "jump":
    case "fallthrough":
      return [terminator.target];
    case "branch":
      return [terminator.target, terminator.fallthrough];
    case "long-branch":
      return [terminator.jump.target, terminator.fallthrough];
    case "return":
    case "unreachable":
      return [];
  }
}

/** Restore tails are just as observable as the restore entry. */
function isRestore(label: string): boolean {
  return label === "startup.restore" || label.startsWith("startup.restore.");
}

/** Traverse machine edges independently of the semantic returnability map. */
function reachableRestoreEdges(main: MachineFunction): readonly string[] {
  const entry = main.blocks[0];
  if (entry === undefined) throw new Error("Main must have a machine entry");
  const blocks = new Map(main.blocks.map((block) => [block.label, block]));
  const pending = [entry.label];
  const visited = new Set<string>();
  const restoreEdges: string[] = [];
  while (pending.length > 0) {
    const label = pending.pop();
    if (label === undefined || visited.has(label)) continue;
    visited.add(label);
    const block = blocks.get(label);
    if (block === undefined) throw new Error("Main has an unexpected external machine edge");
    for (const target of successors(block.terminator)) {
      if (isRestore(target)) restoreEdges.push(target);
      else pending.push(target);
    }
  }
  return restoreEdges;
}

/** Retained dead blocks must not leave address operands or terminators naming removed code. */
function allRestoreReferences(main: MachineFunction): readonly string[] {
  return main.blocks.flatMap((block) => [
    ...successors(block.terminator).filter(isRestore),
    ...block.instructions.flatMap((instruction) =>
      instruction.operand?.kind === "label" && isRestore(instruction.operand.label)
        ? [instruction.operand.label]
        : [],
    ),
  ]);
}

describe("machine proof for unreachable cooperative restoration", () => {
  it("should select absent restoration and remove dead return references for the real closed nonreturning program", async () => {
    const { program, profile } = await closeSource();
    const owner = bindingIdentityKey(program.semantic.main);
    expect(program.interruptOwnership?.returningBodies?.get(owner)).toBe(false);
    const machine = lower(program, profile);
    const main = machine.functions.find(
      (fn) => fn.sourceFunction !== undefined && bindingIdentityKey(fn.sourceFunction) === owner,
    );
    expect(main).toBeDefined();
    if (main === undefined) throw new Error("Lowering must retain the actual source main");
    expect(reachableRestoreEdges(main)).toEqual([]);
    expect(machine.c64Startup).toMatchObject({ restoreRequired: false });
    expect(allRestoreReferences(main)).toEqual([]);
  });

  it("should omit constructed restoration and retain snapshots for the real closed nonreturning program", async () => {
    const { program, profile } = await closeSource();
    const machine = lower(program, profile);
    expect(machine.startup.blocks.some((block) => isRestore(block.label))).toBe(false);
    expect(machine.data.find((data) => data.id === "platform.startup-state")?.bytes).toHaveLength(
      49,
    );
  });

  it.each(["ownership", "map", "main-entry", "other-owner"] as const)(
    "should retain restoration when the closed returnability evidence lacks %s",
    async (missing) => {
      const { program, profile } = await closeSource();
      const ownership = program.interruptOwnership;
      if (ownership === undefined) throw new Error("Real closure must provide ownership facts");
      const owner = bindingIdentityKey(program.semantic.main);
      expect(ownership.returningBodies?.get(owner)).toBe(false);
      let changed: WholeProgram;
      if (missing === "ownership") {
        const { interruptOwnership: omitted, ...withoutOwnership } = program;
        void omitted;
        changed = withoutOwnership;
      } else if (missing === "map") {
        const { returningBodies: omitted, ...withoutMap } = ownership;
        void omitted;
        changed = { ...program, interruptOwnership: withoutMap };
      } else {
        const returningBodies = new Map<string, boolean>(
          missing === "other-owner" ? [[`${owner}:another-owner`, false]] : [],
        );
        changed = { ...program, interruptOwnership: { ...ownership, returningBodies } };
      }
      const machine = lower(changed, profile);
      expect(machine.c64Startup).not.toMatchObject({ restoreRequired: false });
      expect(machine.startup.blocks.some((block) => isRestore(block.label))).toBe(true);
    },
  );

  it.each([
    ["normal return", "module Main; function main(): void {}"],
    [
      "reachable conditional return",
      `module Main;
       function main(): void {
         while (peek($D012) != 0) {
           if (peek($D020) == 1) { return; }
           poke($D021, peek($D012));
         }
       }`,
    ],
  ])("should retain restoration and its reachable machine edge for %s", async (_name, source) => {
    const { program, profile } = await closeSource(source);
    const owner = bindingIdentityKey(program.semantic.main);
    expect(program.interruptOwnership?.returningBodies?.get(owner)).toBe(true);
    const machine = lower(program, profile);
    const main = machine.functions.find(
      (fn) => fn.sourceFunction !== undefined && bindingIdentityKey(fn.sourceFunction) === owner,
    );
    if (main === undefined) throw new Error("Returning main must remain emitted");
    expect(reachableRestoreEdges(main).length).toBeGreaterThan(0);
    expect(machine.c64Startup).not.toMatchObject({ restoreRequired: false });
    expect(machine.startup.blocks.some((block) => isRestore(block.label))).toBe(true);
  });

  it.each([
    [
      "ordinary helper",
      `module Main;
       function sample(): byte { return peek($D012); }
       function main(): void { while (true) { poke($D020, sample()); } }`,
    ],
    [
      "installed IRQ handler",
      `module Main;
       import { setIRQ } from c64.system;
       interrupt function observe(): void { poke($D020, 1); }
       function main(): void { setIRQ(&observe); while (true) {} }`,
    ],
    [
      "raw code observer",
      "module Main; function main(): void { while (true) { poke($D020, peek($080D)); } }",
    ],
    [
      "raw low-RAM observer",
      "module Main; function main(): void { while (true) { poke($D020, peek($0002)); } }",
    ],
    [
      "CIA port configuration",
      "module Main; function main(): void { while (true) { poke($DD00, 0); } }",
    ],
    [
      "CIA interrupt configuration",
      "module Main; function main(): void { while (true) { poke($DD0D, 0); } }",
    ],
  ])("should accept %s without specializing restoration", async (_name, source) => {
    const { program, profile } = await closeSource(source);
    const owner = bindingIdentityKey(program.semantic.main);
    expect(program.interruptOwnership?.returningBodies?.get(owner)).toBe(false);
    const machine = lower(program, profile);
    expect(machine.c64Startup).not.toMatchObject({ restoreRequired: false });
    expect(machine.startup.blocks.some((block) => isRestore(block.label))).toBe(true);
  });
});
