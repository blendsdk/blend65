import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createOraclePublicationSpecFixture } from "./test-fixtures/oracle-publication-spec-fixture.js";

const V1_MEMBER_PATHS = [
  "bindings-v1.json",
  "compiler-readiness-v1.json",
  "compiler-readiness.md",
  "declarations.ts",
  "rule-models-v1-review.json",
  "rule-models-v1.json",
  "semantic-review-v1.json",
] as const;
const HANDLER_IDS = [
  "generator.compiler-cases",
  "generator.frontend-cases",
  "generator.runtime-cases",
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
  "transform.boundary-variants",
  "transform.semantic-relations",
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

function memberPaths(value: unknown): unknown[] {
  return requireArray(value, "publication members").map(
    (entry) => requireRecord(entry, "publication member").path,
  );
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

async function prepareMigration() {
  const fixture = await createOraclePublicationSpecFixture();
  try {
    const [resolver, firstVertical, fixtures, models, migrations] = await Promise.all([
      vi.importActual<typeof import("./publication-resolver.js")>("./publication-resolver.js"),
      vi.importActual<typeof import("./first-vertical-publication.js")>(
        "./first-vertical-publication.js",
      ),
      vi.importActual<typeof import("./embed-case-fixtures.js")>("./embed-case-fixtures.js"),
      vi.importActual<typeof import("./rule-family-model.js")>("./rule-family-model.js"),
      vi.importActual<typeof import("./rule-model-migration.js")>("./rule-model-migration.js"),
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
    const migration = migrations.prepareRuleModelMigrationV2({
      schemaVersion: 2,
      sourceRecord,
      targetModel: model.model,
      firstVerticalCandidate: candidate,
      fixtureSet: fixtureSet.fixtureSet,
    });
    expectOk(migration);
    return { fixture, resolver, migrations, sourceRecord, candidate, fixtureSet, model, migration };
  } catch (error) {
    await fixture.cleanup();
    throw error;
  }
}

describe("passive historical publication resolution", () => {
  it("preserves exact v1 bytes while refusing unavailable executable authority", async () => {
    const fixture = await createOraclePublicationSpecFixture();
    try {
      const resolver = await vi.importActual<typeof import("./publication-resolver.js")>(
        "./publication-resolver.js",
      );
      const recordResult = await resolver.resolvePublishedRuleFamilyRecordByDigestV2({
        repositoryRoot: fixture.repositoryRoot,
        publicationDigest: fixture.publicationDigest,
      });
      expectOk(recordResult);
      const record = recordResult.value;
      const firstProjectionResult = resolver.getPublishedRuleFamilyRecordProjectionV2(record);
      expectOk(firstProjectionResult);
      const firstProjection = firstProjectionResult.value;

      expect(firstProjection.schemaVersion).toBe(1);
      expect(firstProjection.publicationDigest).toBe(fixture.publicationDigest);
      expect(firstProjection.predecessorPublicationDigest).toBeUndefined();
      expect(memberPaths(firstProjection.members)).toEqual(V1_MEMBER_PATHS);
      for (const member of firstProjection.members) {
        expect(member.bytes).toEqual(
          await readFile(
            join(
              fixture.repositoryRoot,
              "readiness/publications/releases",
              fixture.publicationDigest,
              member.path,
            ),
          ),
        );
        expect(member.byteLength).toBe(member.bytes.byteLength);
        expect(member.digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
      }
      expect(
        await readFile(
          join(fixture.repositoryRoot, "readiness/publications/current-publication.json"),
        ),
      ).toEqual(fixture.pointerBytes);

      firstProjection.members[0]?.bytes.fill(0);
      const repeatedResult = resolver.getPublishedRuleFamilyRecordProjectionV2(record);
      expectOk(repeatedResult);
      const repeated = repeatedResult.value;
      expect(repeated.members[0]?.bytes).toEqual(
        await readFile(
          join(
            fixture.repositoryRoot,
            "readiness/publications/releases",
            fixture.publicationDigest,
            V1_MEMBER_PATHS[0],
          ),
        ),
      );
      expectDiagnostic(
        await resolver.acquirePublishedRuleFamilyAuthorityV2(record),
        "publication.implementation-unavailable",
        "/bindings/0/implementationRevision",
      );
      expectDiagnostic(
        await resolver.resolvePublishedSnapshotByDigest({
          repositoryRoot: fixture.repositoryRoot,
          publicationDigest: fixture.publicationDigest,
        }),
        "publication.implementation-unavailable",
        "/bindings/0/implementationRevision",
      );
    } finally {
      await fixture.cleanup();
    }
  });
});

describe("deterministic complete handler migration", () => {
  it("derives all nine exact revisions and produces byte-identical replay", async () => {
    const authority = await prepareMigration();
    try {
      const repeated = authority.migrations.prepareRuleModelMigrationV2({
        schemaVersion: 2,
        sourceRecord: authority.sourceRecord,
        targetModel: authority.model.model,
        firstVerticalCandidate: authority.candidate,
        fixtureSet: authority.fixtureSet.fixtureSet,
      });
      expectOk(repeated);
      expect(authority.migrations.RULE_FAMILY_HANDLER_IDS_V2).toEqual(HANDLER_IDS);
      const handlerRows = requireArray(
        authority.migration.document.handlers,
        "migration handlers",
      ).map((row) => requireRecord(row, "migration handler"));
      expect(handlerRows.map(({ handlerId }) => handlerId)).toEqual(HANDLER_IDS);
      expect(handlerRows).toHaveLength(9);
      for (const row of handlerRows) {
        expect(row.contractVersion).toBe("1.0.0");
        expect(row.fromRevision).toMatch(/^sha256:[0-9a-f]{64}$/u);
        expect(row.toRevision).toMatch(/^sha256:[0-9a-f]{64}$/u);
        expect(row.toRevision).not.toBe(row.fromRevision);
      }
      expect(repeated.document).toEqual(authority.migration.document);
      expect(repeated.migrationDigest).toBe(authority.migration.migrationDigest);
      expect(repeated.canonicalBytes).toEqual(authority.migration.canonicalBytes);
      expect(JSON.parse(decoder.decode(repeated.canonicalBytes))).toEqual(repeated.document);
    } finally {
      await authority.fixture.cleanup();
    }
  });

  it("rejects partial, mixed, reordered, wildcard, duplicate, and no-op migrations", async () => {
    const authority = await prepareMigration();
    try {
      const validate = (document: unknown) =>
        authority.migrations.validateRuleModelMigrationDocumentV2(authority.sourceRecord, document);
      const partial = requireRecord(
        structuredClone(authority.migration.document),
        "partial migration",
      );
      requireArray(partial.handlers, "partial handlers").splice(5);
      expectDiagnostic(validate(partial), "rule-model.invalid-handler-migration", "/handlers");

      const mixed = requireRecord(structuredClone(authority.migration.document), "mixed migration");
      const mixedRow = requireRecord(
        requireArray(mixed.handlers, "mixed handlers")[0],
        "mixed migration row",
      );
      mixedRow.toRevision = mixedRow.fromRevision;
      expectDiagnostic(validate(mixed), "rule-model.invalid-handler-migration");

      const reordered = requireRecord(
        structuredClone(authority.migration.document),
        "reordered migration",
      );
      const reorderedRows = requireArray(reordered.handlers, "reordered handlers");
      [reorderedRows[0], reorderedRows[1]] = [reorderedRows[1], reorderedRows[0]];
      expectDiagnostic(validate(reordered), "rule-model.invalid-handler-migration");

      const wildcard = requireRecord(
        structuredClone(authority.migration.document),
        "wildcard migration",
      );
      requireRecord(
        requireArray(wildcard.handlers, "wildcard handlers")[0],
        "wildcard migration row",
      ).handlerId = "*";
      expectDiagnostic(validate(wildcard), "rule-model.invalid-handler-migration");

      const duplicate = requireRecord(
        structuredClone(authority.migration.document),
        "duplicate migration",
      );
      const duplicateRows = requireArray(duplicate.handlers, "duplicate handlers");
      duplicateRows[1] = duplicateRows[0];
      expectDiagnostic(validate(duplicate), "rule-model.invalid-handler-migration");

      const noOp = requireRecord(structuredClone(authority.migration.document), "no-op migration");
      for (const row of requireArray(noOp.handlers, "no-op handlers")) {
        const noOpRow = requireRecord(row, "no-op migration row");
        noOpRow.toRevision = noOpRow.fromRevision;
      }
      expectDiagnostic(validate(noOp), "rule-model.invalid-handler-migration", "/handlers");
    } finally {
      await authority.fixture.cleanup();
    }
  });
});
