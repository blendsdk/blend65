import {
  FIRST_VERTICAL_RULE_IDS_V1,
  validateFirstVerticalPublicationCandidateV2,
  type FirstVerticalEvidenceBindingV2,
  type FirstVerticalPublicationCandidateV2,
} from "./first-vertical-publication.js";
import { isSha256Digest } from "./canonical-identity.js";
import type { InventoryV1 } from "./model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import { digestPublicationBytes, renderPublicationJson } from "./publication-model.js";
import type {
  PublishedStructuredCaseBindingV2,
  RuleModelRegistryV2,
  RuleModelV2DiagnosticCode,
  RuleModelV2ValidationResult,
} from "./rule-family-model.js";
import { inspectRuleModelInputV2 } from "./rule-family-model-input.js";
import {
  resolveStructuredCaseAuthorityV1,
  type StructuredCaseIdV1,
} from "./structured-case-families.js";
import {
  deriveStructuredOracleEvaluationIdentityV2,
  evaluateStructuredOracleProgram,
} from "./structured-oracle-evaluator.js";
import { renderSourceModule } from "./source-renderer.js";
import type { RuleFamilyV2, TerminalRuleDispositionV2 } from "./terminal-rule-disposition.js";
import { createFirstVerticalStructuredExecutionExemplarV2 } from "./structured-execution-exemplar.js";

const MODEL_KEYS = Object.freeze([
  "schemaVersion",
  "kind",
  "version",
  "inventoryDigest",
  "specRevision",
  "families",
  "dispositions",
  "firstVertical",
  "structuredCases",
]);
const VERSION_KEYS = Object.freeze([
  "schemaVersion",
  "kind",
  "version",
  "predecessorPublicationDigest",
]);
const FAMILY_KEYS = Object.freeze([
  "familyId",
  "memberRuleIds",
  "constructionPreconditions",
  "typedDomains",
  "invalidContracts",
  "boundaryFamilyIds",
  "spellings",
  "oracleRouteIds",
]);
const CASE_KEYS = Object.freeze([
  "caseId",
  "caseDigest",
  "sourceDigest",
  "oracleEvaluationIdentity",
  "embedFixtureIds",
]);
const COMBINED_CASE_KEYS = Object.freeze([...CASE_KEYS, "executionEnvelopeDigest"]);
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const FAMILY_ID = "family.structured-first-vertical";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
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

function sameValues(actual: readonly unknown[], expected: readonly unknown[]): boolean {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  );
}

function expectedEvidenceDigest(binding: FirstVerticalEvidenceBindingV2): Sha256Digest {
  return digestPublicationBytes(renderPublicationJson(binding));
}

/**
 * Reconstructs one published case binding from the executable structured authority.
 *
 * @param caseId Registry-owned structured case identity.
 * @param executionEnvelopeDigest Optional envelope digest owned by the combined execution case.
 * @returns Exact case/source/evaluation identities, or `undefined` when any authority is unavailable.
 */
export function derivePublishedStructuredCaseBindingV2(
  caseId: StructuredCaseIdV1,
  executionEnvelopeDigest?: Sha256Digest,
): PublishedStructuredCaseBindingV2 | undefined {
  const resolved = resolveStructuredCaseAuthorityV1(caseId);
  if (!resolved.ok || resolved.authority.generatedCase.projection.kind !== "structured") {
    return undefined;
  }
  const authority = resolved.authority;
  const rendered = renderSourceModule(authority.generatedCase.projection.module, {
    maxSourceBytes: authority.oracleInput.generationBudget.maxSourceBytes,
    literalSpellings: [],
  });
  const evaluation = evaluateStructuredOracleProgram(authority.oracleInput);
  if (!rendered.ok) return undefined;
  const evaluationIdentity = deriveStructuredOracleEvaluationIdentityV2(authority.oracleInput);
  if (
    evaluation.ok &&
    evaluation.outcome === "modeled" &&
    evaluation.evaluationIdentity !== evaluationIdentity
  ) {
    return undefined;
  }
  return Object.freeze({
    caseId,
    caseDigest: authority.caseDigest,
    sourceDigest: digestPublicationBytes(rendered.sourceBytes),
    oracleEvaluationIdentity: evaluationIdentity,
    ...(executionEnvelopeDigest === undefined ? {} : { executionEnvelopeDigest }),
    embedFixtureIds: Object.freeze([]),
  });
}

