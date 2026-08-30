import { createHash } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  authorizeFailureEnvelopeV1,
  createFailureHistoricalAuthorityResolverV1,
  getFailureEnvelopeProjectionV1,
  getFailureHistoricalAuthorityRecordsV1,
  parseFailureEnvelopeV1,
  serializeFailureEnvelopeV1,
} from "./failure-envelope.js";
import { encodeFailureEnvelopeCanonicalV1 } from "./failure-envelope-codec.js";
import { deriveFailurePredicateIdentityV1 } from "./failure-identity.js";
import { createRawReductionImplFixture } from "./test-fixtures/failure-reduction-impl-fixture.js";
import {
  createMalformedDiagnosticCaseV1,
  getMalformedDiagnosticCaseProjectionV1,
} from "./malformed-diagnostic-case.js";

import type { FailureEnvelopeV1 } from "./failure-envelope.js";
import type { RawReductionImplFixture } from "./test-fixtures/failure-reduction-impl-fixture.js";
import type { Sha256Digest } from "./model-registry-model.js";

let genuine: RawReductionImplFixture;

beforeAll(async () => {
  genuine = await createRawReductionImplFixture();
}, 240_000);

afterAll(async () => genuine?.cleanup());

function digest(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function requireProjection(): FailureEnvelopeV1 {
  const projected = getFailureEnvelopeProjectionV1(genuine.envelope);
  expect(projected).toMatchObject({ ok: true });
  if (!projected.ok) throw new Error("Expected a genuine failure envelope.");
  return projected.value;
}

function withDigest(value: Omit<FailureEnvelopeV1, "digest">): FailureEnvelopeV1 {
  return Object.freeze({
    ...value,
    digest: digest(encodeFailureEnvelopeCanonicalV1(value)),
  });
}

describe("failure envelope historical reconstruction", () => {
  it("should reject source, observation, and tool substitutions before authorization", () => {
    const projection = requireProjection();
    const input = {
      revision: "failure-envelope-authorization-input-v1",
      source: { kind: "raw-malformed", authority: genuine.malformed },
      routePlanBytes: projection.routePlanBytes,
      routePlanDigest: projection.routePlanDigest,
      predicate: projection.predicate,
      policy: projection.policy,
      observationBytes: new Uint8Array(),
      toolVersions: projection.toolVersions,
    };
    expect(
      authorizeFailureEnvelopeV1({
        ...input,
        predicate: { ...projection.predicate, primaryRuleId: "diagnostic.substituted-source" },
      }),
    ).toMatchObject({ ok: false, issues: [{ path: "/envelope/predicate" }] });
    expect(
      authorizeFailureEnvelopeV1({ ...input, observationBytes: Uint8Array.of(1) }),
    ).toMatchObject({ ok: false, issues: [{ path: "/envelope/predicate" }] });
    for (const requiredClaimedRuleIds of [
      [],
      [projection.predicate.primaryRuleId, "diagnostic.extra"],
      ["diagnostic.substituted-source"],
    ]) {
      expect(
        authorizeFailureEnvelopeV1({
          ...input,
          predicate: { ...projection.predicate, requiredClaimedRuleIds },
        }),
      ).toMatchObject({ ok: false, issues: [{ path: "/envelope/predicate" }] });
    }
    const terminalReasonBytes = new TextEncoder().encode("parser stopped before observation");
    const notReached = deriveFailurePredicateIdentityV1({
      ...projection.predicate,
      observation: {
        kind: "not-reached",
        stage: "frontend",
        terminalReasonDigest: digest(terminalReasonBytes),
      },
    });
    if (!notReached.ok) throw new TypeError("Expected a genuine not-reached predicate.");
    const authorizedNotReached = authorizeFailureEnvelopeV1({
      ...input,
      predicate: notReached.value.predicate,
      observationBytes: terminalReasonBytes,
    });
    expect(authorizedNotReached).toMatchObject({ ok: true });
    if (!authorizedNotReached.ok) throw new TypeError("Expected not-reached envelope authority.");
    const historicalRecords = getFailureHistoricalAuthorityRecordsV1(authorizedNotReached.value);
    if (!historicalRecords.ok) throw new TypeError("Expected not-reached historical records.");
    const resolver = createFailureHistoricalAuthorityResolverV1(historicalRecords.value);
    if (!resolver.ok) throw new TypeError("Expected not-reached historical resolver.");
    expect(
      parseFailureEnvelopeV1(
        serializeFailureEnvelopeV1(authorizedNotReached.value),
        resolver.value,
      ),
    ).toMatchObject({ ok: true, value: { outcome: "resolved" } });
    expect(
      authorizeFailureEnvelopeV1({
        ...input,
        predicate: notReached.value.predicate,
        observationBytes: Uint8Array.of(1),
      }),
    ).toMatchObject({ ok: false, issues: [{ path: "/envelope/predicate" }] });
    expect(
      authorizeFailureEnvelopeV1({
        ...input,
        toolVersions: [
          {
            kind: "compiler",
            name: "substituted",
            version: "1",
            digest: `sha256:${"1".repeat(64)}`,
          },
        ],
      }),
    ).toMatchObject({ ok: false, issues: [{ path: "/envelope/toolVersions" }] });
  });

  it("should length-prefix malformed identity fields so embedded NUL bytes cannot collide", () => {
    const first = createMalformedDiagnosticCaseV1(genuine.context, {
      revision: "malformed-diagnostic-case-input-v1",
      sourceBytes: Uint8Array.from([0x61, 0x00, 0x62]),
      encoding: "utf-8",
      ruleId: "c",
      obligation: "d",
      provenance: {
        revision: "malformed-token-text-provenance-v1",
        tokenizerRevision: "utf8-byte-spans-v1",
        tokens: [],
      },
    });
    const second = createMalformedDiagnosticCaseV1(genuine.context, {
      revision: "malformed-diagnostic-case-input-v1",
      sourceBytes: Uint8Array.from([0x61]),
      encoding: "utf-8",
      ruleId: "b",
      obligation: "c\0d",
      provenance: {
        revision: "malformed-token-text-provenance-v1",
        tokenizerRevision: "utf8-byte-spans-v1",
        tokens: [],
      },
    });
    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    if (!first.ok || !second.ok) return;
    const firstProjection = getMalformedDiagnosticCaseProjectionV1(first.value);
    const secondProjection = getMalformedDiagnosticCaseProjectionV1(second.value);
    expect(firstProjection).toMatchObject({ ok: true });
    expect(secondProjection).toMatchObject({ ok: true });
    if (!firstProjection.ok || !secondProjection.ok) return;
    expect(firstProjection.value.digest).not.toBe(secondProjection.value.digest);
    expect(firstProjection.value.textDigest).not.toBe(secondProjection.value.textDigest);
  });

  it("should resolve byte-identical state after restart from a role-complete exact record set", () => {
    const before = requireProjection();
    const bytes = serializeFailureEnvelopeV1(genuine.envelope);
    const records = getFailureHistoricalAuthorityRecordsV1(genuine.envelope);
    expect(records).toMatchObject({ ok: true });
    if (!records.ok) return;
    expect(records.value.map((record) => record.kind)).toEqual([
      "diagnostic",
      "execution-publication",
      "fixture",
      "oracle",
      "platform",
      "projection",
      "tool",
    ]);
    expect(new Set(records.value.map((record) => record.kind)).size).toBe(records.value.length);
    const resolver = createFailureHistoricalAuthorityResolverV1(structuredClone(records.value));
    expect(resolver).toMatchObject({ ok: true });
    if (!resolver.ok) return;
    const resolved = parseFailureEnvelopeV1(bytes.slice(), resolver.value);
    expect(resolved).toMatchObject({
      ok: true,
      value: { outcome: "resolved", missingAuthorityDigests: [] },
    });
    if (!resolved.ok || resolved.value.outcome !== "resolved") return;
    expect(getFailureEnvelopeProjectionV1(resolved.value.envelope)).toEqual({
      ok: true,
      value: before,
    });
    expect(serializeFailureEnvelopeV1(resolved.value.envelope)).toEqual(bytes);
  });

  it("should reject corrupt envelope identity before classifying missing history", () => {
    const bytes = serializeFailureEnvelopeV1(genuine.envelope);
    const records = getFailureHistoricalAuthorityRecordsV1(genuine.envelope);
    expect(records).toMatchObject({ ok: true });
    if (!records.ok) return;
    const unavailable = createFailureHistoricalAuthorityResolverV1(records.value.slice(1));
    expect(unavailable).toMatchObject({ ok: true });
    if (!unavailable.ok) return;
    const projection = requireProjection();
    const corrupt = encodeFailureEnvelopeCanonicalV1({
      ...projection,
      digest: `sha256:${"0".repeat(64)}`,
    });
    expect(parseFailureEnvelopeV1(corrupt, unavailable.value)).toMatchObject({
      ok: false,
      issues: [{ code: "execution.identity", path: "/envelope/digest" }],
    });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("should reject self-hashed hostile fields and unsorted authority identities", () => {
    const records = getFailureHistoricalAuthorityRecordsV1(genuine.envelope);
    expect(records).toMatchObject({ ok: true });
    if (!records.ok) return;
    const resolver = createFailureHistoricalAuthorityResolverV1(records.value);
    expect(resolver).toMatchObject({ ok: true });
    if (!resolver.ok) return;
    const projection = requireProjection();
    const substitutedRoute = new TextEncoder().encode("hostile replacement route\n");
    const substituted = withDigest({
      ...projection,
      routePlanBytes: substitutedRoute,
      routePlanDigest: digest(substitutedRoute),
    });
    expect(
      parseFailureEnvelopeV1(encodeFailureEnvelopeCanonicalV1(substituted), resolver.value),
    ).toMatchObject({ ok: false, issues: [{ code: "execution.identity" }] });

    const reversed = withDigest({
      ...projection,
      authorityDigests: [...projection.authorityDigests].reverse(),
    });
    expect(
      parseFailureEnvelopeV1(encodeFailureEnvelopeCanonicalV1(reversed), resolver.value),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "execution.identity", path: "/envelope/digest" }],
    });
  });

  it("should reject complete digest records when their semantic roles are substituted", () => {
    const records = getFailureHistoricalAuthorityRecordsV1(genuine.envelope);
    expect(records).toMatchObject({ ok: true });
    if (!records.ok) return;
    const first = records.value[0];
    if (first === undefined) return;
    const substituted = [{ ...first, kind: "fixture" as const }, ...records.value.slice(1)];
    const resolver = createFailureHistoricalAuthorityResolverV1(substituted);
    expect(resolver).toMatchObject({ ok: true });
    if (!resolver.ok) return;
    expect(
      parseFailureEnvelopeV1(serializeFailureEnvelopeV1(genuine.envelope), resolver.value),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "execution.identity", path: "/envelope/authorityDigests" }],
    });
  });
});
