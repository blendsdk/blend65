import { createHash } from "node:crypto";

import {
  parseSemanticReviewEvidence,
  type PublicationAuthorityContext,
} from "./authority-loader.js";
import type { InventoryV1 } from "./model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type { PublicationImplementationAuthority } from "./publication-implementation-authority.js";
import { currentPublicationConformance } from "./publication-conformance-v1.js";
import {
  PUBLICATION_V1_LIMITS,
  digestPublicationBytes,
  parsePublicationJson,
  publicationFailure,
  publicationSuccess,
  renderPublicationJson,
  type PublicationResult,
  type PublicationReviewRequestV1,
  type PublicationReviewUnitV1,
} from "./publication-model.js";
import { computeInventoryReviewDigests, INVENTORY_REVIEW_UNIT_IDS } from "./review-digests.js";
import { validateReviewEvidence, type SemanticReviewRecord } from "./review-evidence.js";

const PUBLICATION_BINDINGS_UNIT = "publication-bindings";
const PUBLICATION_IMPLEMENTATION_UNIT = "publication-implementation";
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
type PublicationReviewDiagnosticProfile = "compatible" | "legacy";

function digest(domain: string, bytes: Uint8Array): Sha256Digest {
  return currentPublicationConformance()?.digest?.(domain, bytes) ?? digestPublicationBytes(bytes);
}

function isDigest(value: string | undefined): value is Sha256Digest {
  return value !== undefined && SHA256_PATTERN.test(value);
}

function reviewSemanticDigest(
  specRevision: string,
  dependencyDigests: PublicationReviewRequestV1["dependencyDigests"],
  promotedHandlerIds: readonly string[],
  inventoryUnits: readonly PublicationReviewUnitV1[],
): Sha256Digest {
  const bytes = renderPublicationJson({
    schemaVersion: 1,
    specRevision,
    dependencyDigests,
    promotedHandlerIds,
    reviewUnits: inventoryUnits,
  });
  return `sha256:${createHash("sha256")
    .update("blend65.publication-review.v1")
    .update(Uint8Array.of(0))
    .update(bytes)
    .digest("hex")}`;
}

function inventoryReviewUnits(
  context: PublicationAuthorityContext,
  inventory: InventoryV1,
): PublicationResult<readonly PublicationReviewUnitV1[]> {
  const digests = computeInventoryReviewDigests(
    inventory,
    context.fragments,
    context.identityLedgerBytes,
  );
  const units: PublicationReviewUnitV1[] = [];
  for (const unitId of [...INVENTORY_REVIEW_UNIT_IDS].sort()) {
    const semanticDigest = digests.currentDigests[unitId];
    const dependencies = digests.requiredDependencyIdsByUnit[unitId];
    if (!isDigest(semanticDigest) || dependencies === undefined) {
      return publicationFailure(
        "invalid",
        "publication.input.invalid",
        `/reviewUnits/${unitId}`,
        "Staged inventory review digests are incomplete.",
      );
    }
    const dependencyDigests: Record<string, Sha256Digest> = {};
    for (const dependency of [...dependencies].sort()) {
      const dependencyDigest = digests.currentDigests[dependency];
      if (!isDigest(dependencyDigest)) {
        return publicationFailure(
          "invalid",
          "publication.input.invalid",
          `/reviewUnits/${unitId}/dependencyDigests/${dependency}`,
          "Staged inventory dependency digest is incomplete.",
        );
      }
      dependencyDigests[dependency] = dependencyDigest;
    }
    units.push(
      Object.freeze({
        unitId,
        semanticDigest,
        dependencyDigests: Object.freeze(dependencyDigests),
      }),
    );
  }
  return publicationSuccess(Object.freeze(units));
}

/** Exact member bytes needed to reconstruct one semantic-review request. */
export interface PublicationReviewAuthorityInput {
  /** Source fragments and identity ledger retained by the repository authority loader. */
  readonly context: PublicationAuthorityContext;
  /** Exact inventory serialized in the release. */
  readonly inventory: InventoryV1;
  /** Canonical serialized binding registry. */
  readonly bindingBytes: Uint8Array;
  /** Canonical serialized inventory. */
  readonly inventoryBytes: Uint8Array;
  /** Exact rule-model authority. */
  readonly ruleModelBytes: Uint8Array;
  /** Exact accepted rule-model review. */
  readonly ruleModelReviewBytes: Uint8Array;
  /** Lexical handler set semantically promoted by this release. */
  readonly promotedHandlerIds: readonly string[];
  /** Compatible publication implementation authority required by additive releases. */
  readonly publicationImplementationAuthority?: PublicationImplementationAuthority | undefined;
}

/**
 * Reconstructs the complete immutable semantic-review request from exact authority bytes.
 *
 * @param input Release and repository review authority.
 * @returns Canonical request and defensive canonical bytes.
 *
 * @example
 * ```ts
 * const request = reconstructPublicationReviewRequest(authority);
 * ```
 */
