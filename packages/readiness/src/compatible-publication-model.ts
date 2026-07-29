import type { PublishedSnapshot } from "./binding-model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type {
  PublicationDiagnostic,
  PublicationReviewRequestV1,
  PublishedBindingTransaction,
} from "./publication-model.js";

declare const preparedIncrementalPublicationBrand: unique symbol;

/** Opaque one-use authority to select an already staged compatible publication. */
export interface PreparedIncrementalBindingPublication {
  /** Compile-time nominal marker paired with module-private runtime state. */
  readonly [preparedIncrementalPublicationBrand]: true;
}

/** Input for read-only reconstruction of the exact incremental review request. */
export interface PrepareIncrementalBindingPublicationReviewInput {
  /** Canonical repository root. */
  readonly repositoryRoot: string;
  /** Genuine resolver-created base snapshot. */
  readonly baseSnapshot: PublishedSnapshot;
  /** Exact lexical five-handler promotion set. */
  readonly targetHandlerIds: readonly string[];
}

/** Read-only immutable request prepared for independent review. */
export interface PreparedIncrementalBindingPublicationReview {
  /** Complete canonical semantic-review request. */
  readonly request: PublicationReviewRequestV1;
  /** Defensive copy of canonical LF-terminated request bytes. */
  readonly requestBytes: Uint8Array;
}

/** Input for staging one reviewed compatible publication. */
export interface PrepareIncrementalBindingPublicationInput extends PrepareIncrementalBindingPublicationReviewInput {
  /** Independently authored semantic-review evidence for the reconstructed request. */
  readonly semanticReviewBytes: Uint8Array;
}

/** Immutable readable evidence for one staged publication capability. */
export interface PreparedIncrementalBindingPublicationPreview {
  /** Opaque commit authority. */
  readonly prepared: PreparedIncrementalBindingPublication;
  /** Exact immutable base release. */
  readonly basePublicationDigest: Sha256Digest;
  /** Exact staged nine-row release. */
  readonly publicationDigest: Sha256Digest;
  /** Digest of canonical accepted review evidence. */
  readonly acceptedReviewDigest: Sha256Digest;
  /** Exact lexical promoted handler set. */
  readonly promotedHandlerIds: readonly string[];
  /** Fully revalidated staged snapshot. */
  readonly stagedSnapshot: PublishedSnapshot;
}

/** Additional deterministic failures used only by compatible publication operations. */
export interface CompatiblePublicationDiagnostic {
  /** Closed machine-readable failure category. */
  readonly code:
    | PublicationDiagnostic["code"]
    | "publication.release.not-found"
    | "publication.base.invalid"
    | "publication.base.stale"
    | "publication.targets.invalid"
    | "publication.capability.invalid"
    | "publication.snapshot.invalid";
  /** RFC 6901 pointer or canonical repository-relative artifact path. */
  readonly path: string;
  /** Bounded non-sensitive explanation. */
  readonly message: string;
}

/** Success-or-failure envelope for additive compatible publication operations. */
export type CompatiblePublicationResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly kind:
        | "invalid"
        | "not-found"
        | "stale"
        | "collision"
        | "contended"
        | "durability-unsupported"
        | "acceptance-failed"
        | "io";
      readonly diagnostics: readonly CompatiblePublicationDiagnostic[];
    };

/** Successful selected result of committing one incremental capability. */
export type PublishedIncrementalBindingPublication = PublishedBindingTransaction;
