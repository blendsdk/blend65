import type { Sha256Digest } from "./model-registry-model.js";

/** Immutable version marker carried by the complete rule-model registry. */
export interface RuleModelVersionV2 {
  readonly schemaVersion: 2;
  readonly kind: "rule-model-version-v2";
  readonly version: "2.0.0";
  readonly predecessorPublicationDigest: Sha256Digest;
}
