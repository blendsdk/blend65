import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { resourceSourceSpans } from "../services/resource-diagnostics.js";
import type { CheckedSourceInput } from "../services/size-selection.js";
import { collectSourceLoopNesting } from "../semantic/fixed-loop-facts.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { selectTargetProfile } from "../target/profile.js";
import { lowerMachineProgram } from "./lower.js";
import { machineInstruction } from "./lower-control.js";
import { selectedProfile, sourceSpan } from "./lowering-test-support.js";
import type { MachineFunction, MachineProgram } from "./machine-types.js";
import { deriveOptimizationFacts } from "./optimization-facts.js";
import type { OptimizationFacts } from "./optimization-facts.js";
import { applyOptimizationRules } from "./optimization-rules.js";

const PROFILE_ID = "c64-pal-prg-kernal-6581";
const SOURCE = `module Game;
let saved: byte[1];
function main(): void { saved[0] = peek($C118); }`;

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Build one checked source without touching the host filesystem. */
function checkedSource(text: string): CheckedSourceInput {
  const hash = sha256(text);
  const source: SourceRecord = {
    sourceId: "src/game.blend",
    text,
    sha256: hash,
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/src/game.blend",
  };
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "optimization-cleanup",
      sourceRoot: "src",
      entry: "Game",
      target: PROFILE_ID,
      assetPaths: [],
      outDir: "out",
      optimization: "size",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      sha256: sha256("{}"),
      byteLength: 2,
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source],
    inputSha256: hash,
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: PROFILE_ID,
    effectiveEntry: "Game",
  };
  const target = selectTargetProfile(PROFILE_ID);
  if (target.kind !== "complete") throw new Error("Expected the selected target profile");
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
  return {
    snapshot,
    profile: target.profile,
    program: closed.program,
    loopNesting: collectSourceLoopNesting(closed.program, analysis.program),
    bindingNames: new Map(
      analysis.program.bindings.map((binding) => [
        bindingIdentityKey(binding.id),
        binding.qualifiedName ?? binding.name,
      ]),
    ),
    resourceSpans: resourceSourceSpans(analysis.program),
    sourceText: (span) => Buffer.from(text, "utf8").subarray(span.start, span.end).toString("utf8"),
    diagnostics: analysis.diagnostics,
  };
}

/** Lower the checked source with or without candidate facts. */
function lower(checked: CheckedSourceInput, facts?: OptimizationFacts): MachineProgram {
  const inventory = inventoryStorage(checked.program);
  const allocation = allocateStorage(
    inventory,
    buildInterference(inventory),
    checked.profile.storage,
  );
  if (allocation.kind !== "complete") throw new Error("Expected provisional storage placement");
  const lowered = lowerMachineProgram({
    program: checked.program,
    placement: allocation.placement,
    profile: checked.profile,
    ...(facts === undefined ? {} : { optimizationFacts: facts }),
  });
  if (lowered.kind !== "complete") throw new Error(lowered.reason);
  return lowered.program;
}

/** Locate adjacent store/reload pairs over one direct home. */
function reloadPairs(program: MachineProgram): readonly [string, number][] {
  const pairs: [string, number][] = [];
  for (const fn of program.functions)
    for (const block of fn.blocks)
      for (let index = 0; index + 1 < block.instructions.length; index += 1) {
        const store = block.instructions[index]!;
        const load = block.instructions[index + 1]!;
        if (!["sta", "stx", "sty"].includes(store.opcode)) continue;
        if (store.operand?.kind !== "storage" || load.operand?.kind !== "storage") continue;
        if (store.operand.requestId !== load.operand.requestId) continue;
        if ((store.operand.offset ?? 0) !== (load.operand.offset ?? 0)) continue;
        pairs.push([block.label, index]);
      }
  return pairs;
}

/** Copy one function with a different execution context for a discriminating negative. */
function withContext(
  fn: MachineFunction,
  context: MachineFunction["executionContext"],
): MachineFunction {
  return Object.freeze({ ...fn, executionContext: context });
}

