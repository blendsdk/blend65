import { createHash } from "node:crypto";

import type { GenerationBudget } from "./generator-ir.js";
import { inspectGeneratorInput } from "./generator-ir-validator.js";
import { validateGenerationBudget } from "./generation-budget.js";
import type { Sha256Digest } from "./model-registry-model.js";

/** Domain separators used by every version-one readiness identity. */
export type CanonicalIdentityDomain =
  | "blend65-configuration-v1"
  | "blend65-campaign-v1"
  | "blend65-counter-draw-v1"
  | "blend65-case-v1"
  | "blend65-handler-implementation-v1";

/** One fixed-order name/value pair in a canonical identity preimage. */
export interface CanonicalIdentityField {
  /** Stable semantic field name encoded before the value. */
  readonly name: string;
  /** UTF-8 text or exact binary content encoded as the field value. */
  readonly value: string | Uint8Array;
}

/** Source spelling families retained by a generation configuration. */
export type GenerationSpelling = "literal" | "const" | "local" | "parameter";

/** Complete generation configuration whose canonical bytes are replayed verbatim. */
export interface GenerationConfiguration {
  /** Number of valid cases requested for the campaign. */
  readonly caseCount: number;
  /** Maximum number of deliberately invalid cases admitted by the campaign. */
  readonly maxInvalidCases: number;
  /** Lexically ordered, duplicate-free rule identifiers enabled for generation. */
  readonly enabledRuleIds: readonly string[];
  /** Lexically ordered, duplicate-free source spelling families available to generators. */
  readonly spellings: readonly GenerationSpelling[];
  /** Structural and loop-work ceilings applied to every generated case. */
  readonly budget: GenerationBudget;
}

/** Stable structural validation failure for canonical identity data. */
export interface CanonicalInputProblem {
  /** RFC 6901 pointer to the rejected value. */
  readonly path: string;
  /** Stable human-readable explanation of the validation failure. */
  readonly message: string;
}

/** Successful immutable normalization of a generation configuration. */
export interface NormalizedGenerationConfiguration {
  /** Success discriminator. */
  readonly ok: true;
  /** Closed, deeply immutable configuration value. */
  readonly configuration: GenerationConfiguration;
}

/** Failed generation-configuration normalization. */
export interface InvalidGenerationConfiguration {
  /** Failure discriminator. */
  readonly ok: false;
  /** First deterministic structural problem. */
  readonly problem: CanonicalInputProblem;
}

/** Result of closing unknown data into a generation configuration. */
export type GenerationConfigurationNormalization =
  | NormalizedGenerationConfiguration
  | InvalidGenerationConfiguration;

const TEXT_ENCODER = new TextEncoder();
const MAX_U32 = 0xffff_ffff;
const MAX_RULE_IDS = 4_096;
const MAX_SPELLINGS = 32;
const MAX_STRING_BYTES = 512;
const CONFIGURATION_KEYS = [
  "caseCount",
  "maxInvalidCases",
  "enabledRuleIds",
  "spellings",
  "budget",
] as const;
const SPELLINGS: ReadonlySet<string> = new Set(["literal", "const", "local", "parameter"]);
const RULE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/u;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const BYTE_LENGTH_GETTER = Reflect.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)?.get;

function problem(path: string, message: string): CanonicalInputProblem {
  return Object.freeze({ path, message });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return isNonNegativeSafeInteger(value) && value > 0;
}

function isGenerationSpelling(value: unknown): value is GenerationSpelling {
  return typeof value === "string" && SPELLINGS.has(value);
}

function isBoundedString(value: unknown): value is string {
  return typeof value === "string" && TEXT_ENCODER.encode(value).byteLength <= MAX_STRING_BYTES;
}

function isLexicalUnique(values: readonly string[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous === undefined || current === undefined || previous >= current) return false;
  }
  return true;
}

function u32Bytes(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_U32) {
    throw new RangeError("Canonical byte length exceeds the unsigned 32-bit range.");
  }
  return Uint8Array.of(
    Math.floor(value / 0x100_0000),
    Math.floor(value / 0x1_0000) & 0xff,
    Math.floor(value / 0x100) & 0xff,
    value & 0xff,
  );
}

/**
 * Reads a typed array's intrinsic byte length without consulting overridable properties.
 *
 * @param value Candidate byte array.
 * @returns The intrinsic non-negative byte length, or `undefined` for invalid/exotic values.
 *
 * @example
 * ```ts
 * const length = uint8ArrayByteLength(new Uint8Array(32));
 * ```
 */
