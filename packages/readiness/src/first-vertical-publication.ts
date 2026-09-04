import { createHash } from "node:crypto";

import type { RuleId, Sha256Digest } from "./model-registry-model.js";
import {
  resolveStructuredCaseAuthorityV1,
  STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1,
  type FirstVerticalCaseIdV1,
} from "./structured-case-families.js";

/** One authenticated structured-case binding for a reviewed rule. */
export interface FirstVerticalEvidenceBindingV2 {
  /** Exact reviewed rule identity. */
  readonly ruleId: RuleId;
  /** Lexically ordered structured cases that provide evidence for the rule. */
  readonly evidence: readonly {
    /** Stable structured-case identity. */
    readonly caseId: FirstVerticalCaseIdV1;
    /** Digest independently re-resolved from the structured-case registry. */
    readonly caseDigest: Sha256Digest;
  }[];
}

/** Passive first-vertical value consumed by a later publication transaction. */
export interface FirstVerticalPublicationCandidateV2 {
  /** Candidate wire schema. */
  readonly schemaVersion: 2;
  /** Exact lexical population of reviewed rules. */
  readonly firstVerticalRuleIds: readonly RuleId[];
  /** Exact rule-to-authenticated-case mapping. */
  readonly evidenceBindings: readonly FirstVerticalEvidenceBindingV2[];
}

/** Stable failure categories for passive first-vertical validation. */
export type FirstVerticalCandidateDiagnosticCodeV2 =
  | "first-vertical.input.invalid"
  | "first-vertical.rule-population"
  | "first-vertical.binding-population"
  | "first-vertical.case-identity"
  | "first-vertical.case-digest";

/** One deterministic candidate validation diagnostic. */
export interface FirstVerticalCandidateDiagnosticV2 {
  /** Stable machine-readable category. */
  readonly code: FirstVerticalCandidateDiagnosticCodeV2;
  /** JSON pointer to the rejected member. */
  readonly path: string;
  /** Bounded human-readable reason. */
  readonly message: string;
}

/** Result of passive first-vertical candidate validation. */
export type FirstVerticalCandidateValidationResultV2 =
  | {
      readonly ok: true;
      readonly candidate: FirstVerticalPublicationCandidateV2;
      readonly candidateDigest: Sha256Digest;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly FirstVerticalCandidateDiagnosticV2[];
    };

/** Exact lexical rule population represented by the first structured candidate. */
export const FIRST_VERTICAL_RULE_IDS_V1: readonly RuleId[] = STRUCTURED_FIRST_VERTICAL_RULE_IDS_V1;

/** Exact stable structured-case population represented by the first candidate. */
export const FIRST_VERTICAL_CASE_IDS_V1: readonly FirstVerticalCaseIdV1[] = Object.freeze([
  "case.structured.branch-arms-v1",
  "case.structured.invalid-condition-v1",
  "case.structured.missing-return-v1",
  "case.structured.while-zero-v1",
  "case.structured.do-while-one-v1",
  "case.structured.for-inclusive-extremes-v1",
  "case.structured.for-until-v1",
  "case.structured.call-argument-order-v1",
  "case.structured.scalar-copy-v1",
  "case.structured.scalar-signatures-v1",
  "case.structured.scalar-returns-v1",
  "case.structured.byte-array-index-v1",
  "case.structured.constant-index-v1",
  "case.structured.constant-oob-v1",
  "case.structured.runtime-oob-public-v1",
  "case.structured.runtime-wrap-oracle-v1",
]);

const CASE_IDS_BY_RULE: readonly (readonly FirstVerticalCaseIdV1[])[] = Object.freeze([
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[0]!]),
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[1]!]),
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[2]!]),
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[3]!]),
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[4]!]),
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[5]!]),
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[6]!]),
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[7]!]),
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[8]!]),
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[9]!]),
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[10]!]),
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[11]!]),
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[12]!]),
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[13]!]),
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[14]!]),
  Object.freeze([FIRST_VERTICAL_CASE_IDS_V1[14]!, FIRST_VERTICAL_CASE_IDS_V1[15]!]),
]);
const CANDIDATE_KEYS = ["schemaVersion", "firstVerticalRuleIds", "evidenceBindings"] as const;
const BINDING_KEYS = ["ruleId", "evidence"] as const;
const EVIDENCE_KEYS = ["caseId", "caseDigest"] as const;
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const DIGEST_DOMAIN = "blend65.readiness.first-vertical-publication-candidate.v2";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function rejected(
  code: FirstVerticalCandidateDiagnosticCodeV2,
  path: string,
  message: string,
): FirstVerticalCandidateValidationResultV2 {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([Object.freeze({ code, path, message })]),
  });
}

