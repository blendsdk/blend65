import {
  isExecutionDigest,
  isExecutionIdentifier,
  readExecutionArray,
  readExecutionRecord,
} from "./execution-validation.js";
import type { ExecutionIssueV1, ExecutionOperationResultV1 } from "./execution-contracts.js";
import type { ScalarType } from "./generator-ir.js";

/** Revisions that define how logical C64 values become hardware-visible bytes. */
export type ExecutionProjectionRevisionV1 =
  | "c64-vic-color-readback-v1"
  | "c64-vic-color-observation-v1";

/** One typed external argument supplied to a generated entry function. */
export interface ExecutionArgumentLiteralV1 {
  /** Parameter name in the generated entry function. */
  readonly name: string;
  /** Exact scalar parameter type. */
  readonly type: ScalarType;
  /** Closed JavaScript representation of the scalar value. */
  readonly value: number | boolean;
}

/** Actual bytes that an execution route must observe after the entry returns. */
export interface ExecutionObservationRequestV1 {
  /** Compiler-allocated scalar bytes or direct memory-mapped hardware state. */
  readonly kind: "scalar-bytes" | "direct-mmio";
  /** Number of bytes observed in little-endian order. */
  readonly byteLength: 1 | 2;
  /** First hardware address for direct observations. */
  readonly address?: number;
  /** Hardware projection applied to direct logical writes. */
  readonly projectionRevision?: ExecutionProjectionRevisionV1;
}

/** One ordered store performed after the generated entry returns. */
export type ExecutionEnvelopePostEntryStoreV1 =
  | { readonly kind: "observation-byte"; readonly byteIndex: 0 | 1 }
  | { readonly kind: "completion"; readonly value: 165 };

/** Closed executable-envelope description, independent of source rendering. */
export interface ExecutionEnvelopeIrV1 {
  /** Closed envelope format revision. */
  readonly revision: "execution-envelope-ir-v1";
  /** Identity of the unchanged generated source case. */
  readonly sourceCaseDigest: string;
  /** Complete ordered arguments for the entry function. */
  readonly arguments: readonly ExecutionArgumentLiteralV1[];
  /** Generated function invoked exactly once by the envelope. */
  readonly entryFunction: string;
  /** Actual state requested by the execution route. */
  readonly observation: ExecutionObservationRequestV1;
  /** Failure-safe completion value installed before entry. */
  readonly completionInitialValue: 0;
  /** Success value stored only after every actual observation store. */
  readonly completionSuccessValue: 165;
  /** Exact post-entry store order. */
  readonly postEntryStores: readonly ExecutionEnvelopePostEntryStoreV1[];
}

/** Logical C64 state established before the generated entry executes. */
export interface ExecutionInitialStateFixtureV1 {
  /** Closed fixture projection revision. */
  readonly revision: "c64-vic-color-readback-v1";
  /** Unique hardware cells in ascending address order. */
  readonly cells: readonly {
    /** Memory-mapped hardware address. */
    readonly address: number;
    /** Logical byte supplied to both the host oracle and hardware projection. */
    readonly logicalValue: number;
  }[];
}

/** Proved compiler-allocated locations used to observe one execution. */
export interface ExecutionObservationLayoutV1 {
  /** Closed layout-proof revision. */
  readonly revision: "execution-observation-layout-v1";
  /** Ordered compiler symbols selected for scalar result bytes. */
  readonly resultSymbols: readonly string[];
  /** Ordered byte addresses containing scalar results. */
  readonly resultAddresses: readonly number[];
  /** Compiler symbol selected for the completion sentinel. */
  readonly completionSymbol: string;
  /** Address of the completion sentinel. */
  readonly completionAddress: number;
  /** Ordered report-derived stores accepted by the live proof seam. */
  readonly postEntryStores: readonly ExecutionEmittedStoreV1[];
  /** Digest binding the accepted labels and reserved ranges. */
  readonly proofDigest: string;
}

/**
 * One report-derived emitted store participating in completion-last proof.
 *
 * @example
 * ```ts
 * const store: ExecutionEmittedStoreV1 = {
 *   instructionAddress: 0x0810,
 *   targetAddress: 0x2002,
 *   kind: "completion",
 *   value: 165,
 * };
 * ```
 */
