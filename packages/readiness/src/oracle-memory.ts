import type { OracleBudgetMeterV1 } from "./oracle-budget.js";
import {
  oracleMutationDispatchMarker,
  selectedOracleMutationVariant,
  type OracleMutationDispatchMarkerV1,
} from "./oracle-conformance-v1.js";
import {
  hasExactOracleKeys,
  isOracleRecord,
  oracleFailure,
  type OracleFailure,
} from "./oracle-input.js";
import {
  ORACLE_V1_LIMITS,
  type MemoryCellV1,
  type MemoryEffectV1,
  type MemoryFixtureV1,
} from "./oracle-model.js";

/** Immutable memory cells plus completed logical effects. */
export interface OracleMemoryStateV1 {
  /** Explicit initialized byte cells. */
  readonly cells: ReadonlyMap<bigint, bigint>;
  /** Completed reads and writes in strict evaluation order. */
  readonly effects: readonly MemoryEffectV1[];
}

/**
 * Memory builder owned by one evaluator invocation.
 *
 * Cells and effects remain private until the final observation is projected, so
 * accesses can update them in constant time without exposing mutable state.
 */
export interface OracleMutableMemoryStateV1 {
  /** Mutable initialized byte cells owned by the evaluator. */
  readonly cells: Map<bigint, bigint>;
  /** Append-only logical effects owned by the evaluator. */
  readonly effects: MemoryEffectV1[];
}

/** Closed result of validating one hostile memory fixture. */
export type OracleMemoryValidationResultV1 =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Immutable explicit memory fixture. */
      readonly memory: MemoryFixtureV1;
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | OracleFailure;

/** Successful logical memory read. */
export interface OracleMemoryReadSuccessV1 {
  /** Success discriminator. */
  readonly ok: true;
  /** Complete little-endian value read. */
  readonly value: bigint;
  /** Copy-on-write state containing the completed read effect. */
  readonly state: OracleMemoryStateV1;
  /** Empty diagnostic tuple for success. */
  readonly diagnostics: readonly [];
}

/** Successful logical memory write. */
export interface OracleMemoryWriteSuccessV1 {
  /** Success discriminator. */
  readonly ok: true;
  /** Copy-on-write state containing updated bytes and write effect. */
  readonly state: OracleMemoryStateV1;
  /** Empty diagnostic tuple for success. */
  readonly diagnostics: readonly [];
}

/** Structurally valid memory access that cannot be modeled. */
export interface OracleMemoryUnmodeledV1 {
  /** Unsupported discriminator. */
  readonly ok: true;
  /** Unmodeled outcome. */
  readonly outcome: "oracle-unmodeled";
  /** Memory model's closed unsupported reason. */
  readonly reason: "unsupported-semantics";
  /** Empty diagnostic tuple for an unmodeled result. */
  readonly diagnostics: readonly [];
}

/** Closed result of one memory read. */
export type OracleMemoryReadResultV1 =
  | OracleMemoryReadSuccessV1
  | OracleMemoryUnmodeledV1
  | OracleFailure;

/** Closed result of one memory write. */
export type OracleMemoryWriteResultV1 =
  | OracleMemoryWriteSuccessV1
  | OracleMemoryUnmodeledV1
  | OracleFailure;

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

type OracleMemoryMutationPathV1 = "read-byte" | "read-word" | "write-byte" | "write-word";

const MEMORY_MUTATIONS: Readonly<
  Record<OracleMemoryMutationPathV1, OracleMutationDispatchMarkerV1>
> = Object.freeze({
  "read-byte": oracleMutationDispatchMarker(
    "evaluator.memory",
    "evaluator.memory.read-byte",
    "memory-value-xor-one-v1",
  ),
  "read-word": oracleMutationDispatchMarker(
    "evaluator.memory",
    "evaluator.memory.read-word",
    "memory-value-xor-one-v1",
  ),
  "write-byte": oracleMutationDispatchMarker(
    "evaluator.memory",
    "evaluator.memory.write-byte",
    "memory-value-xor-one-v1",
  ),
  "write-word": oracleMutationDispatchMarker(
    "evaluator.memory",
    "evaluator.memory.write-word",
    "memory-value-xor-one-v1",
  ),
});

