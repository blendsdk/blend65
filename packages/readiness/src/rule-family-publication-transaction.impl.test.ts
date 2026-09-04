import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createFirstVerticalEmbeddedFixtureSetV2 } from "./embed-case-fixtures.js";
import { createFirstVerticalPublicationCandidateV2 } from "./first-vertical-publication.js";
import { runWithPublicationConformance } from "./publication-conformance-v1.js";
import { renderPublicationJson } from "./publication-model.js";
import { createFirstRuleModelRegistryV2 } from "./rule-family-model.js";
import {
  prepareRuleFamilyPublicationReviewV2,
  prepareRuleFamilyPublicationV2,
  publishRuleFamilyPublicationV2,
  type RuleFamilyPublicationPreviewV2,
} from "./rule-family-publication.js";
import { resolvePublishedRuleFamilyRecordByDigestV2 } from "./rule-family-publication-record.js";
import { prepareRuleModelMigrationV2 } from "./rule-model-migration.js";
import {
  createAcceptedReviewBytes,
  createOraclePublicationSpecFixture,
} from "./test-fixtures/oracle-publication-spec-fixture.js";

async function preparePreview(
  repositoryRoot: string,
  publicationDigest: `sha256:${string}`,
): Promise<RuleFamilyPublicationPreviewV2> {
  const source = await resolvePublishedRuleFamilyRecordByDigestV2({
    repositoryRoot,
    publicationDigest,
  });
  if (!source.ok) throw new TypeError("predecessor record was unavailable");
  const candidate = createFirstVerticalPublicationCandidateV2();
  const fixtureSet = createFirstVerticalEmbeddedFixtureSetV2(candidate);
  if (!fixtureSet.ok) throw new TypeError("fixture authority was unavailable");
  const model = createFirstRuleModelRegistryV2({
    sourceRecord: source.value,
    firstVertical: candidate,
    fixtureSet: fixtureSet.fixtureSet,
  });
  if (!model.ok) throw new TypeError("model authority was unavailable");
  const migration = prepareRuleModelMigrationV2({
    schemaVersion: 2,
    sourceRecord: source.value,
    targetModel: model.model,
    firstVerticalCandidate: candidate,
    fixtureSet: fixtureSet.fixtureSet,
  });
  if (!migration.ok) throw new TypeError("migration authority was unavailable");
  const review = await prepareRuleFamilyPublicationReviewV2({
    repositoryRoot,
    migration: migration.migration,
  });
  if (!review.ok) throw new TypeError("review request was unavailable");
  const preview = await prepareRuleFamilyPublicationV2({
    repositoryRoot,
    migration: migration.migration,
    semanticReviewBytes: createAcceptedReviewBytes(review.value.request),
  });
  if (!preview.ok) throw new TypeError("publication preview was unavailable");
  return preview.value;
}

function reachedPostCommitValidation(
  result: Awaited<ReturnType<typeof publishRuleFamilyPublicationV2>>,
): boolean {
  return result.ok || result.diagnostics[0]?.code === "publication.implementation-unavailable";
}

function lostSelectionRace(
  result: Awaited<ReturnType<typeof publishRuleFamilyPublicationV2>>,
): boolean {
  return (
    !result.ok &&
    (result.diagnostics[0]?.code === "publication.review.stale" ||
      result.diagnostics[0]?.code === "publication.lock.contended")
  );
}

describe("version-two parent publication compare-and-swap", () => {
  it("rejects a preparation after another publisher selects the same successor", async () => {
    const fixture = await createOraclePublicationSpecFixture();
    try {
      const first = await preparePreview(fixture.repositoryRoot, fixture.publicationDigest);
      const stale = await preparePreview(fixture.repositoryRoot, fixture.publicationDigest);
      const firstPublished = await publishRuleFamilyPublicationV2(first.prepared);
      expect(reachedPostCommitValidation(firstPublished)).toBe(true);
      await writeFile(
        join(fixture.repositoryRoot, "readiness/publications/current-publication.json"),
        renderPublicationJson({
          schemaVersion: 2,
          kind: "rule-family-publication-pointer-v2",
          publicationDigest: first.publicationDigest,
        }),
      );
      expect(await publishRuleFamilyPublicationV2(stale.prepared)).toMatchObject({
        ok: false,
        kind: "stale",
        diagnostics: [{ code: "publication.review.stale" }],
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it("allows only one of two racing preparations to select a successor", async () => {
    const fixture = await createOraclePublicationSpecFixture();
    try {
      const first = await preparePreview(fixture.repositoryRoot, fixture.publicationDigest);
      const second = await preparePreview(fixture.repositoryRoot, fixture.publicationDigest);
      const results = await Promise.all([
        publishRuleFamilyPublicationV2(first.prepared),
        publishRuleFamilyPublicationV2(second.prepared),
      ]);
      expect(results.filter(reachedPostCommitValidation)).toHaveLength(1);
      expect(results.filter(lostSelectionRace)).toHaveLength(1);
    } finally {
      await fixture.cleanup();
    }
  });

  it.each([
    {
      name: "a version-one pointer shape",
      pointer: (digest: string) => ({ schemaVersion: 1, publicationDigest: digest }),
    },
    {
      name: "a malformed version-two pointer shape",
      pointer: (digest: string) => ({
        schemaVersion: 2,
        kind: "publication-pointer-v1",
        publicationDigest: digest,
      }),
    },
  ])(
    "rejects the post-commit state when the pointer is replaced with $name",
    async ({ pointer }) => {
      const fixture = await createOraclePublicationSpecFixture();
      try {
        const preview = await preparePreview(fixture.repositoryRoot, fixture.publicationDigest);
        const pointerPath = join(
          fixture.repositoryRoot,
          "readiness/publications/current-publication.json",
        );
        let replaced = false;
        const result = await runWithPublicationConformance(
          {
            async atFaultPoint(point) {
              if (point === "after-pointer-rename") {
                replaced = true;
                await writeFile(
                  pointerPath,
                  renderPublicationJson(pointer(preview.publicationDigest)),
                );
              }
            },
          },
          () => publishRuleFamilyPublicationV2(preview.prepared),
        );
        expect(replaced).toBe(true);
        expect(result.ok).toBe(false);
      } finally {
        await fixture.cleanup();
      }
    },
  );
});
