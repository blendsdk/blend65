import { createHash } from "node:crypto";

import type {
  ExecutionAddressRangeV1,
  ExecutionCaseV1,
  ExecutionEmittedStoreV1,
  ExecutionEnvelopePostEntryStoreV1,
  ExecutionObservationLayoutV1,
  ExecutionOperationResultV1,
} from "@blend65/readiness";
import { getExecutionCaseProjectionV1 } from "@blend65/readiness/execution-runtime";

const TEXT_ENCODER = new TextEncoder();
const ADDRESS_LIMIT = 0x1_0000;
const MAX_LABELS = 4_096;
const MAX_RANGES = 4_096;
const MAX_SYMBOL_BYTES = 512;
const MAX_STORES = 3;
const MMIO_RANGE: ExecutionAddressRangeV1 = Object.freeze({ start: 0xd000, length: 0x1000 });
const MAP_SIZE_GETTER = Object.getOwnPropertyDescriptor(Map.prototype, "size")?.get;
const STRUCTURAL_INPUT_KEYS = [
  "labels",
  "codeRanges",
  "dataRanges",
  "semanticRanges",
  "stackRanges",
  "observationSymbols",
  "completionSymbol",
] as const;
const LIVE_INPUT_KEYS = [...STRUCTURAL_INPUT_KEYS, "postEntryStores"] as const;
const RANGE_KEYS = ["start", "length"] as const;
const OBSERVATION_STORE_KEYS = [
  "instructionAddress",
  "targetAddress",
  "kind",
  "byteIndex",
] as const;
const COMPLETION_STORE_KEYS = ["instructionAddress", "targetAddress", "kind", "value"] as const;
const CLOSED_LAYOUT_KEYS = [
  "revision",
  "resultSymbols",
  "resultAddresses",
  "completionSymbol",
  "completionAddress",
  "postEntryStores",
  "proofDigest",
] as const;

interface ClosedLayoutInput {
  readonly labels: ReadonlyMap<string, number>;
  readonly codeRanges: readonly ExecutionAddressRangeV1[];
  readonly dataRanges: readonly ExecutionAddressRangeV1[];
  readonly semanticRanges: readonly ExecutionAddressRangeV1[];
  readonly stackRanges: readonly ExecutionAddressRangeV1[];
  readonly observationSymbols: readonly string[];
  readonly completionSymbol: string;
}

interface ClosedLiveLayoutInput extends ClosedLayoutInput {
  readonly postEntryStores: readonly ExecutionEmittedStoreV1[];
}

interface ResolvedLayout {
  readonly resultAddresses: readonly number[];
  readonly completionAddress: number;
}

function failure<T>(path: string, message: string): ExecutionOperationResultV1<T> {
  const issues = [
    Object.freeze({ code: "invalid-evidence-input" as const, path, message }),
  ] as const;
  return Object.freeze({ ok: false, issues: Object.freeze(issues) });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

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

function validSymbol(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_SYMBOL_BYTES &&
    TEXT_ENCODER.encode(value).byteLength <= MAX_SYMBOL_BYTES
  );
}

function validAddress(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value < ADDRESS_LIMIT
  );
}

function readLabels(input: unknown): ReadonlyMap<string, number> | undefined {
  if (typeof input !== "object" || input === null || MAP_SIZE_GETTER === undefined)
    return undefined;
  try {
    if (Object.getPrototypeOf(input) !== Map.prototype || Reflect.ownKeys(input).length !== 0) {
      return undefined;
    }
    const size = Reflect.apply(MAP_SIZE_GETTER, input, []);
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_LABELS) return undefined;
    const iterator = Reflect.apply(Map.prototype.entries, input, []);
    const labels = new Map<string, number>();
    for (let index = 0; index < size; index += 1) {
      const step = iterator.next();
      if (step.done === true || !Array.isArray(step.value) || step.value.length !== 2) {
        return undefined;
      }
      const [name, address] = step.value;
      if (!validSymbol(name) || !validAddress(address)) return undefined;
      labels.set(name, address);
    }
    if (iterator.next().done !== true || labels.size !== size) return undefined;
    return labels;
  } catch {
    return undefined;
  }
}