function firstUnexpectedKey(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): string | undefined {
  return Object.keys(value).find((key) => !keys.includes(key));
}

function invalidShape(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
  basePath: string,
): FirstVerticalCandidateValidationResultV2 {
  const extra = firstUnexpectedKey(value, keys);
  const missing = keys.find((key) => !Object.hasOwn(value, key));
  const member = extra ?? missing;
  return rejected(
    "first-vertical.input.invalid",
    member === undefined ? basePath : `${basePath}/${member}`,
    "First-vertical candidate has an invalid closed shape.",
  );
}

function resolveDigest(caseId: FirstVerticalCaseIdV1): Sha256Digest {
  const resolved = resolveStructuredCaseAuthorityV1(caseId);
  if (!resolved.ok) {
    throw new TypeError(`Structured case authority is unavailable: ${caseId}`);
  }
  return resolved.authority.caseDigest;
}

function closeCandidate(
  bindings: readonly FirstVerticalEvidenceBindingV2[],
): FirstVerticalPublicationCandidateV2 {
  return Object.freeze({
    schemaVersion: 2,
    firstVerticalRuleIds: Object.freeze([...FIRST_VERTICAL_RULE_IDS_V1]),
    evidenceBindings: Object.freeze(
      bindings.map((binding) =>
        Object.freeze({
          ruleId: binding.ruleId,
          evidence: Object.freeze(binding.evidence.map((entry) => Object.freeze({ ...entry }))),
        }),
      ),
    ),
  });
}

function candidateDigest(candidate: FirstVerticalPublicationCandidateV2): Sha256Digest {
  const canonicalBytes = new TextEncoder().encode(JSON.stringify(candidate));
  return `sha256:${createHash("sha256")
    .update(DIGEST_DOMAIN, "utf8")
    .update("\0", "utf8")
    .update(canonicalBytes)
    .digest("hex")}`;
}

/**
 * Constructs a fresh passive candidate from registry-authenticated case authorities.
 *
 * @returns Exact lexical rules and rule-to-case digest bindings without persisting or selecting.
 *
 * @example
 * ```ts
 * const candidate = createFirstVerticalPublicationCandidateV2();
 * ```
 */
export function createFirstVerticalPublicationCandidateV2(): FirstVerticalPublicationCandidateV2 {
  const bindings = FIRST_VERTICAL_RULE_IDS_V1.map((ruleId, index) =>
    Object.freeze({
      ruleId,
      evidence: Object.freeze(
        CASE_IDS_BY_RULE[index]!.map((caseId) =>
          Object.freeze({ caseId, caseDigest: resolveDigest(caseId) }),
        ),
      ),
    }),
  );
  return closeCandidate(bindings);
}

/**
 * Validates a passive candidate against the complete authenticated structured-case registry.
 *
 * @param input Unknown candidate value.
 * @returns A fresh immutable candidate and content digest, or one stable first-failure diagnostic.
 *
 * @example
 * ```ts
 * const result = validateFirstVerticalPublicationCandidateV2(candidate);
 * ```
 */