export type ExecutionEmittedStoreV1 =
  | {
      /** Address of the store instruction in emitted code. */
      readonly instructionAddress: number;
      /** Absolute address written by the instruction. */
      readonly targetAddress: number;
      /** Identifies a store of one ordered scalar result byte. */
      readonly kind: "observation-byte";
      /** Ordered scalar byte index. */
      readonly byteIndex: 0 | 1;
    }
  | {
      /** Address of the store instruction in emitted code. */
      readonly instructionAddress: number;
      /** Absolute address written by the instruction. */
      readonly targetAddress: number;
      /** Identifies the completion-sentinel store. */
      readonly kind: "completion";
      /** Exact success sentinel written after every observation byte. */
      readonly value: 165;
    };

/** One half-open address range supplied to layout validation. */
export interface ExecutionAddressRangeV1 {
  /** First occupied address. */
  readonly start: number;
  /** Positive occupied byte count. */
  readonly length: number;
}

/** One participant whose exact implementation contributes to execution identity. */
export interface ExecutionHandlerIdentityV1 {
  /** Closed execution capability. */
  readonly capabilityId: "frontend" | "compiler-api" | "cli" | "emit" | "acme" | "vice";
  /** Handler contract version. */
  readonly contractVersion: string;
  /** Content-derived handler implementation revision. */
  readonly implementationRevision: string;
}

/** Complete semantic input to the pre-build execution identity. */
export interface ExecutionPrebuildIdentityInputV1 {
  /** Unchanged generated source-case identity. */
  readonly sourceCaseDigest: string;
  /** Digest of the canonical executable envelope source. */
  readonly renderedSourceDigest: string;
  /** Digest of the complete ordered argument binding. */
  readonly argumentsDigest: string;
  /** Closed envelope revision. */
  readonly envelopeRevision: "execution-envelope-ir-v1";
  /** Selector implementation revision. */
  readonly selectorRevision: string;
  /** Initial-state projection revision. */
  readonly fixtureRevision: "c64-vic-color-readback-v1";
  /** Digest of the complete logical fixture. */
  readonly fixtureDigest: string;
  /** Optional direct-write observation projection. */
  readonly observationProjectionRevision?: "c64-vic-color-observation-v1";
  /** Current execution target. */
  readonly target: "c64";
  /** Digest of the selected bounded execution policy. */
  readonly policyDigest: string;
  /** Exact participating handlers; canonical identity sorts this list lexically. */
  readonly handlers: readonly ExecutionHandlerIdentityV1[];
  /** Actual state requested after the entry returns. */
  readonly observation: ExecutionObservationRequestV1;
}

/** Compiler labels and occupied ranges required to prove observation placement. */
export interface ExecutionLayoutProofInputV1 {
  /** Emitted compiler symbols resolved to absolute addresses. */
  readonly labels: ReadonlyMap<string, number>;
  /** Emitted instruction ranges. */
  readonly codeRanges: readonly ExecutionAddressRangeV1[];
  /** Emitted constant and ordinary-data ranges. */
  readonly dataRanges: readonly ExecutionAddressRangeV1[];
  /** Semantic memory footprint used by the generated case. */
  readonly semanticRanges: readonly ExecutionAddressRangeV1[];
  /** Reserved processor stack ranges. */
  readonly stackRanges: readonly ExecutionAddressRangeV1[];
  /** Ordered result-byte symbols. */
  readonly observationSymbols: readonly string[];
  /** Completion sentinel symbol. */
  readonly completionSymbol: string;
}

/** Report-bound layout input accepted only alongside genuine execution authority. */
export interface ExecutionCaseLayoutProofInputV1 extends ExecutionLayoutProofInputV1 {
  /** Ordered emitted stores reconstructed from compiler and assembler reports. */
  readonly postEntryStores: readonly ExecutionEmittedStoreV1[];
}

const ENVELOPE_KEYS = [
  "revision",
  "sourceCaseDigest",
  "arguments",
  "entryFunction",
  "observation",
  "completionInitialValue",
  "completionSuccessValue",
  "postEntryStores",
] as const;
const ARGUMENT_KEYS = ["name", "type", "value"] as const;
const SCALAR_OBSERVATION_KEYS = ["kind", "byteLength"] as const;
const DIRECT_OBSERVATION_KEYS = ["kind", "byteLength", "address", "projectionRevision"] as const;
const OBSERVATION_STORE_KEYS = ["kind", "byteIndex"] as const;
const COMPLETION_STORE_KEYS = ["kind", "value"] as const;
const FIXTURE_KEYS = ["revision", "cells"] as const;
const FIXTURE_CELL_KEYS = ["address", "logicalValue"] as const;
const MAX_ARGUMENTS = 32;
const MAX_FIXTURE_CELLS = 3;
const C64_VIC_COLOR_FIRST = 0xd020;
const C64_VIC_COLOR_LAST = 0xd022;

