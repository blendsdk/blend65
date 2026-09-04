import type {
  ExecutableBinding,
  FreshCandidateRegistration,
  PublishedSnapshot,
} from "./binding-model.js";
import { validatePublishedBindings } from "./binding-validator.js";
import type { CompatiblePublicationResult } from "./compatible-publication-model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import { RULE_FAMILY_HANDLER_IDS_V2 } from "./rule-family-handler-catalog.js";
import {
  getPublishedRuleFamilyRecordAuthorityV2,
  type PublishedRuleFamilyRecord,
} from "./rule-family-publication-record.js";
import { loadPublicationCandidatesForHandlerIds } from "./publication-candidates.js";
import type { PublishedSnapshotState } from "./publication-resolver.js";
import {
  digestPublicationBytes,
  publicationFailure,
  publicationSuccess,
  type PublicationBindingRow,
  type PublicationResult,
} from "./publication-model.js";
import { validateExecutableRuleFamilyMembersV2 } from "./rule-family-publication-validation.js";

declare const publishedRuleFamilySnapshotV2Brand: unique symbol;

/** Opaque executable authority for a fully authenticated version-two parent. */
export interface PublishedRuleFamilySnapshotV2 extends PublishedSnapshot {
  readonly [publishedRuleFamilySnapshotV2Brand]: true;
}

/** Executable authority acquired from either supported parent format. */
export type PublishedRuleFamilyAuthorityV2 = PublishedSnapshot | PublishedRuleFamilySnapshotV2;

/** Resolver-owned operations injected into the focused executable-authority implementation. */
export interface RuleFamilyExecutableAuthorityDependenciesV2 {
  /** Resolves exact executable authority for a version-one publication. */
  readonly resolveLegacy: (
    repositoryRoot: string,
    publicationDigest: Sha256Digest,
  ) => Promise<PublicationResult<PublishedSnapshot>>;
  /** Mints a resolver-owned snapshot after version-two validation succeeds. */
  readonly createSnapshot: (state: PublishedSnapshotState) => PublishedSnapshot;
}

function exactBindings(
  rows: readonly PublicationBindingRow[],
  candidates: readonly FreshCandidateRegistration[],
): PublicationResult<readonly ExecutableBinding[]> {
  const byId = new Map(candidates.map((candidate) => [candidate.binding.handlerId, candidate]));
  const executable: ExecutableBinding[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const candidate = byId.get(row.handlerId);
    if (
      candidate === undefined ||
      candidate.binding.implementationRevision !== row.implementationRevision
    ) {
      return publicationFailure(
        "invalid",
        "publication.implementation-unavailable",
        `/bindings/${index}/implementationRevision`,
        "The exact published implementation revision is not installed.",
      );
    }
    if (
      candidate.binding.kind !== row.kind ||
      candidate.binding.contractVersion !== row.contractVersion
    ) {
      return publicationFailure(
        "invalid",
        "publication.binding.invalid",
        `/bindings/${index}`,
        "The installed handler does not satisfy the published kind and contract.",
      );
    }
    executable.push(candidate.binding);
  }
  return candidates.length === rows.length
    ? publicationSuccess(Object.freeze(executable))
    : publicationFailure(
        "invalid",
        "publication.implementation-unavailable",
        "/bindings/0/implementationRevision",
        "The exact published handler population is not installed.",
      );
}

function staleImplementation<T>(result: PublicationResult<T>): CompatiblePublicationResult<T> {
  return !result.ok && result.diagnostics[0]?.code === "publication.implementation-unavailable"
    ? Object.freeze({ ...result, kind: "stale" as const })
    : result;
}

/** Acquires exact executable authority for one authenticated passive publication record. */
export async function acquireRuleFamilyExecutableAuthorityV2(
  record: PublishedRuleFamilyRecord,
  dependencies: RuleFamilyExecutableAuthorityDependenciesV2,
): Promise<CompatiblePublicationResult<PublishedRuleFamilyAuthorityV2>> {
  const authority = getPublishedRuleFamilyRecordAuthorityV2(record);
  if (authority === undefined) {
    return Object.freeze({
      ok: false,
      kind: "invalid",
      diagnostics: Object.freeze([
        Object.freeze({
          code: "publication.record.invalid" as const,
          path: "/record",
          message: "Executable acquisition requires a genuine passive publication record.",
        }),
      ]),
    });
  }
  if (authority.schemaVersion === 1) {
    return staleImplementation(
      await dependencies.resolveLegacy(authority.repositoryRoot, authority.publicationDigest),
    );
  }
  const validatedMembers = await validateExecutableRuleFamilyMembersV2(authority);
  if (!validatedMembers.ok) return validatedMembers;
  const inventoryBytes = authority.members.get("compiler-readiness-v1.json")!;
  const catalog = await loadPublicationCandidatesForHandlerIds({
    repositoryRoot: authority.repositoryRoot,
    handlerIds: RULE_FAMILY_HANDLER_IDS_V2,
  });
  if (!catalog.ok) {
    return Object.freeze({
      ok: false,
      kind: "stale",
      diagnostics: Object.freeze([
        Object.freeze({
          code: "publication.implementation-unavailable" as const,
          path: "/bindings/0/implementationRevision",
          message: "Current handler implementation authority could not be reconstructed.",
        }),
      ]),
    });
  }
  const exact = exactBindings(authority.bindings, catalog.candidates);
  if (!exact.ok) return staleImplementation(exact);
  const validated = validatePublishedBindings(
    validatedMembers.value.inventory.handlerDeclarations,
    exact.value,
  );
  if (!validated.ok) {
    return publicationFailure(
      "invalid",
      "publication.binding.invalid",
      validated.diagnostics[0]?.path ?? "/bindings",
      validated.diagnostics[0]?.message ?? "Version-two handlers do not match the inventory.",
    );
  }
  const snapshot = dependencies.createSnapshot({
    repositoryRoot: authority.repositoryRoot,
    publicationDigest: authority.publicationDigest,
    inventoryGenerationDigest: digestPublicationBytes(inventoryBytes),
    inventory: validatedMembers.value.inventory,
    bindingRows: authority.bindings,
    candidates: catalog.candidates,
    bindings: validated.bindings,
    memberBytes: new Map(
      [...authority.members].map(([path, bytes]) => [path, bytes.slice()] as const),
    ),
    acceptedReviewDigest: validatedMembers.value.acceptedReviewDigest,
    seedContractBytes: authority.members.get("rule-model-seed-v1.json")?.slice(),
    diagnosticManifestBytes: authority.members.get("diagnostic-oracle-v1.json")?.slice(),
    bindingRejectionBytes: authority.members.get("binding-rejections-v1.json")?.slice(),
    candidateAuthorityBytes: catalog.authorityBytes,
  }) as PublishedRuleFamilySnapshotV2;
  return Object.freeze({
    ok: true,
    value: snapshot,
    diagnostics: Object.freeze([]) as readonly [],
  });
}
