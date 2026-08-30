import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  authorizeFailureEnvelopeV1,
  createFailureHistoricalAuthorityResolverV1,
  createMalformedDiagnosticCaseV1,
  getFailureEnvelopeProjectionV1,
  getFailureHistoricalAuthorityRecordsV1,
  getMalformedDiagnosticCaseProjectionV1,
  parseFailureEnvelopeV1,
  serializeFailureEnvelopeV1,
} from "./index.js";
import {
  applyFailureTransformationV1,
  enumerateFailureTransformationsV1,
  normalizeFailureReductionCandidateV1,
} from "./failure-transform-catalog.js";
import {
  deriveMalformedReplayDigestV1,
  malformedUtf8BoundariesV1,
} from "./malformed-diagnostic-case.js";
import { validateGeneratorIr } from "./generator-ir-validator.js";
import { renderSourceModule } from "./source-renderer.js";
import {
  digestReductionValueV1,
  encodeReductionValueV1,
  createInitialReductionCandidateV1,
  getValidatedReductionCandidateProjectionV1,
  validateReductionCandidateInvariantV1,
} from "./reduction-candidate.js";
import {
  createRawReductionImplFixture,
  createTypedInvalidReductionImplFixtures,
  createTypedReductionImplFixtures,
} from "./test-fixtures/failure-reduction-impl-fixture.js";

import type { MalformedTokenTextProvenanceV1 } from "./malformed-diagnostic-case.js";

import type { RawReductionImplFixture } from "./test-fixtures/failure-reduction-impl-fixture.js";

let genuine: RawReductionImplFixture;

beforeAll(async () => {
  genuine = await createRawReductionImplFixture();
}, 240_000);

afterAll(async () => genuine.cleanup());