/** Closed memory branches required by mutation conformance. */
export const ORACLE_MEMORY_MUTATION_PATHS = Object.freeze(Object.values(MEMORY_MUTATIONS));

function mutatedMemoryValue(kind: "read" | "write", width: 1 | 2, value: bigint): bigint {
  const pathId: OracleMemoryMutationPathV1 = `${kind}-${width === 1 ? "byte" : "word"}`;
  return selectedOracleMutationVariant(MEMORY_MUTATIONS[pathId]) === "memory-value-xor-one-v1"
    ? value ^ 1n
    : value;
}

function unmodeled(): OracleMemoryUnmodeledV1 {
  return Object.freeze({
    ok: true,
    outcome: "oracle-unmodeled",
    reason: "unsupported-semantics",
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Validates a sorted explicit byte-cell fixture without implicit memory.
 *
 * @param input Hostile fixture candidate.
 * @param path Pointer assigned to the fixture.
 * @returns Immutable validated fixture or one closed failure.
 */
export function validateOracleMemoryFixture(
  input: unknown,
  path = "/memory",
): OracleMemoryValidationResultV1 {
  if (
    !isOracleRecord(input) ||
    !hasExactOracleKeys(input, ["schemaVersion", "cells"]) ||
    input.schemaVersion !== 1 ||
    !Array.isArray(input.cells)
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      path,
      "Memory fixture must use the exact version-one shape.",
    );
  }
  if (BigInt(input.cells.length) > ORACLE_V1_LIMITS.memoryCells) {
    return oracleFailure(
      "oracle.input.limit",
      `${path}/cells`,
      "Memory fixture exceeds the initialized-cell hard limit.",
    );
  }
  const cells: MemoryCellV1[] = [];
  let previousAddress = -1n;
  for (let index = 0; index < input.cells.length; index += 1) {
    const cell = input.cells[index];
    const cellPath = `${path}/cells/${index}`;
    if (!isOracleRecord(cell) || !hasExactOracleKeys(cell, ["address", "value"])) {
      return oracleFailure(
        "oracle.input.invalid",
        cellPath,
        "Memory cell must use the exact closed shape.",
      );
    }
    if (typeof cell.address !== "bigint" || cell.address < 0n || cell.address > 65_535n) {
      return oracleFailure(
        "oracle.input.invalid",
        `${cellPath}/address`,
        "Memory address must be an unsigned 16-bit integer.",
      );
    }
    if (typeof cell.value !== "bigint" || cell.value < 0n || cell.value > 255n) {
      return oracleFailure(
        "oracle.input.invalid",
        `${cellPath}/value`,
        "Memory cell value must be an unsigned byte.",
      );
    }
    if (cell.address <= previousAddress) {
      return oracleFailure(
        "oracle.input.invalid",
        `${cellPath}/address`,
        "Memory cells must be unique and ordered by address.",
      );
    }
    previousAddress = cell.address;
    cells.push(Object.freeze({ address: cell.address, value: cell.value }));
  }
  return Object.freeze({
    ok: true,
    memory: Object.freeze({ schemaVersion: 1, cells: Object.freeze(cells) }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Creates evaluator memory state from a validated explicit fixture.
 *
 * @param fixture Validated ordered cells.
 * @returns Independent state with no effects.
 */
export function createOracleMemoryState(fixture: MemoryFixtureV1): OracleMemoryStateV1 {
  return Object.freeze({
    cells: new Map(fixture.cells.map((cell) => [cell.address, cell.value])),
    effects: Object.freeze([]),
  });
}

/**
 * Creates evaluator-private mutable memory from a validated fixture.
 *
 * @param fixture Validated ordered cells.
 * @returns Owned cells and an empty append-only effect log.
 */
export function createOracleMutableMemoryState(
  fixture: MemoryFixtureV1,
): OracleMutableMemoryStateV1 {
  return Object.freeze({
    cells: new Map(fixture.cells.map((cell) => [cell.address, cell.value])),
    effects: [],
  });
}

function accessAddresses(address: bigint, width: 1 | 2): readonly bigint[] | undefined {
  if (address < 0n || address > 65_535n) return undefined;
  if (width === 2 && address === 65_535n) return undefined;
  return width === 1 ? Object.freeze([address]) : Object.freeze([address, address + 1n]);
}

function chargeCells(
  meter: OracleBudgetMeterV1,
  count: number,
  path: string,
): OracleFailure | undefined {
  for (let index = 0; index < count; index += 1) {
    const charged = meter.charge("evaluationSteps", 1n, path);
    if (!charged.ok) {
      return Object.freeze({ ok: false, diagnostics: charged.diagnostics });
    }
  }
  return undefined;
}

function appendEffect(
  state: OracleMemoryStateV1,
  effect: Omit<MemoryEffectV1, "ordinal">,
  meter: OracleBudgetMeterV1,
  path: string,
): { readonly ok: true; readonly effects: readonly MemoryEffectV1[] } | OracleFailure {
  const charged = meter.charge("effects", 1n, path);
  if (!charged.ok) return charged;
  return Object.freeze({
    ok: true,
    effects: Object.freeze([
      ...state.effects,
      Object.freeze({ ...effect, ordinal: BigInt(state.effects.length) }),
    ]),
  });
}

function appendMutableEffect(
  state: OracleMutableMemoryStateV1,
  effect: Omit<MemoryEffectV1, "ordinal">,
  meter: OracleBudgetMeterV1,
  path: string,
): OracleFailure | undefined {
  const charged = meter.charge("effects", 1n, path);
  if (!charged.ok) return charged;
  state.effects.push(
    Object.freeze({
      ...effect,
      ordinal: BigInt(state.effects.length),
    }),
  );
  return undefined;
}

/**
 * Reads one complete byte or little-endian word and appends one logical effect.
 *
 * @param state Current immutable memory state.
 * @param width Access width.
 * @param address First byte address.
 * @param meter Shared budget meter.
 * @param path Expression pointer used for budget diagnostics.
 * @returns Complete read state, unmodeled access, or budget failure.
 */
export function readOracleMemory(
  state: OracleMemoryStateV1,
  width: 1 | 2,
  address: bigint,
  meter: OracleBudgetMeterV1,
  path: string,
): OracleMemoryReadResultV1 {
  const addresses = accessAddresses(address, width);
  if (addresses === undefined || addresses.some((current) => !state.cells.has(current))) {
    return unmodeled();
  }
  const charged = chargeCells(meter, addresses.length, path);
  if (charged !== undefined) return charged;
  const low = state.cells.get(address);
  if (low === undefined) return unmodeled();
  const high = width === 2 ? state.cells.get(address + 1n) : 0n;
  if (high === undefined) return unmodeled();
  const value = mutatedMemoryValue("read", width, low | (high << 8n));
  const effects = appendEffect(
    state,
    Object.freeze({ kind: "read", width, address, value }),
    meter,
    path,
  );
  if (!effects.ok) return effects;
  return Object.freeze({
    ok: true,
    value,
    state: Object.freeze({ cells: state.cells, effects: effects.effects }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Reads memory through the evaluator-private builder.
 *
 * @param state Private memory builder.
 * @param width Access width.
 * @param address First byte address.
 * @param meter Shared budget meter.
 * @param path Expression pointer used for budget diagnostics.
 * @returns Complete value, unmodeled access, or budget failure.
 */
export function readOracleMutableMemory(
  state: OracleMutableMemoryStateV1,
  width: 1 | 2,
  address: bigint,
  meter: OracleBudgetMeterV1,
  path: string,
):
  | {
      readonly ok: true;
      readonly value: bigint;
      readonly diagnostics: readonly [];
    }
  | OracleMemoryUnmodeledV1
  | OracleFailure {
  const addresses = accessAddresses(address, width);
  if (addresses === undefined || addresses.some((current) => !state.cells.has(current))) {
    return unmodeled();
  }
  const charged = chargeCells(meter, addresses.length, path);
  if (charged !== undefined) return charged;
  const low = state.cells.get(address);
  if (low === undefined) return unmodeled();
  const high = width === 2 ? state.cells.get(address + 1n) : 0n;
  if (high === undefined) return unmodeled();
  const value = mutatedMemoryValue("read", width, low | (high << 8n));
  const effectFailure = appendMutableEffect(
    state,
    Object.freeze({ kind: "read", width, address, value }),
    meter,
    path,
  );
  if (effectFailure !== undefined) return effectFailure;
  return Object.freeze({ ok: true, value, diagnostics: EMPTY_DIAGNOSTICS });
}

/**
 * Writes one complete byte or little-endian word and appends one logical effect.
 *
 * @param state Current immutable memory state.
 * @param width Access width.
 * @param address First byte address.
 * @param value Canonical byte or word value.
 * @param meter Shared budget meter.
 * @param path Statement pointer used for budget diagnostics.
 * @returns Copy-on-write memory state, unmodeled access, or budget failure.
 */
export function writeOracleMemory(
  state: OracleMemoryStateV1,
  width: 1 | 2,
  address: bigint,
  value: bigint,
  meter: OracleBudgetMeterV1,
  path: string,
): OracleMemoryWriteResultV1 {
  const addresses = accessAddresses(address, width);
  if (addresses === undefined || addresses.some((current) => !state.cells.has(current))) {
    return unmodeled();
  }
  const charged = chargeCells(meter, addresses.length, path);
  if (charged !== undefined) return charged;
  const selectedValue = mutatedMemoryValue("write", width, value);
  const effects = appendEffect(
    state,
    Object.freeze({ kind: "write", width, address, value: selectedValue }),
    meter,
    path,
  );
  if (!effects.ok) return effects;
  const cells = new Map(state.cells);
  cells.set(address, selectedValue & 0xffn);
  if (width === 2) cells.set(address + 1n, (selectedValue >> 8n) & 0xffn);
  return Object.freeze({
    ok: true,
    state: Object.freeze({ cells, effects: effects.effects }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Writes memory through the evaluator-private builder.
 *
 * The effect budget is charged before any byte is changed, preserving
 * transactional failure behavior.
 *
 * @param state Private memory builder.
 * @param width Access width.
 * @param address First byte address.
 * @param value Canonical byte or word value.
 * @param meter Shared budget meter.
 * @param path Statement pointer used for budget diagnostics.
 * @returns Success, unmodeled access, or budget failure.
 */
export function writeOracleMutableMemory(
  state: OracleMutableMemoryStateV1,
  width: 1 | 2,
  address: bigint,
  value: bigint,
  meter: OracleBudgetMeterV1,
  path: string,
):
  | { readonly ok: true; readonly diagnostics: readonly [] }
  | OracleMemoryUnmodeledV1
  | OracleFailure {
  const addresses = accessAddresses(address, width);
  if (addresses === undefined || addresses.some((current) => !state.cells.has(current))) {
    return unmodeled();
  }
  const charged = chargeCells(meter, addresses.length, path);
  if (charged !== undefined) return charged;
  const selectedValue = mutatedMemoryValue("write", width, value);
  const effectFailure = appendMutableEffect(
    state,
    Object.freeze({ kind: "write", width, address, value: selectedValue }),
    meter,
    path,
  );
  if (effectFailure !== undefined) return effectFailure;
  state.cells.set(address, selectedValue & 0xffn);
  if (width === 2) state.cells.set(address + 1n, (selectedValue >> 8n) & 0xffn);
  return Object.freeze({ ok: true, diagnostics: EMPTY_DIAGNOSTICS });
}

/**
 * Publishes an immutable effect snapshot after evaluation completes.
 *
 * @param state Private or immutable memory state.
 * @returns Frozen logical effects in evaluation order.
 */
export function snapshotOracleMemoryEffects(
  state: OracleMemoryStateV1 | OracleMutableMemoryStateV1,
): readonly MemoryEffectV1[] {
  return Object.freeze([...state.effects]);
}

/**
 * Projects every initialized byte cell in lexical numeric order.
 *
 * @param state Final evaluator memory state.
 * @returns Complete immutable final-memory projection.
 */
export function projectOracleMemory(
  state: OracleMemoryStateV1 | OracleMutableMemoryStateV1,
): readonly MemoryCellV1[] {
  return Object.freeze(
    [...state.cells]
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .map(([address, value]) => Object.freeze({ address, value })),
  );
}
