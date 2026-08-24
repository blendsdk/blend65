import type {
  CompilerDiagnosticEvidenceEntryV1,
  CompilerDiagnosticEvidenceV1,
} from "@blend65/compiler";
import type { Severity } from "@blend65/core";
import type { ExecutionOperationResultV1 } from "@blend65/readiness";

/** Compiler work that must run inside a terminable worker. */
export type ExecutionWorkerTierV1 = "frontend" | "compiler-api" | "cli" | "emit";

/** Immutable source payload copied into a worker request. */
export interface ExecutionWorkerSourceV1 {
  /** Closed source payload revision. */
  readonly revision: "execution-worker-source-v1";
  /** Safe case-root-relative source path. */
  readonly relativePath: string;
  /** Complete source bytes. */
  readonly bytes: Uint8Array;
  /** SHA-256 identity of the complete bytes. */
  readonly digest: string;
}

/** Parent-pinned workspace identity bound into a production worker job. */
export interface ExecutionWorkerWorkspaceIdentityV1 {
  readonly device: bigint;
  readonly inode: bigint;
  readonly uid: number;
}

/** Fields shared by every version-one worker request. */
export interface ExecutionWorkerRequestBaseV1<TTier extends ExecutionWorkerTierV1> {
  /** Closed request revision. */
  readonly revision: "execution-worker-request-v1";
  /** Worker contract selected by the parent. */
  readonly tier: TTier;
  /** Source authority kind; omitted only by legacy direct callers. */
  readonly caseKind?: "valid-envelope" | "invalid-diagnostic";
  /** Exact opaque execution-case identity. */
  readonly caseIdentity: string;
  /** Canonical parent-owned case root. */
  readonly caseRoot: string;
  /** Parent-pinned root identity; omitted only by legacy direct callers. */
  readonly workspaceIdentity?: ExecutionWorkerWorkspaceIdentityV1;
  /** Isolated source payload. */
  readonly source: ExecutionWorkerSourceV1;
}

/** Closed structured-clone request vocabulary for synchronous compiler work. */
export type ExecutionWorkerRequestV1 =
  | (ExecutionWorkerRequestBaseV1<"frontend"> & {
      readonly contract: "frontend-pipeline-v1";
    })
  | (ExecutionWorkerRequestBaseV1<"compiler-api"> & {
      readonly contract: "compiler-evidence-facade-v1";
    })
  | (ExecutionWorkerRequestBaseV1<"cli"> & {
      readonly contract: "blendc-cli-v1";
      readonly argv: readonly string[];
    })
  | (ExecutionWorkerRequestBaseV1<"emit"> & {
      readonly contract: "assembly-emitter-v1";
    });

/** Artifact-presence facts returned without granting terminal authority. */
export interface ExecutionWorkerEmissionV1 {
  /** Whether IL was emitted. */
  readonly il: boolean;
  /** Whether assembly was emitted. */
  readonly assembly: boolean;
  /** Whether a binary was emitted. */
  readonly binary: boolean;
}

/** Closed compiler-owned address range used by live observation-layout proof. */
export interface ExecutionWorkerAddressRangeV1 {
  readonly start: number;
  readonly length: number;
}

/** Allocation facts projected by the real emitter without granting execution authority. */
export interface ExecutionWorkerLayoutBasisV1 {
  readonly revision: "execution-worker-layout-basis-v1";
  readonly dataRanges: readonly ExecutionWorkerAddressRangeV1[];
}

