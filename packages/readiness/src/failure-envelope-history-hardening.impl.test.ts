import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  getFailureEnvelopeProjectionV1,
  getFailureHistoricalAuthorityRecordsV1,
  serializeFailureEnvelopeV1,
} from "./failure-envelope.js";
import {
  decodeFailureEnvelopeCanonicalV1,
  encodeFailureEnvelopeCanonicalV1,
  readFailureEnvelopeDataPropertyV1,
} from "./failure-envelope-codec.js";
import { reconstructFailureEnvelopeV1 } from "./failure-envelope-history.js";
import { validateFailureEnvelopeIdentityV1 } from "./failure-envelope-identity.js";
import { normalizeMalformedFailureProjectionV1 } from "./failure-envelope-malformed-history.js";
import {
  createRawReductionImplFixture,
  createTypedInvalidReductionImplFixtures,
  createTypedReductionImplFixtures,
} from "./test-fixtures/failure-reduction-impl-fixture.js";

import type {
  AuthorizedFailureEnvelopeV1,
  FailureEnvelopeV1,
  FailureHistoricalAuthorityRecordV1,
} from "./failure-envelope.js";
import type { FailureEnvelopeIdentityV1 } from "./failure-envelope-identity.js";
import type { RawReductionImplFixture } from "./test-fixtures/failure-reduction-impl-fixture.js";

interface HistoricalState {
  readonly projection: FailureEnvelopeV1;
  readonly identity: FailureEnvelopeIdentityV1;
  readonly records: readonly FailureHistoricalAuthorityRecordV1[];
}

let genuine: RawReductionImplFixture;

beforeAll(async () => {
  genuine = await createRawReductionImplFixture();
}, 240_000);

afterAll(async () => genuine?.cleanup());

function requireHistoricalState(envelope: AuthorizedFailureEnvelopeV1): HistoricalState {
  const projected = getFailureEnvelopeProjectionV1(envelope);
  if (!projected.ok) throw new TypeError("Expected a genuine failure projection.");
  const serialized = serializeFailureEnvelopeV1(envelope);
  const identity = validateFailureEnvelopeIdentityV1(
    decodeFailureEnvelopeCanonicalV1(serialized),
    serialized,
  );
  if (!identity.ok) throw new TypeError("Expected a genuine failure identity.");
  const records = getFailureHistoricalAuthorityRecordsV1(envelope);
  if (!records.ok) throw new TypeError("Expected genuine historical records.");
  return { projection: projected.value, identity: identity.value, records: records.value };
}

function replaceAtPath(input: unknown, path: readonly string[], value: unknown): unknown {
  const clone: unknown = structuredClone(input);
  let parent = clone;
  for (const key of path.slice(0, -1)) {
    parent = Array.isArray(parent)
      ? parent[Number.parseInt(key, 10)]
      : readFailureEnvelopeDataPropertyV1(parent, key);
  }
  const finalKey = path.at(-1);
  if (typeof parent !== "object" || parent === null || finalKey === undefined) {
    throw new TypeError(`Cannot replace historical test path /${path.join("/")}.`);
  }
  if (!Reflect.defineProperty(parent, finalKey, { value, enumerable: true, configurable: true })) {
    throw new TypeError(`Cannot define historical test path /${path.join("/")}.`);
  }
  return clone;
}

function deleteAtPath(input: unknown, path: readonly string[]): unknown {
  const clone: unknown = structuredClone(input);
  let parent = clone;
  for (const key of path.slice(0, -1)) {
    parent = readFailureEnvelopeDataPropertyV1(parent, key);
  }
  const finalKey = path.at(-1);
  if (
    typeof parent !== "object" ||
    parent === null ||
    finalKey === undefined ||
    !Reflect.deleteProperty(parent, finalKey)
  ) {
    throw new TypeError(`Cannot delete historical test path /${path.join("/")}.`);
  }
  return clone;
}