function validRange(range: ExecutionAddressRangeV1): boolean {
  return (
    validAddress(range.start) &&
    Number.isSafeInteger(range.length) &&
    range.length > 0 &&
    range.start + range.length <= ADDRESS_LIMIT
  );
}

function readRanges(input: unknown): readonly ExecutionAddressRangeV1[] | undefined {
  const rows = readArray(input, MAX_RANGES);
  if (rows === undefined) return undefined;
  const ranges: ExecutionAddressRangeV1[] = [];
  for (const row of rows) {
    const record = readRecord(row, RANGE_KEYS);
    if (
      record === undefined ||
      typeof record.start !== "number" ||
      typeof record.length !== "number"
    ) {
      return undefined;
    }
    const range = Object.freeze({ start: record.start, length: record.length });
    if (!validRange(range)) return undefined;
    ranges.push(range);
  }
  return Object.freeze(ranges);
}

function readSymbols(input: unknown): readonly string[] | undefined {
  const rows = readArray(input, 2);
  if (rows === undefined) return undefined;
  const symbols: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!validSymbol(row) || seen.has(row)) return undefined;
    seen.add(row);
    symbols.push(row);
  }
  return Object.freeze(symbols);
}

function readStore(input: unknown): ExecutionEmittedStoreV1 | undefined {
  const observation = readRecord(input, OBSERVATION_STORE_KEYS);
  if (
    observation !== undefined &&
    observation.kind === "observation-byte" &&
    validAddress(observation.instructionAddress) &&
    validAddress(observation.targetAddress) &&
    (observation.byteIndex === 0 || observation.byteIndex === 1)
  ) {
    return Object.freeze({
      instructionAddress: observation.instructionAddress,
      targetAddress: observation.targetAddress,
      kind: "observation-byte" as const,
      byteIndex: observation.byteIndex,
    });
  }
  const completion = readRecord(input, COMPLETION_STORE_KEYS);
  if (
    completion !== undefined &&
    completion.kind === "completion" &&
    validAddress(completion.instructionAddress) &&
    validAddress(completion.targetAddress) &&
    completion.value === 165
  ) {
    return Object.freeze({
      instructionAddress: completion.instructionAddress,
      targetAddress: completion.targetAddress,
      kind: "completion" as const,
      value: 165 as const,
    });
  }
  return undefined;
}

function readStores(input: unknown): readonly ExecutionEmittedStoreV1[] | undefined {
  const rows = readArray(input, MAX_STORES);
  if (rows === undefined) return undefined;
  const stores: ExecutionEmittedStoreV1[] = [];
  for (const row of rows) {
    const store = readStore(row);
    if (store === undefined) return undefined;
    stores.push(store);
  }
  return Object.freeze(stores);
}

function readLayoutInput(input: unknown, live: false): ClosedLayoutInput | undefined;
function readLayoutInput(input: unknown, live: true): ClosedLiveLayoutInput | undefined;
function readLayoutInput(
  input: unknown,
  live: boolean,
): ClosedLayoutInput | ClosedLiveLayoutInput | undefined {
  const record = readRecord(input, live ? LIVE_INPUT_KEYS : STRUCTURAL_INPUT_KEYS);
  if (record === undefined) return undefined;
  const labels = readLabels(record.labels);
  const codeRanges = readRanges(record.codeRanges);
  const dataRanges = readRanges(record.dataRanges);
  const semanticRanges = readRanges(record.semanticRanges);
  const stackRanges = readRanges(record.stackRanges);
  const observationSymbols = readSymbols(record.observationSymbols);
  if (
    labels === undefined ||
    codeRanges === undefined ||
    dataRanges === undefined ||
    semanticRanges === undefined ||
    stackRanges === undefined ||
    observationSymbols === undefined ||
    !validSymbol(record.completionSymbol) ||
    observationSymbols.includes(record.completionSymbol)
  ) {
    return undefined;
  }
  const closed = {
    labels,
    codeRanges,
    dataRanges,
    semanticRanges,
    stackRanges,
    observationSymbols,
    completionSymbol: record.completionSymbol,
  };
  if (!live) return Object.freeze(closed);
  const postEntryStores = readStores(record.postEntryStores);
  return postEntryStores === undefined ? undefined : Object.freeze({ ...closed, postEntryStores });
}

