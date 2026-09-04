import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createAcceptedReviewBytes,
  createOraclePublicationSpecFixture,
} from "./test-fixtures/oracle-publication-spec-fixture.js";

const V1_MEMBER_PATHS = [
  "bindings-v1.json",
  "compiler-readiness-v1.json",
  "compiler-readiness.md",
  "declarations.ts",
  "rule-models-v1-review.json",
  "rule-models-v1.json",
  "semantic-review-v1.json",
] as const;
const V2_MEMBER_PATHS = [
  "binding-rejections-v1.json",
  "bindings-v2.json",
  "compiler-readiness-v1.json",
  "diagnostic-oracle-v1.json",
  "embed-fixtures-v2.json",
  "first-vertical-v2.json",
  "migration-v2.json",
  "rule-model-seed-v1.json",
  "rule-models-v2-review.json",
  "rule-models-v2.json",
  "semantic-review-v2.json",
  "structured-execution-exemplar-v2.json",
] as const;
const decoder = new TextDecoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, description: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`expected ${description}`);
  }
  return value;
}

function requireArray(value: unknown, description: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`expected ${description}`);
  }
  return value;
}

function requireBytes(value: unknown, description: string): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    throw new TypeError(`expected ${description}`);
  }
  return value;
}

function publicationMembers(value: unknown): Record<string, unknown>[] {
  return requireArray(value, "publication members").map((entry) =>
    requireRecord(entry, "publication member"),
  );
}

function memberPaths(value: unknown): unknown[] {
  return publicationMembers(value).map(({ path }) => path);
}

function expectOk<T extends { readonly ok: boolean }>(
  result: T,
): asserts result is T & { readonly ok: true } {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new TypeError(JSON.stringify(result));
  }
}

function expectDiagnostic(result: unknown, code: string, path?: string): void {
  const record = requireRecord(result, "rejected operation");
  expect(record.ok).toBe(false);
  expect(record).not.toHaveProperty("value");
  expect(record.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code, ...(path === undefined ? {} : { path }) }),
    ]),
  );
}

function collectDigestStrings(value: unknown, output = new Set<string>()): Set<string> {
  if (typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value)) {
    output.add(value);
  } else if (Array.isArray(value)) {
    for (const entry of value) {
      collectDigestStrings(entry, output);
    }
  } else if (typeof value === "object" && value !== null) {
    for (const entry of Object.values(value)) {
      collectDigestStrings(entry, output);
    }
  }
  return output;
}

async function resolverApi(): Promise<typeof import("./publication-resolver.js")> {
  return vi.importActual<typeof import("./publication-resolver.js")>("./publication-resolver.js");
}

async function prepareAuthority() {
  const fixture = await createOraclePublicationSpecFixture();
  try {
    const [
      resolver,
      firstVertical,
      fixtures,
      models,
      migrationApi,
      publication,
      executionExemplarApi,
    ] = await Promise.all([
      resolverApi(),
      vi.importActual<typeof import("./first-vertical-publication.js")>(
        "./first-vertical-publication.js",
      ),
      vi.importActual<typeof import("./embed-case-fixtures.js")>("./embed-case-fixtures.js"),
      vi.importActual<typeof import("./rule-family-model.js")>("./rule-family-model.js"),
      vi.importActual<typeof import("./rule-model-migration.js")>("./rule-model-migration.js"),
      vi.importActual<typeof import("./rule-family-publication.js")>(
        "./rule-family-publication.js",
      ),
      vi.importActual<typeof import("./structured-execution-exemplar.js")>(
        "./structured-execution-exemplar.js",
      ),
    ]);
    const sourceResult = await resolver.resolvePublishedRuleFamilyRecordByDigestV2({
      repositoryRoot: fixture.repositoryRoot,
      publicationDigest: fixture.publicationDigest,
    });
    expectOk(sourceResult);
    const sourceRecord = sourceResult.value;
    const candidate = firstVertical.createFirstVerticalPublicationCandidateV2();
    const fixtureSet = fixtures.createFirstVerticalEmbeddedFixtureSetV2(candidate);
    expectOk(fixtureSet);
    const model = models.createFirstRuleModelRegistryV2({
      sourceRecord,
      firstVertical: candidate,
      fixtureSet: fixtureSet.fixtureSet,
    });
    expectOk(model);
    const migration = migrationApi.prepareRuleModelMigrationV2({
      schemaVersion: 2,
      sourceRecord,
      targetModel: model.model,
      firstVerticalCandidate: candidate,
      fixtureSet: fixtureSet.fixtureSet,
    });
    expectOk(migration);
    expect(executionExemplarApi.FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID).toBe(
      "rule.ch05.7-2-direction-bounds.requirement.meaning.loop-visits-start-end",
    );
    const executionExemplarResult =
      executionExemplarApi.createFirstVerticalStructuredExecutionExemplarV2();
    expectOk(executionExemplarResult);
    const executionExemplar = executionExemplarResult.value;
    return {
      fixture,
      resolver,
      migrationApi,
      publication,
      executionExemplar,
      sourceRecord,
      model,
      candidate,
      fixtureSet,
      migration,
    };
  } catch (error) {
    await fixture.cleanup();
    throw error;
  }
}

