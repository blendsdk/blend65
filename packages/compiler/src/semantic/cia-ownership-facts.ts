import type { SemanticBlock, SemanticOperation, ValueId } from "./operations.js";

/** The current IRQ vector owner, independent of the CIA1 device configuration. */
export type IrqRoute = "chained" | "exclusive";

/** Raw device writes cannot be reconstructed; typed writes require an owning final release. */
export type CiaMutation = "clean" | "typed" | "raw";

/** Finite source facts used by the CIA ownership check; no runtime shadow is emitted. */
export interface CiaState {
  /** Nested firmware IRQ-vector route kinds from oldest to newest. */
  readonly routes: readonly IrqRoute[];
  /** Possible source handlers at each matching route depth. */
  readonly handlerKeys: readonly (readonly string[])[];
  /** False only while source code or hardware has definitely masked IRQ entry. */
  readonly irqMayRun: boolean;
  /** A full source disable or equivalent proof has established the write-only mask. */
  readonly maskKnown: boolean;
  /** Union of CIA1 sources that may currently be enabled. */
  readonly possibleSources: number;
  /** Configuration effects during each matching route's ownership, oldest to newest. */
  readonly mutations: readonly CiaMutation[];
  /** Known vector or out-of-lease CIA writes have not disqualified the stock predecessor. */
  readonly stockPredecessor: boolean;
}

/** Before an exclusive handoff, the write-only CIA1 mask is unknown. */
export const INITIAL_CIA_STATE: CiaState = Object.freeze({
  routes: Object.freeze([]),
  handlerKeys: Object.freeze([]),
  irqMayRun: true,
  maskKnown: false,
  possibleSources: 0x1f,
  mutations: Object.freeze([]),
  stockPredecessor: true,
});

/** Retain exact literals through source conversions using the resulting integer width. */
export function literalValues(blocks: readonly SemanticBlock[]): ReadonlyMap<ValueId, bigint> {
  const values = new Map<ValueId, bigint>();
  for (const block of blocks) {
    for (const operation of block.operations) {
      if (operation.kind === "constant" && typeof operation.value === "bigint") {
        values.set(operation.result, operation.value);
      } else if (operation.kind === "convert") {
        const operand = values.get(operation.operand);
        if (operand !== undefined && operation.integer !== null) {
          const { width, signed } = operation.integer;
          values.set(
            operation.result,
            signed ? BigInt.asIntN(width, operand) : BigInt.asUintN(width, operand),
          );
        }
      }
    }
  }
  return values;
}

/** Classify each known raw byte through CIA1 mirrors and the selected firmware vector bytes. */
export function rawCia1Effect(
  operation: Extract<SemanticOperation, { readonly kind: "memory-write" }>,
  values: ReadonlyMap<ValueId, bigint>,
  vectorBytes: ReadonlySet<number> = new Set(),
): {
  /** A known timer, control or source-mask write lies outside the typed release contract. */
  readonly dirty: boolean;
  /** The unreadable source mask is no longer proved after an ICR write. */
  readonly icr: boolean;
  /** A known vector write invalidates the stock-predecessor provenance. */
  readonly vector: boolean;
} {
  const address = values.get(operation.address);
  if (address === undefined) return { dirty: false, icr: false, vector: false };
  const bytes = [Number(address & 0xffffn)];
  if (operation.width === 2) bytes.push(Number((address + 1n) & 0xffffn));
  // CIA1 repeats its 16 registers throughout $DC00-$DCFF. A word write may
  // cross a register boundary, so classify both bytes independently.
  const registers = bytes
    .filter((byte) => byte >= 0xdc00 && byte <= 0xdcff)
    .map((byte) => byte & 0x0f);
  return {
    dirty: registers.some((register) => (register >= 4 && register <= 7) || register >= 13),
    icr: registers.includes(13),
    vector: bytes.some((byte) => vectorBytes.has(byte)),
  };
}

