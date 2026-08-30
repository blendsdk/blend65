import type { FreshCandidateRegistration } from "./binding-model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type { ModeledGeneratorSuite } from "./modeled-generator-model.js";
import type { PublishedSnapshotAuthority } from "./publication-resolver.js";

/** Resolver authority after the published context boundary has checked every required member. */
export type CompletePublishedOracleAuthority = Omit<
  PublishedSnapshotAuthority,
  | "seedContractBytes"
  | "diagnosticManifestBytes"
  | "bindingRejectionBytes"
  | "renderer"
  | "candidateAuthorityBytes"
  | "rendererAuthorityBytes"
  | "publicationImplementationAuthority"
> & {
  readonly seedContractBytes: Uint8Array;
  readonly diagnosticManifestBytes: Uint8Array;
  readonly bindingRejectionBytes: Uint8Array;
  readonly renderer: NonNullable<PublishedSnapshotAuthority["renderer"]>;
  readonly candidateAuthorityBytes: ReadonlyMap<string, Uint8Array>;
  readonly rendererAuthorityBytes: ReadonlyMap<string, Uint8Array>;
  readonly publicationImplementationAuthority: NonNullable<
    PublishedSnapshotAuthority["publicationImplementationAuthority"]
  >;
};

/** Callable publication authority retained only behind an authentic context object. */
export interface PublishedContextState {
  /** Complete resolver-selected publication authority. */
  readonly authority: CompletePublishedOracleAuthority;
  /** Reviewed generator models authenticated from the selected publication. */
  readonly modeledSuite: ModeledGeneratorSuite;
  /** Content identity of the authenticated generator models. */
  readonly ruleModelDigest: Sha256Digest;
  /** Fresh executable participants indexed by their fixed handler identity. */
  readonly candidates: ReadonlyMap<string, FreshCandidateRegistration>;
}