function contains(range: ExecutionAddressRangeV1, address: number): boolean {
  return address >= range.start && address < range.start + range.length;
}

function resolveAddresses(input: ClosedLayoutInput): ExecutionOperationResultV1<ResolvedLayout> {
  const resultAddresses: number[] = [];
  for (let index = 0; index < input.observationSymbols.length; index += 1) {
    const symbol = input.observationSymbols[index];
    const address = symbol === undefined ? undefined : input.labels.get(symbol);
    if (address === undefined) {
      return failure(`/observationSymbols/${index}`, "Observation symbol has no valid label.");
    }
    resultAddresses.push(address);
  }
  const completionAddress = input.labels.get(input.completionSymbol);
  if (completionAddress === undefined) {
    return failure("/completionSymbol", "Completion symbol has no valid label.");
  }
  const allAddresses = [...resultAddresses, completionAddress];
  if (new Set(allAddresses).size !== allAddresses.length) {
    return failure("/labels", "Observation and completion labels must not overlap.");
  }
  const reserved = [
    ...input.codeRanges,
    ...input.dataRanges,
    ...input.semanticRanges,
    ...input.stackRanges,
    MMIO_RANGE,
  ];
  if (allAddresses.some((address) => reserved.some((range) => contains(range, address)))) {
    return failure("/labels", "Observation layout collides with an occupied or reserved range.");
  }
  return success(
    Object.freeze({
      resultAddresses: Object.freeze(resultAddresses),
      completionAddress,
    }),
  );
}

function proofDigest(
  input: ClosedLayoutInput,
  resolved: ResolvedLayout,
  postEntryStores: readonly ExecutionEmittedStoreV1[],
): string {
  const labels = [...input.labels.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([name, address]) => ({ name, address }));
  const value = {
    domain: "blend65-execution-layout-v1",
    labels,
    codeRanges: input.codeRanges,
    dataRanges: input.dataRanges,
    semanticRanges: input.semanticRanges,
    stackRanges: input.stackRanges,
    resultSymbols: input.observationSymbols,
    resultAddresses: resolved.resultAddresses,
    completionSymbol: input.completionSymbol,
    completionAddress: resolved.completionAddress,
    postEntryStores,
  };
  return `sha256:${createHash("sha256")
    .update(TEXT_ENCODER.encode(JSON.stringify(value)))
    .digest("hex")}`;
}

function closeLayout(
  input: ClosedLayoutInput,
  resolved: ResolvedLayout,
  postEntryStores: readonly ExecutionEmittedStoreV1[],
): ExecutionObservationLayoutV1 {
  return Object.freeze({
    revision: "execution-observation-layout-v1" as const,
    resultSymbols: input.observationSymbols,
    resultAddresses: resolved.resultAddresses,
    completionSymbol: input.completionSymbol,
    completionAddress: resolved.completionAddress,
    postEntryStores,
    proofDigest: proofDigest(input, resolved, postEntryStores),
  });
}

/**
 * Validates and defensively closes an already-proved observation layout.
 *
 * This parser protects execution boundaries that receive a stored proof rather
 * than the compiler reports used to derive that proof.
 *
 * @example
 * ```ts
 * const parsed = parseExecutionObservationLayoutV1(layout);
 * ```
 */
