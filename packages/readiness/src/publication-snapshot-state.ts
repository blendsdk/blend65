import type {
  FreshCandidateRegistration,
  PublishedSnapshot,
  ValidatedBindingRegistry,
} from "./binding-model.js";
import type { CampaignRendererBindingV1 } from "./campaign-model.js";
import type { InventoryV1 } from "./model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type { PublicationImplementationAuthority } from "./publication-implementation-authority.js";
import type { PublicationBindingRow } from "./publication-model.js";

/** Authenticated facts retained behind one opaque publication snapshot capability. */
export interface PublishedSnapshotState {
  readonly repositoryRoot: string;
  readonly publicationDigest: Sha256Digest;
  readonly inventoryGenerationDigest: Sha256Digest;
  readonly inventory: InventoryV1;
  readonly bindingRows: readonly PublicationBindingRow[];
  readonly candidates: readonly FreshCandidateRegistration[];
  readonly bindings: ValidatedBindingRegistry;
  readonly memberBytes: ReadonlyMap<string, Uint8Array>;
  readonly acceptedReviewDigest: Sha256Digest;
  readonly seedContractBytes?: Uint8Array | undefined;
  readonly diagnosticManifestBytes?: Uint8Array | undefined;
  readonly bindingRejectionBytes?: Uint8Array | undefined;
  readonly renderer?: CampaignRendererBindingV1 | undefined;
  readonly candidateAuthorityBytes?: ReadonlyMap<string, Uint8Array> | undefined;
  readonly rendererAuthorityBytes?: ReadonlyMap<string, Uint8Array> | undefined;
  readonly publicationImplementationAuthority?: PublicationImplementationAuthority | undefined;
}

/** Factory used by format-specific resolvers after all publication facts are authenticated. */
export type PublishedSnapshotFactory = (state: PublishedSnapshotState) => PublishedSnapshot;