/** Strict tier-specific evidence returned by a compiler worker. */
export type ExecutionWorkerResponseV1 =
  | {
      readonly revision: "execution-worker-response-v1";
      readonly tier: "frontend";
      readonly contract: "frontend-pipeline-v1";
      readonly caseIdentity: string;
      readonly diagnostics: CompilerDiagnosticEvidenceV1;
      readonly semanticModelPresent: boolean;
      readonly allocationPlanPresent: boolean;
      readonly emission: ExecutionWorkerEmissionV1;
    }
  | {
      readonly revision: "execution-worker-response-v1";
      readonly tier: "compiler-api";
      readonly contract: "compiler-evidence-facade-v1";
      readonly caseIdentity: string;
      readonly hasErrors: boolean;
      readonly diagnostics: CompilerDiagnosticEvidenceV1;
      readonly emission: ExecutionWorkerEmissionV1;
    }
  | {
      readonly revision: "execution-worker-response-v1";
      readonly tier: "cli";
      readonly contract: "blendc-cli-v1";
      readonly caseIdentity: string;
      readonly exitCode: 0 | 1 | 2 | 3;
      readonly stdout: Uint8Array;
      readonly stderr: Uint8Array;
      readonly diagnostics: CompilerDiagnosticEvidenceV1;
      readonly emission: ExecutionWorkerEmissionV1;
    }
  | {
      readonly revision: "execution-worker-response-v1";
      readonly tier: "emit";
      readonly contract: "assembly-emitter-v1";
      readonly caseIdentity: string;
      /** Whether the full emitter result contains any error-severity diagnostic. */
      readonly hasErrors: boolean;
      readonly assemblyBytes: Uint8Array;
      /** Present on the real emitter; legacy injected workers may omit this non-authorizing fact. */
      readonly layoutBasis?: ExecutionWorkerLayoutBasisV1;
      readonly diagnostics: CompilerDiagnosticEvidenceV1;
      readonly emission: ExecutionWorkerEmissionV1;
    };

/** Completion observed at the worker-thread boundary. */
export type ExecutionWorkerCompletionV1 =
  | { readonly kind: "message"; readonly value: unknown }
  | {
      readonly kind: "crash";
      readonly exitCode: number | null;
      /** Bounded resource failure observed before a valid response was published. */
      readonly resourceFailure?: "output-exhaustion" | "evidence-exhaustion";
    };

/** Parent-owned worker lifecycle handle. */
export interface ExecutionWorkerHandleV1 {
  /** First message or crash observed for this worker. */
  readonly completion: Promise<ExecutionWorkerCompletionV1>;
  /** Pool-local worker identity used for lifecycle observation. */
  readonly workerIdentity?: number;
  /** One-based case ordinal within this worker's bounded batch. */
  readonly batchOrdinal?: number;
  /** Terminates the worker and releases its parent-owned resources. */
  terminate(): Promise<void>;
  /** Returns a healthy completed worker to its bounded pool when reuse is supported. */
  release?(): Promise<void>;
}

/** Cancellation information supplied to one bounded worker launch. */
export interface ExecutionCancellationV1 {
  /** Abort signal shared by the enclosing route. */
  readonly signal: AbortSignal;
  /** Monotonic deadline after which the operation has no authority. */
  readonly deadlineMonotonicMs: number;
  /** Selected aggregate byte bound enforced before a worker publishes output. */
  readonly outputLimitBytes?: number;
  /** Selected evidence byte bound enforced before a worker publishes evidence. */
  readonly evidenceLimitBytes?: number;
}

/** Replaceable worker-thread boundary used by every synchronous compiler tier. */
export interface ExecutionWorkerExecutorV1 {
  /** Starts one worker without running a compiler façade in the parent. */
  start(
    request: ExecutionWorkerRequestV1,
    cancellation: ExecutionCancellationV1,
  ): Promise<ExecutionOperationResultV1<ExecutionWorkerHandleV1>>;
  /** Boundedly terminates every idle or leased worker owned by this executor. */
  shutdown?(): Promise<void>;
}

const RESPONSE_COMMON_KEYS = [
  "revision",
  "tier",
  "contract",
  "caseIdentity",
  "diagnostics",
  "emission",
] as const;
const DIAGNOSTIC_KEYS = ["revision", "entries"] as const;
const DIAGNOSTIC_ENTRY_KEYS = ["acceptedEntryId", "code", "phase", "finalSeverity"] as const;
const EMISSION_KEYS = ["il", "assembly", "binary"] as const;
const LAYOUT_BASIS_KEYS = ["revision", "dataRanges"] as const;
const ADDRESS_RANGE_KEYS = ["start", "length"] as const;
const MAX_DIAGNOSTICS = 4_096;
const MAX_LAYOUT_RANGES = 4_096;
const MAX_ACCEPTED_ENTRY_ID_BYTES = 256;
const ENCODER = new TextEncoder();

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

