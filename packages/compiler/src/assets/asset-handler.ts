import { createHash } from "node:crypto";
import type { ArrayType, ScalarType } from "../frontend/semantic-types.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { EmbeddedValue } from "./asset-types.js";
import { nativeAssetId } from "./asset-identity.js";

/**
 * Exact source-language type one selector can produce.
 *
 * A selector is either a fixed byte array or one scalar value. The handler never
 * offers a partially typed result: the type is known before any bytes are used.
 */
export type AssetValueType =
  | { readonly kind: "scalar"; readonly scalar: ScalarType }
  | { readonly kind: "array"; readonly array: ArrayType };

/** One literal selector declared by a resolved handler output. */
export interface AssetSelectorInfo {
  /** Stable selector spelling used by source `embed(path, name)`. */
  readonly name: string;
  /** Exact value type produced by this selector. */
  readonly type: AssetValueType;
  /** Whether the parsed file currently contains this optional component. */
  readonly available: boolean;
  /** Whether an omitted selector resolves to this name. */
  readonly default: boolean;
}

/**
 * One handler-owned placement or consumer constraint.
 *
 * Constraints describe a requirement, never a final address. The layout stage
 * intersects them with source placement and fails closed when they cannot be
 * satisfied together.
 */
export type AssetConstraint =
  | {
      readonly kind: "at";
      readonly origin: "handler" | "profile" | "source";
      readonly addressSpaceId: "cpu16";
      readonly start: number;
      readonly bankId?: string;
    }
  | {
      readonly kind: "align";
      readonly origin: "handler" | "profile" | "source";
      readonly bytes: number;
    }
  | {
      readonly kind: "noCross";
      readonly origin: "handler" | "profile" | "source";
      readonly boundaryBytes: number;
    }
  | {
      readonly kind: "region";
      readonly origin: "handler" | "profile" | "source";
      readonly regionId: string;
    }
  | {
      readonly kind: "visibility";
      readonly origin: "handler" | "profile" | "source";
      readonly consumer: "cpu" | "vic" | "player" | "loader";
      readonly conditionId: string;
    }
  | {
      readonly kind: "writable";
      readonly origin: "handler" | "profile" | "source";
      readonly startOffset: number;
      readonly endOffset: number;
    }
  | { readonly kind: "contiguous"; readonly origin: "handler" | "profile" | "source" };

/** Exact structured input passed to one handler. */
export interface AssetHandlerRequest {
  /** Source record containing the literal call. */
  readonly sourceId: string;
  /** Literal path exactly as written by source. */
  readonly literalPath: string;
  /** Project-relative spelling with forward slashes. */
  readonly resolvedPath: string;
  /** Requested selector, or null when source omitted it. */
  readonly selector: string | null;
  /** Declaration ownership recorded by source discovery. */
  readonly owner: "resident" | "loadable";
  /** Complete source call span used for every failure diagnostic. */
  readonly span: SourceSpan;
  /** Declaring source name used in failure messages. */
  readonly declaration: string;
  /** Selected profile identity for format compatibility checks. */
  readonly profileId: string;
  /** Already read immutable file bytes. */
  readonly bytes: readonly number[];
  /** Lowercase SHA-256 of the input bytes. */
  readonly inputSha256: string;
}

/** Declared compatibility meanings retained from one native container. */
export interface AssetCompatibility {
  /** Video-standard meaning; `both` is not `unknown`. */
  readonly video: "unknown" | "PAL" | "NTSC" | "both";
  /** Primary SID-model meaning; `both` is not `unknown`. */
  readonly sidModel: "unknown" | "6581" | "8580" | "both";
  /** Whether the container declares a second SID endpoint. */
  readonly secondSid: boolean;
  /** Whether the container declares a third SID endpoint. */
  readonly thirdSid: boolean;
  /** Declared song count. */
  readonly songs: number;
  /** Declared start song, one-based. */
  readonly startSong: number;
}

/** Exact output selected from one validated file. */
export interface AssetHandlerOutput {
  /** Output discriminator. */
  readonly kind: "output";
  /** Registered handler key. */
  readonly handlerKey: string;
  /** Registered handler version. */
  readonly handlerVersion: string;
  /** Selector actually used, including a resolved default. */
  readonly resolvedSelector: string;
  /** Stable representation spelling for identity and evidence. */
  readonly representation: string;
  /** Exact typed value; scalar outputs own no resident bytes. */
  readonly value: EmbeddedValue;
  /** Lowercase SHA-256 of the selected output bytes. */
  readonly outputSha256: string;
  /** Handler-owned constraints on the selected resident object. */
  readonly constraints: readonly AssetConstraint[];
  /** Complete selector inventory for this parsed file. */
  readonly selectors: readonly AssetSelectorInfo[];
  /** Declared compatibility meanings retained for later contract qualification. */
  readonly compatibility?: AssetCompatibility;
}

