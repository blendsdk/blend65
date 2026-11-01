import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { resourceSourceSpans } from "../services/resource-diagnostics.js";
import type { CheckedSourceInput } from "../services/size-selection.js";
import { collectSourceLoopNesting } from "../semantic/fixed-loop-facts.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { selectTargetProfile } from "../target/profile.js";
import { validateMachineProgram } from "./bind.js";
import { lowerMachineProgram } from "./lower.js";
import type { MachineProgram } from "./machine-types.js";
import { deriveOptimizationFacts } from "./optimization-facts.js";
import { applyOptimizationRules, validateRuleObligations } from "./optimization-rules.js";
import type { RulePipelineResult } from "./optimization-rules.js";

const PROFILE_ID = "c64-pal-prg-kernal-6581";
const OTHER_PROFILE_ID = "c64-pal-prg-kernal-8580";

/** The only cleanup rule identities admitted by the foundation pipeline. */
const FOUNDATION_RULE_IDS = [
  "cleanup.copy-forward",
  "cleanup.dead-instruction",
  "cleanup.empty-block",
] as const;

/** Hash source bytes exactly as the project loader records them. */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Build one checked source without touching the host filesystem. */
function checkedSource(text: string, profileId = PROFILE_ID): CheckedSourceInput {
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
      name: "optimization-rules",
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
    effectiveTarget: profileId,
    effectiveEntry: "Game",
  };
  const target = selectTargetProfile(profileId);
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

/** Lower one checked source against its provisional placement. */
function machineProgram(checked: CheckedSourceInput): MachineProgram {
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
  });
  if (lowered.kind !== "complete") throw new Error(lowered.reason);
  return lowered.program;
}

/** Facts and the machine program produced from the same checked source. */
function matchingPair(text: string, profileId = PROFILE_ID) {
  const checked = checkedSource(text, profileId);
  const facts = deriveOptimizationFacts({ checked, mode: "size" });
  return { checked, facts, program: machineProgram(checked) };
}

const SOURCE = `module Game;
function main(): void { poke($d020, 1); }`;

const VARIANT_SOURCE = `module Game;
function main(): void { poke($d020, 1); poke($d021, 2); }`;

describe("optimization rules", () => {
  // A legal program with matching facts completes before any storage projection and
  // the rewritten program is still a legal machine program.
  it("should complete a legal program inside the producer", () => {
    const { facts, program } = matchingPair(SOURCE);
    const result = applyOptimizationRules(facts, program);

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error(result.reason);
    expect(result.producer).toBe("lowering");
    expect(validateMachineProgram(result.program)).toBe(true);
  });

  // Untouched operations retain their canonical form byte for byte: an observable
  // device store has no legal cleanup opportunity.
  it("should preserve canonical code when no cleanup applies", () => {
    const { facts, program } = matchingPair(SOURCE);
    const result = applyOptimizationRules(facts, program);

    if (result.kind !== "complete") throw new Error(result.reason);
    expect(result.applied).toEqual([]);
    expect(result.program).toEqual(program);
  });

  // Rules run in a fixed order and derive only from facts, so repeating the same
  // inputs gives the same result even after a first pass has already run.
  it("should be deterministic across repeated runs", () => {
    const { facts, program } = matchingPair(SOURCE);
    const first = applyOptimizationRules(facts, program);
    const second = applyOptimizationRules(facts, program);

    expect(second).toEqual(first);
  });

  // A facts bundle owns exactly one checked source. A machine program lowered from
  // another source must be rejected before any rule can change it.
  it("should reject facts from a different source", () => {
    const facts = deriveOptimizationFacts({
      checked: checkedSource(SOURCE),
      mode: "size",
    });
    const foreign = machineProgram(checkedSource(VARIANT_SOURCE));

    expect(applyOptimizationRules(facts, foreign)).toMatchObject({ kind: "failure" });
  });

  // The same source text lowered for another target profile is still a different
  // candidate and cannot reuse the first profile's facts.
  it("should reject facts from a different target profile", () => {
    const facts = deriveOptimizationFacts({
      checked: checkedSource(SOURCE),
      mode: "size",
    });
    const foreign = machineProgram(checkedSource(SOURCE, OTHER_PROFILE_ID));

    expect(applyOptimizationRules(facts, foreign)).toMatchObject({ kind: "failure" });
  });

  // Applied rules are exactly the admitted cleanup identities, each declared once,
  // and every applied rule records at least one changed site.
  it("should limit applied rules to the foundation catalogue and declared changes", () => {
    const { facts, program } = matchingPair(SOURCE);
    const result = applyOptimizationRules(facts, program);

    if (result.kind !== "complete") throw new Error(result.reason);
    const ids = result.applied.map(({ ruleId }) => ruleId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of result.applied) {
      expect(FOUNDATION_RULE_IDS).toContain(rule.ruleId);
      expect(rule.functions.length).toBeGreaterThan(0);
      expect(rule.changed.length).toBeGreaterThan(0);
    }
  });

  // Independent validation reports the applied identities of a completed pass.
  it("should validate a complete rule result", () => {
    const { facts, program } = matchingPair(SOURCE);
    const result = applyOptimizationRules(facts, program);
    if (result.kind !== "complete") throw new Error(result.reason);

    const validation = validateRuleObligations(result);
    expect(validation.kind).toBe("complete");
    if (validation.kind !== "complete") throw new Error(validation.reason);
    expect([...validation.applied].sort()).toEqual(
      result.applied.map(({ ruleId }) => ruleId).sort(),
    );
  });

  // A failed pass has no applied rules and cannot validate as complete, so no
  // candidate can be published from it.
  it("should reject validation of a failed rule pass", () => {
    const failure: RulePipelineResult = {
      kind: "failure",
      reason: "rule invariant failed",
      source: null,
    };

    expect(validateRuleObligations(failure)).toMatchObject({ kind: "error" });
  });

  // The three foundation identities are distinct stable strings, so applying one
  // rule can never be mistaken for applying another.
  it("should keep foundation rule identities unique", () => {
    expect(new Set(FOUNDATION_RULE_IDS).size).toBe(FOUNDATION_RULE_IDS.length);
  });
});