function mutateRecord(
  records: readonly FailureHistoricalAuthorityRecordV1[],
  kind: FailureHistoricalAuthorityRecordV1["kind"],
  mutation: (value: unknown) => unknown,
  contentRevision?: string,
): readonly FailureHistoricalAuthorityRecordV1[] {
  return records.map((record) =>
    record.kind === kind
      ? Object.freeze({
          ...record,
          bytes: encodeFailureEnvelopeCanonicalV1(
            mutation(decodeFailureEnvelopeCanonicalV1(record.bytes)),
          ),
          contentRevision: contentRevision ?? record.contentRevision,
        })
      : record,
  );
}

function expectHistoryIssue(
  state: HistoricalState,
  records: readonly FailureHistoricalAuthorityRecordV1[],
  path: string,
): void {
  expect(reconstructFailureEnvelopeV1(state.identity, records)).toMatchObject({
    ok: false,
    path,
  });
}

describe("malformed failure projection hardening", () => {
  it("should normalize a genuine projection and reject mismatched outer shapes", () => {
    const state = requireHistoricalState(genuine.envelope);
    expect(state.projection.family).toBe("raw-malformed");
    expect(
      normalizeMalformedFailureProjectionV1(
        state.projection.replay,
        state.projection.initialCandidate,
      ),
    ).toMatchObject({ replay: { kind: "raw-malformed" }, candidate: { kind: "raw-malformed" } });

    for (const [replay, candidate] of [
      [{}, state.projection.initialCandidate],
      [state.projection.replay, {}],
      [
        replaceAtPath(state.projection.replay, ["envelope", "revision"], "future-revision"),
        state.projection.initialCandidate,
      ],
      [
        state.projection.replay,
        replaceAtPath(state.projection.initialCandidate, ["kind"], "typed-valid"),
      ],
    ] as const) {
      expect(normalizeMalformedFailureProjectionV1(replay, candidate)).toBeUndefined();
    }
  });

  it("should reject malformed replay identities, bytes, provenance, and token spans", () => {
    const { projection } = requireHistoricalState(genuine.envelope);
    const replayMutations: readonly [readonly string[], unknown][] = [
      [["envelope", "encoding"], "utf-16"],
      [["envelope", "ruleId"], "bad rule"],
      [["envelope", "obligation"], ""],
      [["envelope", "obligation"], "\ud800"],
      [["envelope", "diagnosticAuthorityDigest"], "bad"],
      [["envelope", "selectedReleaseDigest"], "bad"],
      [["envelope", "textDigest"], "bad"],
      [["envelope", "digest"], "bad"],
      [["envelope", "sourceBytes"], Uint8Array.from([0xff])],
      [["envelope", "provenance", "revision"], "future-revision"],
      [["envelope", "provenance", "tokenizerRevision"], "future-tokenizer"],
      [["envelope", "provenance", "tokens"], "not-an-array"],
      [["envelope", "provenance", "tokens", "0", "kind"], "word"],
      [["envelope", "provenance", "tokens", "0", "startByte"], -1],
      [["envelope", "provenance", "tokens", "0", "endByte"], 0],
      [["envelope", "provenance", "tokens", "0", "endByte"], 4],
    ];
    for (const [path, value] of replayMutations) {
      expect(
        normalizeMalformedFailureProjectionV1(
          replaceAtPath(projection.replay, path, value),
          projection.initialCandidate,
        ),
      ).toBeUndefined();
    }

    const duplicateTokens = [
      { kind: "unknown", startByte: 0, endByte: 2 },
      { kind: "token", startByte: 1, endByte: 3 },
    ];
    expect(
      normalizeMalformedFailureProjectionV1(
        replaceAtPath(projection.replay, ["envelope", "provenance", "tokens"], duplicateTokens),
        projection.initialCandidate,
      ),
    ).toBeUndefined();
  });

  it("should reject candidate bytes and tokens that differ from replay authority", () => {
    const { projection } = requireHistoricalState(genuine.envelope);
    expect(
      normalizeMalformedFailureProjectionV1(
        projection.replay,
        replaceAtPath(
          projection.initialCandidate,
          ["sourceBytes"],
          new TextEncoder().encode("abd"),
        ),
      ),
    ).toBeUndefined();
    expect(
      normalizeMalformedFailureProjectionV1(
        projection.replay,
        replaceAtPath(projection.initialCandidate, ["tokens"], []),
      ),
    ).toBeUndefined();
  });
});