describe("failure reduction catalog hardening", () => {
  it("recognizes exact BOM and multibyte boundaries and rejects incomplete UTF-8", () => {
    const bytes = Uint8Array.from([0xef, 0xbb, 0xbf, 0xf0, 0x9f, 0x91, 0xbe]);
    expect([...requireBoundaries(bytes)]).toEqual([0, 3, 7]);
    expect(malformedUtf8BoundariesV1(Uint8Array.from([0xf0, 0x9f]))).toBeUndefined();
    expect(malformedUtf8BoundariesV1(Uint8Array.from([0xc0, 0x80]))).toBeUndefined();
  });

  it("rejects forged authorities and candidates without invoking hostile accessors", () => {
    let reads = 0;
    const hostile = Object.defineProperty({}, "revision", {
      enumerable: true,
      get: () => {
        reads += 1;
        throw new Error("must not execute");
      },
    });
    const forged = hostile as never;

    expect(getMalformedDiagnosticCaseProjectionV1(forged)).toMatchObject({
      ok: false,
      issues: [{ code: "unbound-capability" }],
    });
    expect(getFailureEnvelopeProjectionV1(forged)).toMatchObject({
      ok: false,
      issues: [{ code: "unbound-capability" }],
    });
    expect(enumerateFailureTransformationsV1(forged)).toEqual([]);
    expect(validateReductionCandidateInvariantV1(forged, hostile)).toMatchObject({ ok: false });
    expect(applyFailureTransformationV1(forged, forged, hostile)).toMatchObject({ ok: false });
    expect(normalizeFailureReductionCandidateV1(forged, forged)).toMatchObject({ ok: false });
    expect(getValidatedReductionCandidateProjectionV1(forged)).toMatchObject({ ok: false });
    expect(createMalformedDiagnosticCaseV1(forged, hostile)).toMatchObject({
      ok: false,
      issues: [{ code: "unbound-capability" }],
    });
    expect(reads).toBe(0);
  });

  it("bounds shallow resolver input and canonicalizes reduction values deterministically", () => {
    expect(createFailureHistoricalAuthorityResolverV1(new Array(4_097))).toMatchObject({
      ok: false,
      issues: [{ code: "execution.invalid-schema", path: "/resolver" }],
    });
    const value = {
      bytes: Uint8Array.from([0, 255]),
      count: 65_536n,
      nested: [true, null, "text"],
    };
    expect(new TextDecoder().decode(encodeReductionValueV1(value))).toContain("$bigint");
    expect(digestReductionValueV1(value)).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(digestReductionValueV1(value)).toBe(digestReductionValueV1(structuredClone(value)));
    expect(encodeReductionValueV1(7)).toEqual(new TextEncoder().encode("7"));
    expect(encodeReductionValueV1(null)).toEqual(new TextEncoder().encode("null"));
    const accessor = Object.defineProperty({}, "hidden", { enumerable: true, get: () => 1 });
    expect(() => encodeReductionValueV1(accessor)).toThrow(TypeError);
  });

  it("rejects every malformed ingress class against genuine selected authority", () => {
    const provenance: MalformedTokenTextProvenanceV1 = {
      revision: "malformed-token-text-provenance-v1",
      tokenizerRevision: "utf8-byte-spans-v1",
      tokens: [{ kind: "unknown", startByte: 0, endByte: 2 }],
    };
    const validInput = {
      revision: "malformed-diagnostic-case-input-v1",
      sourceBytes: new TextEncoder().encode("é"),
      encoding: "utf-8",
      ruleId: "diagnostic.malformed-source",
      obligation: "reject malformed input",
      provenance,
    };
    for (const input of [
      {},
      { ...validInput, extra: true },
      { ...validInput, revision: "v2" },
      { ...validInput, encoding: "latin1" },
      { ...validInput, sourceBytes: {} },
      { ...validInput, ruleId: "" },
      { ...validInput, obligation: "" },
      { ...validInput, obligation: "\ud800" },
      { ...validInput, obligation: "\udc00" },
      { ...validInput, obligation: "x".repeat(513) },
      { ...validInput, provenance: {} },
      { ...validInput, sourceBytes: Uint8Array.from([0xff]) },
      { ...validInput, provenance: { ...validInput.provenance, tokens: new Array(4_097) } },
      {
        ...validInput,
        provenance: {
          ...validInput.provenance,
          tokens: [{ kind: "bad", startByte: 0, endByte: 2 }],
        },
      },
      {
        ...validInput,
        provenance: {
          ...validInput.provenance,
          tokens: [{ kind: "unknown", startByte: 1, endByte: 2 }],
        },
      },
      {
        ...validInput,
        provenance: {
          ...validInput.provenance,
          tokens: [{ kind: "unknown", startByte: 0, endByte: 3 }],
        },
      },
    ]) {
      expect(createMalformedDiagnosticCaseV1(genuine.context, input)).toMatchObject({ ok: false });
    }
    expect(() =>
      deriveMalformedReplayDigestV1(
        validInput.sourceBytes,
        validInput.ruleId,
        "\ud800",
        `sha256:${"1".repeat(64)}`,
        `sha256:${"2".repeat(64)}`,
        validInput.provenance,
      ),
    ).toThrow(TypeError);
    const projected = getMalformedDiagnosticCaseProjectionV1(genuine.malformed);
    expect(projected).toMatchObject({ ok: true });
    if (projected.ok) {
      projected.value.sourceBytes[0] = 0;
      expect(getMalformedDiagnosticCaseProjectionV1(genuine.malformed)).not.toEqual(projected);
    }
  });

  it("fails closed on raw candidate and historical resolver corruption", () => {
    const initial = createInitialReductionCandidateV1(genuine.envelope);
    expect(initial).toMatchObject({ ok: true });
    if (!initial.ok) return;
    const projection = getValidatedReductionCandidateProjectionV1(initial.value);
    expect(projection).toMatchObject({ ok: true });
    if (!projection.ok) return;
    for (const draft of [
      { ...projection.value.draft, revision: "v2" },
      { ...projection.value.draft, sourceBytes: {} },
      { ...projection.value.draft, sourceBytes: Uint8Array.from([0xff]) },
      { ...projection.value.draft, tokens: [{ kind: "unknown", startByte: 2, endByte: 4 }] },
      { ...projection.value.draft, extra: true },
    ]) {
      expect(validateReductionCandidateInvariantV1(genuine.envelope, draft)).toMatchObject({
        ok: false,
      });
    }
    const segmented = validateReductionCandidateInvariantV1(genuine.envelope, {
      ...projection.value.draft,
      tokens: [
        { kind: "token", startByte: 0, endByte: 1 },
        { kind: "trivia", startByte: 1, endByte: 2 },
        { kind: "unknown", startByte: 2, endByte: 3 },
      ],
    });
    expect(segmented).toMatchObject({ ok: true });
    if (segmented.ok) {
      const middle = enumerateFailureTransformationsV1(segmented.value).find(
        (edit) => "startByte" in edit && edit.startByte === 1 && edit.endByte === 2,
      );
      expect(middle).toBeDefined();
      if (middle !== undefined) {
        expect(
          applyFailureTransformationV1(genuine.envelope, segmented.value, middle),
        ).toMatchObject({ ok: true });
      }
    }

    const records = getFailureHistoricalAuthorityRecordsV1(genuine.envelope);
    expect(records).toMatchObject({ ok: true });
    if (!records.ok) return;
    const resolver = createFailureHistoricalAuthorityResolverV1(records.value);
    expect(resolver).toMatchObject({ ok: true });
    if (!resolver.ok) return;
    const bytes = serializeFailureEnvelopeV1(genuine.envelope);
    expect(parseFailureEnvelopeV1(bytes, resolver.value)).toMatchObject({
      ok: true,
      value: { outcome: "resolved" },
    });
    expect(parseFailureEnvelopeV1(new Uint8Array(), resolver.value)).toMatchObject({ ok: false });
    expect(parseFailureEnvelopeV1(Uint8Array.from([0xff]), resolver.value)).toMatchObject({
      ok: false,
    });
    expect(parseFailureEnvelopeV1(bytes, {} as never)).toMatchObject({ ok: false });
    expect(parseFailureEnvelopeV1(bytes, null as never)).toMatchObject({ ok: false });
    const unavailable = createFailureHistoricalAuthorityResolverV1([]);
    expect(unavailable).toMatchObject({ ok: true });
    if (unavailable.ok) {
      expect(parseFailureEnvelopeV1(bytes, unavailable.value)).toMatchObject({
        ok: true,
        value: { outcome: "historical-authority-unavailable" },
      });
    }
    expect(() => serializeFailureEnvelopeV1(null as never)).toThrow(TypeError);
    expect(getFailureEnvelopeProjectionV1(null as never)).toMatchObject({ ok: false });
    expect(getFailureHistoricalAuthorityRecordsV1(null as never)).toMatchObject({ ok: false });
  });

  it("validates every envelope and historical-record boundary before authority minting", () => {
    const projected = getFailureEnvelopeProjectionV1(genuine.envelope);
    expect(projected).toMatchObject({ ok: true });
    if (!projected.ok) return;
    const base = {
      revision: "failure-envelope-authorization-input-v1",
      source: { kind: "raw-malformed", authority: genuine.malformed },
      routePlanBytes: projected.value.routePlanBytes,
      routePlanDigest: projected.value.routePlanDigest,
      predicate: projected.value.predicate,
      policy: projected.value.policy,
      observationBytes: projected.value.observationBytes,
      toolVersions: projected.value.toolVersions,
    };
    for (const input of [
      {},
      { ...base, revision: "v2" },
      { ...base, source: { kind: "raw-malformed", authority: {} } },
      { ...base, source: { kind: "other", authority: genuine.malformed } },
      { ...base, routePlanBytes: new Uint8Array() },
      { ...base, routePlanDigest: `sha256:${"0".repeat(64)}` },
      { ...base, predicate: {} },
      { ...base, policy: {} },
      { ...base, toolVersions: [{}] },
      {
        ...base,
        toolVersions: [
          { kind: "other", name: "tool", version: "1", digest: `sha256:${"0".repeat(64)}` },
        ],
      },
      {
        ...base,
        toolVersions: [
          { kind: "compiler", name: "", version: "1", digest: `sha256:${"0".repeat(64)}` },
        ],
      },
      {
        ...base,
        toolVersions: [
          { kind: "compiler", name: "tool", version: "", digest: `sha256:${"0".repeat(64)}` },
        ],
      },
      {
        ...base,
        toolVersions: [{ kind: "compiler", name: "tool", version: "1", digest: "bad" }],
      },
      {
        ...base,
        predicate: {
          ...projected.value.predicate,
          routeContract: {
            ...projected.value.predicate.routeContract,
            originalRouteKind: "valid-envelope",
          },
        },
      },
      { ...base, extra: true },
    ]) {
      expect(authorizeFailureEnvelopeV1(input)).toMatchObject({ ok: false });
    }

    const records = getFailureHistoricalAuthorityRecordsV1(genuine.envelope);
    expect(records).toMatchObject({ ok: true });
    if (!records.ok) return;
    const first = records.value[0];
    if (first === undefined) return;
    expect(createFailureHistoricalAuthorityResolverV1([...records.value, first])).toMatchObject({
      ok: true,
    });
    for (const record of [
      {},
      { ...first, revision: "v2" },
      { ...first, kind: "other" },
      { ...first, contentRevision: "" },
      { ...first, contentRevision: "x".repeat(257) },
      { ...first, contentRevision: "bad\nrevision" },
      { ...first, bytes: {} },
      { ...first, digest: "bad" },
      { ...first, bytes: Uint8Array.from([0]) },
      { ...first, extra: true },
    ]) {
      expect(createFailureHistoricalAuthorityResolverV1([record])).toMatchObject({ ok: false });
    }
  });

  it("enumerates and applies every invariant-valid typed simplification shape", () => {
    const typed = createTypedReductionImplFixtures(genuine.context, 12);
    expect(typed.length).toBeGreaterThan(1);
    const kinds = new Set<string>();
    let appliedCount = 0;
    for (const fixture of typed) {
      const initial = createInitialReductionCandidateV1(fixture.envelope);
      if (!initial.ok) continue;
      const before = getValidatedReductionCandidateProjectionV1(initial.value);
      if (!before.ok) continue;
      for (const transformation of enumerateFailureTransformationsV1(initial.value)) {
        kinds.add(transformation.kind);
        const applied = applyFailureTransformationV1(
          fixture.envelope,
          initial.value,
          transformation,
        );
        if (!applied.ok) continue;
        appliedCount += 1;
        const after = getValidatedReductionCandidateProjectionV1(applied.value);
        expect(after).toMatchObject({ ok: true });
        if (after.ok) expect(after.value.contentDigest).not.toBe(before.value.contentDigest);
      }
    }
    expect(kinds.has("typed-expression-simplify") || kinds.has("typed-literal-simplify")).toBe(
      true,
    );
    expect(appliedCount).toBeGreaterThan(0);
  });

  it("walks every typed statement and expression shape through one validated candidate", () => {
    const fixture = createTypedReductionImplFixtures(genuine.context, 1)[0];
    expect(fixture).toBeDefined();
    if (fixture === undefined) return;
    const initial = createInitialReductionCandidateV1(fixture.envelope);
    expect(initial).toMatchObject({ ok: true });
    if (!initial.ok) return;
    const projected = getValidatedReductionCandidateProjectionV1(initial.value);
    expect(projected).toMatchObject({ ok: true });
    if (!projected.ok || projected.value.draft.kind !== "typed-valid") return;
    const module = {
      kind: "module",
      path: ["Reduction", "Coverage"],
      constants: [
        {
          kind: "const",
          name: "step",
          type: "byte",
          value: { kind: "literal", type: "byte", value: 1n },
        },
      ],
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [{ name: "input", type: "byte" }],
          returnType: "byte",
          body: [
            {
              kind: "local",
              name: "value",
              type: "byte",
              initializer: {
                kind: "unary",
                type: "byte",
                operator: "~",
                operand: { kind: "name", type: "byte", name: "input" },
              },
            },
            {
              kind: "assign",
              target: "value",
              value: {
                kind: "binary",
                type: "byte",
                operator: "+",
                left: { kind: "name", type: "byte", name: "value" },
                right: { kind: "name", type: "byte", name: "step" },
              },
            },
            {
              kind: "memory-write",
              width: 1,
              address: { kind: "literal", type: "word", value: 0xd020n },
              value: { kind: "name", type: "byte", name: "value" },
            },
            {
              kind: "return",
              value: {
                kind: "memory-read",
                type: "byte",
                width: 1,
                address: { kind: "literal", type: "word", value: 0xd020n },
              },
            },
          ],
        },
      ],
    };
    const validatedModule = validateGeneratorIr(module);
    expect(validatedModule).toMatchObject({ ok: true });
    if (!validatedModule.ok) return;
    const rendered = renderSourceModule(validatedModule.module, {
      maxSourceBytes: 1_048_576,
      literalSpellings: [],
    });
    expect(rendered).toMatchObject({ ok: true });
    if (!rendered.ok) return;
    const candidate = validateReductionCandidateInvariantV1(fixture.envelope, {
      ...projected.value.draft,
      sourceBytes: rendered.sourceBytes,
      module: validatedModule.module,
      parameterBindings: [
        {
          kind: "parameter-value",
          parameterPath: "/functions/0/parameters/0",
          value: 7n,
        },
      ],
    });
    expect(candidate).toMatchObject({ ok: true });
    if (!candidate.ok) return;
    const edits = enumerateFailureTransformationsV1(candidate.value);
    expect(new Set(edits.map(({ kind }) => kind))).toEqual(
      new Set(["typed-expression-simplify", "typed-literal-simplify", "typed-statement-delete"]),
    );
    for (const edit of edits) {
      const result = applyFailureTransformationV1(fixture.envelope, candidate.value, edit);
      expect(result.ok || (!result.ok && result.issues[0]?.path === "/transformation")).toBe(true);
    }
  });

  it("revalidates typed-invalid transforms, bindings, source bytes, and closed edits", () => {
    const fixtures = createTypedInvalidReductionImplFixtures(genuine.context, 1);
    expect(fixtures.length).toBeGreaterThan(0);
    let attemptedCount = 0;
    for (const fixture of fixtures) {
      const initial = createInitialReductionCandidateV1(fixture.envelope);
      expect(initial).toMatchObject({ ok: true });
      if (!initial.ok) continue;
      const projected = getValidatedReductionCandidateProjectionV1(initial.value);
      expect(projected).toMatchObject({ ok: true });
      if (!projected.ok || projected.value.draft.kind !== "typed-invalid") continue;
      const draft = projected.value.draft;
      expect(normalizeFailureReductionCandidateV1(fixture.envelope, initial.value)).toMatchObject({
        ok: true,
        value: { changed: false, requiresEvaluation: false },
      });
      const malformedTransforms = [
        {},
        { ...draft.transform, kind: "other" },
        { ...draft.transform, extra: true },
        {
          kind: "intrinsic-argument-remove",
          callPath: "/functions/0/body/0/value",
          argumentIndex: -1,
        },
        {
          kind: "intrinsic-argument-remove",
          callPath: "/functions/0/body/0/value",
          argumentIndex: 0,
        },
        {
          kind: "intrinsic-argument-insert",
          callPath: "/functions/0/body/0/value",
          argumentIndex: 0,
          argument: {},
        },
        {
          kind: "intrinsic-argument-replace",
          callPath: "/functions/0/body/0/value",
          argumentIndex: 0,
          argument: {},
        },
        {
          kind: "intrinsic-argument-replace",
          callPath: "/functions/0/body/0/value",
          argumentIndex: 0,
          argument: { kind: "literal", type: "byte", value: 1n },
        },
        {
          kind: "intrinsic-argument-insert",
          callPath: "/functions/0/body/0/value",
          argumentIndex: 0,
          argument: { kind: "literal", type: "byte", value: 1n },
        },
        {
          kind: "scalar-expression-replace",
          expressionPath: "/functions/0/body/0/value",
          replacement: {},
        },
        {
          kind: "scalar-expression-replace",
          expressionPath: "not-a-pointer",
          replacement: { kind: "integer-literal", value: 1n },
        },
        {
          kind: "parameter-binding-replace",
          parameterPath: "/functions/0/parameters/0",
          replacement: {},
        },
        {
          kind: "parameter-binding-replace",
          parameterPath: "/functions/0/parameters/999",
          replacement: { kind: "integer-literal", value: 1n },
        },
      ];
      for (const transform of malformedTransforms) {
        expect(
          validateReductionCandidateInvariantV1(fixture.envelope, { ...draft, transform }),
        ).toMatchObject({ ok: false });
      }
      expect(
        validateReductionCandidateInvariantV1(fixture.envelope, {
          ...draft,
          sourceBytes: new TextEncoder().encode("module substituted;\n"),
        }),
      ).toMatchObject({ ok: false });
      for (const parameterBindings of [
        [{}],
        [{ kind: "parameter-value", parameterPath: "bad", value: 0n }],
        [{ kind: "parameter-value", parameterPath: "/functions/0/parameters/0", value: "bad" }],
        [
          { kind: "parameter-value", parameterPath: "/functions/0/parameters/0", value: 0n },
          { kind: "parameter-value", parameterPath: "/functions/0/parameters/0", value: 1n },
        ],
      ]) {
        expect(
          validateReductionCandidateInvariantV1(fixture.envelope, { ...draft, parameterBindings }),
        ).toMatchObject({ ok: false });
      }
      const edits = enumerateFailureTransformationsV1(initial.value);
      expect(new Set(edits.map(({ kind }) => kind))).toEqual(
        new Set([
          "invalid-baseline-delete",
          "invalid-baseline-simplify",
          "invalid-transform-target-rebase",
          "invalid-unused-binding-remove",
        ]),
      );
      for (const edit of edits) {
        attemptedCount += 1;
        const applied = applyFailureTransformationV1(fixture.envelope, initial.value, edit);
        if (applied.ok) {
          const after = getValidatedReductionCandidateProjectionV1(applied.value);
          expect(after).toMatchObject({ ok: true });
          if (after.ok) expect(after.value.contentDigest).not.toBe(projected.value.contentDigest);
        }
      }
    }
    expect(attemptedCount).toBe(fixtures.length * 4);
  });
});

function requireBoundaries(bytes: Uint8Array): ReadonlySet<number> {
  const boundaries = malformedUtf8BoundariesV1(bytes);
  if (boundaries === undefined) throw new TypeError("expected valid UTF-8 boundaries");
  return boundaries;
}
