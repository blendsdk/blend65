import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { MemoryWriteOperation, SemanticPlace } from "../semantic/operations.js";
import type { StorageRequest } from "../storage/storage-types.js";
import {
  machineInstruction,
  type LoweredValue,
  modeForValue,
  operandForValue,
} from "./lower-control.js";
import { type AggregateInductionRuntime } from "./lower-induction.js";
import type { MultiplyHelper } from "./lower-multiply.js";
import type { DivideHelper } from "./lower-division.js";
import type {
  MachineBlock,
  MachineDataObject,
  MachineInstruction,
  MachineLoweringInput,
} from "./machine-types.js";

/** Internal proving failure converted to the direct lowering error union. */
export interface LoweringFailure extends Error {
  /** Source which selected the unsupported or inconsistent operation. */
  readonly source: SourceSpan | null;
}

/** Construct one proving failure without adding an exception-class hierarchy. */
export function loweringFailure(message: string, source: SourceSpan | null): LoweringFailure {
  return Object.assign(new Error(message), { name: "LoweringFailure", source });
}

/** Recognize a proving failure at the public lowering boundary. */
export function isLoweringFailure(error: unknown): error is LoweringFailure {
  return error instanceof Error && error.name === "LoweringFailure" && "source" in error;
}

/** Return the exact packed byte width of one semantic type. */
export function typeBytes(type: SemanticType): number {
  if (type.kind === "array" || type.kind === "struct") return type.size;
  if (type.kind === "function" || type.kind === "interrupt-handler") return 2;
  if (type.kind === "enum") return 1;
  if (type.name === "void") return 0;
  return type.name === "word" || type.name === "sword" ? 2 : 1;
}

/** Return whether one scalar uses signed two's-complement ordering. */
export function isSignedType(type: SemanticType): boolean {
  return type.kind === "scalar" && (type.name === "sbyte" || type.name === "sword");
}

/** Convert a source binding into the stable generated label used by layout and serialization. */
export function bindingLabel(prefix: string, binding: BindingId): string {
  return `${prefix}.${bindingIdentityKey(binding)}`;
}

/** Compile-time identity of the indexed aggregate base held in the shared address pair. */
export interface AggregateAddressCache {
  /** Stable identity of the aggregate root and scaled index sources. */
  readonly key: string;
  /** Source binding whose packed bytes the pointer addresses. */
  readonly rootBindingKey: string;
  /** Storage homes whose current values contributed dynamic index terms. */
  readonly indexRequestIds: readonly string[];
}

/** Build one canonical aggregate-address fact shared by local and loop-carried reuse. */
export function createAggregateAddressCache(
  rootBindingKey: string,
  indices: readonly {
    readonly requestId: string;
    readonly bytes: number;
    readonly signed: boolean;
    readonly stride: number;
  }[],
): AggregateAddressCache {
  return Object.freeze({
    key: JSON.stringify({ root: rootBindingKey, indices }),
    rootBindingKey,
    indexRequestIds: Object.freeze(indices.map(({ requestId }) => requestId)),
  });
}