export function uint8ArrayByteLength(value: unknown): number | undefined {
  if (!(value instanceof Uint8Array) || BYTE_LENGTH_GETTER === undefined) return undefined;
  try {
    const byteLength: unknown = BYTE_LENGTH_GETTER.call(value);
    return typeof byteLength === "number" && Number.isSafeInteger(byteLength) && byteLength >= 0
      ? byteLength
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Copies an exact typed-array input without trusting iterators or proxy property access.
 *
 * @param value Candidate byte array.
 * @param length Required byte length, when fixed by the caller.
 * @returns An isolated byte copy, or `undefined` for an invalid/exotic value.
 *
 * @example
 * ```ts
 * const digestBytes = copyUint8Array(new Uint8Array(32), 32);
 * ```
 */
export function copyUint8Array(value: unknown, length?: number): Uint8Array | undefined {
  try {
    const byteLength = uint8ArrayByteLength(value);
    if (byteLength === undefined || (length !== undefined && byteLength !== length)) {
      return undefined;
    }
    return Uint8Array.prototype.slice.call(value);
  } catch {
    return undefined;
  }
}

function lengthPrefixedChunks(value: Uint8Array): readonly Uint8Array[] {
  return Object.freeze([u32Bytes(value.byteLength), value]);
}

/**
 * Encodes the invariant domain and field-count prefix of a canonical identity.
 *
 * @param domain Versioned domain separator.
 * @param fieldCount Exact number of semantic fields that follow.
 * @returns Immutable ordered header chunks suitable for streaming.
 *
 * @example
 * ```ts
 * const header = canonicalIdentityHeaderChunks("blend65-counter-draw-v1", 4);
 * ```
 */
export function canonicalIdentityHeaderChunks(
  domain: CanonicalIdentityDomain,
  fieldCount: number,
): readonly Uint8Array[] {
  return Object.freeze([
    ...lengthPrefixedChunks(TEXT_ENCODER.encode(domain)),
    u32Bytes(fieldCount),
  ]);
}

/**
 * Encodes one canonical field as ordered length and payload chunks.
 *
 * @param field Semantic field name and value.
 * @returns Immutable ordered chunks suitable for streaming.
 *
 * @example
 * ```ts
 * const chunks = canonicalIdentityFieldChunks({ name: "ordinal", value: "0" });
 * ```
 */
export function canonicalIdentityFieldChunks(field: CanonicalIdentityField): readonly Uint8Array[] {
  const value = typeof field.value === "string" ? TEXT_ENCODER.encode(field.value) : field.value;
  return Object.freeze([
    ...lengthPrefixedChunks(TEXT_ENCODER.encode(field.name)),
    ...lengthPrefixedChunks(value),
  ]);
}

/**
 * Visits canonical identity chunks without materializing a joined preimage.
 *
 * The visitor is synchronous, so callers may stream each chunk directly into a digest while the
 * input remains in scope.
 *
 * @param domain Versioned domain separator.
 * @param fields Closed fields in semantic order.
 * @param visit Consumer invoked once for every length or payload chunk.
 *
 * @example
 * ```ts
 * visitCanonicalIdentityChunks("blend65-case-v1", fields, (chunk) => hash.update(chunk));
 * ```
 */
export function visitCanonicalIdentityChunks(
  domain: CanonicalIdentityDomain,
  fields: readonly CanonicalIdentityField[],
  visit: (chunk: Uint8Array) => void,
): void {
  for (const chunk of canonicalIdentityHeaderChunks(domain, fields.length)) visit(chunk);
  for (const field of fields) {
    for (const chunk of canonicalIdentityFieldChunks(field)) visit(chunk);
  }
}

/**
 * Encodes a fixed-order canonical identity preimage using unsigned u32-BE lengths.
 *
 * @param domain Versioned domain separator.
 * @param fields Closed fields in their semantic order.
 * @returns Newly allocated canonical bytes.
 *
 * @example
 * ```ts
 * const bytes = encodeCanonicalIdentity("blend65-case-v1", [
 *   { name: "ordinal", value: "0" },
 * ]);
 * ```
 */
export function encodeCanonicalIdentity(
  domain: CanonicalIdentityDomain,
  fields: readonly CanonicalIdentityField[],
): Uint8Array {
  const parts: Uint8Array[] = [];
  visitCanonicalIdentityChunks(domain, fields, (part) => parts.push(part));

  const totalLength = parts.reduce((total, part) => total + part.byteLength, 0);
  if (!Number.isSafeInteger(totalLength)) {
    throw new RangeError("Canonical identity preimage exceeds the safe allocation range.");
  }
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

/**
 * Computes the canonical lowercase SHA-256 digest spelling for preimage bytes.
 *
 * @param preimage Canonical identity preimage.
 * @returns A `sha256:`-prefixed lowercase digest.
 *
 * @example
 * ```ts
 * const digest = hashCanonicalIdentity(new Uint8Array());
 * ```
 */
export function hashCanonicalIdentity(preimage: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(preimage).digest("hex")}`;
}

/**
 * Hashes canonical fields by streaming their chunks directly into SHA-256.
 *
 * @param domain Versioned domain separator.
 * @param fields Closed fields in semantic order.
 * @returns A `sha256:`-prefixed lowercase digest.
 *
 * @example
 * ```ts
 * const digest = hashCanonicalIdentityFields("blend65-case-v1", fields);
 * ```
 */
export function hashCanonicalIdentityFields(
  domain: CanonicalIdentityDomain,
  fields: readonly CanonicalIdentityField[],
): Sha256Digest {
  const hash = createHash("sha256");
  visitCanonicalIdentityChunks(domain, fields, (chunk) => hash.update(chunk));
  return `sha256:${hash.digest("hex")}`;
}

/**
 * Reports whether a value is a canonical SHA-256 digest.
 *
 * @param value Candidate digest.
 * @returns Whether the value uses the exact version-one digest spelling.
 *
 * @example
 * ```ts
 * isSha256Digest(`sha256:${"0".repeat(64)}`);
 * ```
 */
export function isSha256Digest(value: unknown): value is Sha256Digest {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

/**
 * Encodes an unsigned integer without leading zeroes.
 *
 * @param value Validated unsigned number or bigint.
 * @returns Canonical base-ten digits.
 *
 * @example
 * ```ts
 * canonicalUnsignedDecimal(42n);
 * ```
 */
export function canonicalUnsignedDecimal(value: number | bigint): string {
  return value.toString(10);
}

/**
 * Validates and dot-encodes a bounded generation path.
 *
 * @param value Candidate path.
 * @param rootPath Diagnostic root for invalid components.
 * @param maxComponents Maximum accepted component count.
 * @returns An immutable path plus its canonical spelling, or a stable problem.
 *
 * @example
 * ```ts
 * const path = normalizeGenerationPath([1, 2], "/generationPath", 64);
 * ```
 */
export function normalizeGenerationPath(
  value: unknown,
  rootPath: string,
  maxComponents: number,
):
  | { readonly ok: true; readonly path: readonly number[]; readonly encoded: string }
  | { readonly ok: false; readonly problem: CanonicalInputProblem } {
  if (!Array.isArray(value)) {
    return { ok: false, problem: problem(rootPath, "Generation path must be an array.") };
  }
  if (value.length > maxComponents) {
    return {
      ok: false,
      problem: problem(rootPath, `Generation path exceeds ${maxComponents} components.`),
    };
  }
  const normalized: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const component = value[index];
    if (!isNonNegativeSafeInteger(component) || component > MAX_U32) {
      return {
        ok: false,
        problem: problem(
          `${rootPath}/${index}`,
          "Generation path component must be an unsigned 32-bit integer.",
        ),
      };
    }
    normalized.push(component);
  }
  const path = Object.freeze(normalized);
  return Object.freeze({ ok: true, path, encoded: path.join(".") });
}

/**
 * Closes unknown programmatic data into the canonical generation configuration.
 *
 * @param input Candidate configuration.
 * @param rootPath Diagnostic root assigned by the caller.
 * @returns A defensive immutable snapshot or one stable structural failure.
 *
 * @example
 * ```ts
 * const normalized = normalizeGenerationConfiguration(input, "/configuration");
 * ```
 */
export function normalizeGenerationConfiguration(
  input: unknown,
  rootPath = "/configuration",
): GenerationConfigurationNormalization {
  try {
    const structuralFailure = inspectGeneratorInput(input, rootPath, () => false);
    if (structuralFailure !== undefined) {
      return { ok: false, problem: problem(structuralFailure.path, structuralFailure.message) };
    }
    if (!isRecord(input) || !hasExactKeys(input, CONFIGURATION_KEYS)) {
      return {
        ok: false,
        problem: problem(rootPath, "Generation configuration must use the exact closed shape."),
      };
    }
    if (!isPositiveSafeInteger(input.caseCount)) {
      return {
        ok: false,
        problem: problem(`${rootPath}/caseCount`, "Case count must be a positive safe integer."),
      };
    }
    if (
      !isNonNegativeSafeInteger(input.maxInvalidCases) ||
      input.maxInvalidCases > input.caseCount
    ) {
      return {
        ok: false,
        problem: problem(
          `${rootPath}/maxInvalidCases`,
          "Maximum invalid cases must be between zero and the case count.",
        ),
      };
    }
    if (!Array.isArray(input.enabledRuleIds) || input.enabledRuleIds.length > MAX_RULE_IDS) {
      return {
        ok: false,
        problem: problem(
          `${rootPath}/enabledRuleIds`,
          `Enabled rule IDs must contain at most ${MAX_RULE_IDS} entries.`,
        ),
      };
    }
    const enabledRuleIds: string[] = [];
    for (let index = 0; index < input.enabledRuleIds.length; index += 1) {
      const ruleId = input.enabledRuleIds[index];
      if (!isBoundedString(ruleId) || !RULE_ID_PATTERN.test(ruleId)) {
        return {
          ok: false,
          problem: problem(
            `${rootPath}/enabledRuleIds/${index}`,
            "Enabled rule ID is not canonical.",
          ),
        };
      }
      enabledRuleIds.push(ruleId);
    }
    if (!isLexicalUnique(enabledRuleIds)) {
      return {
        ok: false,
        problem: problem(
          `${rootPath}/enabledRuleIds`,
          "Enabled rule IDs must be unique and in lexical order.",
        ),
      };
    }
    if (!Array.isArray(input.spellings) || input.spellings.length > MAX_SPELLINGS) {
      return {
        ok: false,
        problem: problem(
          `${rootPath}/spellings`,
          `Spellings must contain at most ${MAX_SPELLINGS} entries.`,
        ),
      };
    }
    const spellings: GenerationSpelling[] = [];
    for (let index = 0; index < input.spellings.length; index += 1) {
      const spelling = input.spellings[index];
      if (!isGenerationSpelling(spelling)) {
        return {
          ok: false,
          problem: problem(`${rootPath}/spellings/${index}`, "Spelling is not supported."),
        };
      }
      spellings.push(spelling);
    }
    if (!isLexicalUnique(spellings)) {
      return {
        ok: false,
        problem: problem(`${rootPath}/spellings`, "Spellings must be unique and in lexical order."),
      };
    }

    const budgetResult = validateGenerationBudget(input.budget);
    if (!budgetResult.ok) {
      const first = budgetResult.diagnostics[0];
      return {
        ok: false,
        problem:
          first === undefined
            ? problem(`${rootPath}/budget`, "Generation budget is invalid.")
            : problem(`${rootPath}${first.path}`, first.message),
      };
    }
    const configuration: GenerationConfiguration = Object.freeze({
      caseCount: input.caseCount,
      maxInvalidCases: input.maxInvalidCases,
      enabledRuleIds: Object.freeze(enabledRuleIds),
      spellings: Object.freeze(spellings),
      budget: budgetResult.budget,
    });
    return Object.freeze({ ok: true, configuration });
  } catch {
    return {
      ok: false,
      problem: problem(rootPath, "Generation configuration could not be inspected safely."),
    };
  }
}

/**
 * Produces the fixed canonical field sequence for a validated generation configuration.
 *
 * @param configuration Immutable validated configuration.
 * @returns Fixed-order version-one identity fields.
 *
 * @example
 * ```ts
 * const fields = generationConfigurationFields(configuration);
 * ```
 */
export function generationConfigurationFields(
  configuration: GenerationConfiguration,
): readonly CanonicalIdentityField[] {
  return Object.freeze([
    Object.freeze({
      name: "caseCount",
      value: canonicalUnsignedDecimal(configuration.caseCount),
    }),
    Object.freeze({
      name: "maxInvalidCases",
      value: canonicalUnsignedDecimal(configuration.maxInvalidCases),
    }),
    Object.freeze({ name: "enabledRuleIds", value: configuration.enabledRuleIds.join("\n") }),
    Object.freeze({ name: "spellings", value: configuration.spellings.join("\n") }),
    Object.freeze({
      name: "budget.maxModules",
      value: canonicalUnsignedDecimal(configuration.budget.maxModules),
    }),
    Object.freeze({
      name: "budget.maxDeclarations",
      value: canonicalUnsignedDecimal(configuration.budget.maxDeclarations),
    }),
    Object.freeze({
      name: "budget.maxIrNodes",
      value: canonicalUnsignedDecimal(configuration.budget.maxIrNodes),
    }),
    Object.freeze({
      name: "budget.maxStatements",
      value: canonicalUnsignedDecimal(configuration.budget.maxStatements),
    }),
    Object.freeze({
      name: "budget.maxExpressionDepth",
      value: canonicalUnsignedDecimal(configuration.budget.maxExpressionDepth),
    }),
    Object.freeze({
      name: "budget.maxLoopWork",
      value: canonicalUnsignedDecimal(configuration.budget.maxLoopWork),
    }),
    Object.freeze({
      name: "budget.maxSourceBytes",
      value: canonicalUnsignedDecimal(configuration.budget.maxSourceBytes),
    }),
    Object.freeze({
      name: "budget.maxAttempts",
      value: canonicalUnsignedDecimal(configuration.budget.maxAttempts),
    }),
  ]);
}
