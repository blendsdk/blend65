import {
  copyUint8Array,
  hashCanonicalIdentityFields,
  isSha256Digest,
  uint8ArrayByteLength,
  type CanonicalIdentityField,
} from "./canonical-identity.js";
import type { Sha256Digest } from "./model-registry-model.js";

/** One production dependency retained by handler revision metadata. */
export interface ImplementationRevisionFile {
  /** Canonical repository-relative POSIX path for the dependency. */
  readonly path: string;
  /** Exact dependency bytes, normalized to LF in successful results. */
  readonly content: Uint8Array;
}

/** Complete lexical production dependency closure for one handler entrypoint. */
export interface ImplementationRevisionInput {
  /** Handler contract version implemented by this dependency closure. */
  readonly contractVersion: string;
  /** Canonical path of the handler entrypoint within `files`. */
  readonly entryPath: string;
  /** Lexically ordered, duplicate-free complete production dependency closure. */
  readonly files: readonly ImplementationRevisionFile[];
}

/** Stable handler dependency or freshness failure. */
export interface ImplementationRevisionDiagnostic {
  /** Stable machine-readable failure category. */
  readonly code:
    | "implementation.input.invalid"
    | "implementation.dependency.invalid"
    | "implementation.revision.stale";
  /** RFC 6901 pointer to the rejected metadata. */
  readonly path: string;
  /** Stable human-readable explanation of the failure. */
  readonly message: string;
}

const FRESH_IMPLEMENTATION_REVISION_BRAND: unique symbol = Symbol("fresh-implementation-revision");

/**
 * Non-forgeable proof that claimed handler metadata matches its current dependency bytes.
 *
 * The public shape exposes only the revision. Runtime authority additionally requires the
 * module-private capability recorded by successful validation.
 */
export interface FreshImplementationRevision {
  /** Compile-time marker paired with module-private runtime authority. */
  readonly [FRESH_IMPLEMENTATION_REVISION_BRAND]: true;
  /** Canonical digest proven against current dependency bytes. */
  readonly revision: Sha256Digest;
}

/** Successful revision derivation without freshness authority. */
export interface DerivedImplementationRevisionSuccess {
  /** Success discriminator. */
  readonly ok: true;
  /** Canonical digest derived from the normalized dependency closure. */
  readonly revision: Sha256Digest;
  /** LF-normalized defensive dependency snapshots. */
  readonly normalizedFiles: readonly ImplementationRevisionFile[];
  /** Empty diagnostic tuple for the successful branch. */
  readonly diagnostics: readonly [];
}

/** Successful claimed-revision validation carrying runtime freshness authority. */
export interface ValidatedImplementationRevisionSuccess
  extends DerivedImplementationRevisionSuccess, FreshImplementationRevision {}

/** Failed implementation revision derivation or validation. */
export interface ImplementationRevisionFailure {
  /** Failure discriminator. */
  readonly ok: false;
  /** Non-empty deterministic diagnostic list. */
  readonly diagnostics: readonly ImplementationRevisionDiagnostic[];
}

/** Result of deriving dependency metadata without granting freshness authority. */
export type ImplementationRevisionDerivationResult =
  | DerivedImplementationRevisionSuccess
  | ImplementationRevisionFailure;

/** Result of validating a claimed revision against current dependency bytes. */
export type ImplementationRevisionValidationResult =
  | ValidatedImplementationRevisionSuccess
  | ImplementationRevisionFailure;

interface NormalizedImplementationInput {
  readonly contractVersion: string;
  readonly entryPath: string;
  readonly files: readonly ImplementationRevisionFile[];
}

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const INPUT_KEYS = ["contractVersion", "entryPath", "files"] as const;
const FILE_KEYS = ["path", "content"] as const;
const VALIDATION_KEYS = ["claimedRevision", "metadata"] as const;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const MAX_STRING_BYTES = 512;
const MAX_FILES = 4_096;
const MAX_TOTAL_BYTES = 16_777_216;
const TEXT_ENCODER = new TextEncoder();
const FRESH_REVISIONS = new WeakMap<
  object,
  Readonly<{ revision: Sha256Digest; contractVersion: string }>
>();

