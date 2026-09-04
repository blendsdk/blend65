import { Buffer } from "node:buffer";

import { isSha256Digest } from "./canonical-identity.js";
import type { ExecutionOperationResultV1 } from "./execution-contracts.js";
import {
  getCompositeReadinessAuthorityV2,
  type CompositeReadinessSnapshot,
} from "./execution-publication-resolver.js";
import {
  executionPublicationFailure,
  executionPublicationSuccess,
} from "./execution-publication-model.js";
import type { RuleId, Sha256Digest } from "./model-registry-model.js";
import {
  digestPublicationBytes,
  parsePublicationJson,
  renderPublicationJson,
} from "./publication-model.js";
import { validateRuleModelRegistryAgainstInventoryV2 } from "./rule-family-model.js";
import { FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID } from "./structured-execution-exemplar.js";

/** Identity-only provider payload read from one exact parent-child publication pair. */
export interface OptimizerConsumerProjectionV2 {
  readonly schemaVersion: 2;
  readonly kind: "optimizer-consumer-projection-v2";
  readonly parentPublicationDigest: Sha256Digest;
  readonly executionPublicationDigest: Sha256Digest;
  readonly ruleId: RuleId;
  readonly caseId: "case.structured.vertical-combined-v1";
  readonly caseDigest: Sha256Digest;
  readonly sourceBytes: Uint8Array;
  readonly sourceDigest: Sha256Digest;
  readonly expectationBytes: Uint8Array;
  readonly oracleEvaluationIdentity: Sha256Digest;
  readonly envelopeBytes: Uint8Array;
  readonly envelopeDigest: Sha256Digest;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

function identityFailure(): ExecutionOperationResultV1<OptimizerConsumerProjectionV2> {
  return executionPublicationFailure(
    "execution.identity",
    "/structured-execution-exemplar-v2.json",
    "Published structured exemplar identities do not authenticate across the parent and child.",
  );
}

function decodeBase64(value: unknown): Buffer | undefined {
  if (
    typeof value !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)
  ) {
    return undefined;
  }
  const bytes = Buffer.from(value, "base64");
  return bytes.toString("base64") === value ? bytes : undefined;
}

function isDirectExpectation(value: unknown): value is Readonly<{
  kind: "direct-mmio";
  address: number;
  byteLength: number;
  value: number;
}> {
  return (
    isRecord(value) &&
    exactKeys(value, ["kind", "address", "byteLength", "value"]) &&
    value.kind === "direct-mmio" &&
    Number.isInteger(value.address) &&
    Number(value.address) >= 0 &&
    Number(value.address) <= 0xffff &&
    Number.isInteger(value.byteLength) &&
    Number(value.byteLength) === 1 &&
    Number.isInteger(value.value) &&
    Number(value.value) >= 0 &&
    Number(value.value) <= 0xff
  );
}

function isPublishedExecutionEnvelope(value: unknown): value is Readonly<{
  revision: "execution-envelope-ir-v1";
  sourceCaseDigest: Sha256Digest;
  arguments: readonly [];
  entryFunction: "main";
  observation: Readonly<{
    kind: "direct-mmio";
    address: number;
    byteLength: 1;
    projectionRevision: "c64-vic-color-observation-v1";
  }>;
  completionInitialValue: 0;
  completionSuccessValue: 165;
  postEntryStores: readonly [Readonly<{ kind: "completion"; value: 165 }>];
}> {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "revision",
      "sourceCaseDigest",
      "arguments",
      "entryFunction",
      "observation",
      "completionInitialValue",
      "completionSuccessValue",
      "postEntryStores",
    ]) ||
    value.revision !== "execution-envelope-ir-v1" ||
    !isSha256Digest(value.sourceCaseDigest) ||
    !Array.isArray(value.arguments) ||
    value.arguments.length !== 0 ||
    value.entryFunction !== "main" ||
    value.completionInitialValue !== 0 ||
    value.completionSuccessValue !== 165 ||
    !Array.isArray(value.postEntryStores) ||
    value.postEntryStores.length !== 1
  ) {
    return false;
  }
  const observation = value.observation;
  const completion = value.postEntryStores[0];
  return (
    isRecord(observation) &&
    exactKeys(observation, ["kind", "address", "byteLength", "projectionRevision"]) &&
    observation.kind === "direct-mmio" &&
    Number.isInteger(observation.address) &&
    Number(observation.address) >= 0 &&
    Number(observation.address) <= 0xffff &&
    observation.byteLength === 1 &&
    observation.projectionRevision === "c64-vic-color-observation-v1" &&
    isRecord(completion) &&
    exactKeys(completion, ["kind", "value"]) &&
    completion.kind === "completion" &&
    completion.value === 165
  );
}

/**
 * Projects published source and expectation identities without evaluating current compiler code.
 *
 * @param composite Genuine exact parent-child publication pair.
 * @returns Fresh copies of the immutable provider envelope or a closed identity failure.
 */
