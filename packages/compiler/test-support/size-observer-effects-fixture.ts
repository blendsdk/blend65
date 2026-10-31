import { createHash } from "node:crypto";
import { analyzeProject } from "../src/frontend/service.js";
import { bindingIdentityKey } from "../src/frontend/semantic-types.js";
import { buildSemanticProgram } from "../src/semantic/lower.js";
import { closeWholeProgram } from "../src/semantic/whole-program.js";
import { deriveClosedObjectFacts } from "../src/semantic/closed-object-facts.js";
import { deriveLocalStorageLifetimes } from "../src/semantic/local-storage-lifetimes.js";
import {
  collectSourceLoopNesting,
  deriveFixedLoopFacts,
  fixedLoopValueBounds,
} from "../src/semantic/fixed-loop-facts.js";
import { deriveByteComplementFacts } from "../src/machine/byte-value-availability.js";
import { lowerMachineProgram } from "../src/machine/lower.js";
import { selectClosedObjectStorage } from "../src/storage/selection.js";
import { inventoryStorage } from "../src/storage/inventory.js";
import { closeStorage } from "../src/storage/closure.js";
import { closeSharedStorage } from "../src/services/shared-storage.js";
import type { ProjectSnapshot } from "../src/project/types.js";
import type { MachineFunctionSourceFacts, FixedLoopPolicy } from "../src/machine/machine-types.js";
import { selectTargetProfile } from "../src/target/profile.js";
import { resourceSourceSpans } from "../src/services/resource-diagnostics.js";
import { closeCanonicalReference, closeCanonicalStorage } from "../src/services/size-selection.js";
import type { CheckedSourceInput } from "../src/services/size-selection.js";

/**
 * Real checked-source and canonical closure, without files, fabricated proofs or a test runner.
 * @param text Complete source module for the fixture.
 * @param optimization Canonical manifest option; size retains internal observer evidence.
 * @param boundsCheck Preserve the caller's configured source bounds policy.
 * @param loopPolicy Optional independently lowered Closed candidate, not reference reuse.
 * @returns Checked source, real feasible reference and the independently closed candidate.
 * @throws {Error} If any actual source, lowering, storage or layout stage fails.
 * @example const input = effectFixture(source, "size", true, "original");
 */
export function effectFixture(
  text: string,
  optimization: "none" | "size" = "size",
  boundsCheck = true,
  loopPolicy?: FixedLoopPolicy,
) {
  const target = "c64-pal-prg-kernal-6581";
  const sha256 = createHash("sha256").update(text).digest("hex");
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "effects",
      sourceRoot: "src",
      entry: "Game",
      target,
      assetPaths: [],
      outDir: "out",
      optimization,
      boundsCheck,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      byteLength: 2,
      sha256: createHash("sha256").update("{}").digest("hex"),
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [
      {
        sourceId: "src/game.blend",
        text,
        sha256,
        byteLength: Buffer.byteLength(text),
        resolvedPath: "/checkout/src/game.blend",
      },
    ],
    inputSha256: sha256,
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: target,
    effectiveEntry: "Game",
  };
  const selected = selectTargetProfile(target);
  if (selected.kind !== "complete") throw new Error("Expected selected profile");
  const analysis = analyzeProject(snapshot);
  if (analysis.kind !== "complete") throw new Error(JSON.stringify(analysis.diagnostics));
  const semantic = buildSemanticProgram(analysis);
  if (semantic.kind !== "complete") throw new Error(JSON.stringify(semantic));
  const closed = closeWholeProgram(
    semantic.program,
    selected.profile.interrupts,
    selected.profile.storage,
  );
  if (closed.kind !== "complete") throw new Error(JSON.stringify(closed.diagnostics));
  const checked: CheckedSourceInput = {
    snapshot: { ...snapshot, ...analysis.inputs },
    profile: selected.profile,
    program: closed.program,
    bindingNames: new Map(
      analysis.program.bindings.map((binding) => [
        bindingIdentityKey(binding.id),
        binding.qualifiedName ?? binding.name,
      ]),
    ),
    resourceSpans: resourceSourceSpans(analysis.program),
    diagnostics: [],
    sourceText: (span) => {
      const source = analysis.inputs.sources.find((entry) => entry.sourceId === span.sourceId);
      return source === undefined
        ? ""
        : Buffer.from(source.text).subarray(span.start, span.end).toString();
    },
  };
  const storage = closeCanonicalStorage(checked);
  if (storage.kind !== "complete") throw new Error(JSON.stringify(storage));
  const reference = closeCanonicalReference(storage.value);
  if (reference.kind !== "feasible") throw new Error(JSON.stringify(reference));
  let candidate = { lowered: storage.value.lowered, shared: reference.shared };
  if (loopPolicy !== undefined) {
    const program = checked.program;
    const loops = deriveFixedLoopFacts(
      program,
      collectSourceLoopNesting(program, analysis.program),
    );
    const objects = deriveClosedObjectFacts(
      program,
      selected.profile.storage,
      fixedLoopValueBounds(program, loops),
    );
    const lifetimes = deriveLocalStorageLifetimes(program);
    const selections = selectClosedObjectStorage(objects);
    const functions = new Map(
      program.semantic.functions.map((fn) => {
        const packet: MachineFunctionSourceFacts = {
          function: fn,
          objects,
          loops: loops.filter((loop) => loop.function === fn),
          lifetimes: new Map([...lifetimes].filter(([, life]) => life.function === fn.id)),
          ...(selections.has(fn) ? { storage: selections.get(fn)! } : {}),
        };
        return [
          fn,
          { ...packet, complements: deriveByteComplementFacts(packet, selected.profile) },
        ] as const;
      }),
    );
    // Lowering exposes a generic storage type. Check its real target before
    // retaining that identity in the selected profile's stricter typed view.
    const allocatedStorage = storage.value.lowered.program.storageProfile!;
    if (allocatedStorage.profileId !== selected.profile.id)
      throw new Error("Expected allocation for the selected target profile");
    const profile = {
      ...selected.profile,
      storage: { ...allocatedStorage, profileId: selected.profile.id },
    };
    const lowered = lowerMachineProgram({
      program: storage.value.program,
      profile,
      logicalStorage: inventoryStorage(storage.value.program),
      observerEvidence: true,
      sourceFacts: { program, functions, nonLoopBundle: "closed", loopPolicy },
      bindingNames: checked.bindingNames,
      boundsCheck,
      divisionZeroCheck: true,
    });
    if (lowered.kind !== "complete") throw new Error(lowered.reason);
    const closed = closeStorage(lowered.inventory, profile.storage, lowered.binder);
    if (closed.kind !== "complete") throw new Error(JSON.stringify(closed));
    const shared = closeSharedStorage(lowered.program, lowered.binder, closed, selected.profile);
    if (shared.kind !== "complete") throw new Error(JSON.stringify(shared));
    candidate = { lowered, shared };
  }
  return { checked, reference, candidate };
}
