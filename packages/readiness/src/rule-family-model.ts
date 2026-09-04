import {
  getEmbeddedCaseFixtureSetStateV2,
  type EmbeddedCaseFixtureSetV2,
} from "./embed-case-fixtures.js";
import {
  FIRST_VERTICAL_RULE_IDS_V1,
  validateFirstVerticalPublicationCandidateV2,
  type FirstVerticalPublicationCandidateV2,
} from "./first-vertical-publication.js";
import type { RuleId, Sha256Digest } from "./model-registry-model.js";
import { digestPublicationBytes, renderPublicationJson } from "./publication-model.js";
import {
  getPublishedRuleFamilyRecordAuthorityV2,
  type PublishedRuleFamilyRecord,
} from "./rule-family-publication-record.js";
import type { RuleModelVersionV2 } from "./rule-model-version.js";
import { projectRuleFamilySuccessorInventoryV2 } from "./rule-family-inventory.js";
import type { StructuredCaseIdV1 } from "./structured-case-families.js";
import {
  derivePublishedStructuredCaseBindingV2,
  validateRuleModelRegistryAgainstInventoryV2,
  validateRuleModelRegistryValueV2,
} from "./rule-family-model-validation.js";
import type { RuleFamilyV2, TerminalRuleDispositionV2 } from "./terminal-rule-disposition.js";
import { createFirstVerticalStructuredExecutionExemplarV2 } from "./structured-execution-exemplar.js";
import { readInventoryVersioned } from "./versioning.js";

/** Published identity binding retained for one structured case. */
export interface PublishedStructuredCaseBindingV2 {
  readonly caseId: StructuredCaseIdV1;
  readonly caseDigest: Sha256Digest;
  readonly sourceDigest: Sha256Digest;
  readonly oracleEvaluationIdentity: Sha256Digest;
  readonly executionEnvelopeDigest?: Sha256Digest;
  readonly embedFixtureIds: readonly string[];
}

/** Complete first version-two rule-model registry. */
export interface RuleModelRegistryV2 {
  readonly schemaVersion: 2;
  readonly kind: "rule-model-registry-v2";
  readonly version: RuleModelVersionV2;
  readonly inventoryDigest: Sha256Digest;
  readonly specRevision: "spec-v3.0";
  readonly families: readonly RuleFamilyV2[];
  readonly dispositions: readonly TerminalRuleDispositionV2[];
  readonly firstVertical: FirstVerticalPublicationCandidateV2;
  readonly structuredCases: readonly PublishedStructuredCaseBindingV2[];
}

/** Stable rule-model validation categories. */
export type RuleModelV2DiagnosticCode =
  | "rule-model.unsupported-version"
  | "rule-model.invalid-cardinality"
  | "rule-model.invalid-disposition"
  | "rule-model.invalid-family"
  | "rule-model.invalid-first-vertical"
  | "rule-model.invalid-case-binding";

/** One deterministic rule-model validation diagnostic. */
export interface RuleModelV2Diagnostic {
  readonly code: RuleModelV2DiagnosticCode;
  readonly path: string;
  readonly message: string;
}

/** Closed result of validating a complete version-two rule model. */
export type RuleModelV2ValidationResult =
  | {
      readonly ok: true;
      readonly model: RuleModelRegistryV2;
      readonly modelDigest: Sha256Digest;
      readonly canonicalBytes: Uint8Array;
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly RuleModelV2Diagnostic[] };

/** Authorities required to construct the first complete registry. */
export interface CreateFirstRuleModelRegistryInputV2 {
  readonly sourceRecord: PublishedRuleFamilyRecord;
  readonly firstVertical: FirstVerticalPublicationCandidateV2;
  readonly fixtureSet: EmbeddedCaseFixtureSetV2;
}

function failure(
  code: RuleModelV2DiagnosticCode,
  path: string,
  message: string,
): RuleModelV2ValidationResult {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([Object.freeze({ code, path, message })]),
  });
}

function pendingDisposition(ruleId: RuleId): TerminalRuleDispositionV2 {
  return Object.freeze({
    state: "pending-review",
    ruleId,
    result: Object.freeze({ kind: "blocking", reason: "family-review-pending" }),
  });
}

function reviewedDisposition(
  ruleId: RuleId,
  evidenceDigest: Sha256Digest,
): TerminalRuleDispositionV2 {
  return Object.freeze({
    state: "reviewed",
    ruleId,
    claimRole: "semantic-gate",
    route: Object.freeze({ kind: "source", familyId: "family.structured-first-vertical" }),
    result: Object.freeze({ kind: "passing", evidenceDigest }),
  });
}

function structuredCaseBinding(
  caseId: StructuredCaseIdV1,
  executionEnvelopeDigest?: Sha256Digest,
): PublishedStructuredCaseBindingV2 | undefined {
  return derivePublishedStructuredCaseBindingV2(caseId, executionEnvelopeDigest);
}