function validateVersion(value: unknown): RuleModelV2ValidationResult | undefined {
  if (
    !isRecord(value) ||
    !exactKeys(value, VERSION_KEYS) ||
    value.schemaVersion !== 2 ||
    value.kind !== "rule-model-version-v2" ||
    value.version !== "2.0.0" ||
    !isSha256Digest(value.predecessorPublicationDigest)
  ) {
    return failure(
      "rule-model.unsupported-version",
      "/version",
      "Rule model version authority has an invalid closed shape.",
    );
  }
  return undefined;
}

function validateFamilyPopulation(value: unknown): RuleModelV2ValidationResult | undefined {
  if (!Array.isArray(value) || value.length !== 1) {
    return failure(
      "rule-model.invalid-family",
      "/families",
      "The initial registry requires exactly one reviewed family.",
    );
  }
  const family = value[0];
  if (
    !isRecord(family) ||
    !exactKeys(family, FAMILY_KEYS) ||
    family.familyId !== FAMILY_ID ||
    !Array.isArray(family.memberRuleIds) ||
    !sameValues(family.memberRuleIds, FIRST_VERTICAL_RULE_IDS_V1) ||
    !Array.isArray(family.constructionPreconditions) ||
    family.constructionPreconditions.length !== 0 ||
    !Array.isArray(family.typedDomains) ||
    family.typedDomains.length !== 0 ||
    !Array.isArray(family.invalidContracts) ||
    family.invalidContracts.length !== 0 ||
    !Array.isArray(family.boundaryFamilyIds) ||
    family.boundaryFamilyIds.length !== 0 ||
    !Array.isArray(family.spellings) ||
    family.spellings.length !== 0 ||
    !Array.isArray(family.oracleRouteIds) ||
    !sameValues(family.oracleRouteIds, ["oracle.structured-program"])
  ) {
    return failure(
      "rule-model.invalid-family",
      "/families/0",
      "The reviewed family does not match its exact rule and route population.",
    );
  }
  return undefined;
}

function pendingDisposition(
  value: Readonly<Record<string, unknown>>,
  index: number,
): TerminalRuleDispositionV2 | RuleModelV2ValidationResult {
  const path = `/dispositions/${index}`;
  if (!exactKeys(value, ["state", "ruleId", "result"])) {
    return failure(
      "rule-model.invalid-disposition",
      Object.hasOwn(value, "claimRole") ? `${path}/claimRole` : path,
      "Pending rows may contain only the pending blocker.",
    );
  }
  if (
    typeof value.ruleId !== "string" ||
    !isRecord(value.result) ||
    !exactKeys(value.result, ["kind", "reason"]) ||
    value.result.kind !== "blocking" ||
    value.result.reason !== "family-review-pending"
  ) {
    return failure(
      "rule-model.invalid-disposition",
      `${path}/result/reason`,
      "Pending rows require the exact family-review-pending blocker.",
    );
  }
  return Object.freeze({
    state: "pending-review",
    ruleId: value.ruleId,
    result: Object.freeze({ kind: "blocking", reason: "family-review-pending" }),
  });
}