/** Reads exact ordinary data records without invoking accessors. */
function readRecord(
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

/** Copies a bounded dense plain array without consulting its iterator. */
function readArray(input: unknown, maximum: number): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(input)) return undefined;
    if (Object.getPrototypeOf(input) !== Array.prototype) return undefined;
    const lengthDescriptor = Reflect.getOwnPropertyDescriptor(input, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximum ||
      Reflect.ownKeys(input).length !== lengthDescriptor.value + 1
    ) {
      return undefined;
    }
    const output: unknown[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
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

function isAcceptedEntryId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    ENCODER.encode(value).byteLength <= MAX_ACCEPTED_ENTRY_ID_BYTES &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  );
}

function isSeverity(value: unknown): value is Severity {
  return value === "error" || value === "warning";
}

function isPhase(value: unknown): value is CompilerDiagnosticEvidenceEntryV1["phase"] {
  return value === "lexer" || value === "parser" || value === "semantic" || value === "sfa";
}

/** Validates and copies the complete accepted-diagnostic sidecar. */
function parseDiagnostics(input: unknown): CompilerDiagnosticEvidenceV1 | undefined {
  const record = readRecord(input, DIAGNOSTIC_KEYS);
  if (record?.revision !== "compiler-diagnostic-evidence-v1") return undefined;
  const inputs = readArray(record.entries, MAX_DIAGNOSTICS);
  if (inputs === undefined) return undefined;
  const entries: CompilerDiagnosticEvidenceEntryV1[] = [];
  const identities = new Set<string>();
  for (const inputEntry of inputs) {
    const entry = readRecord(inputEntry, DIAGNOSTIC_ENTRY_KEYS);
    if (
      entry === undefined ||
      !isAcceptedEntryId(entry.acceptedEntryId) ||
      identities.has(entry.acceptedEntryId) ||
      typeof entry.code !== "string" ||
      !/^[EW][0-9]{5}$/u.test(entry.code) ||
      !isPhase(entry.phase) ||
      !isSeverity(entry.finalSeverity)
    ) {
      return undefined;
    }
    identities.add(entry.acceptedEntryId);
    entries.push(
      Object.freeze({
        acceptedEntryId: entry.acceptedEntryId,
        code: entry.code,
        phase: entry.phase,
        finalSeverity: entry.finalSeverity,
      }),
    );
  }
  return Object.freeze({
    revision: "compiler-diagnostic-evidence-v1",
    entries: Object.freeze(entries),
  });
}

/** Validates the exact three-field artifact-presence record. */
function parseEmission(input: unknown): ExecutionWorkerEmissionV1 | undefined {
  const record = readRecord(input, EMISSION_KEYS);
  if (
    record === undefined ||
    typeof record.il !== "boolean" ||
    typeof record.assembly !== "boolean" ||
    typeof record.binary !== "boolean"
  ) {
    return undefined;
  }
  return Object.freeze({
    il: record.il,
    assembly: record.assembly,
    binary: record.binary,
  });
}

/** Copies an ordinary byte array while failing closed on exotic or revoked values. */
function parseBytes(input: unknown): Uint8Array | undefined {
  try {
    return input instanceof Uint8Array && Object.getPrototypeOf(input) === Uint8Array.prototype
      ? input.slice()
      : undefined;
  } catch {
    return undefined;
  }
}

function parseLayoutBasis(input: unknown): ExecutionWorkerLayoutBasisV1 | undefined {
  const record = readRecord(input, LAYOUT_BASIS_KEYS);
  const rows = record === undefined ? undefined : readArray(record.dataRanges, MAX_LAYOUT_RANGES);
  if (record?.revision !== "execution-worker-layout-basis-v1" || rows === undefined)
    return undefined;
  const dataRanges: ExecutionWorkerAddressRangeV1[] = [];
  for (const row of rows) {
    const range = readRecord(row, ADDRESS_RANGE_KEYS);
    if (
      range === undefined ||
      typeof range.start !== "number" ||
      !Number.isSafeInteger(range.start) ||
      range.start < 0 ||
      range.start > 0xffff ||
      typeof range.length !== "number" ||
      !Number.isSafeInteger(range.length) ||
      range.length <= 0 ||
      range.start + range.length > 0x1_0000
    ) {
      return undefined;
    }
    const previous = dataRanges.at(-1);
    if (previous !== undefined && range.start < previous.start + previous.length) {
      return undefined;
    }
    dataRanges.push(Object.freeze({ start: range.start, length: range.length }));
  }
  return Object.freeze({
    revision: "execution-worker-layout-basis-v1",
    dataRanges: Object.freeze(dataRanges),
  });
}

