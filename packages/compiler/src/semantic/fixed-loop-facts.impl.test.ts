import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { resourceSourceSpans } from "../services/resource-diagnostics.js";
import { closeCanonicalStorage } from "../services/size-selection.js";
import type { CheckedSourceInput } from "../services/size-selection.js";
import { selectTargetProfile } from "../target/profile.js";
import { lowerMachineProgram } from "../machine/lower.js";
import type { MachineSourceFacts } from "../machine/machine-types.js";
import { deriveLocalStorageLifetimes } from "./local-storage-lifetimes.js";
import { deriveClosedObjectFacts } from "./closed-object-facts.js";
import {
  collectSourceLoopNesting,
  deriveFixedLoopFacts,
  fixedLoopValueBounds,
} from "./fixed-loop-facts.js";
import { buildSemanticProgram } from "./lower.js";
import { closeWholeProgram } from "./whole-program.js";

/** Analyze real source records without replacing the parser, types or source closure. */
function checkedSource(text: string): CheckedSourceInput {
  const sha256 = createHash("sha256").update(text, "utf8").digest("hex");
  const source: SourceRecord = {
    sourceId: "src/game.blend",
    text,
    sha256,
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/src/game.blend",
  };
  const profileId = "c64-pal-prg-kernal-6581";
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "fixed-loop-implementation",
      sourceRoot: "src",
      entry: "Game",
      target: profileId,
      assetPaths: [],
      outDir: "out",
      optimization: "size",
      boundsCheck: false,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      byteLength: 2,
      sha256: createHash("sha256").update("{}", "utf8").digest("hex"),
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source],
    inputSha256: sha256,
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: profileId,
    effectiveEntry: "Game",
  };
  const target = selectTargetProfile(profileId);
  if (target.kind !== "complete") throw new Error("Expected the selected fixture profile");
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

/** Assemble already derived facts once; lowering must only look up their original identities. */
function machineFacts(input: CheckedSourceInput): MachineSourceFacts {
  const loops = deriveFixedLoopFacts(input.program, input.loopNesting);
  const objects = deriveClosedObjectFacts(
    input.program,
    input.profile.storage,
    fixedLoopValueBounds(input.program, loops),
  );
  const lifetimes = deriveLocalStorageLifetimes(input.program);
  return {
    program: input.program,
    functions: new Map(
      input.program.semantic.functions.map((fn) => [
        fn,
        {
          function: fn,
          objects,
          loops: loops.filter((loop) => loop.function === fn),
          lifetimes: new Map([...lifetimes].filter(([, lifetime]) => lifetime.function === fn.id)),
        },
      ]),
    ),
  };
}

describe("conditional induction handoff", () => {
  const source = `module Game;
let buffer: byte[8];
function main(): void {
  let k: word = peekw($C110);
  let sum: byte = 0;
  for (let i: word = 0; i < 8; i += 1) {
    buffer[k] = 9;
    sum += byte(i);
  }
  poke($C100, sum);
}`;

  // An unknown typed index may escape its root when runtime bounds checks are off.
  it("should retain an escaping indexed store as a counter observer obligation", () => {
    const input = checkedSource(source);
    const [loop] = deriveFixedLoopFacts(input.program, input.loopNesting);
    expect(loop).toBeDefined();
    if (loop === undefined) throw new Error("Expected a conditional loop fact");
    const indexed = loop.body.operations.find(
      (operation) =>
        operation.kind === "store" && operation.place.path.some((part) => part.kind === "index"),
    );
    expect(indexed).toBeDefined();
    expect(loop.observerOperations).toContain(indexed);
  });

  it("should carry conditional loop premises through a non-loop object query", () => {
    const input = checkedSource(source);
    const loops = deriveFixedLoopFacts(input.program, input.loopNesting);
    const bounds = fixedLoopValueBounds(input.program, loops);
    const facts = deriveClosedObjectFacts(input.program, input.profile.storage, bounds);
    expect(facts.rangeObservers).toEqual(loops);
    expect(facts.rangeObservers[0]).toBe(loops[0]);
  });

  // Canonical reservation creates a different program representation. It must
  // not advertise source metadata still stamped with the original program.
  it("should keep lexical metadata on checked source rather than rebound canonical storage", () => {
    const input = checkedSource(`module Game;
zeropage { place(at: $03) owned: byte[2] = [7, 9]; }
function main(): void { for (let i: word = 0; i < 8; i += 1) { poke($C100, byte(i)); } }`);
    expect(input.loopNesting?.program).toBe(input.program);
    const canonical = closeCanonicalStorage(input);
    expect(canonical.kind).toBe("complete");
    if (canonical.kind !== "complete") throw new Error("Expected direct storage closure");
    expect(canonical.value.program).not.toBe(input.program);
    expect(canonical.value).not.toHaveProperty("loopNesting");
    expect(input.loopNesting?.program).toBe(input.program);
  });

  it("should retain ordinary machine output when carrying source facts through zero-page reservation", () => {
    const input = checkedSource(`module Game;
zeropage { place(at: $03) owned: byte[2] = [7, 9]; }
function main(): void { for (let i: word = 0; i < 8; i += 1) { poke($C100, byte(i)); } }`);
    const canonical = closeCanonicalStorage(input);
    if (canonical.kind !== "complete") throw new Error("Expected direct storage closure");
    const lowering = {
      program: canonical.value.program,
      profile: input.profile,
      placement: canonical.value.certificate.placement,
      boundsCheck: false,
      divisionZeroCheck: true,
    };
    const direct = lowerMachineProgram(lowering);
    const selected = lowerMachineProgram({ ...lowering, sourceFacts: machineFacts(input) });
    expect(direct.kind).toBe("complete");
    expect(selected.kind).toBe("complete");
    if (direct.kind !== "complete" || selected.kind !== "complete")
      throw new Error("Expected direct machine output");
    expect(selected.program).toEqual(direct.program);
    expect(selected.diagnostics).toEqual(direct.diagnostics);
  });

  it("should reject stale function, object, loop and lifetime identities before machine lowering", () => {
    const input = checkedSource(source);
    const canonical = closeCanonicalStorage(input);
    if (canonical.kind !== "complete") throw new Error("Expected direct storage closure");
    const facts = machineFacts(input);
    const [fn, original] = [...facts.functions][0]!;
    const loop = original.loops[0]!;
    const [key, lifetime] = [...original.lifetimes][0]!;
    const invalid = [
      new Map([[{ ...fn }, original]]),
      new Map([[fn, { ...original, function: { ...fn } }]]),
      new Map([
        [fn, { ...original, objects: { ...original.objects, program: { ...input.program } } }],
      ]),
      new Map([[fn, { ...original, loops: [{ ...loop, function: { ...fn } }] }]]),
      new Map([
        [fn, { ...original, lifetimes: new Map([[key, { ...lifetime, function: { ...fn.id } }]]) }],
      ]),
    ];
    for (const functions of invalid)
      expect(
        lowerMachineProgram({
          program: canonical.value.program,
          profile: input.profile,
          placement: canonical.value.certificate.placement,
          sourceFacts: { ...facts, functions },
        }),
      ).toMatchObject({
        kind: "error",
        reason: "Machine function facts do not match the checked source function",
      });
    expect(
      lowerMachineProgram({
        program: { ...canonical.value.program, roots: [...input.program.roots] },
        profile: input.profile,
        placement: canonical.value.certificate.placement,
        sourceFacts: facts,
      }),
    ).toMatchObject({
      kind: "error",
      reason: "Machine source facts do not match the checked source program",
    });
  });
});
