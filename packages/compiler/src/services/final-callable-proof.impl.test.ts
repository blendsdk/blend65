import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { C64LayoutResult } from "../layout/c64-layout.js";
import { bindingLabel } from "../machine/lower-control.js";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { selectTargetProfile } from "../target/profile.js";
import { projectFinalGlobalRanges, validateFinalCallableProof } from "./final-callable-proof.js";
import { resourceSourceSpans } from "./resource-diagnostics.js";
import { closeCanonicalReference, closeCanonicalStorage } from "./size-selection.js";
import type { CheckedSourceInput } from "./size-selection.js";

const PROFILE_ID = "c64-pal-prg-kernal-6581";

/** One complete layout, the only form these checks accept. */
type CompleteLayout = Extract<C64LayoutResult, { readonly kind: "complete" }>;

/** Hash source bytes exactly as the project loader records them. */
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
      name: "callable-proof",
      sourceRoot: "src",
      entry: "Game",
      target: PROFILE_ID,
      assetPaths: [],
      outDir: "out",
      optimization: "none",
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

/** Close one source all the way to a real layout, as an ordinary build does. */
function reference(text: string, candidate = false) {
  const input = checkedSource(text);
  const storage = closeCanonicalStorage(input);
  if (storage.kind !== "complete") throw new Error(`Expected storage: ${storage.kind}`);
  return { input, outcome: closeCanonicalReference(storage.value, candidate) };
}

/** Resolve the bytes one named global received in a complete layout. */
function placedGlobal(input: CheckedSourceInput, layout: CompleteLayout, name: string) {
  const global = input.program.semantic.globals.find(
    (candidate) =>
      input.bindingNames.get(bindingIdentityKey(candidate.id))?.endsWith(name) === true,
  );
  if (global === undefined) throw new Error(`Fixture has no global named '${name}'`);
  const label = bindingLabel("global", global.id);
  const interval = layout.intervals.find((placed) => placed.id === label);
  if (interval === undefined) throw new Error(`Global '${name}' was not placed`);
  return { global, label, interval };
}

/** The call needs its target, and one same-width literal selects where the write lands. */
const DISJOINT = `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function main(): void {
  callback = &chosen;
  pokew($C100, 0);
  poke($C000, callback());
}
`;

/** Replace only the write address, so every other source span keeps its offset. */
function writingTo(address: number): string {
  const literal = `$${address.toString(16).toUpperCase().padStart(4, "0")}`;
  if (literal.length !== 5) throw new Error("Fixture addresses stay four hexadecimal digits");
  return DISJOINT.replace("$C100", literal);
}

/** Close the disjoint control once and report where its callable actually went. */
function callableAddress(): number {
  const { input, outcome } = reference(DISJOINT);
  if (outcome.kind !== "feasible") throw new Error(`Control must be feasible: ${outcome.kind}`);
  return placedGlobal(input, outcome.shared.layout, "callback").interval.start;
}

