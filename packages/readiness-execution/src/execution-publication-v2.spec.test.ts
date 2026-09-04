import { afterEach, describe, expect, it } from "vitest";

import {
  createFirstRuleModelRegistryV2,
  createFirstVerticalEmbeddedFixtureSetV2,
  createFirstVerticalPublicationCandidateV2,
  getCompositeReadinessProjectionV1,
  getPublishedRuleFamilyRecordProjectionV2,
  prepareRuleFamilyPublicationReviewV2,
  prepareRuleFamilyPublicationV2,
  prepareRuleModelMigrationV2,
  publishRuleFamilyPublicationV2,
  resolveCompositeReadinessSnapshot,
  resolvePublishedExecutionRelease,
  resolvePublishedRuleFamilyRecordByDigestV2,
  type PublicationSemanticReviewRequestV1,
} from "@blend65/readiness";
import { selectExecutionPublicationByDigestV1 } from "@blend65/readiness-execution";

import { snapshotPublicationArtifactsV1 } from "./test-fixtures/execution-publication-catalog-spec-fixture.js";
import {
  createExistingExecutionPairFixtureV2,
  type ExistingExecutionPairFixtureV2,
} from "./test-fixtures/execution-publication-v2-spec-fixture.js";

const fixtures: ExistingExecutionPairFixtureV2[] = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()));
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

function acceptedReviewBytes(
  request: PublicationSemanticReviewRequestV1,
  reviewer: string,
): Uint8Array {
  return new TextEncoder().encode(
    `${JSON.stringify({
      schemaVersion: 1,
      reviews: request.reviewUnits.map((unit) => ({
        unitId: unit.unitId,
        reviewer,
        specRevision: request.specRevision,
        semanticDigest: unit.semanticDigest,
        dependencyDigests: unit.dependencyDigests,
        outcome: "accepted",
        resolvedDisagreementIds: [],
      })),
    })}\n`,
  );
}

async function createSelectedParentV2(fixture: ExistingExecutionPairFixtureV2, reviewer: string) {
  const sourceRecordResult = await resolvePublishedRuleFamilyRecordByDigestV2({
    repositoryRoot: fixture.repositoryRoot,
    publicationDigest: fixture.parentDigest,
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
    repositoryRoot: fixture.repositoryRoot,
    migration: migrationResult.migration,
  });
  expectOk(reviewResult, "prepare the parent semantic review");
  const review = reviewResult.value;
  const previewResult = await prepareRuleFamilyPublicationV2({
    repositoryRoot: fixture.repositoryRoot,
    migration: migrationResult.migration,
    semanticReviewBytes: acceptedReviewBytes(review.request, reviewer),
  });
  expectOk(previewResult, "prepare the parent publication");
  const preview = previewResult.value;
  const publishResult = await publishRuleFamilyPublicationV2(preview.prepared);
  expectOk(publishResult, "publish and select the parent");
  const published = publishResult.value;

  return { published, sourceRecord };
}

describe("execution publication recovery across a changed parent", () => {
  it("fails closed between parent and child selection, then resolves the exact v2-parent/v1-child pair", async () => {
    const fixture = await createExistingExecutionPairFixtureV2();
    fixtures.push(fixture);
    const originalRecordResult = await resolvePublishedRuleFamilyRecordByDigestV2({
      repositoryRoot: fixture.repositoryRoot,
      publicationDigest: fixture.parentDigest,
    });
    expectOk(originalRecordResult, "resolve the original parent record");
    const sourceProjectionResult = getPublishedRuleFamilyRecordProjectionV2(
      originalRecordResult.value,
    );
    expectOk(sourceProjectionResult, "project the original parent record");
    const sourceProjectionBefore = sourceProjectionResult.value;
    const childBytesBefore = await snapshotPublicationArtifactsV1(
      fixture.repositoryRoot,
      fixture.childDigest,
    );

    const firstParent = (await createSelectedParentV2(fixture, "initial parent reviewer"))
      .published;
    const firstChild = await fixture.createChild(firstParent.publicationDigest);
    const initialSelection = await selectExecutionPublicationByDigestV1(
      fixture.repositoryRoot,
      firstChild.childDigest,
    );
    expectOk(initialSelection, "select the initial compatible execution child");
    const initialComposite = resolveCompositeReadinessSnapshot(
      firstParent.snapshot,
      firstChild.release,
    );
    expectOk(initialComposite, "resolve the initial exact parent-child pair");

    const { published } = await createSelectedParentV2(fixture, "replacement parent reviewer");
    expect(published.publicationDigest).not.toBe(firstParent.publicationDigest);
    const stale = resolveCompositeReadinessSnapshot(published.snapshot, firstChild.release);
    expect(stale.ok).toBe(false);
    if (stale.ok) {
      throw new Error("the stale parent-child pair unexpectedly resolved");
    }
    expect(stale.issues[0]).toEqual({
      code: "execution.stale-authority",
      path: "/parentDigest",
      message: expect.any(String),
    });

    const compatibleChild = await fixture.createChild(published.publicationDigest);
    const compatibleSelection = await selectExecutionPublicationByDigestV1(
      fixture.repositoryRoot,
      compatibleChild.childDigest,
    );
    expectOk(compatibleSelection, "select the compatible execution child");
    const selectedChildResult = await resolvePublishedExecutionRelease(
      fixture.repositoryRoot,
      compatibleChild.childDigest,
    );
    expectOk(selectedChildResult, "resolve the compatible execution child");
    const compositeResult = resolveCompositeReadinessSnapshot(
      published.snapshot,
      selectedChildResult.value,
    );
    expectOk(compositeResult, "resolve the exact parent-child pair");
    const compositeProjectionResult = getCompositeReadinessProjectionV1(compositeResult.value);
    expectOk(compositeProjectionResult, "project the exact pair");
    expect(compositeProjectionResult.value).toMatchObject({
      parentDigest: published.publicationDigest,
      executionDigest: compatibleChild.childDigest,
    });

    const sourceRecordAfterResult = await resolvePublishedRuleFamilyRecordByDigestV2({
      repositoryRoot: fixture.repositoryRoot,
      publicationDigest: fixture.parentDigest,
    });
    expectOk(sourceRecordAfterResult, "resolve the historical parent after recovery");
    const sourceProjectionAfterResult = getPublishedRuleFamilyRecordProjectionV2(
      sourceRecordAfterResult.value,
    );
    expectOk(sourceProjectionAfterResult, "project the historical parent after recovery");
    expect(sourceProjectionAfterResult.value).toEqual(sourceProjectionBefore);
    expect(
      await snapshotPublicationArtifactsV1(fixture.repositoryRoot, fixture.childDigest),
    ).toEqual(childBytesBefore);
  });
});
