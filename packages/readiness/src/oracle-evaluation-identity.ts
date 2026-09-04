import { isDeepStrictEqual } from "node:util";

import {
  isSha256Digest,
  structuredGenerationBudgetFields,
  type CanonicalIdentityField,
} from "./canonical-identity.js";
import { validateStructuredGenerationBudgetV2 } from "./generation-budget.js";
import type { StructuredGenerationBudgetV2 } from "./generator-ir.js";
import { isGenIdentifier } from "./generator-ir.js";
import {
  deriveOracleEvaluationDigest,
  type OracleEvaluationCollisionRegistry,
} from "./oracle-evaluation-collision.js";
import {
  copyOracleUint8Array,
  encodeOracleCanonicalIdentity,
  oracleUint8ArrayByteLength,
} from "./oracle-canonical-identity.js";
import { validateOracleBudget } from "./oracle-budget.js";
import { hasExactOracleKeys, isOracleRecord, snapshotOracleInput } from "./oracle-input.js";
import { validateOracleMemoryFixture } from "./oracle-memory.js";
import type {
  MemoryFixtureV1,
  OracleBudgetV1,
  OracleDiagnostic,
  Rd02ReplayProvenanceV1,
  SemanticRelationId,
} from "./oracle-model.js";
import { replayCase } from "./replay.js";
import { parseReplayEnvelope, REPLAY_V1_LIMITS } from "./replay-input.js";
import type { RevisionRegistry } from "./revision-registry.js";
import type { Sha256Digest } from "./model-registry-model.js";
import {
  compareUtf8,
  exactDataRecord,
  failure,
  identityFailure,
  isSemanticRelationId,
  normalizeReplayProvenance,
} from "./oracle-evaluation-identity-validation.js";

/** Bounded canonical policy revision committed by evaluation identities. */
export type OraclePolicyRevision = `oracle-policy-v${number}`;

/** One selected executable participant committed by an evaluation identity. */
export interface OracleEvaluationParticipantV1 {
  /** Stable handler route. */
  readonly handlerId: string;
  /** Exact handler contract version. */
  readonly contractVersion: string;
  /** Content-addressed implementation revision. */
  readonly implementationRevision: Sha256Digest;
}

/** Complete pure replay provenance committed by evaluation derivation. */
export type OracleReplayIdentityProvenanceV1 = Omit<Rd02ReplayProvenanceV1, "configuration"> & {
  /** Carried configuration values normalized before canonical encoding. */
  readonly configuration: Omit<Rd02ReplayProvenanceV1["configuration"], "spellings"> & {
    /** Source spelling candidates accepted only when they normalize to the closed replay set. */
    readonly spellings: readonly string[];
  };
};

/** Complete pure input to evaluation identity derivation. */
export interface OracleEvaluationIdentityInputV1 {
  /** Identity schema version. */
  readonly schemaVersion: 1;
  /** Exact source-case replay provenance. */
  readonly sourceProvenance: OracleReplayIdentityProvenanceV1;
  /** Domain-separated identity of source content. */
  readonly sourceContentIdentity: Sha256Digest;
  /** Domain-separated transformed content identity for metamorphic evaluation. */
  readonly transformedContentIdentity?: Sha256Digest;
  /** Relation selected for metamorphic evaluation. */
  readonly relationId?: SemanticRelationId;
  /** Unique entry function. */
  readonly entryFunction: string;
  /** Canonical initial-memory identity. */
  readonly initialMemoryIdentity: Sha256Digest;
  /** Exact diagnostic authority digest. */
  readonly diagnosticManifestDigest: Sha256Digest;
  /** Exact binding-rejection authority digest. */
  readonly bindingRejectionDigest: Sha256Digest;
  /** Complete bounded oracle budget. */
  readonly budget: OracleBudgetV1;
  /** Canonical evaluation policy revision. */
  readonly policyRevision: OraclePolicyRevision;
  /** Stable observable projection identifier. */
  readonly observableProjectionId: string;
  /** Lexically unique selected participants. */
  readonly participants: readonly OracleEvaluationParticipantV1[];
}