describe("foundation cleanup", () => {
  it("should remove a proved store/reload pair and keep storage demand unchanged", () => {
    const checked = checkedSource(SOURCE);
    const facts = deriveOptimizationFacts({ checked, mode: "size" });
    const before = lower(checked);
    const result = applyOptimizationRules(facts, before);

    if (result.kind !== "complete") throw new Error(result.reason);
    expect(reloadPairs(before).length).toBeGreaterThan(0);
    expect(reloadPairs(result.program)).toEqual([]);
    expect(result.program.requiredStorage.map(({ id }) => id)).toEqual(
      before.requiredStorage.map(({ id }) => id),
    );
    expect(result.applied.map(({ ruleId }) => ruleId)).toEqual(["cleanup.copy-forward"]);
    expect(result.applied[0]!.changed.length).toBe(reloadPairs(before).length);
    expect(result.applied[0]!.obligations).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "source-equivalence" })]),
    );
  });

  it("should keep the canonical pair when no candidate facts are supplied", () => {
    const checked = checkedSource(SOURCE);
    const canonical = lower(checked);

    expect(reloadPairs(canonical).length).toBeGreaterThan(0);
    expect(reloadPairs(lower(checked)).length).toBe(reloadPairs(canonical).length);
  });

  it("should keep candidate lowering identical when the rules produce no change", () => {
    const checked = checkedSource(SOURCE);
    const facts = deriveOptimizationFacts({ checked, mode: "size" });
    const optimized = lower(checked, facts);

    expect(reloadPairs(optimized)).toEqual([]);
  });

  it("should leave an interrupt-context pair unchanged", () => {
    const checked = checkedSource(SOURCE);
    const facts = deriveOptimizationFacts({ checked, mode: "size" });
    const before = lower(checked);
    expect(reloadPairs(before).length).toBeGreaterThan(0);
    const guarded = Object.freeze({
      ...before,
      functions: Object.freeze([
        withContext(before.functions[0]!, { domain: "irq", irq: 1, nmi: 0 }),
      ]),
    });

    const result = applyOptimizationRules(facts, guarded);
    if (result.kind !== "complete") throw new Error(result.reason);
    expect(reloadPairs(result.program).length).toBe(reloadPairs(guarded).length);
  });

  it("should leave a declared or persistent home unchanged", () => {
    const checked = checkedSource(SOURCE);
    const facts = deriveOptimizationFacts({ checked, mode: "size" });
    const before = lower(checked);
    const pair = reloadPairs(before)[0];
    if (pair === undefined) throw new Error("Expected one store/reload pair");
    const block = before.functions[0]!.blocks.find(({ label }) => label === pair[0])!;
    const requestId = block.instructions[pair[1]]!.operand;
    if (requestId?.kind !== "storage") throw new Error("Expected a storage store");
    const guarded = Object.freeze({
      ...before,
      requiredStorage: Object.freeze(
        before.requiredStorage.map((request) =>
          request.id === requestId.requestId
            ? Object.freeze({ ...request, binding: checked.program.semantic.main })
            : request,
        ),
      ),
    });

    const result = applyOptimizationRules(facts, guarded);
    if (result.kind !== "complete") throw new Error(result.reason);
    expect(result.applied).toEqual([]);
    expect(reloadPairs(result.program).length).toBe(1);
  });

  it("should leave a volatile or non-storage operand unchanged", () => {
    const checked = checkedSource(SOURCE);
    const facts = deriveOptimizationFacts({ checked, mode: "size" });
    const before = lower(checked);
    const pair = reloadPairs(before)[0];
    if (pair === undefined) throw new Error("Expected one store/reload pair");
    const main = before.functions[0]!;
    const block = main.blocks.find(({ label }) => label === pair[0])!;
    const volatile = Object.freeze({
      ...before,
      functions: Object.freeze([
        Object.freeze({
          ...main,
          blocks: Object.freeze(
            main.blocks.map((candidate) =>
              candidate.label !== block.label
                ? candidate
                : Object.freeze({
                    ...candidate,
                    instructions: Object.freeze(
                      candidate.instructions.map((instruction, index) =>
                        index === pair[1]
                          ? Object.freeze({
                              ...instruction,
                              operand: Object.freeze({ kind: "absolute" as const, value: 0xd020 }),
                            })
                          : instruction,
                      ),
                    ),
                  }),
            ),
          ),
        }),
      ]),
    });

    const result = applyOptimizationRules(facts, volatile);
    if (result.kind !== "complete") throw new Error(result.reason);
    expect(result.applied).toEqual([]);
    expect(result.program.functions[0]!.blocks).toEqual(volatile.functions[0]!.blocks);
  });

  it("should remove a fully overwritten flag write and not one that is still read", () => {
    const checked = checkedSource(SOURCE);
    const facts = deriveOptimizationFacts({ checked, mode: "size" });
    const before = lower(checked);
    const main = before.functions[0]!;
    const cpu = selectedProfile().cpu;
    const span = sourceSpan(10);
    const clc = machineInstruction(cpu, "clc", "implied", null, [], span);
    const sec = machineInstruction(cpu, "sec", "implied", null, [], span);
    const adc = machineInstruction(
      cpu,
      "adc",
      "immediate",
      { kind: "immediate", value: 1 },
      [],
      span,
    );

    const withPair = (first: typeof clc, next: typeof sec | typeof adc): MachineProgram =>
      Object.freeze({
        ...before,
        functions: Object.freeze([
          Object.freeze({
            ...main,
            blocks: Object.freeze([
              Object.freeze({
                ...main.blocks[0]!,
                instructions: Object.freeze([first, next]),
              }),
              ...main.blocks.slice(1),
            ]),
          }),
        ]),
      });

    const dead = applyOptimizationRules(facts, withPair(clc, sec));
    if (dead.kind !== "complete") throw new Error(dead.reason);
    expect(dead.program.functions[0]!.blocks[0]!.instructions).toEqual([sec]);
    expect(dead.applied.map(({ ruleId }) => ruleId)).toContain("cleanup.dead-instruction");

    const live = applyOptimizationRules(facts, withPair(clc, adc));
    if (live.kind !== "complete") throw new Error(live.reason);
    expect(live.program.functions[0]!.blocks[0]!.instructions).toEqual([clc, adc]);
  });

  it("should remove only an unreferenced empty fallthrough block", () => {
    const checked = checkedSource(SOURCE);
    const facts = deriveOptimizationFacts({ checked, mode: "size" });
    const before = lower(checked);
    const main = before.functions[0]!;
    const fallthrough = { kind: "fallthrough" as const, target: main.blocks[0]!.label };
    const empty = (label: string) =>
      Object.freeze({ label, instructions: Object.freeze([]), terminator: fallthrough });

    const removable = applyOptimizationRules(
      facts,
      Object.freeze({
        ...before,
        functions: Object.freeze([
          Object.freeze({ ...main, blocks: Object.freeze([...main.blocks, empty("dead")]) }),
        ]),
      }),
    );
    if (removable.kind !== "complete") throw new Error(removable.reason);
    expect(removable.program.functions[0]!.blocks.some(({ label }) => label === "dead")).toBe(
      false,
    );

    const referenced = applyOptimizationRules(
      facts,
      Object.freeze({
        ...before,
        functions: Object.freeze([
          Object.freeze({
            ...main,
            blocks: Object.freeze([
              Object.freeze({
                ...main.blocks[0]!,
                terminator: Object.freeze({
                  kind: "fallthrough" as const,
                  target: "dead",
                }),
              }),
              ...main.blocks.slice(1),
              empty("dead"),
            ]),
          }),
        ]),
      }),
    );
    if (referenced.kind !== "complete") throw new Error(referenced.reason);
    expect(referenced.program.functions[0]!.blocks.some(({ label }) => label === "dead")).toBe(
      true,
    );
  });

  it("should leave a candidate with conditional representation proofs canonical", () => {
    const checked = checkedSource(SOURCE);
    const facts = deriveOptimizationFacts({ checked, mode: "size" });
    const before = lower(checked);
    const main = before.functions[0]!;
    const guarded = Object.freeze({
      ...before,
      functions: Object.freeze([Object.freeze({ ...main, fixedLoopProofs: Object.freeze([]) })]),
    });

    const result = applyOptimizationRules(facts, guarded);
    if (result.kind !== "complete") throw new Error(result.reason);
    expect(result.applied).toEqual([]);
    expect(result.program).toBe(guarded);
  });
});