async function preparePreview(authority: Awaited<ReturnType<typeof prepareAuthority>>) {
  const reviewResult = await authority.publication.prepareRuleFamilyPublicationReviewV2({
    repositoryRoot: authority.fixture.repositoryRoot,
    migration: authority.migration.migration,
  });
  expectOk(reviewResult);
  const previewResult = await authority.publication.prepareRuleFamilyPublicationV2({
    repositoryRoot: authority.fixture.repositoryRoot,
    migration: authority.migration.migration,
    semanticReviewBytes: createAcceptedReviewBytes(reviewResult.value.request),
  });
  expectOk(previewResult);
  return previewResult.value;
}

async function selectedPointer(repositoryRoot: string): Promise<Record<string, unknown>> {
  return requireRecord(
    JSON.parse(
      await readFile(
        join(repositoryRoot, "readiness/publications/current-publication.json"),
        "utf8",
      ),
    ),
    "selected publication pointer",
  );
}

describe("published structured execution exemplar", () => {
  it("authenticates the combined source, expectation, and unchanged execution envelope", async () => {
    const api = await vi.importActual<typeof import("./structured-execution-exemplar.js")>(
      "./structured-execution-exemplar.js",
    );
    const firstResult = api.createFirstVerticalStructuredExecutionExemplarV2();
    const secondResult = api.createFirstVerticalStructuredExecutionExemplarV2();
    expectOk(firstResult);
    expectOk(secondResult);
    const first = firstResult.value;
    const second = secondResult.value;

    expect(api.FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID).toBe(
      "rule.ch05.7-2-direction-bounds.requirement.meaning.loop-visits-start-end",
    );
    expect(first.document).toMatchObject({
      schemaVersion: 2,
      kind: "structured-execution-exemplar-v2",
      ruleId: api.FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID,
      caseId: "case.structured.vertical-combined-v1",
      source: { encoding: "base64", digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u) },
      expectation: {
        encoding: "base64",
        oracleEvaluationIdentity: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      },
      envelope: {
        encoding: "base64",
        digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      },
    });
    expect(Buffer.from(first.document.source.bytes, "base64")).toEqual(first.sourceBytes);
    expect(Buffer.from(first.document.expectation.bytes, "base64")).toEqual(first.expectationBytes);
    expect(Buffer.from(first.document.envelope.bytes, "base64")).toEqual(first.envelopeBytes);
    expect(JSON.parse(decoder.decode(first.canonicalBytes))).toEqual(first.document);
    expect(second.document).toEqual(first.document);
    expect(second.documentDigest).toBe(first.documentDigest);
    expect(second.canonicalBytes).toEqual(first.canonicalBytes);

    first.sourceBytes.fill(0);
    first.expectationBytes.fill(0);
    first.envelopeBytes.fill(0);
    first.canonicalBytes.fill(0);
    const repeatedResult = api.createFirstVerticalStructuredExecutionExemplarV2();
    expectOk(repeatedResult);
    const repeated = repeatedResult.value;
    expect(repeated.sourceBytes).toEqual(second.sourceBytes);
    expect(repeated.expectationBytes).toEqual(second.expectationBytes);
    expect(repeated.envelopeBytes).toEqual(second.envelopeBytes);
    expect(repeated.canonicalBytes).toEqual(second.canonicalBytes);
  });
});

