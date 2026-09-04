import { describe, expect, it } from "vitest";

import {
  createFirstVerticalEmbeddedFixtureSetV2,
  createFirstVerticalPublicationCandidateV2,
  createFirstRuleModelRegistryV2,
  prepareRuleModelMigrationV2,
  resolvePublishedRuleFamilyRecordByDigestV2,
  validateRuleModelMigrationDocumentV2,
} from "./index.js";
import type { Sha256Digest } from "./model-registry-model.js";
import { getPreparedRuleModelMigrationAuthorityV2 } from "./rule-model-migration.js";
import {
  CURRENT_PARENT_DIGEST,
  createIsolatedRepository,
  removeIsolatedRepository,
} from "./test-fixtures/execution-publication-spec-fixture.js";
import { createOraclePublicationSpecFixture } from "./test-fixtures/oracle-publication-spec-fixture.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function prepareForParent(repositoryRoot: string, publicationDigest: Sha256Digest) {
  const source = await resolvePublishedRuleFamilyRecordByDigestV2({
    repositoryRoot,
    publicationDigest,
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
  const prepared = prepareRuleModelMigrationV2({
    schemaVersion: 2,
    sourceRecord: source.value,
    targetModel: model.model,
    firstVerticalCandidate: firstVertical,
    fixtureSet: fixtureSet.fixtureSet,
  });
  if (!prepared.ok) throw new TypeError("migration authority was unavailable");
  return { source: source.value, prepared };
}

describe("canonical migration replay capability", () => {
  it("registers a replayed migration in package-owned capability state", async () => {
    const fixture = await createOraclePublicationSpecFixture();
    try {
      const source = await resolvePublishedRuleFamilyRecordByDigestV2({
        repositoryRoot: fixture.repositoryRoot,
        publicationDigest: fixture.publicationDigest,
      });
      expect(source.ok).toBe(true);
      if (!source.ok) throw new TypeError("passive predecessor was unavailable");
      const firstVertical = createFirstVerticalPublicationCandidateV2();
      const fixtureSet = createFirstVerticalEmbeddedFixtureSetV2(firstVertical);
      expect(fixtureSet.ok).toBe(true);
      if (!fixtureSet.ok) throw new TypeError("fixture authority was unavailable");
      const model = createFirstRuleModelRegistryV2({
        sourceRecord: source.value,
        firstVertical,
        fixtureSet: fixtureSet.fixtureSet,
      });
      expect(model.ok).toBe(true);
      if (!model.ok) throw new TypeError("model authority was unavailable");
      const prepared = prepareRuleModelMigrationV2({
        schemaVersion: 2,
        sourceRecord: source.value,
        targetModel: model.model,
        firstVerticalCandidate: firstVertical,
        fixtureSet: fixtureSet.fixtureSet,
      });
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) throw new TypeError("migration authority was unavailable");

      const replayed = validateRuleModelMigrationDocumentV2(
        source.value,
        structuredClone(prepared.document),
      );
      expect(replayed.ok).toBe(true);
      if (!replayed.ok) throw new TypeError("migration replay was rejected");
      const authority = getPreparedRuleModelMigrationAuthorityV2(replayed.migration);
      expect(authority?.document).toEqual(prepared.document);
      expect(authority?.migrationDigest).toBe(prepared.migrationDigest);

      const extended = { ...structuredClone(prepared.document), extra: true };
      expect(validateRuleModelMigrationDocumentV2(source.value, extended)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "rule-model.invalid-handler-migration" }],
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it("accepts current-to-current rows only when both authenticated revisions agree", async () => {
    const repositoryRoot = await createIsolatedRepository();
    try {
      const { source, prepared } = await prepareForParent(repositoryRoot, CURRENT_PARENT_DIGEST);
      expect(
        prepared.document.handlers.every(
          ({ fromRevision, toRevision }) => fromRevision === toRevision,
        ),
      ).toBe(true);
      expect(
        validateRuleModelMigrationDocumentV2(source, structuredClone(prepared.document)),
      ).toMatchObject({ ok: true, migrationDigest: prepared.migrationDigest });

      const mutated: unknown = structuredClone(prepared.document);
      if (
        !isRecord(mutated) ||
        !Array.isArray(mutated.handlers) ||
        !isRecord(mutated.handlers[0])
      ) {
        throw new TypeError("migration mutation fixture was unavailable");
      }
      mutated.handlers[0].toRevision =
        "sha256:0000000000000000000000000000000000000000000000000000000000000000";
      expect(validateRuleModelMigrationDocumentV2(source, mutated)).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: "rule-model.invalid-handler-migration",
            path: "/handlers/0/toRevision",
          },
        ],
      });
    } finally {
      await removeIsolatedRepository(repositoryRoot);
    }
  });

  it("replays mixed changed and unchanged rows from their independent authorities", async () => {
    const fixture = await createOraclePublicationSpecFixture();
    try {
      const { source, prepared } = await prepareForParent(
        fixture.repositoryRoot,
        fixture.publicationDigest,
      );
      const unchanged = prepared.document.handlers.filter(
        ({ fromRevision, toRevision }) => fromRevision === toRevision,
      );
      const changed = prepared.document.handlers.filter(
        ({ fromRevision, toRevision }) => fromRevision !== toRevision,
      );
      expect(unchanged.length).toBeGreaterThan(0);
      expect(changed.length).toBeGreaterThan(0);
      expect(
        validateRuleModelMigrationDocumentV2(source, structuredClone(prepared.document)),
      ).toMatchObject({ ok: true, migrationDigest: prepared.migrationDigest });
    } finally {
      await fixture.cleanup();
    }
  });
});
