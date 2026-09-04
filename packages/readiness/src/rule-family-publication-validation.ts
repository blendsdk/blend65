import type { InventoryV1 } from "./model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import {
  digestPublicationBytes,
  parsePublicationJson,
  publicationFailure,
  publicationSuccess,
  renderPublicationJson,
  type PublicationResult,
} from "./publication-model.js";
import { validatePublicationReviewEvidence } from "./publication-review.js";
import {
  resolvePublishedRuleFamilyRecordByDigestV2,
  type PublishedRuleFamilyRecordAuthorityV2,
} from "./rule-family-publication-record.js";
import { createRuleFamilyPublicationReviewRequestV2 } from "./rule-family-publication-review.js";
import {
  validateRuleModelRegistryAgainstInventoryV2,
  type RuleModelRegistryV2,
} from "./rule-family-model.js";
import { validateEmbeddedCaseFixtureDocumentV2 } from "./embed-case-fixtures.js";
import { validateFirstVerticalPublicationCandidateV2 } from "./first-vertical-publication.js";
import { validateRuleModelMigrationDocumentV2 } from "./rule-model-migration.js";
import { createFirstVerticalStructuredExecutionExemplarV2 } from "./structured-execution-exemplar.js";
import { readInventoryVersioned } from "./versioning.js";

/** Fully joined parent facts retained only after every executable member revalidates. */
export interface ValidatedExecutableRuleFamilyMembersV2 {
  readonly inventory: InventoryV1;
  readonly model: RuleModelRegistryV2;
  readonly acceptedReviewDigest: Sha256Digest;
}

const EXCLUDED_REVIEW_MEMBERS = new Set(["rule-models-v2-review.json", "semantic-review-v2.json"]);

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

function invalid<T>(path: string, message: string): PublicationResult<T> {
  return publicationFailure("invalid", "publication.record.invalid", path, message);
}

function requiredMember(
  authority: PublishedRuleFamilyRecordAuthorityV2,
  path: string,
): PublicationResult<Uint8Array> {
  const bytes = authority.members.get(path);
  return bytes === undefined
    ? invalid(path, "Version-two executable parent member is absent.")
    : publicationSuccess(bytes.slice());
}

function canonicalJsonMember(
  authority: PublishedRuleFamilyRecordAuthorityV2,
  path: string,
): PublicationResult<unknown> {
  const member = requiredMember(authority, path);
  if (!member.ok) return member;
  const parsed = parsePublicationJson(member.value);
  if (!parsed.ok || !equalBytes(member.value, renderPublicationJson(parsed.value))) {
    return invalid(path, "Version-two executable parent member is not canonical JSON.");
  }
  return publicationSuccess(parsed.value);
}

function validateCanonicalInventory(bytes: Uint8Array): PublicationResult<InventoryV1> {
  const parsed = readInventoryVersioned(bytes);
  if (
    !parsed.ok ||
    parsed.inventory === undefined ||
    !equalBytes(bytes, renderPublicationJson(parsed.inventory))
  ) {
    return invalid(
      "compiler-readiness-v1.json",
      "Version-two parent inventory is invalid or non-canonical.",
    );
  }
  return publicationSuccess(parsed.inventory);
}

function validateCanonicalBindings(
  authority: PublishedRuleFamilyRecordAuthorityV2,
  bytes: Uint8Array,
): PublicationResult<true> {
  const expected = renderPublicationJson({
    schemaVersion: 2,
    kind: "rule-family-bindings-v2",
    bindings: authority.bindings,
  });
  return equalBytes(bytes, expected)
    ? publicationSuccess(true)
    : invalid("bindings-v2.json", "Version-two handler bindings are not canonical.");
}

/**
 * Revalidates every semantic join required before a version-two parent becomes executable.
 *
 * @param authority Digest-authenticated passive parent members.
 * @returns Detached inventory/model authority after migration, fixture, case, review and exemplar joins.
 */