describe("final global range projection", () => {
  // Layout reports an inclusive last address; the byte analysis is half-open.
  it("should convert each placed interval to a half-open range of the declared size", () => {
    const { input, outcome } = reference(DISJOINT);
    if (outcome.kind !== "feasible") throw new Error("Expected a feasible control");
    const { global, interval } = placedGlobal(input, outcome.shared.layout, "callback");
    const projection = projectFinalGlobalRanges(input.program, outcome.shared.layout);

    expect(projection.kind).toBe("complete");
    if (projection.kind !== "complete") throw new Error("Expected a complete projection");
    expect(projection.ranges.get(bindingIdentityKey(global.id))).toEqual({
      start: interval.start,
      end: interval.end + 1,
    });
    expect(interval.end + 1 - interval.start).toBe(2);
  });

  // An inlined constant has no storage, so it contributes no interval at all.
  it("should leave out a global the data producer never materialized", () => {
    const text = DISJOINT.replace("let callback:", "const LIMIT: byte = 7;\nlet callback:");
    const { input, outcome } = reference(text);
    if (outcome.kind !== "feasible") throw new Error("Expected a feasible control");
    const projection = projectFinalGlobalRanges(input.program, outcome.shared.layout);
    const inlined = input.program.semantic.globals.find(
      (global) => input.bindingNames.get(bindingIdentityKey(global.id))?.endsWith("LIMIT") === true,
    );

    expect(inlined).toBeDefined();
    if (inlined === undefined) throw new Error("Fixture lost its constant");
    expect(outcome.shared.layout.program.data.map(({ id }) => id)).not.toContain(
      bindingLabel("global", inlined.id),
    );
    if (projection.kind !== "complete") throw new Error("Expected a complete projection");
    expect(projection.ranges.has(bindingIdentityKey(inlined.id))).toBe(false);
  });

  // Disagreeing producers are a compiler fault; no interval may be assumed from them.
  it.each([
    [
      "the same object is placed twice",
      (layout: CompleteLayout, label: string): CompleteLayout => ({
        ...layout,
        intervals: [...layout.intervals, layout.intervals.find(({ id }) => id === label)!],
      }),
      /more than once/u,
    ],
    [
      "a materialized object has no interval",
      (layout: CompleteLayout, label: string): CompleteLayout => ({
        ...layout,
        intervals: layout.intervals.filter(({ id }) => id !== label),
      }),
      /no placed interval/u,
    ],
    [
      "an object is placed although it was never materialized",
      (layout: CompleteLayout, label: string): CompleteLayout => ({
        ...layout,
        program: {
          ...layout.program,
          data: layout.program.data.filter(({ id }) => id !== label),
        },
      }),
      /never materialized/u,
    ],
    [
      "a placed interval is the wrong size",
      (layout: CompleteLayout, label: string): CompleteLayout => ({
        ...layout,
        intervals: layout.intervals.map((interval) =>
          interval.id === label ? { ...interval, end: interval.end + 1 } : interval,
        ),
      }),
      /bytes but its type needs/u,
    ],
  ])("should report a producer disagreement when %s", (_name, damage, reason) => {
    const { input, outcome } = reference(DISJOINT);
    if (outcome.kind !== "feasible") throw new Error("Expected a feasible control");
    const { label } = placedGlobal(input, outcome.shared.layout, "callback");
    const projection = projectFinalGlobalRanges(
      input.program,
      damage(outcome.shared.layout, label),
    );

    expect(projection.kind).toBe("invariant");
    if (projection.kind !== "invariant") throw new Error("Expected a producer disagreement");
    expect(projection.reason).toMatch(reason);
    expect(projection.reason).toContain(label);
  });
});

describe("final callable proof at a real layout", () => {
  // The disjoint control is the baseline: nothing about it may become an error.
  it("should accept a write that misses the callable bytes", () => {
    const { input, outcome } = reference(DISJOINT);
    if (outcome.kind !== "feasible") throw new Error("Expected a feasible control");

    expect(validateFinalCallableProof(input.program, input.profile, outcome.shared.layout)).toEqual(
      { kind: "valid" },
    );
  });

  // Only the representation's own addresses decide; the write now covers them.
  it("should reject the canonical representation when the write covers the callable", () => {
    const { outcome } = reference(writingTo(callableAddress()));

    expect(outcome.kind).toBe("failure");
    if (outcome.kind !== "failure") throw new Error("Expected a canonical failure");
    expect(outcome.failure.category).toBe("source");
    expect(outcome.failure.diagnostics.map(({ code }) => code)).toEqual(["E10277"]);
    expect(outcome.failure.diagnostics[0]?.related.map(({ message }) => message)).toContainEqual(
      expect.stringMatching(/^A raw memory write replaces the callable bytes placed at \$/u),
    );
  });

  // An optional representation withdraws instead of failing the whole build,
  // so a valid canonical representation can still be published.
  it("should withdraw an optional representation as a semantics rejection", () => {
    const { outcome } = reference(writingTo(callableAddress()), true);

    expect(outcome.kind).toBe("resource-rejected");
    if (outcome.kind !== "resource-rejected") throw new Error("Expected a withdrawal");
    expect(outcome.stage).toBe("semantics");
    expect(outcome.failure.category).toBe("source");
    expect(outcome.failure.diagnostics.map(({ code }) => code)).toEqual(["E10277"]);
  });

  // A withdrawal keeps the real observations it already made available.
  it("should keep the partial facts of a withdrawn representation", () => {
    const { outcome } = reference(writingTo(callableAddress()), true);
    if (outcome.kind !== "resource-rejected") throw new Error("Expected a withdrawal");

    expect(outcome.facts.lowered).toBeDefined();
    expect(outcome.facts.certificate).toBeDefined();
  });
});
