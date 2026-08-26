import { canonicalIdentityFieldChunks, isSha256Digest } from "./canonical-identity.js";
import { deriveIdentityDigest } from "./identity-collision-registry.js";
import {
  compareExecutionText,
  isExecutionIdentifier,
  normalizeExecutionStringSet,
  readExecutionArray,
  readExecutionRecord,
} from "./execution-validation.js";
import { parseFailureReductionPolicyV1 } from "./failure-contracts.js";

import type {
  ExecutionIssueV1,
  ExecutionOperationResultV1,
  ExecutionResultCodeV1,
  ExecutionStageV1,
  ExecutionTierV1,
} from "./execution-contracts.js";
import type { CleanupDispositionV1, FailureReductionPolicyV1 } from "./failure-contracts.js";
import type { CanonicalIdentityField } from "./canonical-identity.js";
import type { IdentityCollisionRegistry } from "./identity-collision-registry.js";
import type { Sha256Digest } from "./model-registry-model.js";

type FailureIdentityDomain =
  | "failure-predicate-v1"
  | "promoted-failure-key-v1"
  | "failure-reduction-run-v1";

const FAILURE_IDENTITY_ENCODER = new TextEncoder();

function canonicalU32(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError("Failure identity length exceeds the unsigned 32-bit range.");
  }
  return Uint8Array.of(
    Math.floor(value / 0x100_0000),
    Math.floor(value / 0x1_0000) & 0xff,
    Math.floor(value / 0x100) & 0xff,
    value & 0xff,
  );
}

