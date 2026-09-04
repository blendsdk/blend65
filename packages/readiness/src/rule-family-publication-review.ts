import type { Sha256Digest } from "./model-registry-model.js";
import {
  digestPublicationBytes,
  renderPublicationJson,
  type PublicationBindingRow,
  type PublicationReviewRequestV1,
} from "./publication-model.js";
import type { RuleModelMigrationDocumentV2 } from "./rule-model-migration.js";

/** Minimal migration facts committed by a version-two parent review request. */
export interface RuleFamilyReviewMigrationAuthorityV2 {
  readonly document: RuleModelMigrationDocumentV2;
  readonly migrationDigest: Sha256Digest;
}

/**
 * Reconstructs the exact independent-review request for a version-two parent.
 *
 * @param migration Authenticated migration identities.
 * @param bindings Exact lexical handler bindings.
 * @param preliminaryMembers Parent members excluding the request and accepted review.
 * @returns Canonical digest-bound semantic review request.
 */
export function createRuleFamilyPublicationReviewRequestV2(
  migration: RuleFamilyReviewMigrationAuthorityV2,
  bindings: readonly PublicationBindingRow[],
  preliminaryMembers: ReadonlyMap<string, Uint8Array>,
): PublicationReviewRequestV1 {
  const memberDigests = Object.fromEntries(
    [...preliminaryMembers]
      .map(([path, bytes]) => [path, digestPublicationBytes(bytes)] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const dependencyDigests: PublicationReviewRequestV1["dependencyDigests"] = Object.freeze({
    bindings: digestPublicationBytes(preliminaryMembers.get("bindings-v2.json")!),
    inventory: digestPublicationBytes(preliminaryMembers.get("compiler-readiness-v1.json")!),
    "rule-model": digestPublicationBytes(preliminaryMembers.get("rule-models-v2.json")!),
    "rule-model-review": migration.migrationDigest,
  });
  const completeDependencies = Object.freeze({
    ...memberDigests,
    "migration-authority": migration.migrationDigest,
    "fixture-authority": migration.document.fixtureSetDigest,
    "model-authority": migration.document.targetModelDigest,
    ...Object.fromEntries(
      bindings.map((row) => [`handler:${row.handlerId}`, row.implementationRevision]),
    ),
  });
  const semanticDigest = digestPublicationBytes(
    renderPublicationJson({
      schemaVersion: 2,
      predecessorPublicationDigest: migration.document.sourcePublicationDigest,
      dependencyDigests,
      completeDependencies,
    }),
  );
  return Object.freeze({
    schemaVersion: 1,
    semanticDigest,
    specRevision: "spec-v3.0",
    dependencyDigests,
    promotedHandlerIds: Object.freeze(bindings.map(({ handlerId }) => handlerId)),
    reviewUnits: Object.freeze([
      Object.freeze({
        unitId: "rule-family-publication-v2",
        semanticDigest,
        dependencyDigests: completeDependencies,
      }),
    ]),
  });
}
