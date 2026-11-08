import type { ArrayType, PlacementConstraints, ScalarType } from "../frontend/semantic-types.js";
import type { AssetConstraint, AssetProvenance } from "./asset-handler.js";

/**
 * Immutable fixed-array value selected from one admitted asset.
 *
 * The bytes are shared with the resident asset; selecting the same identity
 * twice never copies or re-parses the payload.
 */
export interface EmbeddedArrayValue {
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

/**
 * Immutable scalar value selected from a native asset.
 *
 * A scalar selector is compile-time metadata. It owns no resident bytes and can
 * never produce a target address or an emitted data record.
 */
export interface EmbeddedScalarValue {
  /** Value discriminator retained by later semantic stages. */
  readonly kind: "embedded-scalar";
  /** Identity of the scalar semantic asset. */
  readonly assetId: string;
  /** Exact declared scalar type. */
  readonly type: ScalarType;
  /** Embedded scalars are compile-time constants. */
  readonly constant: true;
  /** Exact decoded value; booleans stay booleans and integers stay bigint. */
  readonly value: bigint | boolean;
}

/** Typed compile-time value produced by one asset handler. */
export type EmbeddedValue = EmbeddedArrayValue | EmbeddedScalarValue;

/** One immutable resident asset with target bytes. */
export interface ResidentAsset {
  /** Asset discriminator. */
  readonly kind: "resident-asset";
  /** Deterministic identity derived from every input that can change the output. */
  readonly id: string;
  /** Selected project-relative source path with forward slashes. */
  readonly sourcePath: string;
  /** Lowercase SHA-256 of the admitted input bytes. */
  readonly inputSha256: string;
  /** Exact admitted input byte count. */
  readonly inputBytes: number;
  /** Lowercase SHA-256 of the selected output bytes. */
  readonly outputSha256: string;
  /** Immutable emitted bytes in source order. */
  readonly bytes: readonly number[];
  /** Exact selected array type, preserving the element type and extent. */
  readonly arrayType: ArrayType;
  /** Exact handler identity and selector provenance. */
  readonly handler: AssetProvenance;
  /** Handler-owned placement and consumer constraints. */
  readonly constraints: readonly AssetConstraint[];
  /** Combined source constraints on the single resident object. */
  readonly placement?: PlacementConstraints;
}

/**
 * Compile-time-only scalar or zero-byte asset.
 *
 * Scalar assets never enter resident roots, final layout, memory or cost
 * evidence. They are recorded as compile-time symbols with no address.
 */
export interface ScalarAsset {
  /** Asset discriminator. */
  readonly kind: "scalar-asset";
  /** Deterministic identity derived from every input that can change the output. */
  readonly id: string;
  /** Selected project-relative source path with forward slashes. */
  readonly sourcePath: string;
  /** Lowercase SHA-256 of the admitted input bytes. */
  readonly inputSha256: string;
  /** Exact admitted input byte count. */
  readonly inputBytes: number;
  /** Lowercase SHA-256 of the encoded selected value. */
  readonly outputSha256: string;
  /** Exact handler identity and selector provenance. */
  readonly handler: AssetProvenance;
  /** Declared scalar type, or null for a zero-byte non-scalar output. */
  readonly scalarType: ScalarType | null;
  /** Exact compile-time value, or null for a zero-byte non-scalar output. */
  readonly scalarValue: bigint | boolean | null;
  /** Handler-owned consumer constraints (never a resident placement). */
  readonly constraints: readonly AssetConstraint[];
}

/** One admitted asset: either resident bytes or compile-time-only metadata. */
export type SemanticAsset = ResidentAsset | ScalarAsset;

/** A complete raw asset or proving diagnostics without a partial value. */
export type RawAssetResult =
  | {
      readonly kind: "complete";
      readonly asset: ResidentAsset;
      readonly value: EmbeddedArrayValue;
    }
  | {
      readonly kind: "error";
      readonly diagnostics: readonly import("../project/types.js").ProjectDiagnostic[];
    };