/** One closed handler contract. */
export interface AssetHandler {
  /** Stable handler key used by identity and evidence. */
  readonly key: string;
  /** Exact supported producer or format version. */
  readonly version: string;
  /** Canonical lowercase extensions including the leading dot. */
  readonly extensions: readonly string[];
  /** Default selector, or null when source must name one. */
  readonly defaultSelector: string | null;
  /** Parse one already read file into exactly one typed output or one failure. */
  parse(request: AssetHandlerRequest): AssetHandlerOutput | AssetHandlerFailure;
}

/** One complete handler failure with a source-linked diagnostic. */
export interface AssetHandlerFailure {
  /** Failure discriminator. */
  readonly kind: "failure";
  /** Complete proving diagnostic; never a partial value. */
  readonly diagnostic: ProjectDiagnostic;
}

/** Exact handler provenance carried to layout, debug and evidence. */
export interface AssetProvenance {
  /** Registered handler key. */
  readonly handlerKey: string;
  /** Registered handler version. */
  readonly handlerVersion: string;
  /** Selector actually used, including a resolved default. */
  readonly selector: string;
  /** Stable representation spelling for identity and evidence. */
  readonly representation: string;
  /** Lowercase SHA-256 of the input bytes. */
  readonly inputSha256: string;
  /** Lowercase SHA-256 of the selected output bytes. */
  readonly outputSha256: string;
  /** Complete selector inventory for this parsed file. */
  readonly selectors: readonly AssetSelectorInfo[];
  /** Declared compatibility meanings retained for later contract qualification. */
  readonly compatibility?: AssetCompatibility;
}

/** Exact payload and metadata one handler supplies to build its output. */
export type NativeOutputInput =
  | {
      readonly handlerKey: string;
      readonly handlerVersion: string;
      readonly request: AssetHandlerRequest;
      readonly resolvedSelector: string;
      readonly representation: string;
      readonly type: ArrayType;
      readonly bytes: readonly number[];
      readonly constraints: readonly AssetConstraint[];
      readonly selectors: readonly AssetSelectorInfo[];
      readonly compatibility?: AssetCompatibility;
    }
  | {
      readonly handlerKey: string;
      readonly handlerVersion: string;
      readonly request: AssetHandlerRequest;
      readonly resolvedSelector: string;
      readonly representation: string;
      readonly type: ScalarType;
      readonly scalar: bigint | boolean;
      readonly constraints: readonly AssetConstraint[];
      readonly selectors: readonly AssetSelectorInfo[];
      readonly compatibility?: AssetCompatibility;
    };

/** Encode one scalar value into a stable byte sequence for identity and evidence. */
function scalarBytes(type: ScalarType, value: bigint | boolean): readonly number[] {
  if (typeof value === "boolean") return Object.freeze([value ? 1 : 0]);
  const width = type.name === "byte" || type.name === "sbyte" ? 1 : 2;
  const unsigned = BigInt.asUintN(width * 8, value);
  return Object.freeze(
    width === 1 ? [Number(unsigned)] : [Number(unsigned & 0xffn), Number((unsigned >> 8n) & 0xffn)],
  );
}

/** Return the exact bytes of one selected value for hash derivation. */
export function selectedValueBytes(value: EmbeddedValue): readonly number[] {
  return value.kind === "embedded" ? value.bytes : scalarBytes(value.type, value.value);
}

/** Return the canonical digest of one selected value. */
export function selectedValueSha256(value: EmbeddedValue): string {
  return createHash("sha256")
    .update(Buffer.from(selectedValueBytes(value)))
    .digest("hex");
}

/**
 * Build one handler output with canonical provenance and identity.
 *
 * Every handler uses this helper so the selected output hash, provenance record
 * and embedded asset identity are derived the same way and cannot drift.
 */
export function createNativeOutput(input: NativeOutputInput): AssetHandlerOutput {
  const bytes =
    "bytes" in input ? Object.freeze([...input.bytes]) : scalarBytes(input.type, input.scalar);
  const outputSha256 = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
  const provenance: AssetProvenance = Object.freeze({
    handlerKey: input.handlerKey,
    handlerVersion: input.handlerVersion,
    selector: input.resolvedSelector,
    representation: input.representation,
    inputSha256: input.request.inputSha256,
    outputSha256,
    selectors: input.selectors,
    ...(input.compatibility === undefined ? {} : { compatibility: input.compatibility }),
  });
  const assetId = nativeAssetId(provenance, input.request.resolvedPath);
  const value: EmbeddedValue =
    "bytes" in input
      ? Object.freeze({
          kind: "embedded",
          assetId,
          type: input.type,
          constant: true,
          bytes,
        })
      : Object.freeze({
          kind: "embedded-scalar",
          assetId,
          type: input.type,
          constant: true,
          value: input.scalar,
        });
  return Object.freeze({
    kind: "output",
    handlerKey: input.handlerKey,
    handlerVersion: input.handlerVersion,
    resolvedSelector: input.resolvedSelector,
    representation: input.representation,
    value,
    outputSha256,
    constraints: Object.freeze([...input.constraints]),
    selectors: Object.freeze([...input.selectors]),
    ...(input.compatibility === undefined ? {} : { compatibility: input.compatibility }),
  });
}
