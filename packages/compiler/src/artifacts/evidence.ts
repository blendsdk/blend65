import { createHash } from "node:crypto";
import { assetsEvidenceValue } from "./assets-evidence-validator.js";
import { buildEvidenceValue } from "./build-evidence-validator.js";
import { costsEvidenceValue } from "./costs-evidence-validator.js";
import { debugEvidenceValue } from "./debug-evidence-validator.js";
import type {
  AssetsEvidence,
  BuildEvidence,
  CostsEvidence,
  DebugEvidence,
  EvidenceValue,
  MemoryEvidence,
} from "./evidence-types.js";
import { canonicalEvidenceJson, isEvidenceRecord } from "./evidence-validation.js";
import { memoryEvidenceValue } from "./memory-evidence-validator.js";

/** Canonical encoding success or one closed evidence failure category. */
export type EvidenceEncodingResult =
  | { readonly kind: "complete"; readonly bytes: Uint8Array; readonly sha256: string }
  | {
      readonly kind: "error";
      readonly reason: "malformed" | "unsupported-version" | "inconsistent";
      readonly diagnostic: string;
    };

/** Typed validation success or one closed evidence failure category. */
export type EvidenceValidationResult<T> =
  | { readonly kind: "complete"; readonly value: T }
  | {
      readonly kind: "error";
      readonly reason: "malformed" | "unsupported-version" | "inconsistent";
      readonly diagnostic: string;
    };

type EvidenceReason = Extract<EvidenceEncodingResult, { readonly kind: "error" }>["reason"];

/** Return an immutable encoding failure. */
function encodingFailure(reason: EvidenceReason, diagnostic: string): EvidenceEncodingResult {
  return Object.freeze({ kind: "error", reason, diagnostic });
}

/** Return an immutable typed validation failure. */
function validationFailure<T>(
  reason: EvidenceReason,
  diagnostic: string,
): EvidenceValidationResult<T> {
  return Object.freeze({ kind: "error", reason, diagnostic });
}

/** Return whether a value is finite JSON with no null, undefined, or fractional number. */
function jsonValue(value: unknown): value is EvidenceValue {
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isSafeInteger(value);
  if (Array.isArray(value)) return value.every(jsonValue);
  return isEvidenceRecord(value) && Object.values(value).every(jsonValue);
}

/** Encode one already type-guarded evidence record and self-check its canonical bytes. */
function encode<T>(
  name: string,
  value: T,
  validate: (candidate: unknown) => candidate is T,
): EvidenceEncodingResult {
  if (!validate(value)) return encodingFailure("malformed", `${name} evidence is malformed`);
  const bytes = Buffer.from(`${canonicalEvidenceJson(value)}\n`, "utf8");
  const parsed = parse(name, bytes, validate);
  if (parsed.kind === "error") return encodingFailure(parsed.reason, parsed.diagnostic);
  return Object.freeze({
    kind: "complete",
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

/** Parse one canonical sidecar with fixed envelope-error precedence. */
function parse<T>(
  name: string,
  bytes: Uint8Array,
  validate: (candidate: unknown) => candidate is T,
): EvidenceValidationResult<T> {
  let value: unknown;
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    value = JSON.parse(source);
  } catch {
    return validationFailure("malformed", `${name} evidence has an invalid JSON envelope`);
  }
  if (
    !isEvidenceRecord(value) ||
    value.kind !== `blend65.${name}` ||
    !Number.isInteger(value.schemaVersion) ||
    Number(value.schemaVersion) <= 0
  ) {
    return validationFailure("malformed", `${name} evidence has an invalid JSON envelope`);
  }
  if (value.schemaVersion !== 1) {
    return validationFailure(
      "unsupported-version",
      `${name} evidence uses an unsupported schema version`,
    );
  }
  if (!validate(value) || !jsonValue(value)) {
    return validationFailure("malformed", `${name} evidence has an invalid version-1 payload`);
  }
  if (source !== `${canonicalEvidenceJson(value)}\n`) {
    return validationFailure("malformed", `${name} evidence is not in canonical byte form`);
  }
  return Object.freeze({ kind: "complete", value });
}

/** Encode canonical build evidence. */
export function encodeBuildEvidence(value: unknown): EvidenceEncodingResult {
  return buildEvidenceValue(value)
    ? encode("build", value, buildEvidenceValue)
    : encodingFailure("malformed", "build evidence is malformed");
}

/** Validate canonical build evidence. */
export function validateBuildEvidence(bytes: Uint8Array): EvidenceValidationResult<BuildEvidence> {
  return parse("build", bytes, buildEvidenceValue);
}

/** Encode canonical assets evidence. */
export function encodeAssetsEvidence(value: unknown): EvidenceEncodingResult {
  return assetsEvidenceValue(value)
    ? encode("assets", value, assetsEvidenceValue)
    : encodingFailure("malformed", "assets evidence is malformed");
}

/** Validate canonical assets evidence. */
export function validateAssetsEvidence(
  bytes: Uint8Array,
): EvidenceValidationResult<AssetsEvidence> {
  return parse("assets", bytes, assetsEvidenceValue);
}

/** Encode canonical memory evidence. */
export function encodeMemoryEvidence(value: unknown): EvidenceEncodingResult {
  return memoryEvidenceValue(value)
    ? encode("memory", value, memoryEvidenceValue)
    : encodingFailure("malformed", "memory evidence is malformed");
}

/** Validate canonical memory evidence. */
export function validateMemoryEvidence(
  bytes: Uint8Array,
): EvidenceValidationResult<MemoryEvidence> {
  return parse("memory", bytes, memoryEvidenceValue);
}

/** Encode canonical costs evidence. */
export function encodeCostsEvidence(value: unknown): EvidenceEncodingResult {
  return costsEvidenceValue(value)
    ? encode("costs", value, costsEvidenceValue)
    : encodingFailure("malformed", "costs evidence is malformed");
}

/** Validate canonical costs evidence. */
export function validateCostsEvidence(bytes: Uint8Array): EvidenceValidationResult<CostsEvidence> {
  return parse("costs", bytes, costsEvidenceValue);
}

/** Encode canonical debug evidence. */
export function encodeDebugEvidence(value: unknown): EvidenceEncodingResult {
  return debugEvidenceValue(value)
    ? encode("debug", value, debugEvidenceValue)
    : encodingFailure("malformed", "debug evidence is malformed");
}

/** Validate canonical debug evidence. */
export function validateDebugEvidence(bytes: Uint8Array): EvidenceValidationResult<DebugEvidence> {
  return parse("debug", bytes, debugEvidenceValue);
}
