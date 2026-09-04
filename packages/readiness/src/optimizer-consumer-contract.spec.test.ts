import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID,
  createFirstRuleModelRegistryV2,
  createFirstVerticalEmbeddedFixtureSetV2,
  createFirstVerticalPublicationCandidateV2,
  createFirstVerticalStructuredExecutionExemplarV2,
  getOptimizerConsumerProjectionV2,
  getPublishedRuleFamilyRecordProjectionV2,
  prepareExecutionPublicationCandidateV1,
  prepareRuleFamilyPublicationReviewV2,
  prepareRuleFamilyPublicationV2,
  prepareRuleModelMigrationV2,
  publishRuleFamilyPublicationV2,
  resolveCompositeReadinessSnapshot,
  resolvePublishedExecutionRelease,
  resolvePublishedRuleFamilyRecordByDigestV2,
  type PublicationSemanticReviewRequestV1,
} from "./index.js";
import { scanReadinessCompilerBoundary } from "./readiness-boundary-core.js";
import {
  CURRENT_PARENT_DIGEST,
  createIsolatedRepository,
  makePublicationInput,
  removeIsolatedRepository,
} from "./test-fixtures/execution-publication-spec-fixture.js";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "../../..");
const temporaryRepositories = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...temporaryRepositories].map(async (repositoryRoot) => {
      await removeIsolatedRepository(repositoryRoot);
      temporaryRepositories.delete(repositoryRoot);
    }),
  );
});

function expectOk<T extends { readonly ok: boolean }>(
  result: T,
  operation: string,
): asserts result is T & { readonly ok: true } {
  expect(result.ok, operation).toBe(true);
  if (!result.ok) {
    throw new Error(`${operation} failed`);
  }
}

function acceptedReviewBytes(request: PublicationSemanticReviewRequestV1): Uint8Array {
  return new TextEncoder().encode(
    `${JSON.stringify({
      schemaVersion: 1,
      reviews: request.reviewUnits.map((unit) => ({
        unitId: unit.unitId,
        reviewer: "optimizer consumer specification reviewer",
        specRevision: request.specRevision,
        semanticDigest: unit.semanticDigest,
        dependencyDigests: unit.dependencyDigests,
        outcome: "accepted",
        resolvedDisagreementIds: [],
      })),
    })}\n`,
  );
}

async function createCompositeFixture() {
  const repositoryRoot = await createIsolatedRepository();
  temporaryRepositories.add(repositoryRoot);
  const sourceRecordResult = await resolvePublishedRuleFamilyRecordByDigestV2({
    repositoryRoot,
    publicationDigest: CURRENT_PARENT_DIGEST,
  });
  expectOk(sourceRecordResult, "resolve the passive source record");
  const sourceRecord = sourceRecordResult.value;
  const firstVertical = createFirstVerticalPublicationCandidateV2();
  const fixtureResult = createFirstVerticalEmbeddedFixtureSetV2(firstVertical);
  expect(fixtureResult.ok).toBe(true);
  if (!fixtureResult.ok) {
    throw new Error("create the authenticated fixture set failed");
  }
  const modelResult = createFirstRuleModelRegistryV2({
    sourceRecord,
    firstVertical,
    fixtureSet: fixtureResult.fixtureSet,
  });
  expect(modelResult.ok).toBe(true);
  if (!modelResult.ok) {
    throw new Error("create the first complete rule model failed");
  }
  const migrationResult = prepareRuleModelMigrationV2({
    schemaVersion: 2,
    sourceRecord,
    targetModel: modelResult.model,
    firstVerticalCandidate: firstVertical,
    fixtureSet: fixtureResult.fixtureSet,
  });
  expect(migrationResult.ok).toBe(true);
  if (!migrationResult.ok) {
    throw new Error("prepare the complete handler migration failed");
  }
  const reviewResult = await prepareRuleFamilyPublicationReviewV2({
    repositoryRoot,
    migration: migrationResult.migration,
  });
  expectOk(reviewResult, "prepare the parent semantic review");
  const review = reviewResult.value;
  const previewResult = await prepareRuleFamilyPublicationV2({
    repositoryRoot,
    migration: migrationResult.migration,
    semanticReviewBytes: acceptedReviewBytes(review.request),
  });
  expectOk(previewResult, "prepare the parent publication");
  const preview = previewResult.value;
  const parentResult = await publishRuleFamilyPublicationV2(preview.prepared);
  expectOk(parentResult, "publish the parent");
  const parent = parentResult.value;
  const publishedRecordResult = await resolvePublishedRuleFamilyRecordByDigestV2({
    repositoryRoot,
    publicationDigest: parent.publicationDigest,
  });
  expectOk(publishedRecordResult, "resolve the published parent record");
  const parentProjectionResult = getPublishedRuleFamilyRecordProjectionV2(
    publishedRecordResult.value,
  );
  expectOk(parentProjectionResult, "project the published parent record");
  const parentProjection = parentProjectionResult.value;
  const childCandidateResult = await prepareExecutionPublicationCandidateV1(
    makePublicationInput(repositoryRoot, parent.publicationDigest, "optimizer-consumer"),
  );
  expectOk(childCandidateResult, "prepare the execution child");
  const childCandidate = childCandidateResult.value;
  const childResult = await resolvePublishedExecutionRelease(repositoryRoot, childCandidate.digest);
  expectOk(childResult, "resolve the execution child");
  const compositeResult = resolveCompositeReadinessSnapshot(parent.snapshot, childResult.value);
  expectOk(compositeResult, "resolve the exact parent-child pair");
  const composite = compositeResult.value;

  return { parent, parentProjection, childCandidate, composite };
}