function reviewedDisposition(
  value: Readonly<Record<string, unknown>>,
  index: number,
  binding: FirstVerticalEvidenceBindingV2,
): TerminalRuleDispositionV2 | RuleModelV2ValidationResult {
  const path = `/dispositions/${index}`;
  if (!Object.hasOwn(value, "route")) {
    return failure(
      "rule-model.invalid-disposition",
      `${path}/route`,
      "Reviewed rows require one evidence route.",
    );
  }
  if (
    !exactKeys(value, ["state", "ruleId", "claimRole", "route", "result"]) ||
    value.ruleId !== binding.ruleId ||
    value.claimRole !== "semantic-gate" ||
    !isRecord(value.route) ||
    !exactKeys(value.route, ["kind", "familyId"]) ||
    value.route.kind !== "source" ||
    value.route.familyId !== FAMILY_ID ||
    !isRecord(value.result) ||
    !exactKeys(value.result, ["kind", "evidenceDigest"]) ||
    value.result.kind !== "passing" ||
    value.result.evidenceDigest !== expectedEvidenceDigest(binding)
  ) {
    return failure(
      "rule-model.invalid-disposition",
      path,
      "Reviewed row does not join its exact claim, route and evidence identity.",
    );
  }
  return Object.freeze({
    state: "reviewed",
    ruleId: binding.ruleId,
    claimRole: "semantic-gate",
    route: Object.freeze({ kind: "source", familyId: FAMILY_ID }),
    result: Object.freeze({
      kind: "passing",
      evidenceDigest: expectedEvidenceDigest(binding),
    }),
  });
}

function validateDispositionPopulation(
  value: unknown,
  candidate: FirstVerticalPublicationCandidateV2,
):
  | { readonly ok: true; readonly dispositions: readonly TerminalRuleDispositionV2[] }
  | { readonly ok: false; readonly result: RuleModelV2ValidationResult } {
  if (!Array.isArray(value) || value.length !== 2_112) {
    return {
      ok: false,
      result: failure(
        "rule-model.invalid-cardinality",
        "/dispositions",
        "Rule model must contain exactly 2,112 disposition rows.",
      ),
    };
  }
  const reviewed = new Map(candidate.evidenceBindings.map((binding) => [binding.ruleId, binding]));
  const seen = new Set<string>();
  const dispositions: TerminalRuleDispositionV2[] = [];
  let reviewedCount = 0;
  let pendingCount = 0;
  let previousRuleId: string | undefined;
  for (let index = 0; index < value.length; index += 1) {
    const row = value[index];
    const path = `/dispositions/${index}`;
    if (!isRecord(row) || typeof row.ruleId !== "string") {
      return {
        ok: false,
        result: failure("rule-model.invalid-disposition", path, "Disposition row is invalid."),
      };
    }
    if (seen.has(row.ruleId) || (previousRuleId !== undefined && previousRuleId >= row.ruleId)) {
      return {
        ok: false,
        result: failure(
          "rule-model.invalid-disposition",
          `${path}/ruleId`,
          "Disposition rules must be lexical and unique.",
        ),
      };
    }
    seen.add(row.ruleId);
    previousRuleId = row.ruleId;
    const binding = reviewed.get(row.ruleId);
    let normalized: TerminalRuleDispositionV2 | RuleModelV2ValidationResult;
    if (binding === undefined) {
      if (row.state !== "pending-review") {
        return {
          ok: false,
          result: failure(
            "rule-model.invalid-disposition",
            `${path}/state`,
            "Only first-vertical rules may be reviewed in the initial registry.",
          ),
        };
      }
      normalized = pendingDisposition(row, index);
      pendingCount += 1;
    } else {
      if (row.state !== "reviewed") {
        return {
          ok: false,
          result: failure(
            "rule-model.invalid-disposition",
            `${path}/state`,
            "Every first-vertical rule must be reviewed.",
          ),
        };
      }
      normalized = reviewedDisposition(row, index, binding);
      reviewedCount += 1;
    }
    if ("ok" in normalized) return { ok: false, result: normalized };
    dispositions.push(normalized);
  }
  if (reviewedCount !== 16 || pendingCount !== 2_096) {
    return {
      ok: false,
      result: failure(
        "rule-model.invalid-cardinality",
        "/dispositions",
        "The initial registry requires exactly 16 reviewed and 2,096 pending rows.",
      ),
    };
  }
  return { ok: true, dispositions: Object.freeze(dispositions) };
}