/** Successful or failed result shared by pure identity derivations. */
export type OracleIdentityResultV1 =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Canonical lowercase SHA-256 identity. */
      readonly identity: Sha256Digest;
      /** Defensive copy of the exact canonical preimage. */
      readonly preimage: Uint8Array;
      /** Empty diagnostic tuple. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Non-empty bounded validation diagnostics. */
      readonly diagnostics: readonly OracleDiagnostic[];
    };

/** Generic closed validation result used by replay, collision, and catalog validation. */
export type OracleValidationResultV1<T> =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Closed validated value. */
      readonly value: T;
      /** Empty diagnostic tuple. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Non-empty bounded validation diagnostics. */
      readonly diagnostics: readonly OracleDiagnostic[];
    };

/** Input to replay provenance regeneration and exact source-content verification. */
export interface OracleReplayValidationInputV1 {
  /** Exact serialized replay envelope bytes. */
  readonly envelopeBytes: Uint8Array;
  /** Exact revision registry used for regeneration. */
  readonly registry: RevisionRegistry;
  /** Provenance expected to equal the parsed envelope. */
  readonly expectedProvenance: Rd02ReplayProvenanceV1;
  /** Exact source bytes expected from regeneration. */
  readonly expectedSourceContent: Uint8Array;
}

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const TEXT_ENCODER = new TextEncoder();
const POLICY_PATTERN = /^oracle-policy-v[1-9][0-9]{0,8}$/u;
const STABLE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/u;
const CONTRACT_PATTERN = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;
const EVALUATION_INPUT_KEYS = [
  "schemaVersion",
  "sourceProvenance",
  "sourceContentIdentity",
  "entryFunction",
  "initialMemoryIdentity",
  "diagnosticManifestDigest",
  "bindingRejectionDigest",
  "budget",
  "policyRevision",
  "observableProjectionId",
  "participants",
] as const;
const TRANSFORMED_EVALUATION_INPUT_KEYS = [
  ...EVALUATION_INPUT_KEYS,
  "transformedContentIdentity",
  "relationId",
] as const;
const PARTICIPANT_KEYS = ["handlerId", "contractVersion", "implementationRevision"] as const;
const REPLAY_VALIDATION_INPUT_KEYS = [
  "envelopeBytes",
  "registry",
  "expectedProvenance",
  "expectedSourceContent",
] as const;

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function text(value: string | number | bigint): string {
  return String(value);
}

function optional(value: string | undefined): Uint8Array {
  if (value === undefined) return Uint8Array.of(0);
  const encoded = TEXT_ENCODER.encode(value);
  const result = new Uint8Array(encoded.byteLength + 1);
  result[0] = 1;
  result.set(encoded, 1);
  return result;
}

function pushList(
  fields: CanonicalIdentityField[],
  prefix: string,
  values: readonly (string | number)[],
): void {
  fields.push({ name: `${prefix}.count`, value: text(values.length) });
  values.forEach((value, index) => {
    fields.push({ name: `${prefix}.${index}`, value: text(value) });
  });
}

/**
 * Produces the structured generation-budget fields committed by an oracle evaluation identity.
 *
 * @param budget Unknown version-two generation budget.
 * @returns Prefixed canonical fields, or stable oracle diagnostics.
 *
 * @example
 * ```ts
 * const result = structuredGenerationBudgetEvaluationFields(budget);
 * ```
 */
