import { createHash } from "node:crypto";

import {
  canonicalIdentityFieldChunks,
  canonicalIdentityHeaderChunks,
  canonicalUnsignedDecimal,
  copyUint8Array,
  isSha256Digest,
  normalizeGenerationPath,
} from "./canonical-identity.js";
import { inspectGeneratorInput } from "./generator-ir-validator.js";
import type { Sha256Digest } from "./model-registry-model.js";

/** Stable deterministic-choice validation failure. */
export interface ChoiceDiagnostic {
  /** Stable machine-readable failure category. */
  readonly code: "choice.input.invalid";
  /** RFC 6901 pointer to the rejected choice input. */
  readonly path: string;
  /** Stable human-readable explanation of the failure. */
  readonly message: string;
}

/** Closed result returned by deterministic-choice operations. */
export type ChoiceResult<T> =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Successfully derived immutable choice value. */
      readonly value: T;
      /** Empty diagnostic tuple for the successful branch. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Non-empty deterministic validation or digest failures. */
      readonly diagnostics: readonly ChoiceDiagnostic[];
    };

/** Invariant seed and generation path validated once for repeated campaign draws. */
export interface DeterministicChoiceContextInput {
  /** Canonical campaign seed shared by the repeated draws. */
  readonly seed: Sha256Digest;
  /** Immutable branch path shared by the repeated draws. */
  readonly generationPath: readonly number[];
}

/** Complete random-access input for one SHA-256 counter block. */
export interface CounterBlockInput {
  /** Canonical campaign seed. */
  readonly seed: Sha256Digest;
  /** Immutable branch path locating the draw. */
  readonly generationPath: readonly number[];
  /** Zero-based draw ordinal within the generation path. */
  readonly drawOrdinal: bigint;
  /** Zero-based SHA-256 block index for rejection retries. */
  readonly blockIndex: bigint;
}

/** Complete random-access input for one unbiased bounded integer. */
export interface BoundedIntegerInput {
  /** Canonical campaign seed. */
  readonly seed: Sha256Digest;
  /** Immutable branch path locating the draw. */
  readonly generationPath: readonly number[];
  /** Zero-based draw ordinal within the generation path. */
  readonly drawOrdinal: bigint;
  /** Exclusive upper bound in the range one through 2^256. */
  readonly upperExclusive: bigint;
}

/** Injectable counter-block digest used by deterministic rejection tests. */
export type CounterBlockDigest = (preimage: Uint8Array) => Uint8Array;

const DETERMINISTIC_CHOICE_CONTEXT_BRAND: unique symbol = Symbol("deterministic-choice-context");

/** Opaque validated context for repeated path-local deterministic draws. */
export interface DeterministicChoiceContext {
  /** Compile-time marker paired with module-private pre-encoded runtime state. */
  readonly [DETERMINISTIC_CHOICE_CONTEXT_BRAND]: true;
}

interface PreparedChoiceState {
  readonly seed: Sha256Digest;
  readonly generationPath: readonly number[];
  readonly encodedPath: string;
  readonly invariantChunks: readonly Uint8Array[];
}

interface ValidatedChoiceDraw {
  readonly state: PreparedChoiceState;
  readonly drawOrdinal: bigint;
}

const CONTEXT_KEYS = ["seed", "generationPath"] as const;
const COUNTER_KEYS = ["seed", "generationPath", "drawOrdinal", "blockIndex"] as const;
const BOUNDED_KEYS = ["seed", "generationPath", "drawOrdinal", "upperExclusive"] as const;
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const MAX_U64 = (1n << 64n) - 1n;
const UINT256_RANGE = 1n << 256n;
const MAX_REJECTION_BLOCKS = 1_024n;
const CHOICE_CONTEXTS = new WeakMap<object, PreparedChoiceState>();

function diagnostic(path: string, message: string): ChoiceDiagnostic {
  return Object.freeze({ code: "choice.input.invalid", path, message });
}

function failure(path: string, message: string): ChoiceResult<never> {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnostic(path, message)]),
  });
}