export function validateFirstVerticalPublicationCandidateV2(
  input: unknown,
): FirstVerticalCandidateValidationResultV2 {
  if (!isRecord(input)) {
    return rejected(
      "first-vertical.input.invalid",
      "/",
      "First-vertical candidate must be an object.",
    );
  }
  if (!exactKeys(input, CANDIDATE_KEYS)) return invalidShape(input, CANDIDATE_KEYS, "");
  if (input.schemaVersion !== 2) {
    return rejected(
      "first-vertical.input.invalid",
      "/schemaVersion",
      "First-vertical candidate schema must be version 2.",
    );
  }
  if (!Array.isArray(input.firstVerticalRuleIds)) {
    return rejected(
      "first-vertical.input.invalid",
      "/firstVerticalRuleIds",
      "First-vertical rules must be an array.",
    );
  }
  if (input.firstVerticalRuleIds.length !== FIRST_VERTICAL_RULE_IDS_V1.length) {
    return rejected(
      "first-vertical.rule-population",
      "/firstVerticalRuleIds",
      "First-vertical rule population is incomplete.",
    );
  }
  for (let index = 0; index < FIRST_VERTICAL_RULE_IDS_V1.length; index += 1) {
    if (input.firstVerticalRuleIds[index] !== FIRST_VERTICAL_RULE_IDS_V1[index]) {
      return rejected(
        "first-vertical.rule-population",
        `/firstVerticalRuleIds/${index}`,
        "First-vertical rules must use the exact lexical population.",
      );
    }
  }
  if (!Array.isArray(input.evidenceBindings)) {
    return rejected(
      "first-vertical.input.invalid",
      "/evidenceBindings",
      "First-vertical evidence bindings must be an array.",
    );
  }
  if (input.evidenceBindings.length !== FIRST_VERTICAL_RULE_IDS_V1.length) {
    return rejected(
      "first-vertical.binding-population",
      "/evidenceBindings",
      "First-vertical evidence binding population is incomplete.",
    );
  }
  const bindings: FirstVerticalEvidenceBindingV2[] = [];
  for (let rowIndex = 0; rowIndex < input.evidenceBindings.length; rowIndex += 1) {
    const row = input.evidenceBindings[rowIndex];
    const rowPath = `/evidenceBindings/${rowIndex}`;
    if (!isRecord(row)) {
      return rejected(
        "first-vertical.input.invalid",
        rowPath,
        "First-vertical evidence binding must be an object.",
      );
    }
    if (!exactKeys(row, BINDING_KEYS)) return invalidShape(row, BINDING_KEYS, rowPath);
    if (row.ruleId !== FIRST_VERTICAL_RULE_IDS_V1[rowIndex]) {
      return rejected(
        "first-vertical.binding-population",
        `${rowPath}/ruleId`,
        "Evidence binding does not match the lexical rule row.",
      );
    }
    if (!Array.isArray(row.evidence)) {
      return rejected(
        "first-vertical.input.invalid",
        `${rowPath}/evidence`,
        "First-vertical row evidence must be an array.",
      );
    }
    const expectedCases = CASE_IDS_BY_RULE[rowIndex]!;
    if (row.evidence.length !== expectedCases.length) {
      return rejected(
        "first-vertical.binding-population",
        `${rowPath}/evidence`,
        "Evidence row has the wrong case population.",
      );
    }
    const evidence: {
      readonly caseId: FirstVerticalCaseIdV1;
      readonly caseDigest: Sha256Digest;
    }[] = [];
    for (let itemIndex = 0; itemIndex < row.evidence.length; itemIndex += 1) {
      const item = row.evidence[itemIndex];
      const itemPath = `${rowPath}/evidence/${itemIndex}`;
      if (!isRecord(item)) {
        return rejected(
          "first-vertical.input.invalid",
          itemPath,
          "First-vertical evidence entry must be an object.",
        );
      }
      if (!Object.hasOwn(item, "caseId")) {
        return rejected(
          "first-vertical.case-identity",
          `${itemPath}/caseId`,
          "Evidence case identity is missing.",
        );
      }
      if (!Object.hasOwn(item, "caseDigest")) {
        return rejected(
          "first-vertical.case-digest",
          `${itemPath}/caseDigest`,
          "Evidence case digest is missing.",
        );
      }
      if (!exactKeys(item, EVIDENCE_KEYS)) return invalidShape(item, EVIDENCE_KEYS, itemPath);
      const caseId = expectedCases[itemIndex]!;
      if (item.caseId !== caseId) {
        return rejected(
          "first-vertical.case-identity",
          `${itemPath}/caseId`,
          "Evidence case does not match the authenticated rule binding.",
        );
      }
      const digest = resolveDigest(caseId);
      if (item.caseDigest !== digest) {
        return rejected(
          "first-vertical.case-digest",
          `${itemPath}/caseDigest`,
          "Evidence case digest does not match current authenticated authority.",
        );
      }
      evidence.push(Object.freeze({ caseId, caseDigest: digest }));
    }
    bindings.push(Object.freeze({ ruleId: row.ruleId, evidence: Object.freeze(evidence) }));
  }
  const candidate = closeCandidate(bindings);
  return Object.freeze({
    ok: true,
    candidate,
    candidateDigest: candidateDigest(candidate),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
