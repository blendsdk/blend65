import type { ArrayType } from "../frontend/semantic-types.js";

/** One immutable compiler-owned identity for a validated resident asset. */
export interface SemanticAsset {
  /** Deterministic identity derived from representation, source path and content hash. */
  readonly id: string;
  /** Selected project-relative source path with forward slashes. */
  readonly sourcePath: string;
  /** Lowercase SHA-256 of the admitted bytes. */
  readonly sha256: string;
  /** Immutable raw bytes in source order. */
  readonly bytes: readonly number[];
}

/** Typed compile-time value produced by the bounded raw-asset resolver. */
export interface EmbeddedValue {
  /** Value discriminator retained by later semantic stages. */
  readonly kind: "embedded";
  /** Identity of the single resident semantic asset. */
  readonly assetId: string;
  /** Exact fixed byte-array type. */
  readonly type: ArrayType;
  /** Embedded data is immutable source data. */
  readonly constant: true;
  /** Same immutable byte sequence held by the semantic asset. */
  readonly bytes: readonly number[];
}

/** A complete raw asset or proving diagnostics without a partial value. */
export type RawAssetResult =
  | {
      readonly kind: "complete";
      readonly asset: SemanticAsset;
      readonly value: EmbeddedValue;
    }
  | {
      readonly kind: "error";
      readonly diagnostics: readonly import("../project/types.js").ProjectDiagnostic[];
    };