function success<T>(value: T): ChoiceResult<T> {
  return Object.freeze({ ok: true, value, diagnostics: EMPTY_DIAGNOSTICS });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Reflect.ownKeys(value);
  return (
    actual.length === keys.length &&
    actual.every((key) => typeof key === "string" && keys.includes(key))
  );
}

function prepareChoiceState(
  seed: Sha256Digest,
  generationPath: readonly number[],
  encodedPath: string,
): PreparedChoiceState {
  return Object.freeze({
    seed,
    generationPath,
    encodedPath,
    invariantChunks: Object.freeze([
      ...canonicalIdentityHeaderChunks("blend65-counter-draw-v1", 4),
      ...canonicalIdentityFieldChunks({ name: "seed", value: seed }),
      ...canonicalIdentityFieldChunks({ name: "generationPath", value: encodedPath }),
    ]),
  });
}

function normalizeChoiceContextInput(
  input: unknown,
  keys: readonly string[],
): ChoiceResult<PreparedChoiceState> {
  const structuralFailure = inspectGeneratorInput(input, "", () => false);
  if (structuralFailure !== undefined) {
    return failure(structuralFailure.path, structuralFailure.message);
  }
  if (!isRecord(input) || !hasExactKeys(input, keys)) {
    return failure("", "Deterministic-choice input must use the exact closed shape.");
  }
  if (!isSha256Digest(input.seed)) {
    return failure("/seed", "Seed must be a canonical SHA-256 digest.");
  }
  const generationPath = normalizeGenerationPath(input.generationPath, "/generationPath", 64);
  if (!generationPath.ok) {
    return failure(generationPath.problem.path, generationPath.problem.message);
  }
  return success(prepareChoiceState(input.seed, generationPath.path, generationPath.encoded));
}

function normalizeChoiceDrawInput(
  input: unknown,
  keys: readonly string[],
): ChoiceResult<ValidatedChoiceDraw> {
  const normalized = normalizeChoiceContextInput(input, keys);
  if (!normalized.ok) return normalized;
  const drawOrdinal = (input as Readonly<Record<string, unknown>>).drawOrdinal;
  if (typeof drawOrdinal !== "bigint" || drawOrdinal < 0n || drawOrdinal > MAX_U64) {
    return failure("/drawOrdinal", "Draw ordinal must be an unsigned 64-bit integer.");
  }
  return success(
    Object.freeze({
      state: normalized.value,
      drawOrdinal,
    }),
  );
}

function variableCounterChunks(drawOrdinal: bigint, blockIndex: bigint): readonly Uint8Array[] {
  return Object.freeze([
    ...canonicalIdentityFieldChunks({
      name: "drawOrdinal",
      value: canonicalUnsignedDecimal(drawOrdinal),
    }),
    ...canonicalIdentityFieldChunks({
      name: "blockIndex",
      value: canonicalUnsignedDecimal(blockIndex),
    }),
  ]);
}

function visitCounterChunks(
  state: PreparedChoiceState,
  drawOrdinal: bigint,
  blockIndex: bigint,
  visit: (chunk: Uint8Array) => void,
): void {
  for (const chunk of state.invariantChunks) visit(chunk);
  for (const chunk of variableCounterChunks(drawOrdinal, blockIndex)) visit(chunk);
}

function defaultCounterBlock(
  state: PreparedChoiceState,
  drawOrdinal: bigint,
  blockIndex: bigint,
): Uint8Array {
  const hash = createHash("sha256");
  visitCounterChunks(state, drawOrdinal, blockIndex, (chunk) => hash.update(chunk));
  const digest = hash.digest();
  return new Uint8Array(digest.buffer, digest.byteOffset, digest.byteLength);
}

function materializeCounterPreimage(
  state: PreparedChoiceState,
  drawOrdinal: bigint,
  blockIndex: bigint,
): Uint8Array {
  const chunks: Uint8Array[] = [];
  visitCounterChunks(state, drawOrdinal, blockIndex, (chunk) => chunks.push(chunk));
  const totalBytes = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const preimage = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    preimage.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return preimage;
}