export function reconstructPublicationReviewRequest(
  input: PublicationReviewAuthorityInput,
): PublicationResult<{
  readonly request: PublicationReviewRequestV1;
  readonly requestBytes: Uint8Array;
}> {
  const dependencyDigests = Object.freeze({
    bindings: digest("publication-member:bindings-v1.json", input.bindingBytes),
    inventory: digest("publication-member:compiler-readiness-v1.json", input.inventoryBytes),
    "rule-model": digest("publication-member:rule-models-v1.json", input.ruleModelBytes),
    "rule-model-review": digest(
      "publication-member:rule-models-v1-review.json",
      input.ruleModelReviewBytes,
    ),
  });
  const units = inventoryReviewUnits(input.context, input.inventory);
  if (!units.ok) return units;
  const implementationUnit =
    input.publicationImplementationAuthority === undefined
      ? undefined
      : Object.freeze({
          unitId: PUBLICATION_IMPLEMENTATION_UNIT,
          semanticDigest: input.publicationImplementationAuthority.revision,
          dependencyDigests: Object.freeze({
            implementation: input.publicationImplementationAuthority.revision,
          }),
        });
  const semanticUnits = Object.freeze([
    ...units.value,
    ...(implementationUnit === undefined ? [] : [implementationUnit]),
  ]);
  const semanticDigest = reviewSemanticDigest(
    input.inventory.specRevision,
    dependencyDigests,
    input.promotedHandlerIds,
    semanticUnits,
  );
  const reviewUnits = Object.freeze(
    [
      ...semanticUnits,
      Object.freeze({
        unitId: PUBLICATION_BINDINGS_UNIT,
        semanticDigest,
        dependencyDigests,
      }),
    ].sort((left, right) => left.unitId.localeCompare(right.unitId)),
  );
  const request: PublicationReviewRequestV1 = Object.freeze({
    schemaVersion: 1,
    semanticDigest,
    specRevision: input.inventory.specRevision,
    dependencyDigests,
    promotedHandlerIds: Object.freeze([...input.promotedHandlerIds]),
    reviewUnits,
  });
  return publicationSuccess(
    Object.freeze({
      request,
      requestBytes: renderPublicationJson(request),
    }),
  );
}

function renderSemanticReview(records: readonly SemanticReviewRecord[]): Uint8Array {
  return renderPublicationJson({
    schemaVersion: 1,
    reviews: records.map((record) => ({
      unitId: record.unitId,
      reviewer: record.reviewer,
      specRevision: record.specRevision,
      semanticDigest: record.semanticDigest,
      dependencyDigests: Object.fromEntries(
        Object.entries(record.dependencyDigests).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
      outcome: record.outcome,
      resolvedDisagreementIds: record.resolvedDisagreementIds,
    })),
  });
}

/**
 * Validates exact independent review evidence against a reconstructed request.
 *
 * @param bytes Hostile semantic-review bytes.
 * @param request Current canonical request.
 * @param diagnosticProfile Diagnostic compatibility profile for the calling publication surface.
 * @returns Canonically ordered accepted evidence bytes.
 *
 * @example
 * ```ts
 * const accepted = validatePublicationReviewEvidence(bytes, request);
 * ```
 */
export function validatePublicationReviewEvidence(
  bytes: Uint8Array,
  request: PublicationReviewRequestV1,
  diagnosticProfile: PublicationReviewDiagnosticProfile = "compatible",
): PublicationResult<Uint8Array> {
  if (bytes.byteLength > PUBLICATION_V1_LIMITS.maxSemanticReviewBytes) {
    return publicationFailure(
      "invalid",
      "publication.input.limit",
      "semantic-review-v1.json",
      "Semantic review evidence exceeds the version-one byte limit.",
    );
  }
  const strict = parsePublicationJson(bytes);
  if (!strict.ok) {
    return publicationFailure(
      "invalid",
      "publication.review.invalid",
      "semantic-review-v1.json",
      strict.diagnostics[0]?.message ?? "Semantic review evidence is invalid.",
    );
  }
  const records = parseSemanticReviewEvidence(bytes);
  if (records === undefined) {
    return publicationFailure(
      "invalid",
      "publication.review.invalid",
      "semantic-review-v1.json",
      "Semantic review evidence does not satisfy its closed schema.",
    );
  }
  const sorted = [...records].sort((left, right) => left.unitId.localeCompare(right.unitId));
  const requiredDependencyIdsByUnit: Record<string, readonly string[]> = {};
  const currentDigests: Record<string, string> = {};
  for (const unit of request.reviewUnits) {
    requiredDependencyIdsByUnit[unit.unitId] = Object.keys(unit.dependencyDigests).sort();
    currentDigests[unit.unitId] = unit.semanticDigest;
    Object.assign(currentDigests, unit.dependencyDigests);
  }
  const evidence = validateReviewEvidence(sorted, {
    expectedSpecRevision: request.specRevision,
    requiredUnitIds: request.reviewUnits.map(({ unitId }) => unitId),
    requiredDependencyIdsByUnit,
    currentDigests,
  });
  if (!evidence.ok) {
    const first = evidence.diagnostics[0];
    const code =
      diagnosticProfile === "legacy"
        ? first?.code === "review.not-accepted"
          ? "publication.review.not-accepted"
          : first?.code.includes("stale") === true
            ? "publication.review.stale"
            : "publication.review.invalid"
        : evidence.diagnostics.some(({ code }) => code === "review.not-accepted")
          ? "publication.review.not-accepted"
          : evidence.diagnostics.some(
                ({ code }) =>
                  code === "review.unexpected" ||
                  code === "review.duplicate" ||
                  code === "review.dependencies-contract",
              )
            ? "publication.review.invalid"
            : evidence.diagnostics.some(
                  ({ code }) => code.includes("stale") || code === "review.dependencies-mismatch",
                )
              ? "publication.review.stale"
              : "publication.review.invalid";
    return publicationFailure(
      "invalid",
      code,
      diagnosticProfile === "legacy"
        ? (first?.path ?? "semantic-review-v1.json")
        : "semantic-review-v1.json",
      first?.message ?? "Semantic review evidence does not match the staged request.",
    );
  }
  return publicationSuccess(renderSemanticReview(sorted));
}
