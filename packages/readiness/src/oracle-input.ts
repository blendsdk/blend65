import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import { copyUint8Array, uint8ArrayByteLength } from "./canonical-identity.js";
import type { Sha256Digest } from "./model-registry-model.js";
import {
  ORACLE_V1_LIMITS,
  type OracleDiagnostic,
  type OracleDiagnosticCode,
} from "./oracle-model.js";
import { parseStrictJson } from "./strict-json.js";

/** Successful immutable snapshot of an untrusted plain-data value. */
export interface OracleSnapshotSuccess {
  /** Success discriminator. */
  readonly ok: true;
  /** Deeply immutable copy containing only accepted plain data. */
  readonly value: unknown;
  /** Aggregate value count charged while copying. */
  readonly nodes: number;
  /** Aggregate UTF-8 bytes charged for keys, strings and canonical decimal BigInts. */
  readonly bytes: number;
  /** Greatest observed container nesting depth. */
  readonly depth: number;
}

/** Closed result of defensively snapshotting one hostile value. */
export type OracleSnapshotResult =
  | OracleSnapshotSuccess
  | { readonly ok: false; readonly diagnostics: readonly OracleDiagnostic[] };

/** Closed single-diagnostic oracle failure used by all public entry points. */
export type OracleFailure = {
  readonly ok: false;
  readonly diagnostics: readonly OracleDiagnostic[];
};

/** Successful bounded parsing of one strict authority JSON artifact. */
export interface OracleAuthorityJsonSuccess {
  /** Success discriminator. */
  readonly ok: true;
  /** Parsed strict JSON data. */
  readonly value: unknown;
  /** Digest of the exact supplied bytes. */
  readonly digest: Sha256Digest;
}

interface SnapshotBudget {
  nodes: number;
  bytes: number;
  depth: number;
}

const MAX_MESSAGE_LENGTH = 256;
const BIGINT_MAGNITUDE_LIMIT = 10n ** BigInt(ORACLE_V1_LIMITS.bigintDecimalDigits);

function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function childPath(path: string, key: string): string {
  return `${path}/${escapePointerSegment(key)}`;
}

function isCanonicalArrayIndex(key: string, length: number): boolean {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

/**
 * Creates one immutable bounded diagnostic.
 *
 * @param code Stable machine-readable failure category.
 * @param path RFC 6901 pointer to the rejected value.
 * @param message Non-sensitive explanation, truncated to the public bound.
 * @returns An immutable diagnostic.
 *
 * @example
 * ```ts
 * const problem = oracleDiagnostic("oracle.input.invalid", "/ruleId", "Invalid rule.");
 * ```
 */
export function oracleDiagnostic(
  code: OracleDiagnosticCode,
  path: string,
  message: string,
): OracleDiagnostic {
  return Object.freeze({
    code,
    path,
    message: message.slice(0, MAX_MESSAGE_LENGTH),
  });
}

/**
 * Creates one closed oracle failure.
 *
 * @param code Stable machine-readable failure category.
 * @param path RFC 6901 pointer to the rejected value.
 * @param message Non-sensitive bounded explanation.
 * @returns An immutable failure result.
 *
 * @example
 * ```ts
 * return oracleFailure("oracle.input.invalid", "", "Input must be a closed record.");
 * ```
 */
export function oracleFailure(
  code: OracleDiagnosticCode,
  path: string,
  message: string,
): OracleFailure {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([oracleDiagnostic(code, path, message)]),
  });
}

/**
 * Determines whether a value is a non-array object after it has been safely inspected.
 *
 * @param value Candidate plain record.
 * @returns Whether the candidate is a non-null, non-array object.
 */
export function isOracleRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks a snapshot record for an exact closed field set.
 *
 * @param value Immutable snapshot record.
 * @param keys Permitted own field names.
 * @returns Whether every and only permitted key occurs once.
 */