/**
 * Validates an untrusted worker message against the exact request contract.
 *
 * @param request Parent-owned request used to bind tier, contract and case identity.
 * @param input Structured-clone value received from the worker.
 * @returns A fresh immutable evidence record or one stable validation issue.
 */
export function parseExecutionWorkerResponseV1(
  request: ExecutionWorkerRequestV1,
  input: unknown,
): ExecutionOperationResultV1<ExecutionWorkerResponseV1> {
  const tierKeys =
    request.tier === "frontend"
      ? [...RESPONSE_COMMON_KEYS, "semanticModelPresent", "allocationPlanPresent"]
      : request.tier === "compiler-api"
        ? [...RESPONSE_COMMON_KEYS, "hasErrors"]
        : request.tier === "cli"
          ? [...RESPONSE_COMMON_KEYS, "exitCode", "stdout", "stderr"]
          : [...RESPONSE_COMMON_KEYS, "hasErrors", "assemblyBytes"];
  let record = readRecord(input, tierKeys);
  if (record === undefined && request.tier === "emit") {
    record = readRecord(input, [...tierKeys, "layoutBasis"]);
  }
  const diagnostics = record === undefined ? undefined : parseDiagnostics(record.diagnostics);
  const emission = record === undefined ? undefined : parseEmission(record.emission);
  if (
    record === undefined ||
    record.revision !== "execution-worker-response-v1" ||
    record.tier !== request.tier ||
    record.contract !== request.contract ||
    record.caseIdentity !== request.caseIdentity ||
    diagnostics === undefined ||
    emission === undefined
  ) {
    return failure("/response", "Worker response does not match its closed request contract.");
  }

  switch (request.tier) {
    case "frontend":
      if (
        typeof record.semanticModelPresent !== "boolean" ||
        typeof record.allocationPlanPresent !== "boolean"
      ) {
        return failure("/response", "Frontend worker evidence is malformed.");
      }
      return success(
        Object.freeze({
          revision: "execution-worker-response-v1",
          tier: "frontend",
          contract: "frontend-pipeline-v1",
          caseIdentity: request.caseIdentity,
          diagnostics,
          semanticModelPresent: record.semanticModelPresent,
          allocationPlanPresent: record.allocationPlanPresent,
          emission,
        }),
      );
    case "compiler-api":
      if (typeof record.hasErrors !== "boolean") {
        return failure("/response", "Compiler worker evidence is malformed.");
      }
      return success(
        Object.freeze({
          revision: "execution-worker-response-v1",
          tier: "compiler-api",
          contract: "compiler-evidence-facade-v1",
          caseIdentity: request.caseIdentity,
          hasErrors: record.hasErrors,
          diagnostics,
          emission,
        }),
      );
    case "cli": {
      const stdout = parseBytes(record.stdout);
      const stderr = parseBytes(record.stderr);
      if (
        (record.exitCode !== 0 &&
          record.exitCode !== 1 &&
          record.exitCode !== 2 &&
          record.exitCode !== 3) ||
        stdout === undefined ||
        stderr === undefined
      ) {
        return failure("/response", "CLI worker evidence is malformed.");
      }
      return success(
        Object.freeze({
          revision: "execution-worker-response-v1",
          tier: "cli",
          contract: "blendc-cli-v1",
          caseIdentity: request.caseIdentity,
          exitCode: record.exitCode,
          stdout,
          stderr,
          diagnostics,
          emission,
        }),
      );
    }
    case "emit": {
      const assemblyBytes = parseBytes(record.assemblyBytes);
      const layoutBasis =
        record.layoutBasis === undefined ? undefined : parseLayoutBasis(record.layoutBasis);
      if (
        typeof record.hasErrors !== "boolean" ||
        assemblyBytes === undefined ||
        (record.layoutBasis !== undefined && layoutBasis === undefined)
      ) {
        return failure("/response", "Emitter worker evidence is malformed.");
      }
      return success(
        Object.freeze({
          revision: "execution-worker-response-v1",
          tier: "emit",
          contract: "assembly-emitter-v1",
          caseIdentity: request.caseIdentity,
          hasErrors: record.hasErrors,
          assemblyBytes,
          ...(layoutBasis === undefined ? {} : { layoutBasis }),
          diagnostics,
          emission,
        }),
      );
    }
  }
}
