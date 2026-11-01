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
import { selectTargetProfile } from "../target/profile.js";
import { deriveOptimizationFacts } from "./optimization-facts.js";
import type { OptimizationFacts } from "./optimization-facts.js";

const PROFILE_ID = "c64-pal-prg-kernal-6581";

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
      name: "optimization-facts",
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

/** Deterministic function order is the observable identity of the facts map. */
function functionNames(facts: OptimizationFacts): readonly string[] {
  return [...facts.functions.values()].map((entry) => entry.function.name);
}

const SOURCE = `module Game;
function helper(value: byte): byte { return value + 1; }
function main(): void { poke($d020, helper(1)); }`;

describe("optimization facts", () => {
  // Facts always belong to the exact checked program and profile they were derived from.
  it.each(["size", "balanced", "speed"] as const)(
    "should retain the checked source and record mode %s",
    (mode) => {
      const checked = checkedSource(SOURCE);
      const facts = deriveOptimizationFacts({ checked, mode });

      expect(facts.program).toBe(checked.program);
      expect(facts.profile).toBe(checked.profile);
      expect(facts.mode).toBe(mode);
      expect(facts.functions.size).toBe(checked.program.semantic.functions.length);
    },
  );

  // One immutable bundle per checked candidate; no rule may mutate shared facts.
  it("should return an immutable bundle", () => {
    const checked = checkedSource(SOURCE);
    expect(Object.isFrozen(deriveOptimizationFacts({ checked, mode: "size" }))).toBe(true);
  });

  // Derivation is deterministic: repeated reads of the same checked source agree in
  // content and in function order, so rules cannot depend on discovery order.
  it("should derive deterministic content and order for the same checked source", () => {
    const checked = checkedSource(SOURCE);
    const first = deriveOptimizationFacts({ checked, mode: "size" });
    const second = deriveOptimizationFacts({ checked, mode: "size" });

    expect(second).toEqual(first);
    expect(functionNames(second)).toEqual(functionNames(first));
  });

  // A rebuilt but byte-identical source produces the same facts, so identity is bound
  // to source content rather than to host object identity.
  it("should derive the same facts from a rebuilt identical source", () => {
    const first = deriveOptimizationFacts({
      checked: checkedSource(SOURCE),
      mode: "size",
    });
    const second = deriveOptimizationFacts({
      checked: checkedSource(SOURCE),
      mode: "size",
    });

    expect(functionNames(second)).toEqual(functionNames(first));
    expect(second.functions.size).toBe(first.functions.size);
  });
});