export function hasExactOracleKeys(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean {
  const actual = Reflect.ownKeys(value);
  return (
    actual.length === keys.length &&
    actual.every((key) => typeof key === "string" && keys.includes(key))
  );
}

function chargeSnapshotBytes(
  budget: SnapshotBudget,
  path: string,
  byteCount: number,
): OracleFailure | undefined {
  const nextBytes = budget.bytes + byteCount;
  if (!Number.isSafeInteger(nextBytes) || nextBytes > ORACLE_V1_LIMITS.inputBytes) {
    return oracleFailure(
      "oracle.input.limit",
      path,
      `Input exceeds ${ORACLE_V1_LIMITS.inputBytes} aggregate UTF-8 bytes.`,
    );
  }
  budget.bytes = nextBytes;
  return undefined;
}

function snapshotValue(
  value: unknown,
  path: string,
  depth: number,
  ancestors: WeakSet<object>,
  budget: SnapshotBudget,
): unknown | OracleFailure {
  budget.nodes += 1;
  budget.depth = Math.max(budget.depth, depth);
  if (budget.nodes > ORACLE_V1_LIMITS.inputNodes) {
    return oracleFailure(
      "oracle.input.limit",
      path,
      `Input exceeds ${ORACLE_V1_LIMITS.inputNodes} aggregate nodes.`,
    );
  }
  if (depth > ORACLE_V1_LIMITS.inputDepth) {
    return oracleFailure(
      "oracle.input.limit",
      path,
      `Input exceeds ${ORACLE_V1_LIMITS.inputDepth} container levels.`,
    );
  }

  if (typeof value === "string") {
    const exhausted = chargeSnapshotBytes(budget, path, Buffer.byteLength(value, "utf8"));
    return exhausted ?? value;
  }
  if (typeof value === "bigint") {
    if (value >= BIGINT_MAGNITUDE_LIMIT || value <= -BIGINT_MAGNITUDE_LIMIT) {
      return oracleFailure(
        "oracle.input.limit",
        path,
        `BigInt exceeds ${ORACLE_V1_LIMITS.bigintDecimalDigits} canonical decimal digits.`,
      );
    }
    const canonical = value.toString(10);
    return chargeSnapshotBytes(budget, path, Buffer.byteLength(canonical, "utf8")) ?? value;
  }
  if (value === null || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : oracleFailure("oracle.input.invalid", path, "Numbers must be finite.");
  }
  if (typeof value !== "object") {
    return oracleFailure("oracle.input.invalid", path, "Input contains a non-data value.");
  }
  if (ancestors.has(value)) {
    return oracleFailure("oracle.input.invalid", path, "Input must be an acyclic data tree.");
  }

  ancestors.add(value);
  try {
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (
      (array && prototype !== Array.prototype) ||
      (!array && prototype !== Object.prototype && prototype !== null)
    ) {
      return oracleFailure(
        "oracle.input.invalid",
        path,
        "Input records and arrays must use plain prototypes.",
      );
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== "string")) {
      return oracleFailure("oracle.input.invalid", path, "Input must not contain symbol fields.");
    }
    const keys = ownKeys.filter((key): key is string => typeof key === "string");

    if (array) {
      const lengthDescriptor = descriptors.length;
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        typeof lengthDescriptor.value !== "number"
      ) {
        return oracleFailure("oracle.input.invalid", path, "Array length must be plain data.");
      }
      const elementKeys = keys.filter((key) => key !== "length");
      if (
        elementKeys.length !== lengthDescriptor.value ||
        elementKeys.some((key) => !isCanonicalArrayIndex(key, lengthDescriptor.value))
      ) {
        return oracleFailure(
          "oracle.input.invalid",
          path,
          "Arrays must be dense and contain no extra fields.",
        );
      }
      const output: unknown[] = [];
      for (let index = 0; index < lengthDescriptor.value; index += 1) {
        const key = String(index);
        const descriptor = descriptors[key];
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          return oracleFailure(
            "oracle.input.invalid",
            childPath(path, key),
            "Array elements must be enumerable own data.",
          );
        }
        const child = snapshotValue(
          descriptor.value,
          childPath(path, key),
          depth + 1,
          ancestors,
          budget,
        );
        if (isOracleFailure(child)) return child;
        output.push(child);
      }
      return Object.freeze(output);
    }

    const output: Record<string, unknown> = {};
    for (const key of keys) {
      const keyBytes = Buffer.byteLength(key, "utf8");
      if (keyBytes > ORACLE_V1_LIMITS.identifierBytes) {
        return oracleFailure("oracle.input.invalid", path, "Input field name is too long.");
      }
      const keyBudget = chargeSnapshotBytes(budget, path, keyBytes);
      if (keyBudget !== undefined) return keyBudget;
      const descriptor = descriptors[key];
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return oracleFailure(
          "oracle.input.invalid",
          childPath(path, key),
          "Properties must be enumerable own data.",
        );
      }
      const child = snapshotValue(
        descriptor.value,
        childPath(path, key),
        depth + 1,
        ancestors,
        budget,
      );
      if (isOracleFailure(child)) return child;
      output[key] = child;
    }
    return Object.freeze(output);
  } catch {
    return oracleFailure(
      "oracle.input.invalid",
      path,
      "Input structure could not be inspected safely.",
    );
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Copies an unknown plain-data tree without invoking accessors.
 *
 * Cycles, exotic prototypes, functions, symbols, sparse arrays and unknown host values fail
 * before a consumer reads any nested member.
 *
 * @param value Hostile value to snapshot.
 * @param rootPath JSON pointer assigned to the root.
 * @returns A deeply immutable snapshot and its measured size, or a closed failure.
 *
 * @example
 * ```ts
 * const snapshot = snapshotOracleInput({ schemaVersion: 1 });
 * ```
 */
export function snapshotOracleInput(value: unknown, rootPath = ""): OracleSnapshotResult {
  const budget: SnapshotBudget = { nodes: 0, bytes: 0, depth: 0 };
  const snapshot = snapshotValue(value, rootPath, 0, new WeakSet(), budget);
  return isOracleFailure(snapshot)
    ? snapshot
    : Object.freeze({
        ok: true,
        value: snapshot,
        nodes: budget.nodes,
        bytes: budget.bytes,
        depth: budget.depth,
      });
}

/**
 * Copies a raw byte array after enforcing the authority byte limit.
 *
 * @param value Hostile byte-array candidate.
 * @param path JSON pointer assigned to the artifact.
 * @returns Immutable-by-ownership copied bytes, or a closed failure.
 */
export function snapshotOracleBytes(
  value: unknown,
  path: string,
): { readonly ok: true; readonly bytes: Uint8Array } | OracleFailure {
  const length = uint8ArrayByteLength(value);
  if (length === undefined) {
    return oracleFailure("oracle.input.invalid", path, "Authority artifact must be a byte array.");
  }
  if (length > ORACLE_V1_LIMITS.authorityBytes) {
    return oracleFailure(
      "oracle.input.limit",
      path,
      `Authority artifact exceeds ${ORACLE_V1_LIMITS.authorityBytes} bytes.`,
    );
  }
  const bytes = copyUint8Array(value, length);
  return bytes === undefined
    ? oracleFailure("oracle.input.invalid", path, "Authority artifact could not be copied safely.")
    : Object.freeze({ ok: true, bytes });
}

/**
 * Parses one bounded strict authority artifact and digests its exact bytes.
 *
 * @param value Hostile byte-array candidate.
 * @param path JSON pointer assigned to the authority member.
 * @returns Parsed JSON and exact digest, or a closed input failure.
 */
export function parseOracleAuthorityJson(
  value: unknown,
  path: string,
): OracleAuthorityJsonSuccess | OracleFailure {
  const copied = snapshotOracleBytes(value, path);
  if (!copied.ok) return copied;
  const parsed = parseStrictJson(copied.bytes);
  if (!parsed.ok) {
    return oracleFailure(
      parsed.problem.message.includes("limit") ? "oracle.input.limit" : "oracle.input.invalid",
      `${path}${parsed.problem.path}`,
      parsed.problem.message,
    );
  }
  const digest: Sha256Digest = `sha256:${createHash("sha256").update(copied.bytes).digest("hex")}`;
  return Object.freeze({
    ok: true,
    value: parsed.value,
    digest,
  });
}

/**
 * Reports whether an internal value is already a closed oracle failure.
 *
 * @param value Internal snapshot or failure candidate.
 * @returns Whether the value is the failure branch.
 */
export function isOracleFailure(value: unknown): value is OracleFailure {
  if (!isOracleRecord(value)) return false;
  const okDescriptor = Reflect.getOwnPropertyDescriptor(value, "ok");
  const diagnosticsDescriptor = Reflect.getOwnPropertyDescriptor(value, "diagnostics");
  return (
    okDescriptor !== undefined &&
    "value" in okDescriptor &&
    okDescriptor.value === false &&
    diagnosticsDescriptor !== undefined &&
    "value" in diagnosticsDescriptor &&
    Array.isArray(diagnosticsDescriptor.value)
  );
}
