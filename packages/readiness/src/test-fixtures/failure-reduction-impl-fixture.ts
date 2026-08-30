import { createHash } from "node:crypto";

import {
  prepareIncrementalBindingPublication,
  prepareIncrementalBindingPublicationReview,
} from "../binding-publication.js";
import {
  authorizeFailureEnvelopeV1,
  type AuthorizedFailureEnvelopeV1,
} from "../failure-envelope.js";
import {
  FAILURE_REDUCTION_DEFAULT_POLICY_V1,
  type FailureReductionPolicyV1,
} from "../failure-contracts.js";
import { deriveFailurePredicateIdentityV1 } from "../failure-identity.js";
import { createExecutionCaseV1 } from "../execution-case.js";
import {
  createMalformedDiagnosticCaseV1,
  type MalformedDiagnosticCaseV1,
} from "../malformed-diagnostic-case.js";
import { createPublishedDiagnosticCaseFromIntentV1 } from "../published-diagnostic-case.js";
import {
  createPublishedOracleContext,
  preparePublishedCampaignCaseV1,
} from "../published-oracle-context.js";
import { resolvePublishedSnapshotByDigest } from "../publication-resolver.js";
import {
  createAcceptedReviewBytes,
  createOraclePublicationSpecFixture,
} from "./oracle-publication-spec-fixture.js";

import type { PublishedOracleContext } from "../oracle-model.js";
import type { Sha256Digest } from "../model-registry-model.js";

const TARGET_HANDLER_IDS = Object.freeze([
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
  "transform.semantic-relations",
]);

/** Genuine raw reduction authority used only by implementation-hardening tests. */
export interface RawReductionImplFixture {
  /** Selected published oracle context. */
  readonly context: PublishedOracleContext;
  /** Genuine malformed source authority. */
  readonly malformed: MalformedDiagnosticCaseV1;
  /** Genuine raw failure envelope. */
  readonly envelope: AuthorizedFailureEnvelopeV1;
  /** Selected reduction policy. */
  readonly policy: FailureReductionPolicyV1;
  /** Removes the isolated historical authority repository. */
  readonly cleanup: () => Promise<void>;
}

/** Genuine typed-valid envelope and its source ordinal. */
export interface TypedReductionImplFixture {
  /** Genuine typed-valid failure envelope. */
  readonly envelope: AuthorizedFailureEnvelopeV1;
  /** Selected source ordinal. */
  readonly ordinal: number;
}

/** Genuine typed-invalid envelope and its source ordinal. */
export interface TypedInvalidReductionImplFixture {
  /** Genuine typed-invalid failure envelope. */
  readonly envelope: AuthorizedFailureEnvelopeV1;
  /** Selected source ordinal. */
  readonly ordinal: number;
}

const MODELED_RULE_IDS = Object.freeze([
  "rule.ch02.2-primitive-types.byte.range.0-255",
  "rule.ch02.2-primitive-types.sbyte.range.128-127",
  "rule.ch02.2-primitive-types.sword.range.32768-32767",
  "rule.ch02.2-primitive-types.word.range.0-65535",
]);

const MODELED_CONFIGURATION = Object.freeze({
  caseCount: 72,
  maxInvalidCases: 24,
  enabledRuleIds: [...MODELED_RULE_IDS].sort(),
  spellings: ["const", "literal", "local", "parameter"],
  budget: {
    maxModules: 4,
    maxDeclarations: 128,
    maxIrNodes: 512,
    maxStatements: 256,
    maxExpressionDepth: 16,
    maxLoopWork: 1n,
    maxSourceBytes: 65_536,
    maxAttempts: 128,
  },
});

function requireSuccess<T>(result: { readonly ok: boolean; readonly value?: T }): T {
  if (!result.ok || result.value === undefined)
    throw new TypeError(`reduction fixture setup failed: ${JSON.stringify(result)}`);
  return result.value;
}

