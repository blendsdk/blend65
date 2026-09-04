import { describe, expect, it } from "vitest";

import { createFirstVerticalEmbeddedFixtureSetV2 } from "./embed-case-fixtures.js";
import { createFirstVerticalPublicationCandidateV2 } from "./first-vertical-publication.js";
import { parsePublicationJson, renderPublicationJson } from "./publication-model.js";
import { createFirstRuleModelRegistryV2 } from "./rule-family-model.js";
import {
  createStagedPublishedRuleFamilyRecordV2,
  getPublishedRuleFamilyRecordAuthorityV2,
  resolvePublishedRuleFamilyRecordByDigestV2,
} from "./rule-family-publication-record.js";
import {
  prepareRuleFamilyPublicationReviewV2,
  prepareRuleFamilyPublicationV2,
} from "./rule-family-publication.js";
import { validateExecutableRuleFamilyMembersV2 } from "./rule-family-publication-validation.js";
import { prepareRuleModelMigrationV2 } from "./rule-model-migration.js";
import {
  createAcceptedReviewBytes,
  createOraclePublicationSpecFixture,
} from "./test-fixtures/oracle-publication-spec-fixture.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError("expected a record");
  }
  return value;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError("expected an array");
  return value;
}

describe("executable rule-family member closure", () => {
  it("revalidates joined model and exemplar identities before executable acquisition", async () => {
    const fixture = await createOraclePublicationSpecFixture();
    try {
      const source = await resolvePublishedRuleFamilyRecordByDigestV2({
        repositoryRoot: fixture.repositoryRoot,
        publicationDigest: fixture.publicationDigest,
      });
      if (!source.ok) throw new TypeError("passive predecessor was unavailable");
      const firstVertical = createFirstVerticalPublicationCandidateV2();
      const fixtureSet = createFirstVerticalEmbeddedFixtureSetV2(firstVertical);
      if (!fixtureSet.ok) throw new TypeError("fixture authority was unavailable");
      const model = createFirstRuleModelRegistryV2({
        sourceRecord: source.value,
        firstVertical,
        fixtureSet: fixtureSet.fixtureSet,
      });
      if (!model.ok) throw new TypeError("model authority was unavailable");
      const migration = prepareRuleModelMigrationV2({
        schemaVersion: 2,
        sourceRecord: source.value,
        targetModel: model.model,
        firstVerticalCandidate: firstVertical,
        fixtureSet: fixtureSet.fixtureSet,
      });
      if (!migration.ok) throw new TypeError("migration authority was unavailable");
      const review = await prepareRuleFamilyPublicationReviewV2({
        repositoryRoot: fixture.repositoryRoot,
        migration: migration.migration,
      });
      if (!review.ok) throw new TypeError("review request was unavailable");
      const preview = await prepareRuleFamilyPublicationV2({
        repositoryRoot: fixture.repositoryRoot,
        migration: migration.migration,
        semanticReviewBytes: createAcceptedReviewBytes(review.value.request),
      });
      if (!preview.ok) throw new TypeError("publication preview was unavailable");
      const authority = getPublishedRuleFamilyRecordAuthorityV2(preview.value.stagedRecord);
      if (authority === undefined) throw new TypeError("staged record authority was unavailable");
      expect((await validateExecutableRuleFamilyMembersV2(authority)).ok).toBe(true);

      const members = new Map(authority.members);
      const modelBytes = members.get("rule-models-v2.json");
      if (modelBytes === undefined) throw new TypeError("model member was unavailable");
      const parsed = parsePublicationJson(modelBytes);
      if (!parsed.ok) throw new TypeError("model member was invalid");
      const hostileModel = record(structuredClone(parsed.value));
      record(array(hostileModel.structuredCases)[0]).oracleEvaluationIdentity =
        `sha256:${"0".repeat(64)}`;
      members.set("rule-models-v2.json", renderPublicationJson(hostileModel));
      const hostile = createStagedPublishedRuleFamilyRecordV2({
        ...authority,
        members,
      });
      const hostileAuthority = getPublishedRuleFamilyRecordAuthorityV2(hostile);
      if (hostileAuthority === undefined) throw new TypeError("hostile record was unavailable");
      expect(await validateExecutableRuleFamilyMembersV2(hostileAuthority)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "publication.record.invalid", path: "rule-models-v2.json" }],
      });
    } finally {
      await fixture.cleanup();
    }
  });
});