function issue(path: string, message: string): ExecutionIssueV1 {
  return Object.freeze({ code: "execution.invalid-schema", path, message });
}

function failure<T>(path: string, message: string): ExecutionOperationResultV1<T> {
  const issues: readonly [ExecutionIssueV1] = [issue(path, message)];
  return Object.freeze({ ok: false, issues: Object.freeze(issues) });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function isScalarType(value: unknown): value is ScalarType {
  return (
    value === "boolean" ||
    value === "byte" ||
    value === "sbyte" ||
    value === "word" ||
    value === "sword"
  );
}

function validScalarValue(type: ScalarType, value: unknown): value is number | boolean {
  if (type === "boolean") return typeof value === "boolean";
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return false;
  if (type === "byte") return value >= 0 && value <= 0xff;
  if (type === "sbyte") return value >= -0x80 && value <= 0x7f;
  if (type === "word") return value >= 0 && value <= 0xffff;
  return value >= -0x8000 && value <= 0x7fff;
}

/** Closes an unknown observation request into the supported scalar or direct-MMIO shape. */
export function parseExecutionObservationRequestV1(
  input: unknown,
): ExecutionOperationResultV1<ExecutionObservationRequestV1> {
  const scalar = readExecutionRecord(input, SCALAR_OBSERVATION_KEYS);
  if (
    scalar !== undefined &&
    scalar.kind === "scalar-bytes" &&
    (scalar.byteLength === 1 || scalar.byteLength === 2)
  ) {
    return success(Object.freeze({ kind: "scalar-bytes" as const, byteLength: scalar.byteLength }));
  }
  const direct = readExecutionRecord(input, DIRECT_OBSERVATION_KEYS);
  if (
    direct !== undefined &&
    direct.kind === "direct-mmio" &&
    (direct.byteLength === 1 || direct.byteLength === 2) &&
    typeof direct.address === "number" &&
    Number.isSafeInteger(direct.address) &&
    direct.address >= C64_VIC_COLOR_FIRST &&
    direct.address + direct.byteLength - 1 <= C64_VIC_COLOR_LAST &&
    direct.projectionRevision === "c64-vic-color-observation-v1"
  ) {
    return success(
      Object.freeze({
        kind: "direct-mmio" as const,
        byteLength: direct.byteLength,
        address: direct.address,
        projectionRevision: "c64-vic-color-observation-v1" as const,
      }),
    );
  }
  return failure("/observation", "Observation request must use one exact supported shape.");
}

/** Validates and freezes an executable envelope without granting execution authority. */
export function parseExecutionEnvelopeIrV1(
  input: unknown,
): ExecutionOperationResultV1<ExecutionEnvelopeIrV1> {
  const record = readExecutionRecord(input, ENVELOPE_KEYS);
  if (record === undefined) return failure("/", "Envelope must use the exact closed shape.");
  const argumentInputs = readExecutionArray(record.arguments, MAX_ARGUMENTS);
  if (argumentInputs === undefined) {
    return failure("/arguments", "Arguments must be a bounded dense array.");
  }
  const argumentsValue: ExecutionArgumentLiteralV1[] = [];
  const names = new Set<string>();
  for (let index = 0; index < argumentInputs.length; index += 1) {
    const argument = readExecutionRecord(argumentInputs[index], ARGUMENT_KEYS);
    if (
      argument === undefined ||
      !isExecutionIdentifier(argument.name) ||
      !isScalarType(argument.type) ||
      !validScalarValue(argument.type, argument.value) ||
      names.has(argument.name)
    ) {
      return failure(`/arguments/${index}`, "Argument must be unique, typed and in range.");
    }
    names.add(argument.name);
    argumentsValue.push(
      Object.freeze({ name: argument.name, type: argument.type, value: argument.value }),
    );
  }
  const observation = parseExecutionObservationRequestV1(record.observation);
  if (!observation.ok) return observation;
  const storeInputs = readExecutionArray(record.postEntryStores, 3);
  if (storeInputs === undefined) {
    return failure("/postEntryStores", "Post-entry stores must be a bounded dense array.");
  }
  const stores: ExecutionEnvelopePostEntryStoreV1[] = [];
  for (let index = 0; index < storeInputs.length; index += 1) {
    const observationStore = readExecutionRecord(storeInputs[index], OBSERVATION_STORE_KEYS);
    if (
      observationStore !== undefined &&
      observationStore.kind === "observation-byte" &&
      (observationStore.byteIndex === 0 || observationStore.byteIndex === 1)
    ) {
      stores.push(
        Object.freeze({
          kind: "observation-byte" as const,
          byteIndex: observationStore.byteIndex,
        }),
      );
      continue;
    }
    const completionStore = readExecutionRecord(storeInputs[index], COMPLETION_STORE_KEYS);
    if (completionStore?.kind === "completion" && completionStore.value === 165) {
      stores.push(Object.freeze({ kind: "completion" as const, value: 165 as const }));
      continue;
    }
    return failure(`/postEntryStores/${index}`, "Post-entry store is not supported.");
  }
  const observationStores =
    observation.value.kind === "scalar-bytes" ? observation.value.byteLength : 0;
  const exactStoreOrder =
    stores.length === observationStores + 1 &&
    stores
      .slice(0, observationStores)
      .every((store, index) => store.kind === "observation-byte" && store.byteIndex === index) &&
    stores[stores.length - 1]?.kind === "completion";
  if (!exactStoreOrder) {
    return failure(
      "/postEntryStores",
      "Observation bytes must be stored in byte order before one completion store.",
    );
  }
  if (
    record.revision !== "execution-envelope-ir-v1" ||
    !isExecutionDigest(record.sourceCaseDigest) ||
    !isExecutionIdentifier(record.entryFunction) ||
    record.completionInitialValue !== 0 ||
    record.completionSuccessValue !== 165
  ) {
    return failure("/", "Envelope identity, entry or completion values are invalid.");
  }
  return success(
    Object.freeze({
      revision: "execution-envelope-ir-v1" as const,
      sourceCaseDigest: record.sourceCaseDigest,
      arguments: Object.freeze(argumentsValue),
      entryFunction: record.entryFunction,
      observation: observation.value,
      completionInitialValue: 0 as const,
      completionSuccessValue: 165 as const,
      postEntryStores: Object.freeze(stores),
    }),
  );
}

/** Validates and freezes one logical C64 initial-state fixture. */
export function parseExecutionInitialStateFixtureV1(
  input: unknown,
): ExecutionOperationResultV1<ExecutionInitialStateFixtureV1> {
  const record = readExecutionRecord(input, FIXTURE_KEYS);
  const cellInputs = readExecutionArray(record?.cells, MAX_FIXTURE_CELLS);
  if (record?.revision !== "c64-vic-color-readback-v1" || cellInputs === undefined) {
    return failure("/", "Fixture must use the exact supported revision and shape.");
  }
  const cells: { readonly address: number; readonly logicalValue: number }[] = [];
  let previousAddress = -1;
  for (let index = 0; index < cellInputs.length; index += 1) {
    const cell = readExecutionRecord(cellInputs[index], FIXTURE_CELL_KEYS);
    if (
      cell === undefined ||
      typeof cell.address !== "number" ||
      !Number.isSafeInteger(cell.address) ||
      cell.address < C64_VIC_COLOR_FIRST ||
      cell.address > C64_VIC_COLOR_LAST ||
      cell.address <= previousAddress ||
      typeof cell.logicalValue !== "number" ||
      !Number.isSafeInteger(cell.logicalValue) ||
      cell.logicalValue < 0 ||
      cell.logicalValue > 0xff
    ) {
      return failure(`/cells/${index}`, "Fixture cells must be unique ascending VIC color bytes.");
    }
    previousAddress = cell.address;
    cells.push(Object.freeze({ address: cell.address, logicalValue: cell.logicalValue }));
  }
  return success(
    Object.freeze({
      revision: "c64-vic-color-readback-v1" as const,
      cells: Object.freeze(cells),
    }),
  );
}