export async function validateExecutableRuleFamilyMembersV2(
  authority: PublishedRuleFamilyRecordAuthorityV2,
): Promise<PublicationResult<ValidatedExecutableRuleFamilyMembersV2>> {
  if (authority.schemaVersion !== 2 || authority.predecessorPublicationDigest === undefined) {
    return invalid(
      "/record",
      "Executable version-two validation requires a predecessor-bound record.",
    );
  }
  const inventoryMember = requiredMember(authority, "compiler-readiness-v1.json");
  if (!inventoryMember.ok) return inventoryMember;
  const inventory = validateCanonicalInventory(inventoryMember.value);
  if (!inventory.ok) return inventory;

  const bindingsMember = requiredMember(authority, "bindings-v2.json");
  if (!bindingsMember.ok) return bindingsMember;
  const bindings = validateCanonicalBindings(authority, bindingsMember.value);
  if (!bindings.ok) return bindings;

  const modelMember = canonicalJsonMember(authority, "rule-models-v2.json");
  if (!modelMember.ok) return modelMember;
  const model = validateRuleModelRegistryAgainstInventoryV2(modelMember.value, inventory.value);
  if (
    !model.ok ||
    !equalBytes(model.canonicalBytes, authority.members.get("rule-models-v2.json")!) ||
    model.model.version.predecessorPublicationDigest !== authority.predecessorPublicationDigest
  ) {
    return invalid(
      "rule-models-v2.json",
      "Version-two model does not match its exact inventory and predecessor authority.",
    );
  }

  const firstVerticalMember = canonicalJsonMember(authority, "first-vertical-v2.json");
  if (!firstVerticalMember.ok) return firstVerticalMember;
  const firstVertical = validateFirstVerticalPublicationCandidateV2(firstVerticalMember.value);
  if (
    !firstVertical.ok ||
    !equalBytes(
      authority.members.get("first-vertical-v2.json")!,
      renderPublicationJson(firstVertical.candidate),
    ) ||
    !equalBytes(
      renderPublicationJson(model.model.firstVertical),
      renderPublicationJson(firstVertical.candidate),
    )
  ) {
    return invalid(
      "first-vertical-v2.json",
      "First-vertical member does not match the model's authenticated case bindings.",
    );
  }

  const fixtureMember = canonicalJsonMember(authority, "embed-fixtures-v2.json");
  if (!fixtureMember.ok) return fixtureMember;
  const fixtures = validateEmbeddedCaseFixtureDocumentV2(fixtureMember.value);
  if (
    !fixtures.ok ||
    !equalBytes(authority.members.get("embed-fixtures-v2.json")!, fixtures.canonicalBytes)
  ) {
    return invalid(
      "embed-fixtures-v2.json",
      "Embedded fixture member does not match package-owned fixture authority.",
    );
  }

  const predecessor = await resolvePublishedRuleFamilyRecordByDigestV2({
    repositoryRoot: authority.repositoryRoot,
    publicationDigest: authority.predecessorPublicationDigest,
  });
  if (!predecessor.ok) {
    return invalid(
      "migration-v2.json/sourcePublicationDigest",
      "Migration predecessor record is unavailable.",
    );
  }
  const migrationMember = canonicalJsonMember(authority, "migration-v2.json");
  if (!migrationMember.ok) return migrationMember;
  const migration = validateRuleModelMigrationDocumentV2(predecessor.value, migrationMember.value);
  if (
    !migration.ok ||
    !equalBytes(authority.members.get("migration-v2.json")!, migration.canonicalBytes) ||
    migration.document.sourcePublicationDigest !== authority.predecessorPublicationDigest ||
    migration.document.targetModelDigest !== model.modelDigest ||
    migration.document.firstVerticalCandidateDigest !== firstVertical.candidateDigest ||
    migration.document.fixtureSetDigest !== fixtures.fixtureSetDigest ||
    migration.document.handlers.length !== authority.bindings.length ||
    migration.document.handlers.some((row, index) => {
      const binding = authority.bindings[index];
      return (
        binding === undefined ||
        row.handlerId !== binding.handlerId ||
        row.kind !== binding.kind ||
        row.contractVersion !== binding.contractVersion ||
        row.toRevision !== binding.implementationRevision
      );
    })
  ) {
    return invalid(
      "migration-v2.json",
      "Migration does not join its predecessor, model, fixtures, cases and handler bindings.",
    );
  }

  const exemplarMember = requiredMember(authority, "structured-execution-exemplar-v2.json");
  if (!exemplarMember.ok) return exemplarMember;
  const exemplar = createFirstVerticalStructuredExecutionExemplarV2();
  if (!exemplar.ok || !equalBytes(exemplarMember.value, exemplar.value.canonicalBytes)) {
    return invalid(
      "structured-execution-exemplar-v2.json",
      "Structured execution exemplar does not match current authenticated case authority.",
    );
  }

  const preliminaryMembers = new Map(
    [...authority.members].filter(([path]) => !EXCLUDED_REVIEW_MEMBERS.has(path)),
  );
  const request = createRuleFamilyPublicationReviewRequestV2(
    migration,
    authority.bindings,
    preliminaryMembers,
  );
  const requestMember = requiredMember(authority, "rule-models-v2-review.json");
  if (!requestMember.ok) return requestMember;
  if (!equalBytes(requestMember.value, renderPublicationJson(request))) {
    return invalid(
      "rule-models-v2-review.json",
      "Published review request does not match the complete parent member closure.",
    );
  }
  const semanticReview = requiredMember(authority, "semantic-review-v2.json");
  if (!semanticReview.ok) return semanticReview;
  const accepted = validatePublicationReviewEvidence(semanticReview.value, request);
  if (!accepted.ok || !equalBytes(accepted.value, semanticReview.value)) {
    return invalid(
      "semantic-review-v2.json",
      "Published semantic review does not accept the reconstructed parent request.",
    );
  }
  return publicationSuccess(
    Object.freeze({
      inventory: inventory.value,
      model: model.model,
      acceptedReviewDigest: digestPublicationBytes(semanticReview.value),
    }),
  );
}