describe("reviewed parent publication", () => {
  it("binds model, case, migration, and implementation identities and rejects stale review", async () => {
    const authority = await prepareAuthority();
    try {
      const reviewResult = await authority.publication.prepareRuleFamilyPublicationReviewV2({
        repositoryRoot: authority.fixture.repositoryRoot,
        migration: authority.migration.migration,
      });
      expectOk(reviewResult);
      const review = reviewResult.value;
      expect(JSON.parse(decoder.decode(review.requestBytes))).toEqual(review.request);
      const reviewDigests = collectDigestStrings(review.request);
      expect(reviewDigests).toContain(authority.model.modelDigest);
      expect(reviewDigests).toContain(authority.fixtureSet.fixtureSetDigest);
      expect(reviewDigests).toContain(authority.migration.migrationDigest);
      expect(reviewDigests).toContain(authority.executionExemplar.documentDigest);
      for (const { toRevision } of authority.migration.document.handlers) {
        expect(reviewDigests).toContain(toRevision);
      }

      const staleReview = requireRecord(
        JSON.parse(decoder.decode(createAcceptedReviewBytes(review.request))),
        "accepted review",
      );
      const firstReview = requireRecord(
        requireArray(staleReview.reviews, "review rows")[0],
        "first review row",
      );
      firstReview.semanticDigest = `sha256:${"0".repeat(64)}`;
      expectDiagnostic(
        await authority.publication.prepareRuleFamilyPublicationV2({
          repositoryRoot: authority.fixture.repositoryRoot,
          migration: authority.migration.migration,
          semanticReviewBytes: new TextEncoder().encode(`${JSON.stringify(staleReview)}\n`),
        }),
        "publication.review.stale",
      );
      expect(
        await readFile(
          join(authority.fixture.repositoryRoot, "readiness/publications/current-publication.json"),
        ),
      ).toEqual(authority.fixture.pointerBytes);
    } finally {
      await authority.fixture.cleanup();
    }
  });

  it("publishes exactly the closed v2 member set and preserves its v1 predecessor", async () => {
    const authority = await prepareAuthority();
    try {
      expect(authority.publication.RULE_FAMILY_PUBLICATION_V2_MEMBER_PATHS).toEqual(
        V2_MEMBER_PATHS,
      );
      const preview = await preparePreview(authority);
      expect(preview.predecessorPublicationDigest).toBe(authority.fixture.publicationDigest);
      expect(
        await readFile(
          join(authority.fixture.repositoryRoot, "readiness/publications/current-publication.json"),
        ),
      ).toEqual(authority.fixture.pointerBytes);

      const publishedResult = await authority.publication.publishRuleFamilyPublicationV2(
        preview.prepared,
      );
      expectOk(publishedResult);
      const published = publishedResult.value;
      expect(published.publicationDigest).toBe(preview.publicationDigest);
      expect(published.reusedExistingRelease).toBe(false);
      expect(await selectedPointer(authority.fixture.repositoryRoot)).toEqual({
        schemaVersion: 2,
        kind: "rule-family-publication-pointer-v2",
        publicationDigest: preview.publicationDigest,
      });

      const recordResult = await authority.resolver.resolvePublishedRuleFamilyRecordByDigestV2({
        repositoryRoot: authority.fixture.repositoryRoot,
        publicationDigest: preview.publicationDigest,
      });
      expectOk(recordResult);
      const projectionResult = authority.resolver.getPublishedRuleFamilyRecordProjectionV2(
        recordResult.value,
      );
      expectOk(projectionResult);
      const projection = projectionResult.value;
      expect(projection.schemaVersion).toBe(2);
      expect(projection.predecessorPublicationDigest).toBe(authority.fixture.publicationDigest);
      expect(memberPaths(projection.members)).toEqual(V2_MEMBER_PATHS);
      const exemplarMember = publicationMembers(projection.members).find(
        ({ path }) => path === "structured-execution-exemplar-v2.json",
      );
      expect(exemplarMember).toBeDefined();
      if (exemplarMember === undefined) {
        throw new TypeError("published execution exemplar member was absent");
      }
      const exemplarBytes = requireBytes(exemplarMember.bytes, "execution exemplar bytes");
      expect(exemplarBytes).toEqual(authority.executionExemplar.canonicalBytes);
      expect(JSON.parse(decoder.decode(exemplarBytes))).toEqual(
        authority.executionExemplar.document,
      );

      const legacyRecord = await authority.resolver.resolvePublishedRuleFamilyRecordByDigestV2({
        repositoryRoot: authority.fixture.repositoryRoot,
        publicationDigest: authority.fixture.publicationDigest,
      });
      expectOk(legacyRecord);
      const legacyProjection = authority.resolver.getPublishedRuleFamilyRecordProjectionV2(
        legacyRecord.value,
      );
      expectOk(legacyProjection);
      expect(memberPaths(legacyProjection.value.members)).toEqual(V1_MEMBER_PATHS);
    } finally {
      await authority.fixture.cleanup();
    }
  });
});

describe.each([
  { faultPoint: "after-staged-validation", expected: "old" },
  { faultPoint: "after-release-rename", expected: "old" },
  { faultPoint: "after-pointer-rename", expected: "new" },
] as const)("failure-atomic v2 parent selection", ({ faultPoint, expected }) => {
  it(`resolves only the complete ${expected} release after ${faultPoint}`, async () => {
    const authority = await prepareAuthority();
    try {
      const preview = await preparePreview(authority);
      const conformance = await vi.importActual<typeof import("./publication-conformance-v1.js")>(
        "./publication-conformance-v1.js",
      );
      const result = await conformance.runWithPublicationConformance(
        {
          atFaultPoint(point): void {
            if (point === faultPoint) {
              throw new Error(`injected ${faultPoint}`);
            }
          },
        },
        () => authority.publication.publishRuleFamilyPublicationV2(preview.prepared),
      );
      expect(requireRecord(result, "publication result").ok).toBe(expected === "new");

      const pointer = await selectedPointer(authority.fixture.repositoryRoot);
      const selectedDigest =
        expected === "new" ? preview.publicationDigest : authority.fixture.publicationDigest;
      expect(pointer.publicationDigest).toBe(selectedDigest);
      const selectedRecord = await authority.resolver.resolvePublishedRuleFamilyRecordByDigestV2({
        repositoryRoot: authority.fixture.repositoryRoot,
        publicationDigest: selectedDigest,
      });
      expectOk(selectedRecord);
      const selectedProjection = authority.resolver.getPublishedRuleFamilyRecordProjectionV2(
        selectedRecord.value,
      );
      expectOk(selectedProjection);
      expect(memberPaths(selectedProjection.value.members)).toEqual(
        expected === "new" ? V2_MEMBER_PATHS : V1_MEMBER_PATHS,
      );
    } finally {
      await authority.fixture.cleanup();
    }
  });
});