async function readProductionModules(packageName: "codegen" | "compiler") {
  const sourceRoot = join(REPOSITORY_ROOT, "packages", packageName, "src");

  async function visit(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const paths = await Promise.all(
      entries.map(async (entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          return entry.name === "test-fixtures" ? [] : visit(path);
        }
        return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
          ? [path]
          : [];
      }),
    );
    return paths.flat();
  }

  return Promise.all(
    (await visit(sourceRoot)).sort().map(async (path) => ({
      owner: "compiler-toolchain" as const,
      path: relative(REPOSITORY_ROOT, path),
      source: new Uint8Array(await readFile(path)),
    })),
  );
}

describe("optimizer consumer publication boundary", () => {
  it("returns fresh byte-identical published source, expectation, and envelope bytes with exact identities and no cost truth", async () => {
    const exemplarResult = createFirstVerticalStructuredExecutionExemplarV2();
    expectOk(exemplarResult, "create the authenticated execution exemplar");
    const exemplar = exemplarResult.value;
    const { parent, parentProjection, childCandidate, composite } = await createCompositeFixture();
    const publishedExemplar = parentProjection.members.find(
      ({ path }) => path === "structured-execution-exemplar-v2.json",
    );
    expect(publishedExemplar?.bytes).toEqual(exemplar.canonicalBytes);
    const firstResult = getOptimizerConsumerProjectionV2(composite);
    expectOk(firstResult, "project the optimizer consumer envelope");
    const first = firstResult.value;
    const secondResult = getOptimizerConsumerProjectionV2(composite);
    expectOk(secondResult, "project a fresh optimizer consumer envelope");
    const second = secondResult.value;

    expect(Object.keys(first).sort()).toEqual(
      [
        "caseDigest",
        "caseId",
        "envelopeBytes",
        "envelopeDigest",
        "executionPublicationDigest",
        "expectationBytes",
        "kind",
        "oracleEvaluationIdentity",
        "parentPublicationDigest",
        "ruleId",
        "schemaVersion",
        "sourceBytes",
        "sourceDigest",
      ].sort(),
    );
    expect(first).toEqual({
      schemaVersion: 2,
      kind: "optimizer-consumer-projection-v2",
      parentPublicationDigest: parent.publicationDigest,
      executionPublicationDigest: childCandidate.digest,
      ruleId: FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID,
      caseId: "case.structured.vertical-combined-v1",
      caseDigest: exemplar.document.caseDigest,
      sourceBytes: exemplar.sourceBytes,
      sourceDigest: exemplar.document.source.digest,
      expectationBytes: exemplar.expectationBytes,
      oracleEvaluationIdentity: exemplar.document.expectation.oracleEvaluationIdentity,
      envelopeBytes: exemplar.envelopeBytes,
      envelopeDigest: exemplar.document.envelope.digest,
    });
    expect(second).toEqual(first);
    expect(second.sourceBytes).not.toBe(first.sourceBytes);
    expect(second.expectationBytes).not.toBe(first.expectationBytes);
    expect(second.envelopeBytes).not.toBe(first.envelopeBytes);

    first.sourceBytes[0] = first.sourceBytes[0]! ^ 0xff;
    first.expectationBytes[0] = first.expectationBytes[0]! ^ 0xff;
    first.envelopeBytes[0] = first.envelopeBytes[0]! ^ 0xff;
    const thirdResult = getOptimizerConsumerProjectionV2(composite);
    expectOk(thirdResult, "project the immutable optimizer consumer envelope");
    const third = thirdResult.value;
    expect(third.sourceBytes).toEqual(exemplar.sourceBytes);
    expect(third.expectationBytes).toEqual(exemplar.expectationBytes);
    expect(third.envelopeBytes).toEqual(exemplar.envelopeBytes);
  });

  it("keeps readiness imports out of production compiler and code-generator modules", async () => {
    const modules = (
      await Promise.all([readProductionModules("compiler"), readProductionModules("codegen")])
    ).flat();

    expect(scanReadinessCompilerBoundary({ schemaVersion: 1, modules })).toEqual({
      ok: true,
      modulePaths: modules.map(({ path }) => path).sort(),
      diagnostics: [],
    });
  });
});