/** Union configuration effects without losing an unsupported raw mutation at a join. */
function mergeMutation(left: CiaMutation, right: CiaMutation): CiaMutation {
  if (left === "raw" || right === "raw") return "raw";
  return left === "typed" || right === "typed" ? "typed" : "clean";
}

/** Charge the selected handler's transitive writes to its own route, even through helpers. */
export function handlerCiaMutation(
  keys: readonly string[],
  typedWrites: ReadonlySet<string>,
  rawWrites: ReadonlySet<string>,
): CiaMutation {
  if (keys.some((key) => rawWrites.has(key))) return "raw";
  return keys.some((key) => typedWrites.has(key)) ? "typed" : "clean";
}

/** Charge a configuration change to its current owner, not to every older vector link. */
export function mutateCiaState(state: CiaState, mutation: CiaMutation): CiaState {
  return {
    ...state,
    mutations: state.mutations.map((previous, index) =>
      index === state.mutations.length - 1 ? mergeMutation(previous, mutation) : previous,
    ),
  };
}

/** Identify the only vector pop that may restore stock CIA1 service. */
export function isFinalCiaRelease(state: CiaState): boolean {
  return state.routes.length === 1 && state.routes[0] === "exclusive";
}

/**
 * Pop a clean inner route or perform a qualified final typed release.
 * A dirty inner pop cannot reconstruct its outer owner's write-only mask/latch.
 * The stock handback deliberately discards pending game events and establishes
 * Timer A's known mask; it never claims to recover raw or custom device state.
 * @returns The remaining ownership state, or null when the release cannot be proved safe.
 */
export function restoreCiaState(state: CiaState): CiaState | null {
  const final = isFinalCiaRelease(state);
  const mutation = state.mutations.at(-1) ?? "clean";
  if (mutation === "raw" || (final ? !state.stockPredecessor : mutation !== "clean")) return null;
  return {
    ...state,
    routes: state.routes.slice(0, -1),
    handlerKeys: state.handlerKeys.slice(0, -1),
    mutations: state.mutations.slice(0, -1),
    maskKnown: final ? true : state.maskKnown,
    possibleSources: final ? 0x01 : state.possibleSources,
  };
}

/** Typed CIA1 writes change device state; observation and consuming reads do not. */
export function typedMutation(capability: string): boolean {
  return (
    capability.startsWith("c64.cia1.") &&
    !capability.includes("readTimer") &&
    capability !== "c64.cia1.readAndClearPendingSources"
  );
}

/** Route depth and kind must agree; other ownership facts merge conservatively. */
export function joinCiaState(left: CiaState, right: CiaState): CiaState | null {
  if (
    left.routes.length !== right.routes.length ||
    left.routes.some((route, index) => route !== right.routes[index])
  ) {
    return null;
  }
  return {
    routes: left.routes,
    handlerKeys: left.handlerKeys.map((keys, index) =>
      [...new Set([...keys, ...(right.handlerKeys[index] ?? [])])].sort(),
    ),
    irqMayRun: left.irqMayRun || right.irqMayRun,
    maskKnown: left.maskKnown && right.maskKnown,
    possibleSources: left.possibleSources | right.possibleSources,
    mutations: left.mutations.map((mutation, index) =>
      mergeMutation(mutation, right.mutations[index]!),
    ),
    stockPredecessor: left.stockPredecessor && right.stockPredecessor,
  };
}

/** Detect when a loop or branch join has reached the same finite facts. */
export function sameCiaState(left: CiaState, right: CiaState): boolean {
  return (
    left.maskKnown === right.maskKnown &&
    left.irqMayRun === right.irqMayRun &&
    left.possibleSources === right.possibleSources &&
    left.stockPredecessor === right.stockPredecessor &&
    left.routes.length === right.routes.length &&
    left.routes.every(
      (route, index) =>
        route === right.routes[index] &&
        left.mutations[index] === right.mutations[index] &&
        left.handlerKeys[index]?.length === right.handlerKeys[index]?.length &&
        left.handlerKeys[index]?.every(
          (key, keyIndex) => key === right.handlerKeys[index]?.[keyIndex],
        ),
    )
  );
}
