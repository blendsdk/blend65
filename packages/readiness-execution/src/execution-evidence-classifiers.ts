import type { CompilerDiagnosticPhaseV1 } from "@blend65/compiler";
import type { Severity } from "@blend65/core";

/** Exact diagnostic fact required for one deliberately invalid generated case. */
export interface ExecutionDiagnosticExpectationV1 {
  /** Accepted compiler diagnostic code. */
  readonly code: string;
  /** Real compiler stage that accepted the diagnostic. */
  readonly phase: CompilerDiagnosticPhaseV1;
  /** Final severity after suppression and promotion policy. */
  readonly severity: Severity;
}

/** Closed artifact-presence facts observed for a deliberately invalid case. */
export interface ExecutionEmissionPresenceV1 {
  /** Whether compiler IL was produced. */
  readonly il: boolean;
  /** Whether assembly text was produced. */
  readonly assembly: boolean;
  /** Whether a target binary was produced. */
  readonly binary: boolean;
}

const EXPECTATION_KEYS = ["code", "phase", "severity"] as const;
const EVIDENCE_KEYS = ["revision", "entries"] as const;
const ENTRY_KEYS = ["acceptedEntryId", "code", "phase", "finalSeverity"] as const;
const EMISSION_KEYS = ["il", "assembly", "binary"] as const;
const MAX_DIAGNOSTIC_ENTRIES = 4_096;

function readRecord(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  try {
    if (Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    ) {
      return undefined;
    }
    const output: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return undefined;
  }
}

function readArray(input: unknown, maximum: number): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) return undefined;
    const lengthDescriptor = Reflect.getOwnPropertyDescriptor(input, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximum
    ) {
      return undefined;
    }
    const length: number = lengthDescriptor.value;
    if (Reflect.ownKeys(input).length !== length + 1) return undefined;
    const output: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      output.push(descriptor.value);
    }
    return output;
  } catch {
    return undefined;
  }
}

function isDiagnosticCode(value: unknown): value is string {
  return typeof value === "string" && value.length === 6 && /^[EW][0-9]{5}$/u.test(value);
}

function isPhase(value: unknown): value is CompilerDiagnosticPhaseV1 {
  return value === "lexer" || value === "parser" || value === "semantic" || value === "sfa";
}

function isSeverity(value: unknown): value is Severity {
  return value === "error" || value === "warning";
}

function isAcceptedEntryId(value: unknown): value is string {
  return typeof value === "string" && value.length === 71 && /^sha256:[0-9a-f]{64}$/u.test(value);
}

/** Requires one accepted diagnostic with the exact code, real phase and final severity. */
export function classifyExecutionDiagnosticEvidenceV1(
  expectedInput: unknown,
  observedInput: unknown,
): "pass" | "diagnostic-mismatch" {
  const expected = readRecord(expectedInput, EXPECTATION_KEYS);
  const observed = readRecord(observedInput, EVIDENCE_KEYS);
  if (
    expected === undefined ||
    !isDiagnosticCode(expected.code) ||
    !isPhase(expected.phase) ||
    !isSeverity(expected.severity) ||
    observed?.revision !== "compiler-diagnostic-evidence-v1"
  ) {
    return "diagnostic-mismatch";
  }
  const entryInputs = readArray(observed.entries, MAX_DIAGNOSTIC_ENTRIES);
  if (entryInputs === undefined) return "diagnostic-mismatch";
  let matched = false;
  const acceptedEntryIds = new Set<string>();
  for (const input of entryInputs) {
    const entry = readRecord(input, ENTRY_KEYS);
    if (
      entry === undefined ||
      !isAcceptedEntryId(entry.acceptedEntryId) ||
      acceptedEntryIds.has(entry.acceptedEntryId) ||
      !isDiagnosticCode(entry.code) ||
      !isPhase(entry.phase) ||
      !isSeverity(entry.finalSeverity)
    ) {
      return "diagnostic-mismatch";
    }
    acceptedEntryIds.add(entry.acceptedEntryId);
    if (
      entry.code === expected.code &&
      entry.phase === expected.phase &&
      entry.finalSeverity === expected.severity
    ) {
      matched = true;
    }
  }
  return matched ? "pass" : "diagnostic-mismatch";
}

/** Rejects invalid-case evidence as soon as any IL, assembly or binary exists. */
export function classifyInvalidCaseEmissionV1(presence: unknown): "pass" | "unexpected-emission" {
  const record = readRecord(presence, EMISSION_KEYS);
  if (
    record === undefined ||
    typeof record.il !== "boolean" ||
    typeof record.assembly !== "boolean" ||
    typeof record.binary !== "boolean"
  ) {
    return "unexpected-emission";
  }
  return record.il || record.assembly || record.binary ? "unexpected-emission" : "pass";
}