function diagnostic(
  code: ImplementationRevisionDiagnostic["code"],
  path: string,
  message: string,
): ImplementationRevisionDiagnostic {
  return Object.freeze({ code, path, message });
}

function failure(
  code: ImplementationRevisionDiagnostic["code"],
  path: string,
  message: string,
): ImplementationRevisionFailure {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnostic(code, path, message)]),
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inspectClosedRecord(
  value: unknown,
  keys: readonly string[],
  path: string,
): ImplementationRevisionDiagnostic | undefined {
  if (!isRecord(value)) {
    return diagnostic("implementation.input.invalid", path, "Value must be a plain record.");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return diagnostic("implementation.input.invalid", path, "Record must use a plain prototype.");
  }
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== keys.length ||
    ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
  ) {
    return diagnostic(
      "implementation.input.invalid",
      path,
      "Record must use the exact closed shape.",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      return diagnostic(
        "implementation.input.invalid",
        `${path}/${key}`,
        "Property must be an enumerable own data property.",
      );
    }
  }
  return undefined;
}

function inspectDenseArray(
  value: unknown,
  path: string,
): ImplementationRevisionDiagnostic | undefined {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    return diagnostic("implementation.input.invalid", path, "Files must be a plain array.");
  }
  const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    typeof lengthDescriptor.value !== "number"
  ) {
    return diagnostic(
      "implementation.input.invalid",
      path,
      "Files array length must be an own data property.",
    );
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) {
    return diagnostic(
      "implementation.input.invalid",
      path,
      "Files array must not contain symbol properties.",
    );
  }
  const elementKeys = keys.filter((key) => key !== "length");
  if (
    elementKeys.length !== value.length ||
    elementKeys.some((key, index) => key !== String(index))
  ) {
    return diagnostic(
      "implementation.input.invalid",
      path,
      "Files array must be dense and unadorned.",
    );
  }
  return undefined;
}

function isCanonicalPath(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("\u0000") ||
    TEXT_ENCODER.encode(value).byteLength > MAX_STRING_BYTES
  ) {
    return false;
  }
  const segments = value.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function normalizeNewlines(content: Uint8Array): Uint8Array {
  let normalizedLength = content.byteLength;
  let containsCarriageReturn = false;
  for (let index = 0; index < content.byteLength; index += 1) {
    if (content[index] !== 0x0d) continue;
    containsCarriageReturn = true;
    if (content[index + 1] === 0x0a) {
      normalizedLength -= 1;
      index += 1;
    }
  }
  if (!containsCarriageReturn) return content;

  const normalized = new Uint8Array(normalizedLength);
  let readOffset = 0;
  let writeOffset = 0;
  while (readOffset < content.byteLength) {
    const byte = content[readOffset];
    if (byte === 0x0d) {
      normalized[writeOffset] = 0x0a;
      writeOffset += 1;
      readOffset += content[readOffset + 1] === 0x0a ? 2 : 1;
      continue;
    }
    if (byte !== undefined) {
      normalized[writeOffset] = byte;
      writeOffset += 1;
    }
    readOffset += 1;
  }
  return normalized;
}

