import { createHash } from "node:crypto";

import {
  MODELED_BOUNDARY_REVISION,
  MODELED_GENERATOR_REVISION,
} from "./modeled-candidate-revisions.generated.js";
import {
  ORACLE_COMPILER_RESULT_REVISION,
  ORACLE_EMITTED_PROGRAM_REVISION,
  ORACLE_FRONTEND_RESULT_REVISION,
  ORACLE_RUNTIME_STATE_REVISION,
  ORACLE_SEMANTIC_RELATIONS_REVISION,
} from "./oracle-candidate-revisions.generated.js";
import {
  getEmbeddedCaseFixtureSetStateV2,
  type EmbeddedCaseFixtureSetV2,
} from "./embed-case-fixtures.js";
import {
  validateFirstVerticalPublicationCandidateV2,
  type FirstVerticalPublicationCandidateV2,
} from "./first-vertical-publication.js";
import { isSha256Digest } from "./canonical-identity.js";
import type { HandlerKind } from "./model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import {
  digestPublicationBytes,
  renderPublicationJson,
  type PublicationBindingRow,
} from "./publication-model.js";
import {
  RULE_FAMILY_HANDLER_IDS_V2,
  type RuleFamilyHandlerIdV2,
} from "./rule-family-handler-catalog.js";
import {
  getPublishedRuleFamilyRecordAuthorityV2,
  type PublishedRuleFamilyRecord,
} from "./rule-family-publication-record.js";
import { validateRuleModelRegistryV2, type RuleModelRegistryV2 } from "./rule-family-model.js";

export { RULE_FAMILY_HANDLER_IDS_V2 } from "./rule-family-handler-catalog.js";
export type { RuleFamilyHandlerIdV2 } from "./rule-family-handler-catalog.js";

/** One exact old-to-current handler revision transition. */
export interface RuleFamilyHandlerMigrationV2 {
  readonly handlerId: RuleFamilyHandlerIdV2;
  readonly kind: HandlerKind;
  readonly contractVersion: "1.0.0";
  readonly fromRevision: Sha256Digest;
  readonly toRevision: Sha256Digest;
}

/** Complete deterministic migration into one version-two model. */
export interface RuleModelMigrationDocumentV2 {
  readonly schemaVersion: 2;
  readonly kind: "rule-model-migration-v2";
  readonly sourcePublicationDigest: Sha256Digest;
  readonly targetModelDigest: Sha256Digest;
  readonly firstVerticalCandidateDigest: Sha256Digest;
  readonly fixtureSetDigest: Sha256Digest;
  readonly handlers: readonly RuleFamilyHandlerMigrationV2[];
}

declare const preparedRuleModelMigrationV2Brand: unique symbol;

/** Opaque authority proving that the complete migration has been derived and validated. */
export interface PreparedRuleModelMigrationV2 {
  readonly [preparedRuleModelMigrationV2Brand]: true;
}

/** Authorities required to prepare a complete migration. */
export interface PrepareRuleModelMigrationInputV2 {
  readonly schemaVersion: 2;
  readonly sourceRecord: PublishedRuleFamilyRecord;
  readonly targetModel: RuleModelRegistryV2;
  readonly firstVerticalCandidate: FirstVerticalPublicationCandidateV2;
  readonly fixtureSet: EmbeddedCaseFixtureSetV2;
}

/** Stable migration validation diagnostic. */
export interface RuleModelMigrationDiagnosticV2 {
  readonly code:
    | "rule-model.invalid-handler-migration"
    | "rule-model.invalid-first-vertical"
    | "rule-model.unauthenticated-fixture";
  readonly path: string;
  readonly message: string;
}

/** Result of deriving or validating one complete migration. */
export type RuleModelMigrationValidationResultV2 =
  | {
      readonly ok: true;
      readonly migration: PreparedRuleModelMigrationV2;
      readonly document: RuleModelMigrationDocumentV2;
      readonly migrationDigest: Sha256Digest;
      readonly canonicalBytes: Uint8Array;
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly RuleModelMigrationDiagnosticV2[] };

/** Internal authority retained behind a genuine migration capability. */
export interface PreparedRuleModelMigrationAuthorityV2 {
  readonly sourceRecord: PublishedRuleFamilyRecord;
  readonly targetModel?: RuleModelRegistryV2;
  readonly firstVerticalCandidate?: FirstVerticalPublicationCandidateV2;
  readonly fixtureSet?: EmbeddedCaseFixtureSetV2;
  readonly document: RuleModelMigrationDocumentV2;
  readonly canonicalBytes: Uint8Array;
  readonly migrationDigest: Sha256Digest;
}

const MIGRATIONS = new WeakMap<object, PreparedRuleModelMigrationAuthorityV2>();
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

