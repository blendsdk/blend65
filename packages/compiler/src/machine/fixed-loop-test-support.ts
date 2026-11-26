/**
 * Real-frontend lowering fixtures for the finite-loop schedule.
 *
 * These drive the actual frontend, source proof producer, staging and binder
 * discovery, so a lowering decision observed through one is the decision the
 * compiler makes rather than one a hand-built graph invited. They stop at
 * lowering deliberately: a decision the final observers would later reject is
 * still a decision lowering made, and that is what these fixtures exist to see.
 */
import { createHash } from "node:crypto";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { ProjectSnapshot } from "../project/types.js";
import { deriveClosedObjectFacts } from "../semantic/closed-object-facts.js";
import {
  collectSourceLoopNesting,
  deriveFixedLoopFacts,
  fixedLoopValueBounds,
} from "../semantic/fixed-loop-facts.js";
import { deriveLocalStorageLifetimes } from "../semantic/local-storage-lifetimes.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { selectTargetProfile } from "../target/profile.js";
import { lowerMachineProgram } from "./lower.js";
import type { FixedLoopPolicy, MachineLoweringInput } from "./machine-types.js";

/**
 * Lower one source under a chosen finite-loop policy.
 *
 * @param text Complete module source, compiled as the project's only file.
 * @param policy Finite-loop construction policy the selection would have chosen.
 * @returns The lowering input, the lowered program, its loop facts and the
 * machine function lowered from `Game.work`.
 * @example const fixture = prepareFixedLoopFixture(source, "x-first");
 */
export function prepareFixedLoopFixture(text: string, policy: FixedLoopPolicy = "low-byte") {
  const selected = selectTargetProfile("c64-pal-prg-kernal-6581");
  if (selected.kind !== "complete") throw new Error("Expected fixture profile");
  const profile = selected.profile;
  const sha256 = createHash("sha256").update(text).digest("hex");
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "counter-selection",
      sourceRoot: "src",
      entry: "Game",
      target: profile.id,
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
    effectiveTarget: profile.id,
    effectiveEntry: "Game",
  };
  const analysis = analyzeProject(snapshot);
  if (analysis.kind !== "complete") throw new Error(JSON.stringify(analysis));
  const semantic = buildSemanticProgram(analysis);
  if (semantic.kind !== "complete") throw new Error(JSON.stringify(semantic));
  const closed = closeWholeProgram(semantic.program, profile.interrupts, profile.storage);
  if (closed.kind !== "complete") throw new Error(JSON.stringify(closed.diagnostics));
  const program = closed.program;
  const loops = deriveFixedLoopFacts(program, collectSourceLoopNesting(program, analysis.program));
  const objects = deriveClosedObjectFacts(
    program,
    profile.storage,
    fixedLoopValueBounds(program, loops),
  );
  const lives = deriveLocalStorageLifetimes(program);
  const functions = new Map(
    program.semantic.functions.map((fn) => [
      fn,
      {
        function: fn,
        objects,
        loops: loops.filter((loop) => loop.function === fn),
        lifetimes: new Map([...lives].filter(([, life]) => life.function === fn.id)),
      },
    ]),
  );
  const inventory = inventoryStorage(program);
  const allocated = allocateStorage(inventory, buildInterference(inventory), profile.storage);
  if (allocated.kind !== "complete") throw new Error("Expected fixture homes");
  const input: MachineLoweringInput = {
    program,
    profile,
    placement: allocated.placement,
    bindingNames: new Map(
      analysis.program.bindings.map((binding) => [
        bindingIdentityKey(binding.id),
        binding.qualifiedName ?? binding.name,
      ]),
    ),
    sourceFacts: { program, functions, nonLoopBundle: "closed", loopPolicy: policy },
    boundsCheck: true,
    divisionZeroCheck: true,
  };
  const lowered = lowerMachineProgram(input);
  if (lowered.kind !== "complete") throw new Error(JSON.stringify(lowered));
  return {
    input,
    lowered,
    loops,
    functions,
    machine: lowered.program.functions.find((fn) => fn.sourceName === "Game.work")!,
  };
}