function normalizeInput(
  input: unknown,
):
  | { readonly ok: true; readonly input: NormalizedImplementationInput }
  | { readonly ok: false; readonly diagnostic: ImplementationRevisionDiagnostic } {
  try {
    const inputProblem = inspectClosedRecord(input, INPUT_KEYS, "");
    if (inputProblem !== undefined) return { ok: false, diagnostic: inputProblem };
    if (!isRecord(input)) {
      return {
        ok: false,
        diagnostic: diagnostic(
          "implementation.input.invalid",
          "",
          "Implementation metadata must be a record.",
        ),
      };
    }
    if (
      typeof input.contractVersion !== "string" ||
      !VERSION_PATTERN.test(input.contractVersion) ||
      TEXT_ENCODER.encode(input.contractVersion).byteLength > MAX_STRING_BYTES
    ) {
      return {
        ok: false,
        diagnostic: diagnostic(
          "implementation.input.invalid",
          "/contractVersion",
          "Contract version is not canonical.",
        ),
      };
    }
    if (!isCanonicalPath(input.entryPath)) {
      return {
        ok: false,
        diagnostic: diagnostic(
          "implementation.dependency.invalid",
          "/entryPath",
          "Entry path must be a contained canonical repository-relative POSIX path.",
        ),
      };
    }
    const arrayProblem = inspectDenseArray(input.files, "/files");
    if (arrayProblem !== undefined) return { ok: false, diagnostic: arrayProblem };
    if (!Array.isArray(input.files) || input.files.length === 0 || input.files.length > MAX_FILES) {
      return {
        ok: false,
        diagnostic: diagnostic(
          "implementation.dependency.invalid",
          "/files",
          `Dependency closure must contain between one and ${MAX_FILES} files.`,
        ),
      };
    }

    const normalizedFiles: ImplementationRevisionFile[] = [];
    let totalBytes = 0;
    let previousPath: string | undefined;
    let hasEntry = false;
    for (let index = 0; index < input.files.length; index += 1) {
      const value = input.files[index];
      const base = `/files/${index}`;
      const fileProblem = inspectClosedRecord(value, FILE_KEYS, base);
      if (fileProblem !== undefined) return { ok: false, diagnostic: fileProblem };
      if (!isRecord(value) || !isCanonicalPath(value.path)) {
        return {
          ok: false,
          diagnostic: diagnostic(
            "implementation.dependency.invalid",
            `${base}/path`,
            "Dependency path must be a contained canonical repository-relative POSIX path.",
          ),
        };
      }
      if (previousPath !== undefined && value.path <= previousPath) {
        return {
          ok: false,
          diagnostic: diagnostic(
            "implementation.dependency.invalid",
            `${base}/path`,
            value.path === previousPath
              ? "Dependency path occurs more than once."
              : "Dependency paths must be in lexical order.",
          ),
        };
      }
      const contentByteLength = uint8ArrayByteLength(value.content);
      if (contentByteLength === undefined) {
        return {
          ok: false,
          diagnostic: diagnostic(
            "implementation.input.invalid",
            `${base}/content`,
            "Dependency content must be a byte array.",
          ),
        };
      }
      const nextTotalBytes = totalBytes + contentByteLength;
      if (!Number.isSafeInteger(nextTotalBytes) || nextTotalBytes > MAX_TOTAL_BYTES) {
        return {
          ok: false,
          diagnostic: diagnostic(
            "implementation.dependency.invalid",
            base,
            `Dependency bytes exceed ${MAX_TOTAL_BYTES}.`,
          ),
        };
      }
      const copiedContent = copyUint8Array(value.content, contentByteLength);
      if (copiedContent === undefined) {
        return {
          ok: false,
          diagnostic: diagnostic(
            "implementation.input.invalid",
            `${base}/content`,
            "Dependency content could not be copied safely.",
          ),
        };
      }
      totalBytes = nextTotalBytes;
      const normalizedContent = normalizeNewlines(copiedContent);
      normalizedFiles.push(
        Object.freeze({
          path: value.path,
          content: normalizedContent,
        }),
      );
      previousPath = value.path;
      if (value.path === input.entryPath) hasEntry = true;
    }
    if (!hasEntry) {
      return {
        ok: false,
        diagnostic: diagnostic(
          "implementation.dependency.invalid",
          "/entryPath",
          "Entry path must name one dependency closure member.",
        ),
      };
    }
    return {
      ok: true,
      input: Object.freeze({
        contractVersion: input.contractVersion,
        entryPath: input.entryPath,
        files: Object.freeze(normalizedFiles),
      }),
    };
  } catch {
    return {
      ok: false,
      diagnostic: diagnostic(
        "implementation.input.invalid",
        "",
        "Implementation metadata could not be inspected safely.",
      ),
    };
  }
}

function deriveNormalized(
  input: NormalizedImplementationInput,
): DerivedImplementationRevisionSuccess {
  const fields: CanonicalIdentityField[] = [
    { name: "contractVersion", value: input.contractVersion },
    { name: "entryPath", value: input.entryPath },
  ];
  for (const file of input.files) fields.push({ name: file.path, value: file.content });
  const success: DerivedImplementationRevisionSuccess = {
    ok: true,
    revision: hashCanonicalIdentityFields("blend65-handler-implementation-v1", fields),
    normalizedFiles: input.files,
    diagnostics: EMPTY_DIAGNOSTICS,
  };
  return Object.freeze(success);
}