function firstFamily(ruleIds: readonly RuleId[]): RuleFamilyV2 {
  return Object.freeze({
    familyId: "family.structured-first-vertical",
    memberRuleIds: Object.freeze([...ruleIds]),
    constructionPreconditions: Object.freeze([]),
    typedDomains: Object.freeze([]),
    invalidContracts: Object.freeze([]),
    boundaryFamilyIds: Object.freeze([]),
    spellings: Object.freeze([]),
    oracleRouteIds: Object.freeze(["oracle.structured-program"]),
  });
}

/**
 * Constructs the initial complete 2,112-row registry from authenticated authorities only.
 *
 * @param input Passive predecessor, reviewed vertical and fixture capabilities.
 * @returns Canonical complete registry or one stable authority diagnostic.
 */
export function createFirstRuleModelRegistryV2(
  input: CreateFirstRuleModelRegistryInputV2,
): RuleModelV2ValidationResult {
  const source = getPublishedRuleFamilyRecordAuthorityV2(input.sourceRecord);
  const firstVertical = validateFirstVerticalPublicationCandidateV2(input.firstVertical);
  const fixture = getEmbeddedCaseFixtureSetStateV2(input.fixtureSet);
  if (source === undefined || !firstVertical.ok || fixture === undefined) {
    return failure(
      "rule-model.invalid-first-vertical",
      "/firstVertical",
      "The initial registry requires exact authenticated source, vertical and fixture authorities.",
    );
  }
  const inventoryBytes = source.members.get("compiler-readiness-v1.json");
  if (inventoryBytes === undefined) {
    return failure(
      "rule-model.invalid-cardinality",
      "/dispositions",
      "The predecessor inventory member is unavailable.",
    );
  }
  const inventory = readInventoryVersioned(inventoryBytes);
  const successor =
    inventory.ok && inventory.inventory !== undefined
      ? projectRuleFamilySuccessorInventoryV2(inventory.inventory)
      : undefined;
  if (successor === undefined || successor.inventory.rules.length !== 2_112) {
    return failure(
      "rule-model.invalid-cardinality",
      "/dispositions",
      "The predecessor inventory must contain exactly 2,112 rules.",
    );
  }
  const reviewedByRule = new Map(
    firstVertical.candidate.evidenceBindings.map((binding) => [
      binding.ruleId,
      digestPublicationBytes(renderPublicationJson(binding)),
    ]),
  );
  const dispositions = [...successor.inventory.rules]
    .map(({ ruleId }) =>
      reviewedByRule.has(ruleId)
        ? reviewedDisposition(ruleId, reviewedByRule.get(ruleId)!)
        : pendingDisposition(ruleId),
    )
    .sort((left, right) => left.ruleId.localeCompare(right.ruleId));
  const evidenceCaseIds = new Set<StructuredCaseIdV1>();
  for (const binding of firstVertical.candidate.evidenceBindings) {
    for (const evidence of binding.evidence) evidenceCaseIds.add(evidence.caseId);
  }
  const exemplar = createFirstVerticalStructuredExecutionExemplarV2();
  if (!exemplar.ok) {
    return failure(
      "rule-model.invalid-case-binding",
      "/structuredCases",
      "The combined execution exemplar is unavailable.",
    );
  }
  const structuredCases = [...evidenceCaseIds]
    .sort()
    .map((caseId) => structuredCaseBinding(caseId));
  structuredCases.push(
    structuredCaseBinding(
      "case.structured.vertical-combined-v1",
      exemplar.value.document.envelope.digest,
    ),
  );
  if (structuredCases.some((binding) => binding === undefined)) {
    return failure(
      "rule-model.invalid-case-binding",
      "/structuredCases",
      "One structured case could not be authenticated.",
    );
  }
  const model: RuleModelRegistryV2 = Object.freeze({
    schemaVersion: 2,
    kind: "rule-model-registry-v2",
    version: Object.freeze({
      schemaVersion: 2,
      kind: "rule-model-version-v2",
      version: "2.0.0",
      predecessorPublicationDigest: source.publicationDigest,
    }),
    inventoryDigest: successor.inventoryDigest,
    specRevision: "spec-v3.0",
    families: Object.freeze([firstFamily(FIRST_VERTICAL_RULE_IDS_V1)]),
    dispositions: Object.freeze(dispositions),
    firstVertical: firstVertical.candidate,
    structuredCases: Object.freeze(
      structuredCases.filter(
        (binding): binding is PublishedStructuredCaseBindingV2 => binding !== undefined,
      ),
    ),
  });
  return validateRuleModelRegistryAgainstInventoryV2(model, successor.inventory);
}

/**
 * Validates and canonicalizes one complete version-two registry.
 *
 * @param input Untrusted registry value.
 * @returns Canonical immutable registry or the first path-specific diagnostic.
 */
export function validateRuleModelRegistryV2(input: unknown): RuleModelV2ValidationResult {
  return validateRuleModelRegistryValueV2(input);
}

export { validateRuleModelRegistryAgainstInventoryV2 } from "./rule-family-model-validation.js";
