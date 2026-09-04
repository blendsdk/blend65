import { Buffer } from "node:buffer";

import type { Sha256Digest } from "./model-registry-model.js";
import {
  digestPublicationBytes,
  publicationFailure,
  publicationSuccess,
  renderPublicationJson,
  type PublicationResult,
} from "./publication-model.js";
import { createStructuredExecutionCaseDataV1 } from "./structured-execution-case-data.js";

/** Reviewed rule that owns the combined structured execution exemplar. */
export const FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID =
  "rule.ch05.7-2-direction-bounds.requirement.meaning.loop-visits-start-end" as const;

/** Immutable encoded source, expectation and execution envelope for the combined case. */
export interface StructuredExecutionExemplarDocumentV2 {
  readonly schemaVersion: 2;
  readonly kind: "structured-execution-exemplar-v2";
  readonly ruleId: typeof FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID;
  readonly caseId: "case.structured.vertical-combined-v1";
  readonly caseDigest: Sha256Digest;
  readonly source: {
    readonly encoding: "base64";
    readonly bytes: string;
    readonly digest: Sha256Digest;
  };
  readonly expectation: {
    readonly encoding: "base64";
    readonly bytes: string;
    readonly oracleEvaluationIdentity: Sha256Digest;
  };
  readonly envelope: {
    readonly encoding: "base64";
    readonly bytes: string;
    readonly digest: Sha256Digest;
  };
}

/** Defensive publication payload returned by the structured exemplar factory. */
export interface PreparedStructuredExecutionExemplarV2 {
  readonly document: StructuredExecutionExemplarDocumentV2;
  readonly canonicalBytes: Uint8Array;
  readonly documentDigest: Sha256Digest;
  readonly sourceBytes: Uint8Array;
  readonly expectationBytes: Uint8Array;
  readonly envelopeBytes: Uint8Array;
}

/**
 * Resolves the authenticated combined case into one canonical publication member.
 *
 * @returns Fresh byte copies of the source, independent expectation and v1 envelope.
 */
export function createFirstVerticalStructuredExecutionExemplarV2(): PublicationResult<PreparedStructuredExecutionExemplarV2> {
  const structured = createStructuredExecutionCaseDataV1();
  if (!structured.ok) {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      "/structuredExecutionExemplar",
      "The combined structured case projection is unavailable.",
    );
  }
  const sourceBytes = Buffer.from(structured.value.sourceBytes);
  const expectationBytes = Buffer.from(renderPublicationJson(structured.value.expectedObservation));
  const envelopeBytes = Buffer.from(renderPublicationJson(structured.value.envelope));
  const document: StructuredExecutionExemplarDocumentV2 = Object.freeze({
    schemaVersion: 2,
    kind: "structured-execution-exemplar-v2",
    ruleId: FIRST_VERTICAL_EXECUTION_EXEMPLAR_RULE_ID,
    caseId: "case.structured.vertical-combined-v1",
    caseDigest: structured.value.authority.caseDigest,
    source: Object.freeze({
      encoding: "base64",
      bytes: sourceBytes.toString("base64"),
      digest: digestPublicationBytes(sourceBytes),
    }),
    expectation: Object.freeze({
      encoding: "base64",
      bytes: expectationBytes.toString("base64"),
      oracleEvaluationIdentity: structured.value.oracleEvaluationIdentity,
    }),
    envelope: Object.freeze({
      encoding: "base64",
      bytes: envelopeBytes.toString("base64"),
      digest: digestPublicationBytes(envelopeBytes),
    }),
  });
  const canonicalBytes = renderPublicationJson(document);
  return publicationSuccess(
    Object.freeze({
      document,
      canonicalBytes: canonicalBytes.slice(),
      documentDigest: digestPublicationBytes(canonicalBytes),
      sourceBytes: Buffer.from(sourceBytes),
      expectationBytes: Buffer.from(expectationBytes),
      envelopeBytes: Buffer.from(envelopeBytes),
    }),
  );
}