/** State used only while one semantic execution context is lowered. */
export interface FunctionLoweringState {
  /** Source function whose execution storage is being selected. */
  readonly owner: BindingId;
  /** Proven vector nesting at this machine variant's entry. */
  readonly interruptDepth: Readonly<{
    irq: number;
    nmi: number;
    activationRoot?: string;
    localIrqDepth?: number;
    entrySlot?: string;
  }>;
  /** Machine location of each already selected semantic value. */
  readonly values: Map<string, LoweredValue>;
  /** Source places whose aggregate values are represented by addresses, not packed bytes. */
  readonly aggregatePlaces: Map<string, SemanticPlace>;
  /** Results already constructed in the current function's caller-owned object. */
  readonly directCallerResults: Set<string>;
  /** Newly discovered execution storage returned to the closure owner. */
  readonly requests: StorageRequest[];
  /** Whole-program facts, provisional homes and selected CPU/platform. */
  readonly input: MachineLoweringInput;
  /** Conservative function-local positions for machine-discovered lifetimes. */
  readonly allPositions: readonly { readonly block: string; readonly operation: number }[];
  /** Values consumed directly by a control-flow terminator. */
  readonly branchConditions: ReadonlySet<string>;
  /** Values that must survive beyond their immediate production. */
  readonly materializedValues: ReadonlySet<string>;
  /** One-use A/AX results consumed by the next instruction-producing operation. */
  readonly forwardedRegisterValues: ReadonlySet<string>;
  /** Word BCD results written directly to one fixed volatile destination. */
  readonly directBcdWrites: ReadonlyMap<string, MemoryWriteOperation>;
  /** Later fixed-address volatile byte of a subtraction, staged from X. */
  readonly subtractRightInX: ReadonlySet<string>;
  /** First addend has its low byte staged and high byte in Y. */
  readonly wordAddLeftHighInY: ReadonlySet<string>;
  /** First minuend remains in A/Y while the later word is read. */
  readonly wordSubtractLeftHighInY: ReadonlySet<string>;
  /** Later word's low byte is staged while its high byte stays in X. */
  readonly wordSubtractRightLowStaged: ReadonlySet<string>;
  /** Values consumed once may donate their address pair to a terminal aggregate copy. */
  readonly singleUseValues: ReadonlySet<string>;
  /** Aggregate results whose pointer is consumed beyond a redundant same-place store. */
  readonly retainedAggregateResults: ReadonlySet<string>;
  /** Values used as addresses rather than loaded scalar contents. */
  readonly addressValues: ReadonlySet<string>;
  /** Call sites conservatively crossed by discovered storage. */
  readonly callSpans: readonly SourceSpan[];
  /** Edge-local copies needed to materialize control-flow merge values. */
  readonly mergeCopies: {
    /** Semantic predecessor which owns the copy. */
    readonly predecessor: string;
    /** Value entering through that predecessor. */
    readonly incoming: string;
    /** Common machine destination after the join. */
    readonly destination: LoweredValue;
    /** Exact copied width. */
    readonly bytes: number;
    /** Source origin for every selected copy instruction. */
    readonly source: SourceSpan;
  }[];
  /** Link-on-use immutable objects selected by profile operations. */
  readonly generatedData: Map<string, MachineDataObject>;
  /** Reachable helper bodies emitted with this function. */
  readonly helperBlocks: MachineBlock[];
  /** Multiply helpers shared within one execution context by width. */
  readonly multiplyHelpers: Map<number, MultiplyHelper>;
  /** Divide helpers shared within one execution context by typed form. */
  readonly divideHelpers: Map<string, DivideHelper>;
  /** Direct source-place origins of values eligible for same-input divide reuse. */
  readonly loadOrigins: Map<string, string>;
  /** Divider outputs still valid after the last same-input call in this block. */
  divisionReuse: { readonly left: string; readonly right: string; readonly helper: string } | null;
  /** Selected helper scratch identities used by final storage closure. */
  readonly helperUses: {
    readonly id: string;
    readonly requestIds: readonly string[];
    readonly source: SourceSpan;
  }[];
  /** Source-facing cost warnings attributable to direct selection. */
  readonly warnings: ProjectDiagnostic[];
  /** Current source block, retained while lowering inserts machine blocks. */
  currentSemanticBlockId: string;
  /**
   * Identity of the indexed aggregate base currently held in the shared address pair.
   * This is compile-time knowledge only. Index writes and calls clear it. Forward control-flow
   * edges retain it only when every incoming path proves the same identity.
   */
  aggregateAddressCache: AggregateAddressCache | null;
  /** One proved canonical loop recurrence, or null for ordinary lowering. */
  aggregateInduction: AggregateInductionRuntime | null;
}

/** Build a conservative finite lifetime for machine-discovered function storage. */
function machineLifetime(state: FunctionLoweringState, value: string) {
  const semantic = state.input.program.lifetimes.find(
    (lifetime) =>
      bindingIdentityKey(lifetime.function) === bindingIdentityKey(state.owner) &&
      lifetime.value === value,
  );
  if (semantic !== undefined) return semantic;
  return Object.freeze({
    function: state.owner,
    value,
    definition: state.allPositions[0] ?? Object.freeze({ block: "entry", operation: 0 }),
    liveAt: state.allPositions,
    callsCrossed: state.callSpans,
  });
}

/** Add or return one stable machine-discovered request. */
export function requestStorage(
  state: FunctionLoweringState,
  idSuffix: string,
  storageClass: "temporary" | "pointer" | "spill",
  bytes: number,
  region: StorageRequest["region"],
  source: SourceSpan,
  reason: string,
  type: SemanticType | null = null,
): StorageRequest {
  const id = `machine:${bindingIdentityKey(state.owner)}:${idSuffix}`;
  const existing = state.requests.find((request) => request.id === id);
  if (existing !== undefined) return existing;
  const request: StorageRequest = Object.freeze({
    id,
    storageClass,
    owner: state.owner,
    binding: null,
    value: idSuffix,
    type,
    bytes,
    alignment: 1,
    region,
    lifetime: machineLifetime(state, idSuffix),
    source,
    reason,
  });
  state.requests.push(request);
  return request;
}