const CURRENT_REVISIONS: Readonly<Record<RuleFamilyHandlerIdV2, Sha256Digest>> = Object.freeze({
  "generator.compiler-cases": MODELED_GENERATOR_REVISION.claimedRevision,
  "generator.frontend-cases": MODELED_GENERATOR_REVISION.claimedRevision,
  "generator.runtime-cases": MODELED_GENERATOR_REVISION.claimedRevision,
  "oracle.compiler-result": ORACLE_COMPILER_RESULT_REVISION.claimedRevision,
  "oracle.emitted-program": ORACLE_EMITTED_PROGRAM_REVISION.claimedRevision,
  "oracle.frontend-result": ORACLE_FRONTEND_RESULT_REVISION.claimedRevision,
  "oracle.runtime-state": ORACLE_RUNTIME_STATE_REVISION.claimedRevision,
  "transform.boundary-variants": MODELED_BOUNDARY_REVISION.claimedRevision,
  "transform.semantic-relations": ORACLE_SEMANTIC_RELATIONS_REVISION.claimedRevision,
});

const HANDLER_KINDS: Readonly<Record<RuleFamilyHandlerIdV2, HandlerKind>> = Object.freeze({
  "generator.compiler-cases": "generator",
  "generator.frontend-cases": "generator",
  "generator.runtime-cases": "generator",
  "oracle.compiler-result": "oracle",
  "oracle.emitted-program": "oracle",
  "oracle.frontend-result": "oracle",
  "oracle.runtime-state": "oracle",
  "transform.boundary-variants": "transform",
  "transform.semantic-relations": "transform",
});

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function failure(
  code: RuleModelMigrationDiagnosticV2["code"],
  path: string,
  message: string,
): RuleModelMigrationValidationResultV2 {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([Object.freeze({ code, path, message })]),
  });
}

function absentSourceRevision(
  publicationDigest: Sha256Digest,
  handlerId: RuleFamilyHandlerIdV2,
): Sha256Digest {
  return `sha256:${createHash("sha256")
    .update("blend65-unbound-publication-handler-v1\0", "utf8")
    .update(publicationDigest, "utf8")
    .update("\0", "utf8")
    .update(handlerId, "utf8")
    .digest("hex")}`;
}

function expectedRows(
  sourcePublicationDigest: Sha256Digest,
  bindings: readonly PublicationBindingRow[],
): readonly RuleFamilyHandlerMigrationV2[] {
  const oldRows = new Map(bindings.map((row) => [row.handlerId, row]));
  return Object.freeze(
    RULE_FAMILY_HANDLER_IDS_V2.map((handlerId) =>
      Object.freeze({
        handlerId,
        kind: HANDLER_KINDS[handlerId],
        contractVersion: "1.0.0" as const,
        fromRevision:
          oldRows.get(handlerId)?.implementationRevision ??
          absentSourceRevision(sourcePublicationDigest, handlerId),
        toRevision: CURRENT_REVISIONS[handlerId],
      }),
    ),
  );
}

function sameRows(
  input: unknown,
  expected: readonly RuleFamilyHandlerMigrationV2[],
): { readonly ok: true } | { readonly ok: false; readonly path: string } {
  if (!Array.isArray(input) || input.length !== expected.length) {
    return { ok: false, path: "/handlers" };
  }
  const suppliedAllEqual = input.every(
    (value) => isRecord(value) && value.fromRevision === value.toRevision,
  );
  const authoritiesAllEqual = expected.every(
    ({ fromRevision, toRevision }) => fromRevision === toRevision,
  );
  if (suppliedAllEqual && !authoritiesAllEqual) {
    return { ok: false, path: "/handlers" };
  }
  for (let index = 0; index < expected.length; index += 1) {
    const row = input[index];
    const authoritative = expected[index];
    if (!isRecord(row) || authoritative === undefined) {
      return { ok: false, path: `/handlers/${index}` };
    }
    for (const key of [
      "handlerId",
      "kind",
      "contractVersion",
      "fromRevision",
      "toRevision",
    ] as const) {
      if (row[key] !== authoritative[key]) {
        return { ok: false, path: `/handlers/${index}/${key}` };
      }
    }
    if (Object.keys(row).length !== 5) return { ok: false, path: `/handlers/${index}` };
  }
  return { ok: true };
}