export function structuredGenerationBudgetEvaluationFields(
  budget: StructuredGenerationBudgetV2,
): OracleValidationResultV1<readonly CanonicalIdentityField[]> {
  const normalized = validateStructuredGenerationBudgetV2(budget);
  if (!normalized.ok) {
    const first = normalized.diagnostics[0];
    return failure(
      first?.path ?? "/generationBudget",
      first?.message ?? "Structured generation budget is invalid.",
    );
  }
  return Object.freeze({
    ok: true,
    value: Object.freeze(
      structuredGenerationBudgetFields(normalized.budget).map((field) =>
        Object.freeze({ name: `generationBudget.${field.name}`, value: field.value }),
      ),
    ),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function evaluationFields(
  input: OracleEvaluationIdentityInputV1,
): readonly CanonicalIdentityField[] {
  const { campaign, caseIdentity, configuration } = input.sourceProvenance;
  const participants = [...input.participants].sort((left, right) =>
    compareUtf8(left.handlerId, right.handlerId),
  );
  const fields: CanonicalIdentityField[] = [
    { name: "schemaVersion", value: text(input.schemaVersion) },
    {
      name: "sourceProvenance.schemaVersion",
      value: text(input.sourceProvenance.schemaVersion),
    },
    {
      name: "sourceProvenance.campaign.inventorySchemaVersion",
      value: text(campaign.inventorySchemaVersion),
    },
    {
      name: "sourceProvenance.campaign.inventoryVersion",
      value: campaign.inventoryVersion,
    },
    {
      name: "sourceProvenance.campaign.inventoryDigest",
      value: campaign.inventoryDigest,
    },
    { name: "sourceProvenance.campaign.specRevision", value: campaign.specRevision },
    {
      name: "sourceProvenance.campaign.ruleModelVersion",
      value: campaign.ruleModelVersion,
    },
    {
      name: "sourceProvenance.campaign.ruleModelDigest",
      value: campaign.ruleModelDigest,
    },
    {
      name: "sourceProvenance.campaign.generator.handlerId",
      value: campaign.generator.handlerId,
    },
    {
      name: "sourceProvenance.campaign.generator.contractVersion",
      value: campaign.generator.contractVersion,
    },
    {
      name: "sourceProvenance.campaign.generator.implementationRevision",
      value: campaign.generator.implementationRevision,
    },
    {
      name: "sourceProvenance.campaign.boundaryTransform.handlerId",
      value: campaign.boundaryTransform.handlerId,
    },
    {
      name: "sourceProvenance.campaign.boundaryTransform.contractVersion",
      value: campaign.boundaryTransform.contractVersion,
    },
    {
      name: "sourceProvenance.campaign.boundaryTransform.implementationRevision",
      value: campaign.boundaryTransform.implementationRevision,
    },
    {
      name: "sourceProvenance.campaign.rendererRevision",
      value: campaign.rendererRevision,
    },
    { name: "sourceProvenance.campaign.target", value: campaign.target },
    {
      name: "sourceProvenance.campaign.prngAlgorithm",
      value: campaign.prngAlgorithm,
    },
    { name: "sourceProvenance.campaign.seed", value: campaign.seed },
    {
      name: "sourceProvenance.campaign.configurationDigest",
      value: campaign.configurationDigest,
    },
    {
      name: "sourceProvenance.campaignDigest",
      value: input.sourceProvenance.campaignDigest,
    },
    {
      name: "sourceProvenance.caseIdentity.campaignDigest",
      value: caseIdentity.campaignDigest,
    },
  ];
  pushList(fields, "sourceProvenance.caseIdentity.generationPath", caseIdentity.generationPath);
  fields.push(
    { name: "sourceProvenance.caseIdentity.ordinal", value: text(caseIdentity.ordinal) },
    { name: "sourceProvenance.caseIdentity.digest", value: caseIdentity.digest },
    {
      name: "sourceProvenance.configuration.caseCount",
      value: text(configuration.caseCount),
    },
    {
      name: "sourceProvenance.configuration.maxInvalidCases",
      value: text(configuration.maxInvalidCases),
    },
  );
  pushList(fields, "sourceProvenance.configuration.enabledRuleIds", configuration.enabledRuleIds);
  pushList(fields, "sourceProvenance.configuration.spellings", configuration.spellings);
  fields.push(
    {
      name: "sourceProvenance.configuration.budget.maxModules",
      value: text(configuration.budget.maxModules),
    },
    {
      name: "sourceProvenance.configuration.budget.maxDeclarations",
      value: text(configuration.budget.maxDeclarations),
    },
    {
      name: "sourceProvenance.configuration.budget.maxIrNodes",
      value: text(configuration.budget.maxIrNodes),
    },
    {
      name: "sourceProvenance.configuration.budget.maxStatements",
      value: text(configuration.budget.maxStatements),
    },
    {
      name: "sourceProvenance.configuration.budget.maxExpressionDepth",
      value: text(configuration.budget.maxExpressionDepth),
    },
    {
      name: "sourceProvenance.configuration.budget.maxLoopWork",
      value: text(configuration.budget.maxLoopWork),
    },
    {
      name: "sourceProvenance.configuration.budget.maxSourceBytes",
      value: text(configuration.budget.maxSourceBytes),
    },
    {
      name: "sourceProvenance.configuration.budget.maxAttempts",
      value: text(configuration.budget.maxAttempts),
    },
    { name: "sourceContentIdentity", value: input.sourceContentIdentity },
    {
      name: "transformedContentIdentity",
      value: optional(input.transformedContentIdentity),
    },
    { name: "relationId", value: optional(input.relationId) },
    { name: "entryFunction", value: input.entryFunction },
    { name: "initialMemoryIdentity", value: input.initialMemoryIdentity },
    { name: "diagnosticManifestDigest", value: input.diagnosticManifestDigest },
    { name: "bindingRejectionDigest", value: input.bindingRejectionDigest },
    { name: "budget.inputNodes", value: text(input.budget.inputNodes) },
    { name: "budget.expressionDepth", value: text(input.budget.expressionDepth) },
    { name: "budget.evaluationSteps", value: text(input.budget.evaluationSteps) },
    { name: "budget.frames", value: text(input.budget.frames) },
    { name: "budget.memoryCells", value: text(input.budget.memoryCells) },
    { name: "budget.effects", value: text(input.budget.effects) },
    { name: "budget.transformedNodes", value: text(input.budget.transformedNodes) },
    { name: "policyRevision", value: input.policyRevision },
    { name: "observableProjectionId", value: input.observableProjectionId },
    { name: "participantCount", value: text(participants.length) },
  );
  participants.forEach((participant, index) => {
    fields.push(
      { name: `participants.${index}.handlerId`, value: participant.handlerId },
      {
        name: `participants.${index}.contractVersion`,
        value: participant.contractVersion,
      },
      {
        name: `participants.${index}.implementationRevision`,
        value: participant.implementationRevision,
      },
    );
  });
  return Object.freeze(fields);
}

function normalizeParticipants(
  input: unknown,
  transformed: boolean,
): OracleValidationResultV1<readonly OracleEvaluationParticipantV1[]> {
  if (!Array.isArray(input) || input.length < 1 || input.length > 5) {
    return failure("/participants", "Evaluation requires one to five participants.");
  }
  const participants: OracleEvaluationParticipantV1[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const participant = input[index];
    if (!isOracleRecord(participant) || !hasExactOracleKeys(participant, PARTICIPANT_KEYS)) {
      return failure(`/participants/${index}`, "Participant must use the exact closed shape.");
    }
    const { handlerId, contractVersion, implementationRevision } = participant;
    if (
      typeof handlerId !== "string" ||
      !STABLE_ID_PATTERN.test(handlerId) ||
      typeof contractVersion !== "string" ||
      !CONTRACT_PATTERN.test(contractVersion) ||
      !isSha256Digest(implementationRevision)
    ) {
      return failure(`/participants/${index}`, "Participant identity is not canonical.");
    }
    participants.push(
      Object.freeze({
        handlerId,
        contractVersion,
        implementationRevision,
      }),
    );
  }
  const sorted = participants.sort((left, right) => compareUtf8(left.handlerId, right.handlerId));
  for (let index = 0; index < sorted.length; index += 1) {
    const participant = sorted[index];
    const previous = sorted[index - 1];
    if (participant === undefined || previous?.handlerId === participant.handlerId) {
      return failure(
        `/participants/${index}`,
        "Participants must be canonical and handler IDs must be unique.",
      );
    }
  }
  const oracleHandlerIds = new Set([
    "oracle.compiler-result",
    "oracle.emitted-program",
    "oracle.frontend-result",
    "oracle.runtime-state",
  ]);
  if (sorted.filter(({ handlerId }) => oracleHandlerIds.has(handlerId)).length !== 1) {
    return failure("/participants", "Evaluation requires exactly one invoked oracle participant.");
  }
  if (
    transformed &&
    !sorted.some(({ handlerId }) => handlerId === "transform.semantic-relations")
  ) {
    return failure("/participants", "Metamorphic evaluation requires its transform.");
  }
  return Object.freeze({
    ok: true,
    value: Object.freeze(sorted),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Regenerates one exact replay case and verifies both carried provenance and source bytes.
 *
 * @param input Replay envelope, revision registry, expected provenance, and expected source.
 * @returns The unchanged verified provenance or a closed failure.
 *
 * @example
 * ```ts
 * const result = validateOracleReplayProvenance(input);
 * ```
 */
export function validateOracleReplayProvenance(
  input: OracleReplayValidationInputV1,
): OracleValidationResultV1<Rd02ReplayProvenanceV1> {
  try {
    const closed = exactDataRecord(input, REPLAY_VALIDATION_INPUT_KEYS);
    if (closed === undefined) {
      return failure("", "Replay validation input must use the exact closed data shape.");
    }
    const envelopeLength = oracleUint8ArrayByteLength(closed.envelopeBytes);
    if (envelopeLength === undefined || envelopeLength > REPLAY_V1_LIMITS.maxInputBytes) {
      return failure(
        "/envelopeBytes",
        "Replay envelope bytes are invalid or exceed the fixed byte limit.",
      );
    }
    const envelopeBytes = copyOracleUint8Array(closed.envelopeBytes, envelopeLength);
    const sourceLength = oracleUint8ArrayByteLength(closed.expectedSourceContent);
    if (
      envelopeBytes === undefined ||
      sourceLength === undefined ||
      sourceLength > REPLAY_V1_LIMITS.maxInputBytes
    ) {
      return failure(
        "/expectedSourceContent",
        "Expected source bytes are invalid or exceed the fixed byte limit.",
      );
    }
    const expectedSourceContent = copyOracleUint8Array(closed.expectedSourceContent, sourceLength);
    if (expectedSourceContent === undefined) {
      return failure("/expectedSourceContent", "Expected source bytes could not be copied.");
    }
    const expected = normalizeReplayProvenance(closed.expectedProvenance);
    if (!expected.ok) return expected;
    if (sourceLength > expected.value.configuration.budget.maxSourceBytes) {
      return failure(
        "/expectedSourceContent",
        "Expected source bytes exceed the carried generation budget.",
      );
    }
    const parsed = parseReplayEnvelope(envelopeBytes);
    if (!parsed.ok || !isDeepStrictEqual(parsed.envelope, expected.value)) {
      return failure("/sourceProvenance", "Replay envelope does not match expected provenance.");
    }
    const replayed = replayCase({
      envelopeBytes,
      registry: closed.registry as RevisionRegistry,
    });
    if (!replayed.ok) {
      return failure("/sourceProvenance", "Replay provenance could not be regenerated exactly.");
    }
    if (!equalBytes(replayed.source, expectedSourceContent)) {
      return failure("/sourceContent", "Regenerated source content does not match expected bytes.");
    }
    return Object.freeze({
      ok: true,
      value: expected.value,
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  } catch {
    return failure("/sourceProvenance", "Replay provenance could not be inspected safely.");
  }
}

/**
 * Derives the canonical identity of an explicit initial-memory fixture.
 *
 * @param memory Sorted unique initialized memory cells.
 * @param registry Optional bounded collision registry.
 * @returns Canonical memory identity and exact preimage.
 *
 * @example
 * ```ts
 * const result = deriveOracleInitialMemoryIdentity(memory);
 * ```
 */
export function deriveOracleInitialMemoryIdentity(
  memory: MemoryFixtureV1,
  registry?: OracleEvaluationCollisionRegistry,
): OracleIdentityResultV1 {
  try {
    const validated = validateOracleMemoryFixture(memory);
    if (!validated.ok) return validated;
    const fields: CanonicalIdentityField[] = [
      { name: "schemaVersion", value: text(validated.memory.schemaVersion) },
      { name: "cellCount", value: text(validated.memory.cells.length) },
    ];
    validated.memory.cells.forEach((cell, index) => {
      fields.push(
        { name: `cells.${index}.address`, value: text(cell.address) },
        { name: `cells.${index}.value`, value: text(cell.value) },
      );
    });
    return deriveOracleEvaluationDigest(
      encodeOracleCanonicalIdentity("blend65-oracle-initial-memory-v1", fields),
      registry,
    );
  } catch {
    return identityFailure("/memory", "Initial-memory identity could not be derived safely.");
  }
}

/**
 * Derives the complete canonical evaluation identity without selecting ambient revisions.
 *
 * @param input Complete provenance, content, authority, budget, policy, and participant identity.
 * @param registry Optional bounded collision registry.
 * @returns Canonical evaluation identity and exact preimage.
 *
 * @example
 * ```ts
 * const result = deriveOracleEvaluationIdentity(input);
 * ```
 */
export function deriveOracleEvaluationIdentity(
  input: unknown,
  registry?: OracleEvaluationCollisionRegistry,
): OracleIdentityResultV1 {
  try {
    const snapshot = snapshotOracleInput(input);
    if (!snapshot.ok) return snapshot;
    if (!isOracleRecord(snapshot.value)) {
      return identityFailure("", "Evaluation identity must be a closed data record.");
    }
    const hasTransformed = Object.hasOwn(snapshot.value, "transformedContentIdentity");
    const hasRelation = Object.hasOwn(snapshot.value, "relationId");
    const expectedKeys =
      hasTransformed && hasRelation ? TRANSFORMED_EVALUATION_INPUT_KEYS : EVALUATION_INPUT_KEYS;
    if (!hasExactOracleKeys(snapshot.value, expectedKeys)) {
      return identityFailure("", "Evaluation identity must use the exact closed shape.");
    }
    const closed = snapshot.value;
    if (closed.schemaVersion !== 1) {
      return identityFailure("/schemaVersion", "Evaluation identity schema version must be one.");
    }
    if (hasTransformed !== hasRelation) {
      return identityFailure(
        "/transformedContentIdentity",
        "Transformed content and relation identity must be present together.",
      );
    }
    const paired = hasTransformed && hasRelation;
    for (const [path, value] of [
      ["/sourceContentIdentity", closed.sourceContentIdentity],
      ["/initialMemoryIdentity", closed.initialMemoryIdentity],
      ["/diagnosticManifestDigest", closed.diagnosticManifestDigest],
      ["/bindingRejectionDigest", closed.bindingRejectionDigest],
    ] as const) {
      if (!isSha256Digest(value)) return identityFailure(path, "Identity digest is not canonical.");
    }
    if (hasTransformed && !isSha256Digest(closed.transformedContentIdentity)) {
      return identityFailure(
        "/transformedContentIdentity",
        "Transformed content identity is not canonical.",
      );
    }
    if (hasRelation && !isSemanticRelationId(closed.relationId)) {
      return identityFailure("/relationId", "Semantic relation identity is not supported.");
    }
    if (
      typeof closed.entryFunction !== "string" ||
      !isGenIdentifier(closed.entryFunction) ||
      typeof closed.policyRevision !== "string" ||
      !POLICY_PATTERN.test(closed.policyRevision) ||
      typeof closed.observableProjectionId !== "string" ||
      !STABLE_ID_PATTERN.test(closed.observableProjectionId)
    ) {
      return identityFailure("", "Evaluation identity contains a non-canonical identifier.");
    }
    const provenance = normalizeReplayProvenance(closed.sourceProvenance);
    if (!provenance.ok) return provenance;
    const budget = validateOracleBudget(closed.budget);
    if (!budget.ok) return budget;
    const participants = normalizeParticipants(closed.participants, paired);
    if (!participants.ok) return participants;
    const normalized: OracleEvaluationIdentityInputV1 = Object.freeze({
      schemaVersion: 1,
      sourceProvenance: provenance.value,
      sourceContentIdentity: closed.sourceContentIdentity as Sha256Digest,
      ...(paired
        ? {
            transformedContentIdentity: closed.transformedContentIdentity as Sha256Digest,
            relationId: closed.relationId as SemanticRelationId,
          }
        : {}),
      entryFunction: closed.entryFunction,
      initialMemoryIdentity: closed.initialMemoryIdentity as Sha256Digest,
      diagnosticManifestDigest: closed.diagnosticManifestDigest as Sha256Digest,
      bindingRejectionDigest: closed.bindingRejectionDigest as Sha256Digest,
      budget: budget.budget,
      policyRevision: closed.policyRevision as OraclePolicyRevision,
      observableProjectionId: closed.observableProjectionId,
      participants: participants.value,
    });
    return deriveOracleEvaluationDigest(
      encodeOracleCanonicalIdentity("blend65-oracle-evaluation-v1", evaluationFields(normalized)),
      registry,
    );
  } catch {
    return identityFailure("", "Evaluation identity could not be inspected safely.");
  }
}