describe("failure envelope historical authority hardening", () => {
  it("should reject incomplete, duplicate, and noncanonical historical record sets", () => {
    const state = requireHistoricalState(genuine.envelope);
    expectHistoryIssue(state, state.records.slice(1), "/envelope/authorityDigests");
    expectHistoryIssue(state, [...state.records, state.records[0]!], "/envelope/authorityDigests");
    const invalidBytes = state.records.map((record, index) =>
      index === 0 ? Object.freeze({ ...record, bytes: Uint8Array.from([0xff]) }) : record,
    );
    expectHistoryIssue(state, invalidBytes, "/resolver");
  });

  it("should reject malformed projection, oracle, fixture, platform, and tool roles", () => {
    const state = requireHistoricalState(genuine.envelope);
    const cases: readonly [
      FailureHistoricalAuthorityRecordV1["kind"],
      (value: unknown) => unknown,
      string,
    ][] = [
      [
        "projection",
        (value) => replaceAtPath(value, ["family"], "typed-valid"),
        "/envelope/replay",
      ],
      ["projection", (value) => replaceAtPath(value, ["replay"], {}), "/envelope/replay"],
      [
        "projection",
        (value) => replaceAtPath(value, ["initialCandidate", "tokens"], []),
        "/envelope/replay",
      ],
      ["oracle", (value) => replaceAtPath(value, ["predicate"], {}), "/envelope/predicate"],
      [
        "oracle",
        (value) => replaceAtPath(value, ["observationBytes"], "bad"),
        "/envelope/predicate",
      ],
      [
        "fixture",
        (value) => replaceAtPath(value, ["routePlanBytes"], new Uint8Array()),
        "/envelope/routePlanDigest",
      ],
      [
        "platform",
        (value) => replaceAtPath(value, ["target"], "atari7800"),
        "/envelope/toolVersions",
      ],
      ["tool", () => [{}], "/envelope/toolVersions"],
    ];
    for (const [kind, mutation, path] of cases) {
      expectHistoryIssue(state, mutateRecord(state.records, kind, mutation), path);
    }
  });

  it("should reject cross-authority predicate, fixture, tool, and route identities", () => {
    const state = requireHistoricalState(genuine.envelope);
    expectHistoryIssue(
      state,
      mutateRecord(state.records, "oracle", (value) =>
        replaceAtPath(value, ["predicate", "primaryRuleId"], "diagnostic.other"),
      ),
      "/envelope/predicate",
    );
    expectHistoryIssue(
      state,
      mutateRecord(state.records, "fixture", (value) => value, "wrong-revision"),
      "/envelope/routePlanDigest",
    );
    expectHistoryIssue(
      state,
      mutateRecord(state.records, "tool", (value) => value, "wrong-revision"),
      "/envelope/toolVersions",
    );
    expectHistoryIssue(
      state,
      mutateRecord(state.records, "tool", () => [
        {
          kind: "compiler",
          name: "historical-compiler",
          version: "1",
          digest: `sha256:${"0".repeat(64)}`,
        },
      ]),
      "/envelope/toolVersions",
    );
    expectHistoryIssue(
      state,
      mutateRecord(state.records, "oracle", (value) => value, "wrong-revision"),
      "/envelope/predicate/routeContract",
    );
    expectHistoryIssue(
      state,
      mutateRecord(state.records, "oracle", (value) =>
        replaceAtPath(value, ["predicate", "routeContract", "originalRouteKind"], "valid-envelope"),
      ),
      "/envelope/predicate/routeContract",
    );
    for (const requiredClaimedRuleIds of [
      [],
      ["diagnostic.substituted-source"],
      [state.projection.predicate.primaryRuleId, "diagnostic.extra"],
    ]) {
      expectHistoryIssue(
        state,
        mutateRecord(state.records, "oracle", (value) =>
          replaceAtPath(value, ["predicate", "requiredClaimedRuleIds"], requiredClaimedRuleIds),
        ),
        "/envelope/predicate",
      );
    }
    expectHistoryIssue(
      state,
      mutateRecord(state.records, "diagnostic", (value) => value, "wrong-revision"),
      "/envelope/replay",
    );
    expectHistoryIssue(
      state,
      mutateRecord(state.records, "execution-publication", (value) => value, "wrong-revision"),
      "/envelope/replay",
    );
  });

  it("should reconstruct typed families and reject their role-specific authority substitutions", () => {
    const typedValid = createTypedReductionImplFixtures(genuine.context, 1)[0];
    const typedInvalid = createTypedInvalidReductionImplFixtures(genuine.context, 1)[0];
    if (typedValid === undefined || typedInvalid === undefined) {
      throw new TypeError("Expected genuine typed reduction fixtures.");
    }
    const validState = requireHistoricalState(typedValid.envelope);
    const invalidState = requireHistoricalState(typedInvalid.envelope);
    const validReconstruction = reconstructFailureEnvelopeV1(
      validState.identity,
      validState.records,
    );
    expect(validReconstruction).toMatchObject({ ok: true });
    expect(reconstructFailureEnvelopeV1(invalidState.identity, invalidState.records)).toMatchObject(
      {
        ok: true,
      },
    );

    expectHistoryIssue(
      validState,
      mutateRecord(validState.records, "campaign", (value) => value, "wrong-revision"),
      "/envelope/replay",
    );
    expectHistoryIssue(
      validState,
      mutateRecord(validState.records, "projection", (value) =>
        replaceAtPath(value, ["initialCandidate", "claimedRuleIds"], ["rule.unrelated"]),
      ),
      "/envelope/initialCandidate",
    );
    expectHistoryIssue(
      validState,
      mutateRecord(validState.records, "oracle", (value) =>
        replaceAtPath(
          value,
          ["predicate", "requiredClaimedRuleIds"],
          ["rule.ch02.2-primitive-types.byte.range.0-255", "rule.unrelated"],
        ),
      ),
      "/envelope/predicate",
    );
    expectHistoryIssue(
      invalidState,
      mutateRecord(invalidState.records, "diagnostic", (value) =>
        replaceAtPath(value, ["kind"], "other-diagnostic"),
      ),
      "/envelope/replay",
    );

    const candidateMutations: readonly [readonly string[], unknown][] = [
      [["initialCandidate", "parameterBindings"], "not-an-array"],
      [
        ["initialCandidate", "parameterBindings"],
        [Object.freeze({ kind: "other", parameterPath: "/functions/0/parameters/0", value: 1n })],
      ],
      [["initialCandidate", "primaryRuleId"], "bad rule"],
      [["initialCandidate", "claimedRuleIds"], []],
      [["initialCandidate", "claimWitnesses"], []],
    ];
    for (const [path, value] of candidateMutations) {
      expectHistoryIssue(
        validState,
        mutateRecord(validState.records, "projection", (record) =>
          replaceAtPath(record, path, value),
        ),
        "/envelope/initialCandidate",
      );
    }

    expectHistoryIssue(
      invalidState,
      mutateRecord(invalidState.records, "projection", (value) =>
        replaceAtPath(value, ["replay", "generatedProjection"], {
          kind: "valid",
          module: readFailureEnvelopeDataPropertyV1(
            readFailureEnvelopeDataPropertyV1(
              readFailureEnvelopeDataPropertyV1(value, "replay"),
              "generatedProjection",
            ),
            "baseline",
          ),
        }),
      ),
      "/envelope/initialCandidate",
    );
  });

  it("should decode every closed invalid-transform shape from historical projection data", () => {
    const typedInvalid = createTypedInvalidReductionImplFixtures(genuine.context, 1)[0];
    if (typedInvalid === undefined) throw new TypeError("Expected a genuine invalid fixture.");
    const state = requireHistoricalState(typedInvalid.envelope);
    const argument = Object.freeze({ kind: "literal", type: "byte", value: 1n });
    const transforms = Object.freeze([
      Object.freeze({
        kind: "intrinsic-argument-remove",
        callPath: "/functions/0/body/0",
        argumentIndex: 0,
      }),
      Object.freeze({
        kind: "intrinsic-argument-insert",
        callPath: "/functions/0/body/0",
        argumentIndex: 0,
        argument,
      }),
      Object.freeze({
        kind: "intrinsic-argument-replace",
        callPath: "/functions/0/body/0",
        argumentIndex: 0,
        argument,
      }),
      Object.freeze({
        kind: "scalar-expression-replace",
        expressionPath: "/functions/0/body/0/value",
        replacement: Object.freeze({ kind: "integer-literal", value: 1n }),
      }),
      Object.freeze({
        kind: "parameter-binding-replace",
        parameterPath: "/functions/0/parameters/0",
        replacement: Object.freeze({ kind: "integer-literal", value: 1n }),
      }),
    ]);

    for (const transform of transforms) {
      const records = mutateRecord(state.records, "projection", (value) => {
        const replayChanged = replaceAtPath(
          value,
          ["replay", "generatedProjection", "transform"],
          transform,
        );
        return replaceAtPath(replayChanged, ["initialCandidate", "transform"], transform);
      });
      expectHistoryIssue(state, records, "/envelope");
    }
  });

  it("should reject hostile fields at every invalid-transform decoder boundary", () => {
    const typedInvalid = createTypedInvalidReductionImplFixtures(genuine.context, 1)[0];
    if (typedInvalid === undefined) throw new TypeError("Expected a genuine invalid fixture.");
    const state = requireHistoricalState(typedInvalid.envelope);
    const transforms = Object.freeze([
      Object.freeze({ kind: "intrinsic-argument-remove", callPath: 1, argumentIndex: 0 }),
      Object.freeze({
        kind: "intrinsic-argument-insert",
        callPath: "/bad path",
        argumentIndex: -1,
        argument: Object.freeze({ kind: "literal", type: "byte", value: 1n }),
      }),
      Object.freeze({
        kind: "intrinsic-argument-replace",
        callPath: "/functions/0/body/0",
        argumentIndex: 0,
        argument: Object.freeze({}),
      }),
      Object.freeze({
        kind: "scalar-expression-replace",
        expressionPath: "/bad path",
        replacement: Object.freeze({ kind: "integer-literal", value: 1 }),
      }),
      Object.freeze({
        kind: "parameter-binding-replace",
        parameterPath: "/functions/x/parameters/0",
        replacement: Object.freeze({ kind: "integer-literal", value: 1 }),
      }),
    ]);

    for (const transform of transforms) {
      expectHistoryIssue(
        state,
        mutateRecord(state.records, "projection", (value) =>
          replaceAtPath(value, ["replay", "generatedProjection", "transform"], transform),
        ),
        "/envelope/replay",
      );
    }
  });

  it("should reject a reconstructed envelope that differs from its retained outer fields", () => {
    const state = requireHistoricalState(genuine.envelope);
    const alteredIdentity = Object.freeze({
      ...state.identity,
      decoded: Object.freeze({
        ...state.identity.decoded,
        routePlanBytes: new TextEncoder().encode("outer mismatch"),
      }),
    });
    expect(reconstructFailureEnvelopeV1(alteredIdentity, state.records)).toMatchObject({
      ok: false,
      path: "/envelope",
    });
  });

  it("should reject historical records whose canonical object properties are missing", () => {
    const state = requireHistoricalState(genuine.envelope);
    expectHistoryIssue(
      state,
      mutateRecord(state.records, "fixture", (value) => deleteAtPath(value, ["routePlanDigest"])),
      "/envelope/routePlanDigest",
    );
  });
});