function createPrepared(
  authority: PreparedRuleModelMigrationAuthorityV2,
): RuleModelMigrationValidationResultV2 {
  const migration = Object.freeze({}) as PreparedRuleModelMigrationV2;
  MIGRATIONS.set(migration, authority);
  return Object.freeze({
    ok: true,
    migration,
    document: authority.document,
    migrationDigest: authority.migrationDigest,
    canonicalBytes: authority.canonicalBytes.slice(),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Derives a complete old-to-current migration from opaque package-owned authorities.
 *
 * @param input Authenticated source, model, vertical and fixture capabilities.
 * @returns One deterministic all-handler migration or a stable failure.
 */
export function prepareRuleModelMigrationV2(
  input: PrepareRuleModelMigrationInputV2,
): RuleModelMigrationValidationResultV2 {
  const source = getPublishedRuleFamilyRecordAuthorityV2(input.sourceRecord);
  const target = validateRuleModelRegistryV2(input.targetModel);
  const firstVertical = validateFirstVerticalPublicationCandidateV2(input.firstVerticalCandidate);
  const fixture = getEmbeddedCaseFixtureSetStateV2(input.fixtureSet);
  if (input.schemaVersion !== 2 || source === undefined || !target.ok) {
    return failure(
      "rule-model.invalid-handler-migration",
      "/handlers",
      "Migration requires an authenticated source and complete target model.",
    );
  }
  if (!firstVertical.ok) {
    return failure(
      "rule-model.invalid-first-vertical",
      "/firstVerticalCandidate",
      "Migration first-vertical authority is invalid.",
    );
  }
  if (fixture === undefined) {
    return failure(
      "rule-model.unauthenticated-fixture",
      "/fixtureSet",
      "Migration fixture authority is invalid.",
    );
  }
  const document: RuleModelMigrationDocumentV2 = Object.freeze({
    schemaVersion: 2,
    kind: "rule-model-migration-v2",
    sourcePublicationDigest: source.publicationDigest,
    targetModelDigest: target.modelDigest,
    firstVerticalCandidateDigest: firstVertical.candidateDigest,
    fixtureSetDigest: fixture.digest,
    handlers: expectedRows(source.publicationDigest, source.bindings),
  });
  const canonicalBytes = renderPublicationJson(document);
  return createPrepared(
    Object.freeze({
      sourceRecord: input.sourceRecord,
      targetModel: target.model,
      firstVerticalCandidate: firstVertical.candidate,
      fixtureSet: input.fixtureSet,
      document,
      canonicalBytes,
      migrationDigest: digestPublicationBytes(canonicalBytes),
    }),
  );
}

/**
 * Replays one raw migration against its authenticated predecessor and current handler revisions.
 *
 * @param sourceRecord Genuine passive predecessor record.
 * @param input Untrusted migration document.
 * @returns Reissued migration capability or a path-specific rejection.
 */
export function validateRuleModelMigrationDocumentV2(
  sourceRecord: PublishedRuleFamilyRecord,
  input: unknown,
): RuleModelMigrationValidationResultV2 {
  const source = getPublishedRuleFamilyRecordAuthorityV2(sourceRecord);
  if (
    source === undefined ||
    !isRecord(input) ||
    !exactKeys(input, [
      "schemaVersion",
      "kind",
      "sourcePublicationDigest",
      "targetModelDigest",
      "firstVerticalCandidateDigest",
      "fixtureSetDigest",
      "handlers",
    ]) ||
    input.schemaVersion !== 2 ||
    input.kind !== "rule-model-migration-v2" ||
    input.sourcePublicationDigest !== source.publicationDigest ||
    !isSha256Digest(input.targetModelDigest) ||
    !isSha256Digest(input.firstVerticalCandidateDigest) ||
    !isSha256Digest(input.fixtureSetDigest)
  ) {
    return failure(
      "rule-model.invalid-handler-migration",
      "/handlers",
      "Migration document has an invalid authority envelope.",
    );
  }
  const compared = sameRows(
    input.handlers,
    expectedRows(source.publicationDigest, source.bindings),
  );
  if (!compared.ok) {
    return failure(
      "rule-model.invalid-handler-migration",
      compared.path,
      "Migration must contain every exact old-to-current handler transition once.",
    );
  }
  const document: RuleModelMigrationDocumentV2 = Object.freeze({
    schemaVersion: 2,
    kind: "rule-model-migration-v2",
    sourcePublicationDigest: source.publicationDigest,
    targetModelDigest: input.targetModelDigest,
    firstVerticalCandidateDigest: input.firstVerticalCandidateDigest,
    fixtureSetDigest: input.fixtureSetDigest,
    handlers: expectedRows(source.publicationDigest, source.bindings),
  });
  const canonicalBytes = renderPublicationJson(document);
  return createPrepared(
    Object.freeze({
      sourceRecord,
      document,
      canonicalBytes,
      migrationDigest: digestPublicationBytes(canonicalBytes),
    }),
  );
}

/** Returns retained migration authority only for a factory-issued capability. */
export function getPreparedRuleModelMigrationAuthorityV2(
  migration: PreparedRuleModelMigrationV2,
): PreparedRuleModelMigrationAuthorityV2 | undefined {
  return typeof migration === "object" && migration !== null
    ? MIGRATIONS.get(migration)
    : undefined;
}