function expectedStructuredCases(
  candidate: FirstVerticalPublicationCandidateV2,
): readonly PublishedStructuredCaseBindingV2[] | undefined {
  const caseIds = new Set<StructuredCaseIdV1>();
  for (const binding of candidate.evidenceBindings) {
    for (const evidence of binding.evidence) caseIds.add(evidence.caseId);
  }
  const exemplar = createFirstVerticalStructuredExecutionExemplarV2();
  if (!exemplar.ok) return undefined;
  const expected = [...caseIds]
    .sort()
    .map((caseId) => derivePublishedStructuredCaseBindingV2(caseId));
  expected.push(
    derivePublishedStructuredCaseBindingV2(
      "case.structured.vertical-combined-v1",
      exemplar.value.document.envelope.digest,
    ),
  );
  if (expected.some((binding) => binding === undefined)) return undefined;
  const bindings = expected.filter(
    (binding): binding is PublishedStructuredCaseBindingV2 => binding !== undefined,
  );
  const combined = bindings.at(-1);
  return combined?.oracleEvaluationIdentity ===
    exemplar.value.document.expectation.oracleEvaluationIdentity
    ? Object.freeze(bindings)
    : undefined;
}

function validateStructuredCases(
  value: unknown,
  candidate: FirstVerticalPublicationCandidateV2,
):
  | { readonly ok: true; readonly structuredCases: readonly PublishedStructuredCaseBindingV2[] }
  | { readonly ok: false; readonly result: RuleModelV2ValidationResult } {
  const expected = expectedStructuredCases(candidate);
  if (!Array.isArray(value) || expected === undefined || value.length !== expected.length) {
    return {
      ok: false,
      result: failure(
        "rule-model.invalid-case-binding",
        "/structuredCases",
        "Structured case binding population is incomplete.",
      ),
    };
  }
  for (let index = 0; index < expected.length; index += 1) {
    const row = value[index];
    const authoritative = expected[index];
    const keys =
      authoritative?.executionEnvelopeDigest === undefined ? CASE_KEYS : COMBINED_CASE_KEYS;
    if (!isRecord(row) || authoritative === undefined || !exactKeys(row, keys)) {
      return {
        ok: false,
        result: failure(
          "rule-model.invalid-case-binding",
          `/structuredCases/${index}`,
          "Structured case binding has an invalid closed shape.",
        ),
      };
    }
    for (const key of [
      "caseId",
      "caseDigest",
      "sourceDigest",
      "oracleEvaluationIdentity",
      "executionEnvelopeDigest",
    ] as const) {
      if (row[key] !== authoritative[key]) {
        return {
          ok: false,
          result: failure(
            "rule-model.invalid-case-binding",
            `/structuredCases/${index}/${key}`,
            "Structured case identity does not match authenticated case authority.",
          ),
        };
      }
    }
    if (!Array.isArray(row.embedFixtureIds) || row.embedFixtureIds.length !== 0) {
      return {
        ok: false,
        result: failure(
          "rule-model.invalid-case-binding",
          `/structuredCases/${index}/embedFixtureIds`,
          "The initial structured cases require the exact empty fixture population.",
        ),
      };
    }
  }
  return { ok: true, structuredCases: expected };
}

function normalizedFamily(): RuleFamilyV2 {
  return Object.freeze({
    familyId: FAMILY_ID,
    memberRuleIds: Object.freeze([...FIRST_VERTICAL_RULE_IDS_V1]),
    constructionPreconditions: Object.freeze([]),
    typedDomains: Object.freeze([]),
    invalidContracts: Object.freeze([]),
    boundaryFamilyIds: Object.freeze([]),
    spellings: Object.freeze([]),
    oracleRouteIds: Object.freeze(["oracle.structured-program"]),
  });
}