function digest(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/** Builds one isolated genuine raw envelope from the selected historical publication. */
export async function createRawReductionImplFixture(
  sourceBytes = new TextEncoder().encode("abc"),
  policy: FailureReductionPolicyV1 = FAILURE_REDUCTION_DEFAULT_POLICY_V1,
): Promise<RawReductionImplFixture> {
  const publication = await createOraclePublicationSpecFixture();
  try {
    const baseSnapshot = requireSuccess(
      await resolvePublishedSnapshotByDigest({
        repositoryRoot: publication.repositoryRoot,
        publicationDigest: publication.publicationDigest,
      }),
    );
    const review = requireSuccess(
      await prepareIncrementalBindingPublicationReview({
        repositoryRoot: publication.repositoryRoot,
        baseSnapshot,
        targetHandlerIds: TARGET_HANDLER_IDS,
      }),
    );
    const prepared = requireSuccess(
      await prepareIncrementalBindingPublication({
        repositoryRoot: publication.repositoryRoot,
        baseSnapshot,
        targetHandlerIds: TARGET_HANDLER_IDS,
        semanticReviewBytes: createAcceptedReviewBytes(review.request),
      }),
    );
    const context = requireSuccess(createPublishedOracleContext(prepared.stagedSnapshot));
    const malformed = requireSuccess(
      createMalformedDiagnosticCaseV1(context, {
        revision: "malformed-diagnostic-case-input-v1",
        sourceBytes,
        encoding: "utf-8",
        ruleId: "diagnostic.malformed-source",
        obligation: "reject malformed language input",
        provenance: {
          revision: "malformed-token-text-provenance-v1",
          tokenizerRevision: "utf8-byte-spans-v1",
          tokens:
            sourceBytes.length === 0
              ? []
              : [{ kind: "unknown", startByte: 0, endByte: sourceBytes.length }],
        },
      }),
    );
    const predicate = requireSuccess(
      deriveFailurePredicateIdentityV1({
        revision: "failure-predicate-v1",
        resultCode: "semantic-mismatch",
        terminalTier: "frontend",
        terminalStage: "frontend",
        observation: { kind: "observed", digest: digest(new Uint8Array()) },
        cleanup: "cleanup-clear",
        primaryRuleId: "diagnostic.malformed-source",
        requiredClaimedRuleIds: ["diagnostic.malformed-source"],
        target: "c64",
        routeContract: {
          originalRouteKind: "invalid-diagnostic",
          terminalTier: "frontend",
          obligation: "raw-malformed-failure",
          prerequisiteTiers: [],
          policyDigest: digest(Uint8Array.from([1])),
          fixtureDigest: digest(Uint8Array.from([2])),
          oracleContractDigest: digest(Uint8Array.from([3])),
          toolContractDigests: [],
        },
      }),
    );
    const routePlanBytes = new TextEncoder().encode("raw diagnostic route\n");
    const envelope = requireSuccess(
      authorizeFailureEnvelopeV1({
        revision: "failure-envelope-authorization-input-v1",
        source: { kind: "raw-malformed", authority: malformed },
        routePlanBytes,
        routePlanDigest: digest(routePlanBytes),
        predicate: predicate.predicate,
        policy,
        observationBytes: new Uint8Array(),
        toolVersions: [],
      }),
    );
    return Object.freeze({
      context,
      malformed,
      envelope,
      policy,
      cleanup: publication.cleanup,
    });
  } catch (error) {
    await publication.cleanup();
    throw error;
  }
}

/** Creates several genuine typed-valid envelopes spanning modeled generator shapes. */
export function createTypedReductionImplFixtures(
  context: PublishedOracleContext,
  maximum = 8,
): readonly TypedReductionImplFixture[] {
  const output: TypedReductionImplFixture[] = [];
  const seed = digest(Uint8Array.from([6]));
  for (
    let ordinal = 0;
    ordinal < MODELED_CONFIGURATION.caseCount && output.length < maximum;
    ordinal += 1
  ) {
    for (const ruleId of MODELED_RULE_IDS) {
      const prepared = preparePublishedCampaignCaseV1(context, {
        schemaVersion: 1,
        ruleId,
        seed,
        configuration: MODELED_CONFIGURATION,
        ordinal,
      });
      if (!prepared.ok || prepared.value.generatedCase.modeledCase.projection.kind !== "valid")
        continue;
      const fn = prepared.value.generatedCase.modeledCase.projection.module.functions[0];
      if (fn === undefined || fn.returnType === "void") continue;
      const width = fn.returnType === "word" || fn.returnType === "sword" ? 2 : 1;
      const executionCase = createExecutionCaseV1(prepared.value.campaign, ordinal, {
        kind: "scalar-bytes",
        byteLength: width,
      });
      if (!executionCase.ok) continue;
      const predicate = requireSuccess(
        deriveFailurePredicateIdentityV1({
          revision: "failure-predicate-v1",
          resultCode: "semantic-mismatch",
          terminalTier: "vice",
          terminalStage: "compare",
          observation: { kind: "observed", digest: digest(new Uint8Array()) },
          cleanup: "cleanup-clear",
          primaryRuleId: ruleId,
          requiredClaimedRuleIds: [ruleId],
          target: "c64",
          routeContract: {
            originalRouteKind: "valid-envelope",
            terminalTier: "vice",
            obligation: "typed-valid-failure",
            prerequisiteTiers: ["frontend", "compiler-api", "cli", "emit", "acme"],
            policyDigest: digest(Uint8Array.from([1])),
            fixtureDigest: digest(Uint8Array.from([2])),
            oracleContractDigest: digest(Uint8Array.from([3])),
            toolContractDigests: [],
          },
        }),
      );
      const routePlanBytes = new TextEncoder().encode(`typed route ${ordinal}\n`);
      const envelope = authorizeFailureEnvelopeV1({
        revision: "failure-envelope-authorization-input-v1",
        source: { kind: "typed-valid", authority: executionCase.value },
        routePlanBytes,
        routePlanDigest: digest(routePlanBytes),
        predicate: predicate.predicate,
        policy: FAILURE_REDUCTION_DEFAULT_POLICY_V1,
        observationBytes: new Uint8Array(),
        toolVersions: [],
      });
      if (envelope.ok) output.push(Object.freeze({ envelope: envelope.value, ordinal }));
      if (output.length >= maximum) break;
    }
  }
  return Object.freeze(output);
}

/** Creates genuine publication-bound typed-invalid envelopes. */
export function createTypedInvalidReductionImplFixtures(
  context: PublishedOracleContext,
  maximum = 8,
): readonly TypedInvalidReductionImplFixture[] {
  const output: TypedInvalidReductionImplFixture[] = [];
  const seed = digest(Uint8Array.from([6]));
  const firstInvalidOrdinal =
    MODELED_CONFIGURATION.caseCount - MODELED_CONFIGURATION.maxInvalidCases;
  for (
    let ordinal = firstInvalidOrdinal;
    ordinal < MODELED_CONFIGURATION.caseCount && output.length < maximum;
    ordinal += 1
  ) {
    for (const ruleId of MODELED_RULE_IDS) {
      const prepared = preparePublishedCampaignCaseV1(context, {
        schemaVersion: 1,
        ruleId,
        seed,
        configuration: MODELED_CONFIGURATION,
        ordinal,
      });
      if (
        !prepared.ok ||
        prepared.value.generatedCase.modeledCase.projection.kind !== "invalid" ||
        prepared.value.generatedCase.modeledCase.projection.transform.kind ===
          "parameter-binding-replace"
      ) {
        continue;
      }
      const diagnostic = createPublishedDiagnosticCaseFromIntentV1(context, {
        schemaVersion: 1,
        ruleId,
        seed,
        configuration: MODELED_CONFIGURATION,
        ordinal,
      });
      if (!diagnostic.ok) continue;
      const predicate = requireSuccess(
        deriveFailurePredicateIdentityV1({
          revision: "failure-predicate-v1",
          resultCode: "semantic-mismatch",
          terminalTier: "frontend",
          terminalStage: "frontend",
          observation: { kind: "observed", digest: digest(new Uint8Array()) },
          cleanup: "cleanup-clear",
          primaryRuleId: ruleId,
          requiredClaimedRuleIds: [ruleId],
          target: "c64",
          routeContract: {
            originalRouteKind: "invalid-diagnostic",
            terminalTier: "frontend",
            obligation: "typed-invalid-failure",
            prerequisiteTiers: [],
            policyDigest: digest(Uint8Array.from([1])),
            fixtureDigest: digest(Uint8Array.from([2])),
            oracleContractDigest: digest(Uint8Array.from([3])),
            toolContractDigests: [],
          },
        }),
      );
      const routePlanBytes = new TextEncoder().encode(`typed invalid route ${ordinal}\n`);
      const envelope = authorizeFailureEnvelopeV1({
        revision: "failure-envelope-authorization-input-v1",
        source: { kind: "typed-invalid", authority: diagnostic.value },
        routePlanBytes,
        routePlanDigest: digest(routePlanBytes),
        predicate: predicate.predicate,
        policy: FAILURE_REDUCTION_DEFAULT_POLICY_V1,
        observationBytes: new Uint8Array(),
        toolVersions: [],
      });
      if (envelope.ok) output.push(Object.freeze({ envelope: envelope.value, ordinal }));
      if (output.length >= maximum) break;
    }
  }
  return Object.freeze(output);
}