function digestBlock(
  state: PreparedChoiceState,
  drawOrdinal: bigint,
  blockIndex: bigint,
  blockDigest?: CounterBlockDigest,
): ChoiceResult<Uint8Array> {
  try {
    if (blockDigest === undefined) {
      return success(defaultCounterBlock(state, drawOrdinal, blockIndex));
    }
    const preimage = materializeCounterPreimage(state, drawOrdinal, blockIndex);
    const block = copyUint8Array(blockDigest(preimage), 32);
    if (block === undefined) {
      return failure("/blockIndex", "Counter digest must return exactly 32 bytes.");
    }
    return success(block);
  } catch {
    return failure("/blockIndex", "Counter digest could not produce a block.");
  }
}

function unsignedBigEndian(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function isUnsignedU64(value: unknown): value is bigint {
  return typeof value === "bigint" && value >= 0n && value <= MAX_U64;
}

function drawBoundedFromState(
  state: PreparedChoiceState,
  drawOrdinal: bigint,
  upperExclusive: bigint,
  blockDigest?: CounterBlockDigest,
): ChoiceResult<bigint> {
  const limit = (UINT256_RANGE / upperExclusive) * upperExclusive;
  for (let blockIndex = 0n; blockIndex < MAX_REJECTION_BLOCKS; blockIndex += 1n) {
    const block = digestBlock(state, drawOrdinal, blockIndex, blockDigest);
    if (!block.ok) return block;
    const candidate = unsignedBigEndian(block.value);
    if (candidate < limit) return success(candidate % upperExclusive);
  }
  return failure("/blockIndex", "Deterministic bounded draw exceeded its rejection safety limit.");
}

/**
 * Validates invariant deterministic-choice data once and pre-encodes its canonical chunks.
 *
 * @param input Canonical campaign seed and immutable generation path.
 * @returns An opaque reusable context or deterministic input diagnostics.
 *
 * @example
 * ```ts
 * const context = createDeterministicChoiceContext({ seed, generationPath: [1, 2] });
 * ```
 */
export function createDeterministicChoiceContext(
  input: DeterministicChoiceContextInput,
): ChoiceResult<DeterministicChoiceContext> {
  try {
    const normalized = normalizeChoiceContextInput(input, CONTEXT_KEYS);
    if (!normalized.ok) return normalized;
    const contextValue: DeterministicChoiceContext = {
      [DETERMINISTIC_CHOICE_CONTEXT_BRAND]: true,
    };
    const context = Object.freeze(contextValue);
    CHOICE_CONTEXTS.set(context, normalized.value);
    return success(context);
  } catch {
    return failure("", "Deterministic-choice context could not be inspected safely.");
  }
}

/**
 * Computes one counter block from a reusable validated choice context.
 *
 * @param context Factory-produced deterministic-choice context.
 * @param drawOrdinal Zero-based draw ordinal within the context path.
 * @param blockIndex Zero-based counter block index.
 * @returns The exact 32-byte block or deterministic diagnostics.
 *
 * @example
 * ```ts
 * const block = drawCounterBlockFromContext(context, 0n, 0n);
 * ```
 */
export function drawCounterBlockFromContext(
  context: DeterministicChoiceContext,
  drawOrdinal: bigint,
  blockIndex: bigint,
): ChoiceResult<Uint8Array> {
  const state =
    typeof context === "object" && context !== null ? CHOICE_CONTEXTS.get(context) : undefined;
  if (state === undefined)
    return failure("/context", "Choice context was not produced by factory.");
  if (!isUnsignedU64(drawOrdinal)) {
    return failure("/drawOrdinal", "Draw ordinal must be an unsigned 64-bit integer.");
  }
  if (!isUnsignedU64(blockIndex)) {
    return failure("/blockIndex", "Block index must be an unsigned 64-bit integer.");
  }
  return digestBlock(state, drawOrdinal, blockIndex);
}

/**
 * Draws an unbiased integer from a reusable validated choice context.
 *
 * @param context Factory-produced deterministic-choice context.
 * @param drawOrdinal Zero-based draw ordinal within the context path.
 * @param upperExclusive Exclusive upper bound in the range one through 2^256.
 * @param blockDigest Optional deterministic block source for conformance tests.
 * @returns An integer in `[0, upperExclusive)` or deterministic diagnostics.
 *
 * @example
 * ```ts
 * const draw = drawBoundedIntegerFromContext(context, 0n, 1000n);
 * ```
 */
export function drawBoundedIntegerFromContext(
  context: DeterministicChoiceContext,
  drawOrdinal: bigint,
  upperExclusive: bigint,
  blockDigest?: CounterBlockDigest,
): ChoiceResult<bigint> {
  const state =
    typeof context === "object" && context !== null ? CHOICE_CONTEXTS.get(context) : undefined;
  if (state === undefined)
    return failure("/context", "Choice context was not produced by factory.");
  if (!isUnsignedU64(drawOrdinal)) {
    return failure("/drawOrdinal", "Draw ordinal must be an unsigned 64-bit integer.");
  }
  if (typeof upperExclusive !== "bigint" || upperExclusive < 1n || upperExclusive > UINT256_RANGE) {
    return failure("/upperExclusive", "Exclusive upper bound must be between one and 2^256.");
  }
  if (blockDigest !== undefined && typeof blockDigest !== "function") {
    return failure("/blockIndex", "Counter digest must be callable.");
  }
  return drawBoundedFromState(state, drawOrdinal, upperExclusive, blockDigest);
}

/**
 * Computes one path-local SHA-256 counter block.
 *
 * @param input Seed, generation path, draw ordinal and block index.
 * @returns The exact 32-byte block or deterministic input diagnostics.
 *
 * @example
 * ```ts
 * const block = drawCounterBlock({
 *   seed,
 *   generationPath: [1, 2],
 *   drawOrdinal: 0n,
 *   blockIndex: 0n,
 * });
 * ```
 */
export function drawCounterBlock(input: CounterBlockInput): ChoiceResult<Uint8Array> {
  try {
    const normalized = normalizeChoiceDrawInput(input, COUNTER_KEYS);
    if (!normalized.ok) return normalized;
    const rawBlockIndex = input.blockIndex;
    if (!isUnsignedU64(rawBlockIndex)) {
      return failure("/blockIndex", "Block index must be an unsigned 64-bit integer.");
    }
    return digestBlock(normalized.value.state, normalized.value.drawOrdinal, rawBlockIndex);
  } catch {
    return failure("", "Counter input could not be inspected safely.");
  }
}

/**
 * Draws an unbiased integer by rejecting counter blocks outside a whole-number range.
 *
 * @param input Seed, generation path, draw ordinal and exclusive upper bound.
 * @param blockDigest Optional deterministic block source for conformance tests.
 * @returns An integer in `[0, upperExclusive)` or deterministic diagnostics.
 *
 * @example
 * ```ts
 * const draw = drawBoundedInteger({
 *   seed,
 *   generationPath: [1, 2],
 *   drawOrdinal: 0n,
 *   upperExclusive: 1000n,
 * });
 * ```
 */
export function drawBoundedInteger(
  input: BoundedIntegerInput,
  blockDigest?: CounterBlockDigest,
): ChoiceResult<bigint> {
  try {
    if (blockDigest !== undefined && typeof blockDigest !== "function") {
      return failure("/blockIndex", "Counter digest must be callable.");
    }
    const normalized = normalizeChoiceDrawInput(input, BOUNDED_KEYS);
    if (!normalized.ok) return normalized;
    const rawUpperExclusive = input.upperExclusive;
    if (
      typeof rawUpperExclusive !== "bigint" ||
      rawUpperExclusive < 1n ||
      rawUpperExclusive > UINT256_RANGE
    ) {
      return failure("/upperExclusive", "Exclusive upper bound must be between one and 2^256.");
    }

    return drawBoundedFromState(
      normalized.value.state,
      normalized.value.drawOrdinal,
      rawUpperExclusive,
      blockDigest,
    );
  } catch {
    return failure("", "Bounded-integer input could not be inspected safely.");
  }
}