/** Find the provisional home identity already assigned to a source place. */
export function loweredPlace(
  place: SemanticPlace,
  bytes: number,
  signed: boolean,
  state: FunctionLoweringState,
): LoweredValue {
  if (place.asset !== undefined) {
    return Object.freeze({ kind: "label", label: `asset.${place.asset}`, bytes, signed });
  }
  const bindingKey = bindingIdentityKey(place.root);
  const home = state.input.placement.homes.find(
    ({ requestId }) =>
      requestId.endsWith(`:parameter:${bindingKey}`) || requestId.endsWith(`:local:${bindingKey}`),
  );
  if (home !== undefined) {
    return Object.freeze({
      kind: "storage",
      requestId: home.requestId,
      bytes,
      signed,
    });
  }
  return Object.freeze({
    kind: "label",
    label: bindingLabel("global", place.root),
    bytes,
    signed,
    ...(state.input.program.semantic.globals.some(
      (global) => bindingIdentityKey(global.id) === bindingKey && global.zeropage === true,
    )
      ? { zeroPage: true }
      : {}),
  });
}

/** Preserve a register result whose semantic identity survives this operation. */
export function retainMachineValue(
  resultId: string,
  value: LoweredValue,
  instructionsInput: readonly MachineInstruction[],
  type: SemanticType,
  source: SourceSpan,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly value: LoweredValue } {
  const hasSemanticLifetime = state.input.program.lifetimes.some(
    (lifetime) =>
      bindingIdentityKey(lifetime.function) === bindingIdentityKey(state.owner) &&
      lifetime.value === resultId,
  );
  if (
    !state.materializedValues.has(resultId) ||
    state.forwardedRegisterValues.has(resultId) ||
    value.kind !== "register" ||
    !hasSemanticLifetime
  ) {
    return Object.freeze({ instructions: instructionsInput, value });
  }
  const request = requestStorage(
    state,
    `retained-value:${resultId}`,
    "temporary",
    value.bytes,
    "ram",
    source,
    "Semantic value retained across later machine clobbers",
    type,
  );
  const retained: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: request.id,
    bytes: value.bytes,
    signed: value.signed ?? false,
  });
  const instructions = [...instructionsInput, storeA(retained, 0, state, source)];
  if (value.registers === "ax") {
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "stx",
        "storage",
        Object.freeze({ kind: "storage", requestId: request.id, offset: 1 }),
        [],
        source,
      ),
    );
  }
  return Object.freeze({
    instructions: Object.freeze(instructions),
    value: retained,
  });
}

/** Load one byte of a retained value into A. */
export function loadA(
  value: LoweredValue,
  offset: number,
  state: FunctionLoweringState,
  source: SourceSpan,
): MachineInstruction {
  try {
    return machineInstruction(
      state.input.profile.cpu,
      "lda",
      modeForValue(value, offset),
      operandForValue(value, offset),
      [],
      source,
    );
  } catch (error) {
    throw loweringFailure(error instanceof Error ? error.message : "Cannot load value", source);
  }
}

/** Append the load needed to make one byte current in A; a register value is already current. */
export function appendLoadA(
  instructions: MachineInstruction[],
  value: LoweredValue,
  offset: number,
  state: FunctionLoweringState,
  source: SourceSpan,
): void {
  if (value.kind === "register") {
    if (offset === 0) return;
    if (offset === 1 && value.registers === "ax") {
      instructions.push(
        machineInstruction(state.input.profile.cpu, "txa", "implied", null, [], source),
      );
      return;
    }
    throw loweringFailure("Register value does not retain the requested byte", source);
  }
  instructions.push(loadA(value, offset, state, source));
}

/** Store A into one byte of a retained place. */
export function storeA(
  place: LoweredValue,
  offset: number,
  state: FunctionLoweringState,
  source: SourceSpan,
): MachineInstruction {
  if (place.kind !== "storage" && place.kind !== "label") {
    throw loweringFailure("Destination is not a writable machine place", source);
  }
  return machineInstruction(
    state.input.profile.cpu,
    "sta",
    modeForValue(place),
    operandForValue(place, offset),
    [],
    source,
  );
}