function success(
  predecessorPublicationDigest: Sha256Digest,
  inventoryDigest: Sha256Digest,
  firstVertical: FirstVerticalPublicationCandidateV2,
  dispositions: readonly TerminalRuleDispositionV2[],
  structuredCases: readonly PublishedStructuredCaseBindingV2[],
): RuleModelV2ValidationResult {
  const model: RuleModelRegistryV2 = Object.freeze({
    schemaVersion: 2,
    kind: "rule-model-registry-v2",
    version: Object.freeze({
      schemaVersion: 2,
      kind: "rule-model-version-v2",
      version: "2.0.0",
      predecessorPublicationDigest,
    }),
    inventoryDigest,
    specRevision: "spec-v3.0",
    families: Object.freeze([normalizedFamily()]),
    dispositions,
    firstVertical,
    structuredCases,
  });
  const canonicalBytes = renderPublicationJson(model);
  return Object.freeze({
    ok: true,
    model,
    modelDigest: digestPublicationBytes(canonicalBytes),
    canonicalBytes: canonicalBytes.slice(),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/** Validates the complete initial model without accepting caller-owned nested objects. */
export function validateRuleModelRegistryValueV2(input: unknown): RuleModelV2ValidationResult {
  const inspected = inspectRuleModelInputV2(input);
  if (!inspected.ok) {
    return failure(
      "rule-model.invalid-cardinality",
      "/",
      "Rule model input must be an acyclic plain-data graph with data properties only.",
    );
  }
  const value = inspected.value;
  if (!isRecord(value) || !exactKeys(value, MODEL_KEYS)) {
    return failure(
      "rule-model.invalid-cardinality",
      "/dispositions",
      "Rule model must use the exact complete registry shape.",
    );
  }
  if (value.schemaVersion !== 2 || value.kind !== "rule-model-registry-v2") {
    return failure(
      "rule-model.unsupported-version",
      "/schemaVersion",
      "Rule model version is unsupported.",
    );
  }
  const versionFailure = validateVersion(value.version);
  if (versionFailure !== undefined) return versionFailure;
  if (
    !isRecord(value.version) ||
    !isSha256Digest(value.version.predecessorPublicationDigest) ||
    !isSha256Digest(value.inventoryDigest) ||
    value.specRevision !== "spec-v3.0"
  ) {
    return failure(
      "rule-model.unsupported-version",
      "/version",
      "Rule model version and inventory identities are invalid.",
    );
  }
  const familyFailure = validateFamilyPopulation(value.families);
  if (familyFailure !== undefined) return familyFailure;
  const firstVertical = validateFirstVerticalPublicationCandidateV2(value.firstVertical);
  if (!firstVertical.ok) {
    return failure(
      "rule-model.invalid-first-vertical",
      "/firstVertical",
      firstVertical.diagnostics[0]?.message ?? "First-vertical authority is invalid.",
    );
  }
  const dispositions = validateDispositionPopulation(value.dispositions, firstVertical.candidate);
  if (!dispositions.ok) return dispositions.result;
  const structuredCases = validateStructuredCases(value.structuredCases, firstVertical.candidate);
  if (!structuredCases.ok) return structuredCases.result;
  return success(
    value.version.predecessorPublicationDigest,
    value.inventoryDigest,
    firstVertical.candidate,
    dispositions.dispositions,
    structuredCases.structuredCases,
  );
}

/**
 * Validates a model and joins its exact disposition population to one authenticated inventory.
 *
 * @param input Untrusted complete model.
 * @param inventory Authenticated inventory parsed from the same publication.
 * @returns Detached immutable model only when both rule populations and inventory digest match.
 */
export function validateRuleModelRegistryAgainstInventoryV2(
  input: unknown,
  inventory: InventoryV1,
): RuleModelV2ValidationResult {
  const model = validateRuleModelRegistryValueV2(input);
  if (!model.ok) return model;
  const canonicalInventory = renderPublicationJson(inventory);
  if (model.model.inventoryDigest !== digestPublicationBytes(canonicalInventory)) {
    return failure(
      "rule-model.invalid-cardinality",
      "/inventoryDigest",
      "Rule model inventory identity does not match its authenticated inventory.",
    );
  }
  const inventoryRuleIds = inventory.rules.map(({ ruleId }) => ruleId).sort();
  const dispositionRuleIds = model.model.dispositions.map(({ ruleId }) => ruleId);
  if (!sameValues(dispositionRuleIds, inventoryRuleIds)) {
    const mismatch = dispositionRuleIds.findIndex(
      (ruleId, index) => ruleId !== inventoryRuleIds[index],
    );
    return failure(
      "rule-model.invalid-cardinality",
      mismatch < 0 ? "/dispositions" : `/dispositions/${mismatch}/ruleId`,
      "Rule model dispositions do not match the exact inventory rule population.",
    );
  }
  return model;
}