export function getOptimizerConsumerProjectionV2(
  composite: CompositeReadinessSnapshot,
): ExecutionOperationResultV1<OptimizerConsumerProjectionV2> {
  const authority = getCompositeReadinessAuthorityV2(composite);
  const member = authority?.parentAuthority.memberBytes.get(
    "structured-execution-exemplar-v2.json",
  );
  const modelMember = authority?.parentAuthority.memberBytes.get("rule-models-v2.json");
  if (authority === undefined || member === undefined || modelMember === undefined) {
    return executionPublicationFailure(
      "execution.identity",
      "/composite",
      "A genuine composite with a published structured exemplar is required.",
    );
  }
  const parsed = parsePublicationJson(member);
  if (!parsed.ok || !isRecord(parsed.value)) {
    return executionPublicationFailure(
      "execution.identity",
      "/structured-execution-exemplar-v2.json",
      "Published structured exemplar is invalid.",
    );
  }
  const document = parsed.value;
  const source = isRecord(document.source) ? document.source : undefined;
  const expectation = isRecord(document.expectation) ? document.expectation : undefined;
  const envelope = isRecord(document.envelope) ? document.envelope : undefined;
  const sourceBytes = decodeBase64(source?.bytes);
  const expectationBytes = decodeBase64(expectation?.bytes);
  const envelopeBytes = decodeBase64(envelope?.bytes);
  const modelJson = parsePublicationJson(modelMember);
  const model = modelJson.ok
    ? validateRuleModelRegistryAgainstInventoryV2(
        modelJson.value,
        authority.parentAuthority.inventory,
      )
    : undefined;
  const modelCase = model?.ok
    ? model.model.structuredCases.find(
        ({ caseId }) => caseId === "case.structured.vertical-combined-v1",
      )
    : undefined;
  const modelDisposition = model?.ok
    ? model.model.dispositions.find(
        ({ ruleId }) => ruleId === FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID,
      )
    : undefined;
  const modelFamily = model?.ok
    ? model.model.families.find(({ familyId }) => familyId === "family.structured-first-vertical")
    : undefined;
  const parsedExpectation =
    expectationBytes === undefined ? undefined : parsePublicationJson(expectationBytes);
  const parsedEnvelope =
    envelopeBytes === undefined ? undefined : parsePublicationJson(envelopeBytes);
  const validatedEnvelope =
    parsedEnvelope?.ok === true && isPublishedExecutionEnvelope(parsedEnvelope.value)
      ? parsedEnvelope.value
      : undefined;
  if (
    !exactKeys(document, [
      "schemaVersion",
      "kind",
      "ruleId",
      "caseId",
      "caseDigest",
      "source",
      "expectation",
      "envelope",
    ]) ||
    document.schemaVersion !== 2 ||
    document.kind !== "structured-execution-exemplar-v2" ||
    document.ruleId !== FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID ||
    document.caseId !== "case.structured.vertical-combined-v1" ||
    !isSha256Digest(document.caseDigest) ||
    !isRecord(source) ||
    !exactKeys(source, ["encoding", "bytes", "digest"]) ||
    source?.encoding !== "base64" ||
    !isSha256Digest(source.digest) ||
    sourceBytes === undefined ||
    digestPublicationBytes(sourceBytes) !== source.digest ||
    !isRecord(expectation) ||
    !exactKeys(expectation, ["encoding", "bytes", "oracleEvaluationIdentity"]) ||
    expectation?.encoding !== "base64" ||
    !isSha256Digest(expectation.oracleEvaluationIdentity) ||
    expectationBytes === undefined ||
    !isRecord(envelope) ||
    !exactKeys(envelope, ["encoding", "bytes", "digest"]) ||
    envelope?.encoding !== "base64" ||
    !isSha256Digest(envelope.digest) ||
    envelopeBytes === undefined ||
    digestPublicationBytes(envelopeBytes) !== envelope.digest ||
    parsedExpectation?.ok !== true ||
    !isDirectExpectation(parsedExpectation.value) ||
    !equalBytes(expectationBytes, renderPublicationJson(parsedExpectation.value)) ||
    validatedEnvelope === undefined ||
    !equalBytes(envelopeBytes, renderPublicationJson(validatedEnvelope)) ||
    validatedEnvelope.sourceCaseDigest !== document.caseDigest ||
    validatedEnvelope.observation.kind !== parsedExpectation.value.kind ||
    validatedEnvelope.observation.address !== parsedExpectation.value.address ||
    validatedEnvelope.observation.byteLength !== parsedExpectation.value.byteLength ||
    model?.ok !== true ||
    !equalBytes(modelMember, model.canonicalBytes) ||
    modelCase === undefined ||
    modelDisposition?.state !== "reviewed" ||
    modelDisposition.route.kind !== "source" ||
    modelDisposition.route.familyId !== modelFamily?.familyId ||
    !modelFamily.memberRuleIds.includes(FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID) ||
    modelCase.caseDigest !== document.caseDigest ||
    modelCase.sourceDigest !== source.digest ||
    modelCase.oracleEvaluationIdentity !== expectation.oracleEvaluationIdentity ||
    modelCase.executionEnvelopeDigest !== envelope.digest ||
    authority.projection.parentDigest !== authority.parentAuthority.publicationDigest ||
    authority.projection.executionDigest !== authority.executionDigest ||
    !isSha256Digest(authority.projection.parentDigest) ||
    !isSha256Digest(authority.executionDigest)
  ) {
    return identityFailure();
  }
  return executionPublicationSuccess(
    Object.freeze({
      schemaVersion: 2,
      kind: "optimizer-consumer-projection-v2",
      parentPublicationDigest: authority.projection.parentDigest,
      executionPublicationDigest: authority.executionDigest,
      ruleId: FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID,
      caseId: document.caseId,
      caseDigest: document.caseDigest,
      sourceBytes: Buffer.from(sourceBytes),
      sourceDigest: source.digest,
      expectationBytes: Buffer.from(expectationBytes),
      oracleEvaluationIdentity: expectation.oracleEvaluationIdentity,
      envelopeBytes: Buffer.from(envelopeBytes),
      envelopeDigest: envelope.digest,
    }),
  );
}
