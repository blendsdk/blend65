import type { ExecutionOperationResultV1 } from "@blend65/readiness";
import { isExecutionDigestV1 } from "@blend65/readiness/execution-runtime";
import {
  getPublishedDiagnosticCaseProjectionV1,
  type PublishedDiagnosticCaseV1,
} from "@blend65/readiness/published-oracle";

import { classifyInvalidCaseEmissionV1 } from "./execution-evidence-classifiers.js";
import type { ExecutionWorkerResponseV1 } from "./execution-worker-protocol.js";

const DIRECT_DIAGNOSTIC_KEYS = ["revision", "sourceCaseDigest", "diagnostics", "emission"] as const;
const DIAGNOSTIC_KEYS = ["revision", "entries"] as const;
const DIAGNOSTIC_ENTRY_KEYS = ["acceptedEntryId", "code", "phase", "finalSeverity"] as const;
const EMISSION_KEYS = ["il", "assembly", "binary"] as const;

/** Direct parent-side classification result for one invalid diagnostic route. */
export type DiagnosticExecutionResultV1 =
  | { readonly status: "pass"; readonly code: "pass" }
  | {
      readonly status: "failure";
      readonly code: "diagnostic-mismatch" | "unexpected-emission";
    };

/** Worker evidence that intentionally carries no expected diagnostic truth. */
export interface DirectDiagnosticEvidenceV1 {
  readonly revision: "direct-diagnostic-evidence-v1";
  readonly sourceCaseDigest: string;
  readonly diagnostics: ExecutionWorkerResponseV1["diagnostics"];
  readonly emission: ExecutionWorkerResponseV1["emission"];
}

function failure<T>(path: string, message: string): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      Object.freeze({ code: "invalid-evidence-input" as const, path, message }),
    ]) as readonly [
      { readonly code: "invalid-evidence-input"; readonly path: string; readonly message: string },
    ],
  });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function exactRecord(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    ) {
      return undefined;
    }
    const result: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return undefined;
  }
}

/**
 * Classifies hostile direct diagnostic evidence against opaque published truth.
 *
 * @param authority Authentic published diagnostic-case authority.
 * @param observed Worker-derived source identity, diagnostics and artifact presence.
 * @returns A closed classification or invalid-input issue.
 *
 * @example
 * ```ts
 * const classified = classifyDiagnosticRouteEvidenceV1(authority, observed);
 * ```
 */
export function classifyDiagnosticRouteEvidenceV1(
  authority: unknown,
  observed: unknown,
): ExecutionOperationResultV1<DiagnosticExecutionResultV1> {
  const projection = getPublishedDiagnosticCaseProjectionV1(authority as PublishedDiagnosticCaseV1);
  if (!projection.ok) {
    return failure("/authority", "Published diagnostic case authority is invalid.");
  }
  const record = exactRecord(observed, DIRECT_DIAGNOSTIC_KEYS);
  const diagnostics = exactRecord(record?.diagnostics, DIAGNOSTIC_KEYS);
  const emission = exactRecord(record?.emission, EMISSION_KEYS);
  if (
    record?.revision !== "direct-diagnostic-evidence-v1" ||
    !isExecutionDigestV1(record.sourceCaseDigest) ||
    diagnostics?.revision !== "compiler-diagnostic-evidence-v1" ||
    !Array.isArray(diagnostics.entries) ||
    Object.getPrototypeOf(diagnostics.entries) !== Array.prototype ||
    Reflect.ownKeys(diagnostics.entries).length !== diagnostics.entries.length + 1 ||
    emission === undefined ||
    typeof emission.il !== "boolean" ||
    typeof emission.assembly !== "boolean" ||
    typeof emission.binary !== "boolean"
  ) {
    return failure("/observed", "Direct diagnostic evidence is malformed.");
  }
  const entries: Readonly<Record<string, unknown>>[] = [];
  for (let index = 0; index < diagnostics.entries.length; index += 1) {
    const descriptor = Reflect.getOwnPropertyDescriptor(diagnostics.entries, String(index));
    const entry =
      descriptor !== undefined && "value" in descriptor && descriptor.enumerable
        ? exactRecord(descriptor.value, DIAGNOSTIC_ENTRY_KEYS)
        : undefined;
    if (
      entry === undefined ||
      typeof entry.acceptedEntryId !== "string" ||
      entry.acceptedEntryId.length === 0 ||
      typeof entry.code !== "string" ||
      typeof entry.phase !== "string" ||
      typeof entry.finalSeverity !== "string"
    ) {
      return failure("/observed/diagnostics", "Diagnostic evidence entries are malformed.");
    }
    entries.push(entry);
  }
  const expected = projection.value.expectedDiagnostic;
  const exact =
    record.sourceCaseDigest === projection.value.sourceCaseDigest &&
    entries.length === 1 &&
    entries[0]?.code === expected.code &&
    entries[0]?.phase === expected.phase &&
    entries[0]?.finalSeverity === expected.severity;
  if (!exact) return success(Object.freeze({ status: "failure", code: "diagnostic-mismatch" }));
  const emissionClassification = classifyInvalidCaseEmissionV1(record.emission);
  return emissionClassification === "pass"
    ? success(Object.freeze({ status: "pass", code: "pass" }))
    : success(Object.freeze({ status: "failure", code: "unexpected-emission" }));
}