export function parseExecutionObservationLayoutV1(
  input: unknown,
): ExecutionOperationResultV1<ExecutionObservationLayoutV1> {
  const record = readRecord(input, CLOSED_LAYOUT_KEYS);
  const symbols = readArray(record?.resultSymbols, 2);
  const addresses = readArray(record?.resultAddresses, 2);
  const storeInputs = readArray(record?.postEntryStores, MAX_STORES);
  if (
    record === undefined ||
    record.revision !== "execution-observation-layout-v1" ||
    symbols === undefined ||
    addresses === undefined ||
    symbols.length !== addresses.length ||
    symbols.some((symbol) => !validSymbol(symbol)) ||
    new Set(symbols).size !== symbols.length ||
    addresses.some((address) => !validAddress(address)) ||
    new Set(addresses).size !== addresses.length ||
    !validSymbol(record.completionSymbol) ||
    !validAddress(record.completionAddress) ||
    addresses.includes(record.completionAddress) ||
    storeInputs === undefined ||
    typeof record.proofDigest !== "string" ||
    !/^(?:sha256:)?[0-9a-f]{64}$/.test(record.proofDigest)
  ) {
    return failure("/", "Observation layout must use the exact bounded closed shape.");
  }
  const stores: ExecutionEmittedStoreV1[] = [];
  let previousInstruction = -1;
  for (const storeInput of storeInputs) {
    const store = readStore(storeInput);
    if (store === undefined || store.instructionAddress <= previousInstruction) {
      return failure("/postEntryStores", "Observation stores are invalid or unordered.");
    }
    previousInstruction = store.instructionAddress;
    stores.push(store);
  }
  return success(
    Object.freeze({
      revision: "execution-observation-layout-v1",
      resultSymbols: Object.freeze(symbols as string[]),
      resultAddresses: Object.freeze(addresses as number[]),
      completionSymbol: record.completionSymbol as string,
      completionAddress: record.completionAddress as number,
      postEntryStores: Object.freeze(stores),
      proofDigest: record.proofDigest,
    }),
  );
}

/** Validates a bounded passive historical layout without granting live execution authority. */
export function resolveExecutionObservationLayoutV1(
  input: unknown,
): ExecutionOperationResultV1<ExecutionObservationLayoutV1> {
  const closed = readLayoutInput(input, false);
  if (closed === undefined || closed.observationSymbols.length < 1) {
    return failure("/", "Layout proof input must use the exact bounded passive shape.");
  }
  const resolved = resolveAddresses(closed);
  return resolved.ok ? success(closeLayout(closed, resolved.value, Object.freeze([]))) : resolved;
}

function storesMatchEnvelope(
  input: ClosedLiveLayoutInput,
  resolved: ResolvedLayout,
  envelopeStores: readonly ExecutionEnvelopePostEntryStoreV1[],
): boolean {
  if (input.postEntryStores.length !== envelopeStores.length) return false;
  let previousInstruction = -1;
  for (let index = 0; index < input.postEntryStores.length; index += 1) {
    const emitted = input.postEntryStores[index];
    const expected = envelopeStores[index];
    if (
      emitted === undefined ||
      expected === undefined ||
      emitted.instructionAddress <= previousInstruction ||
      !input.codeRanges.some((range) => contains(range, emitted.instructionAddress))
    ) {
      return false;
    }
    previousInstruction = emitted.instructionAddress;
    if (expected.kind === "completion") {
      if (
        emitted.kind !== "completion" ||
        emitted.targetAddress !== resolved.completionAddress ||
        emitted.value !== expected.value
      ) {
        return false;
      }
      continue;
    }
    if (
      emitted.kind !== "observation-byte" ||
      emitted.byteIndex !== expected.byteIndex ||
      emitted.targetAddress !== resolved.resultAddresses[expected.byteIndex]
    ) {
      return false;
    }
  }
  return true;
}

/** Proves a genuine case's exact emitted observation and completion store layout. */
export function resolveExecutionCaseObservationLayoutV1(
  executionCase: ExecutionCaseV1,
  input: unknown,
): ExecutionOperationResultV1<ExecutionObservationLayoutV1> {
  const projection = getExecutionCaseProjectionV1(executionCase);
  if (!projection.ok) return failure("/executionCase", "Execution case authority is invalid.");
  const closed = readLayoutInput(input, true);
  if (closed === undefined) {
    return failure("/", "Live layout proof input must use the exact bounded report shape.");
  }
  const expectedSymbolCount =
    projection.value.observation.kind === "scalar-bytes"
      ? projection.value.observation.byteLength
      : 0;
  if (closed.observationSymbols.length !== expectedSymbolCount) {
    return failure(
      "/observationSymbols",
      "Result symbols must exactly match the genuine case observation width.",
    );
  }
  const resolved = resolveAddresses(closed);
  if (!resolved.ok) return resolved;
  if (!storesMatchEnvelope(closed, resolved.value, projection.value.envelope.postEntryStores)) {
    return failure(
      "/postEntryStores",
      "Emitted stores must match the genuine envelope in increasing code order.",
    );
  }
  return success(closeLayout(closed, resolved.value, closed.postEntryStores));
}