/**
 * Reports whether a value carries successful module-private freshness authority.
 *
 * @param value Candidate freshness result.
 * @returns Whether the exact object came from successful claimed-revision validation.
 *
 * @example
 * ```ts
 * if (isFreshImplementationRevision(result)) register(result);
 * ```
 */
export function isFreshImplementationRevision(
  value: unknown,
): value is FreshImplementationRevision {
  return typeof value === "object" && value !== null && FRESH_REVISIONS.has(value);
}

/**
 * Checks runtime freshness authority against an exact revision and contract version.
 *
 * This internal package seam keeps the validation metadata module-private while allowing the
 * authoritative binding registry to require an exact match.
 *
 * @param value Candidate freshness capability.
 * @param revision Revision claimed by the executable binding.
 * @param contractVersion Contract version claimed by the executable binding.
 * @returns Whether the capability was validated for both exact claims.
 *
 * @example
 * ```ts
 * matchesFreshImplementationRevision(freshness, bindingRevision, contractVersion);
 * ```
 */
export function matchesFreshImplementationRevision(
  value: unknown,
  revision: Sha256Digest,
  contractVersion: string,
): value is FreshImplementationRevision {
  if (typeof value !== "object" || value === null) return false;
  const metadata = FRESH_REVISIONS.get(value);
  return metadata?.revision === revision && metadata.contractVersion === contractVersion;
}

/**
 * Derives a handler revision from its normalized lexical dependency closure.
 *
 * @param input Contract, entrypoint and complete ordered production dependency bytes.
 * @returns The derived revision and LF-normalized defensive file snapshots.
 *
 * @example
 * ```ts
 * const derived = deriveImplementationRevision({ contractVersion: "1", entryPath, files });
 * ```
 */
export function deriveImplementationRevision(
  input: ImplementationRevisionInput,
): ImplementationRevisionDerivationResult {
  const normalized = normalizeInput(input);
  if (!normalized.ok) {
    return Object.freeze({
      ok: false,
      diagnostics: Object.freeze([normalized.diagnostic]),
    });
  }
  return deriveNormalized(normalized.input);
}

/**
 * Validates a claimed handler revision against freshly normalized dependency bytes.
 *
 * @param input Claimed revision and current dependency metadata.
 * @returns A non-forgeable freshness capability on exact equality, or stable diagnostics.
 *
 * @example
 * ```ts
 * const fresh = validateImplementationRevision({ claimedRevision, metadata });
 * ```
 */
export function validateImplementationRevision(input: {
  readonly claimedRevision: Sha256Digest;
  readonly metadata: ImplementationRevisionInput;
}): ImplementationRevisionValidationResult {
  try {
    const validationProblem = inspectClosedRecord(input, VALIDATION_KEYS, "");
    if (validationProblem !== undefined) {
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([validationProblem]),
      });
    }
    if (!isRecord(input) || !isSha256Digest(input.claimedRevision)) {
      return failure(
        "implementation.input.invalid",
        "/claimedRevision",
        "Claimed revision must be a canonical SHA-256 digest.",
      );
    }
    const normalized = normalizeInput(input.metadata);
    if (!normalized.ok) {
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([normalized.diagnostic]),
      });
    }
    const derived = deriveNormalized(normalized.input);
    if (derived.revision !== input.claimedRevision) {
      return failure(
        "implementation.revision.stale",
        "/claimedRevision",
        "Claimed implementation revision does not match current dependency bytes.",
      );
    }
    const freshValue: ValidatedImplementationRevisionSuccess = {
      ok: true,
      [FRESH_IMPLEMENTATION_REVISION_BRAND]: true,
      revision: derived.revision,
      normalizedFiles: derived.normalizedFiles,
      diagnostics: EMPTY_DIAGNOSTICS,
    };
    const fresh = Object.freeze(freshValue);
    FRESH_REVISIONS.set(
      fresh,
      Object.freeze({
        revision: derived.revision,
        contractVersion: normalized.input.contractVersion,
      }),
    );
    return fresh;
  } catch {
    return failure(
      "implementation.input.invalid",
      "",
      "Implementation freshness input could not be inspected safely.",
    );
  }
}