/** Encodes a failure-specific identity without extending the frozen publication domains. */
function encodeFailureIdentity(
  domain: FailureIdentityDomain,
  fields: readonly CanonicalIdentityField[],
): Uint8Array {
  const domainBytes = FAILURE_IDENTITY_ENCODER.encode(domain);
  const chunks: Uint8Array[] = [
    canonicalU32(domainBytes.byteLength),
    domainBytes,
    canonicalU32(fields.length),
  ];
  for (const field of fields) chunks.push(...canonicalIdentityFieldChunks(field));
  const byteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  if (!Number.isSafeInteger(byteLength)) {
    throw new RangeError("Failure identity preimage exceeds the safe allocation range.");
  }
  const output = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

/** Stable identity of an oracle observation or an execution path that never reached observation. */
export type FailureObservationIdentityV1 =
  | {
      /** Observation discriminator. */
      readonly kind: "observed";
      /** Digest of the normalized oracle observation. */
      readonly digest: Sha256Digest;
    }
  | {
      /** Early-termination discriminator. */
      readonly kind: "not-reached";
      /** Pipeline stage at which observation became impossible. */
      readonly stage: ExecutionStageV1;
      /** Digest of bounded predicate-bearing terminal evidence. */
      readonly terminalReasonDigest: Sha256Digest;
    };

/** Campaign-independent execution semantics that must remain equal while shrinking. */
export interface FailureRouteContractV1 {
  /** Closed input family; omitted legacy values normalize to a valid envelope. */
  readonly originalRouteKind: "valid-envelope" | "invalid-diagnostic";
  /** Last route tier authorized for execution. */
  readonly terminalTier: ExecutionTierV1;
  /** Human-readable but identity-bearing evidence obligation. */
  readonly obligation: string;
  /** Ordered prerequisite tiers required before the terminal tier. */
  readonly prerequisiteTiers: readonly ExecutionTierV1[];
  /** Digest of the execution policy. */
  readonly policyDigest: Sha256Digest;
  /** Digest of the runtime fixture contract. */
  readonly fixtureDigest: Sha256Digest;
  /** Digest of the oracle contract. */
  readonly oracleContractDigest: Sha256Digest;
  /** Lexically ordered, duplicate-free tool contract digests. */
  readonly toolContractDigests: readonly Sha256Digest[];
}

/** Complete immutable predicate that a reduced candidate must reproduce. */
export interface FailurePredicateV1 {
  /** Closed predicate schema revision. */
  readonly revision: "failure-predicate-v1";
  /** Exact non-pass result category. */
  readonly resultCode: Exclude<ExecutionResultCodeV1, "pass">;
  /** Authenticated route terminal tier. */
  readonly terminalTier: ExecutionTierV1;
  /** Exact primary terminal stage. */
  readonly terminalStage: ExecutionStageV1;
  /** Normalized observation identity. */
  readonly observation: FailureObservationIdentityV1;
  /** Cleanup state retained separately from the primary result. */
  readonly cleanup: CleanupDispositionV1;
  /** Primary reviewed rule. */
  readonly primaryRuleId: string;
  /** Frozen required subset of claimed rules; incidental claims are excluded. */
  readonly requiredClaimedRuleIds: readonly string[];
  /** Current supported target. */
  readonly target: "c64";
  /** Campaign-independent route semantics. */
  readonly routeContract: FailureRouteContractV1;
}

/** Predicate plus canonical bytes and digest retained from one validating derivation. */
export interface FailurePredicateIdentityV1 {
  /** Closed identity wrapper revision. */
  readonly revision: "failure-predicate-identity-v1";
  /** Deeply normalized predicate. */
  readonly predicate: FailurePredicateV1;
  /** Canonical field encoding used to derive the digest. */
  readonly canonicalBytes: Uint8Array;
  /** Domain-separated predicate digest. */
  readonly digest: Sha256Digest;
}

/** Campaign-independent regression key for minimized content and one exact predicate. */
export interface PromotedFailureKeyV1 {
  /** Closed promoted-key schema revision. */
  readonly revision: "promoted-failure-key-v1";
  /** Exact normalization contract revision. */
  readonly normalizationRevision: "failure-normalization-v1";
  /** Digest of normalized minimized source content. */
  readonly minimizedContentDigest: Sha256Digest;
  /** Digest of the complete canonical predicate. */
  readonly predicateDigest: Sha256Digest;
  /** Domain-separated promoted-key digest. */
  readonly digest: Sha256Digest;
}

/** Inputs that make one reduction run distinct without changing promotion identity. */
export interface FailureReductionRunIdentityInputV1 {
  /** Digest of the exact historical failure envelope. */
  readonly historicalEnvelopeDigest: Sha256Digest;
  /** Digest of the predicate selected for this run. */
  readonly predicateDigest: Sha256Digest;
  /** Complete selected reduction policy. */
  readonly policy: FailureReductionPolicyV1;
  /** Digest of the deterministic transformation trace. */
  readonly traceDigest: Sha256Digest;
}

/** Domain-separated identity of one historical reduction run. */
export interface FailureReductionRunIdentityV1 {
  /** Closed run-identity revision. */
  readonly revision: "failure-reduction-run-identity-v1";
  /** Digest over history, predicate, policy, and trace. */
  readonly digest: Sha256Digest;
}

const PREDICATE_KEYS = [
  "revision",
  "resultCode",
  "terminalTier",
  "terminalStage",
  "observation",
  "cleanup",
  "primaryRuleId",
  "requiredClaimedRuleIds",
  "target",
  "routeContract",
] as const;
const OBSERVED_KEYS = ["kind", "digest"] as const;
const NOT_REACHED_KEYS = ["kind", "stage", "terminalReasonDigest"] as const;
const ROUTE_REQUIRED_KEYS = [
  "terminalTier",
  "obligation",
  "prerequisiteTiers",
  "policyDigest",
  "fixtureDigest",
  "oracleContractDigest",
  "toolContractDigests",
] as const;
const RUN_KEYS = ["historicalEnvelopeDigest", "predicateDigest", "policy", "traceDigest"] as const;
const TIERS: ReadonlySet<string> = new Set([
  "frontend",
  "compiler-api",
  "cli",
  "emit",
  "acme",
  "vice",
]);
const STAGES: ReadonlySet<string> = new Set([
  "input",
  "capability",
  "frontend",
  "compiler-api",
  "cli",
  "emit",
  "acme",
  "vice-launch",
  "vice-handshake",
  "fixture",
  "run",
  "observe",
  "compare",
  "cleanup",
]);
const FAILURE_CODES: ReadonlySet<string> = new Set([
  "invalid-evidence-input",
  "unbound-capability",
  "execution-plan-capacity",
  "tier-unavailable",
  "diagnostic-mismatch",
  "unexpected-emission",
  "compiler-ice",
  "emission-failure",
  "assembler-failure",
  "emulator-launch-failure",
  "emulator-handshake-failure",
  "instruction-exhaustion",
  "cycle-exhaustion",
  "wall-time-exhaustion",
  "output-exhaustion",
  "evidence-exhaustion",
  "emulator-lease-recovery-blocked",
  "semantic-mismatch",
]);
const CAMPAIGN_ONLY_FAILURE_CODES: ReadonlySet<string> = new Set([
  "invalid-evidence-input",
  "unbound-capability",
  "execution-plan-capacity",
  "tier-unavailable",
  "emulator-lease-recovery-blocked",
]);
const CLEANUP_DISPOSITIONS: ReadonlySet<string> = new Set(["cleanup-clear", "cleanup-blocked"]);
const MAX_RULE_IDS = 4_096;
const MAX_TOOL_DIGESTS = 256;
const MAX_TIERS = 6;
const MAX_OBLIGATION_BYTES = 512;
const TEXT_ENCODER = new TextEncoder();

/** Rejects lone UTF-16 surrogates before canonical UTF-8 encoding can merge distinct inputs. */
function isWellFormedText(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const following = value.charCodeAt(index + 1);
      if (following < 0xdc00 || following > 0xdfff) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function issue<T>(path: string, message: string): ExecutionOperationResultV1<T> {
  const issues: readonly [ExecutionIssueV1] = [
    Object.freeze({ code: "execution.invalid-schema", path, message }),
  ];
  return Object.freeze({
    ok: false,
    issues: Object.freeze(issues),
  });
}

function identityIssue<T>(
  result: Exclude<ReturnType<typeof deriveIdentityDigest>, { readonly ok: true }>,
): ExecutionOperationResultV1<T> {
  const [first] = result.diagnostics;
  const issues: readonly [ExecutionIssueV1] = [
    Object.freeze({
      code: "execution.identity",
      path: first.path,
      message: first.message,
    }),
  ];
  return Object.freeze({
    ok: false,
    issues: Object.freeze(issues),
  });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function isTier(value: unknown): value is ExecutionTierV1 {
  return typeof value === "string" && TIERS.has(value);
}

function isStage(value: unknown): value is ExecutionStageV1 {
  return typeof value === "string" && STAGES.has(value);
}

function isFailureCode(value: unknown): value is Exclude<ExecutionResultCodeV1, "pass"> {
  return typeof value === "string" && FAILURE_CODES.has(value);
}

function readRouteRecord(input: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  let keys: readonly string[];
  try {
    const ownKeys = Reflect.ownKeys(input);
    if (ownKeys.some((key) => typeof key !== "string")) return undefined;
    keys = ownKeys.filter((key): key is string => typeof key === "string");
  } catch {
    return undefined;
  }
  const allowed = [...ROUTE_REQUIRED_KEYS, "originalRouteKind"];
  if (
    keys.length < ROUTE_REQUIRED_KEYS.length ||
    keys.length > allowed.length ||
    ROUTE_REQUIRED_KEYS.some((key) => !keys.includes(key)) ||
    keys.some((key) => !allowed.includes(key))
  ) {
    return undefined;
  }
  return readExecutionRecord(input, keys);
}

function normalizeObservation(input: unknown): FailureObservationIdentityV1 | undefined {
  const kindRecord = readExecutionRecord(input, OBSERVED_KEYS);
  if (
    kindRecord !== undefined &&
    kindRecord.kind === "observed" &&
    isSha256Digest(kindRecord.digest)
  ) {
    return Object.freeze({ kind: "observed", digest: kindRecord.digest });
  }
  const notReached = readExecutionRecord(input, NOT_REACHED_KEYS);
  if (
    notReached !== undefined &&
    notReached.kind === "not-reached" &&
    isStage(notReached.stage) &&
    isSha256Digest(notReached.terminalReasonDigest)
  ) {
    return Object.freeze({
      kind: "not-reached",
      stage: notReached.stage,
      terminalReasonDigest: notReached.terminalReasonDigest,
    });
  }
  return undefined;
}

function normalizeTierList(input: unknown): readonly ExecutionTierV1[] | undefined {
  const values = readExecutionArray(input, MAX_TIERS);
  if (values === undefined) return undefined;
  const tiers: ExecutionTierV1[] = [];
  const seen = new Set<ExecutionTierV1>();
  for (const value of values) {
    if (!isTier(value) || seen.has(value)) return undefined;
    seen.add(value);
    tiers.push(value);
  }
  return Object.freeze(tiers);
}

function normalizeDigestSet(input: unknown): readonly Sha256Digest[] | undefined {
  const values = readExecutionArray(input, MAX_TOOL_DIGESTS);
  if (values === undefined) return undefined;
  const digests: Sha256Digest[] = [];
  const seen = new Set<Sha256Digest>();
  for (const value of values) {
    if (!isSha256Digest(value) || seen.has(value)) return undefined;
    seen.add(value);
    digests.push(value);
  }
  digests.sort(compareExecutionText);
  return Object.freeze(digests);
}

function normalizeRouteContract(input: unknown): FailureRouteContractV1 | undefined {
  const route = readRouteRecord(input);
  if (route === undefined) return undefined;
  const originalRouteKind = Object.hasOwn(route, "originalRouteKind")
    ? route.originalRouteKind
    : "valid-envelope";
  const prerequisiteTiers = normalizeTierList(route.prerequisiteTiers);
  const toolContractDigests = normalizeDigestSet(route.toolContractDigests);
  if (
    (originalRouteKind !== "valid-envelope" && originalRouteKind !== "invalid-diagnostic") ||
    !isTier(route.terminalTier) ||
    typeof route.obligation !== "string" ||
    route.obligation.length === 0 ||
    route.obligation.length > MAX_OBLIGATION_BYTES ||
    !isWellFormedText(route.obligation) ||
    TEXT_ENCODER.encode(route.obligation).byteLength > MAX_OBLIGATION_BYTES ||
    prerequisiteTiers === undefined ||
    !isSha256Digest(route.policyDigest) ||
    !isSha256Digest(route.fixtureDigest) ||
    !isSha256Digest(route.oracleContractDigest) ||
    toolContractDigests === undefined
  ) {
    return undefined;
  }
  return Object.freeze({
    originalRouteKind,
    terminalTier: route.terminalTier,
    obligation: route.obligation,
    prerequisiteTiers,
    policyDigest: route.policyDigest,
    fixtureDigest: route.fixtureDigest,
    oracleContractDigest: route.oracleContractDigest,
    toolContractDigests,
  });
}

function normalizePredicate(input: unknown): FailurePredicateV1 | undefined {
  const predicate = readExecutionRecord(input, PREDICATE_KEYS);
  if (predicate === undefined) return undefined;
  const observation = normalizeObservation(predicate.observation);
  const requiredClaimedRuleIds = normalizeExecutionStringSet(
    predicate.requiredClaimedRuleIds,
    MAX_RULE_IDS,
    isExecutionIdentifier,
  );
  const routeContract = normalizeRouteContract(predicate.routeContract);
  if (
    predicate.revision !== "failure-predicate-v1" ||
    !isFailureCode(predicate.resultCode) ||
    !isTier(predicate.terminalTier) ||
    !isStage(predicate.terminalStage) ||
    observation === undefined ||
    typeof predicate.cleanup !== "string" ||
    !CLEANUP_DISPOSITIONS.has(predicate.cleanup) ||
    !isExecutionIdentifier(predicate.primaryRuleId) ||
    requiredClaimedRuleIds === undefined ||
    predicate.target !== "c64" ||
    routeContract === undefined
  ) {
    return undefined;
  }
  const cleanup: CleanupDispositionV1 =
    predicate.cleanup === "cleanup-blocked" ? "cleanup-blocked" : "cleanup-clear";
  return Object.freeze({
    revision: "failure-predicate-v1",
    resultCode: predicate.resultCode,
    terminalTier: predicate.terminalTier,
    terminalStage: predicate.terminalStage,
    observation,
    cleanup,
    primaryRuleId: predicate.primaryRuleId,
    requiredClaimedRuleIds: Object.freeze([...requiredClaimedRuleIds]),
    target: "c64",
    routeContract,
  });
}

function canonicalPredicateBytes(predicate: FailurePredicateV1): Uint8Array {
  const observation =
    predicate.observation.kind === "observed"
      ? `observed:${predicate.observation.digest}`
      : `not-reached:${predicate.observation.stage}:${predicate.observation.terminalReasonDigest}`;
  return encodeFailureIdentity("failure-predicate-v1", [
    { name: "revision", value: predicate.revision },
    { name: "resultCode", value: predicate.resultCode },
    { name: "terminalTier", value: predicate.terminalTier },
    { name: "terminalStage", value: predicate.terminalStage },
    { name: "observation", value: observation },
    {
      name: "cleanup",
      value: CAMPAIGN_ONLY_FAILURE_CODES.has(predicate.resultCode)
        ? "campaign-only"
        : predicate.cleanup,
    },
    { name: "primaryRuleId", value: predicate.primaryRuleId },
    { name: "requiredClaimedRuleIds", value: JSON.stringify(predicate.requiredClaimedRuleIds) },
    { name: "target", value: predicate.target },
    { name: "originalRouteKind", value: predicate.routeContract.originalRouteKind },
    { name: "routeTerminalTier", value: predicate.routeContract.terminalTier },
    { name: "obligation", value: predicate.routeContract.obligation },
    { name: "prerequisiteTiers", value: JSON.stringify(predicate.routeContract.prerequisiteTiers) },
    { name: "policyDigest", value: predicate.routeContract.policyDigest },
    { name: "fixtureDigest", value: predicate.routeContract.fixtureDigest },
    { name: "oracleContractDigest", value: predicate.routeContract.oracleContractDigest },
    {
      name: "toolContractDigests",
      value: JSON.stringify(predicate.routeContract.toolContractDigests),
    },
  ]);
}

function canonicalPolicy(policy: FailureReductionPolicyV1): string {
  return JSON.stringify({
    revision: policy.revision,
    dispositionRevision: policy.dispositionRevision,
    catalogRevision: policy.catalogRevision,
    normalizationRevision: policy.normalizationRevision,
    budget: {
      campaignOperations: policy.budget.campaignOperations,
      transformationAttempts: policy.budget.transformationAttempts,
      routeExecutions: policy.budget.routeExecutions,
      oracleEvaluations: policy.budget.oracleEvaluations,
      diagnosticBytes: policy.budget.diagnosticBytes,
      provenanceEvents: policy.budget.provenanceEvents,
      sequenceCases: policy.budget.sequenceCases,
      durableWrites: policy.budget.durableWrites,
      coreBytes: policy.budget.coreBytes,
      runBytes: policy.budget.runBytes,
    },
  });
}

/**
 * Validates and derives the complete canonical identity of a failure predicate.
 *
 * @param input Untrusted predicate candidate.
 * @param registry Optional bounded collision registry.
 * @returns Normalized predicate, canonical bytes, and digest, or a closed validation issue.
 *
 * @example
 * ```ts
 * const identity = deriveFailurePredicateIdentityV1(candidate, registry);
 * ```
 */
export function deriveFailurePredicateIdentityV1(
  input: unknown,
  registry?: IdentityCollisionRegistry,
): ExecutionOperationResultV1<FailurePredicateIdentityV1> {
  const predicate = normalizePredicate(input);
  if (predicate === undefined) {
    return issue("/predicate", "Failure predicate must use the exact version-one shape.");
  }
  const canonicalBytes = canonicalPredicateBytes(predicate);
  const identity = deriveIdentityDigest(canonicalBytes, registry);
  if (!identity.ok) return identityIssue(identity);
  const retainedCanonicalBytes = identity.preimage;
  return success(
    Object.freeze({
      revision: "failure-predicate-identity-v1",
      predicate,
      get canonicalBytes(): Uint8Array {
        return new Uint8Array(retainedCanonicalBytes);
      },
      digest: identity.identity,
    }),
  );
}

/**
 * Derives a campaign-independent key for normalized minimized content and one predicate.
 *
 * @param minimizedContentDigest Digest of normalized minimized source bytes.
 * @param predicate Untrusted complete predicate candidate.
 * @param registry Optional bounded collision registry shared across derived identities.
 * @returns Canonical promoted key or a closed validation/identity issue.
 *
 * @example
 * ```ts
 * const key = derivePromotedFailureKeyV1(contentDigest, predicate, registry);
 * ```
 */
export function derivePromotedFailureKeyV1(
  minimizedContentDigest: unknown,
  predicate: unknown,
  registry?: IdentityCollisionRegistry,
): ExecutionOperationResultV1<PromotedFailureKeyV1> {
  if (!isSha256Digest(minimizedContentDigest)) {
    return issue("/minimizedContentDigest", "Minimized content digest must be canonical SHA-256.");
  }
  const predicateIdentity = deriveFailurePredicateIdentityV1(predicate, registry);
  if (!predicateIdentity.ok) return predicateIdentity;
  const canonicalBytes = encodeFailureIdentity("promoted-failure-key-v1", [
    { name: "revision", value: "promoted-failure-key-v1" },
    { name: "normalizationRevision", value: "failure-normalization-v1" },
    { name: "minimizedContentDigest", value: minimizedContentDigest },
    { name: "predicateDigest", value: predicateIdentity.value.digest },
  ]);
  const identity = deriveIdentityDigest(canonicalBytes, registry);
  if (!identity.ok) return identityIssue(identity);
  return success(
    Object.freeze({
      revision: "promoted-failure-key-v1",
      normalizationRevision: "failure-normalization-v1",
      minimizedContentDigest,
      predicateDigest: predicateIdentity.value.digest,
      digest: identity.identity,
    }),
  );
}

/**
 * Derives the identity of one reduction run including its selected policy and trace.
 *
 * @param input Untrusted run-identity fields.
 * @param registry Optional bounded collision registry.
 * @returns Domain-separated run identity or a closed validation/identity issue.
 *
 * @example
 * ```ts
 * const runIdentity = deriveFailureReductionRunIdentityV1(input, registry);
 * ```
 */
export function deriveFailureReductionRunIdentityV1(
  input: unknown,
  registry?: IdentityCollisionRegistry,
): ExecutionOperationResultV1<FailureReductionRunIdentityV1> {
  const run = readExecutionRecord(input, RUN_KEYS);
  if (
    run === undefined ||
    !isSha256Digest(run.historicalEnvelopeDigest) ||
    !isSha256Digest(run.predicateDigest) ||
    !isSha256Digest(run.traceDigest)
  ) {
    return issue("/run", "Failure reduction run identity must use the exact version-one shape.");
  }
  const policy = parseFailureReductionPolicyV1(run.policy);
  if (!policy.ok) return policy;
  const canonicalBytes = encodeFailureIdentity("failure-reduction-run-v1", [
    { name: "historicalEnvelopeDigest", value: run.historicalEnvelopeDigest },
    { name: "predicateDigest", value: run.predicateDigest },
    { name: "policy", value: canonicalPolicy(policy.value) },
    { name: "traceDigest", value: run.traceDigest },
  ]);
  const identity = deriveIdentityDigest(canonicalBytes, registry);
  if (!identity.ok) return identityIssue(identity);
  return success(
    Object.freeze({
      revision: "failure-reduction-run-identity-v1",
      digest: identity.identity,
    }),
  );
}
