/** Additional stable failures introduced by version-two rule-family publication. */
export type RuleFamilyPublicationDiagnosticCodeV2 =
  | "publication.version.unsupported"
  | "publication.record.invalid"
  | "publication.implementation-unavailable"
  | "publication.migration.invalid"
  | "publication.fixture.invalid";

/** Stable failure emitted by publication preparation, resolution or commit. */
export interface PublicationDiagnostic {
  /** Closed machine-readable failure category. */
  readonly code:
    | "publication.input.invalid"
    | "publication.input.limit"
    | "publication.path.invalid"
    | "publication.digest.mismatch"
    | "publication.collision"
    | "publication.binding.invalid"
    | "publication.review.invalid"
    | "publication.review.stale"
    | "publication.review.not-accepted"
    | "publication.lock.contended"
    | "publication.durability-unsupported"
    | "publication.acceptance.failed"
    | RuleFamilyPublicationDiagnosticCodeV2
    | "publication.io";
  /** RFC 6901 pointer or canonical repository-relative artifact path. */
  readonly path: string;
  /** Bounded human-readable explanation. */
  readonly message: string;
}

/** Closed success-or-failure result shared by every publication operation. */
export type PublicationResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly kind:
        | "invalid"
        | "collision"
        | "contended"
        | "durability-unsupported"
        | "acceptance-failed"
        | "io";
      readonly diagnostics: readonly PublicationDiagnostic[];
    };
