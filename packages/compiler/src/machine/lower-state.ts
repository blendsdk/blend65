import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { ByteComplementRuntime } from "./byte-value-availability.js";
import type { FixedLoopRuntime } from "./fixed-loop-selection.js";
import type {
  MemoryWriteOperation,
  SemanticBlock,
  SemanticOperation,
  SemanticPlace,
} from "../semantic/operations.js";
import type { InterruptExecutionContext } from "../semantic/interrupt-contexts.js";
import { validLocalStorageLifetime } from "../semantic/local-storage-lifetimes.js";
import type { StorageRequest } from "../storage/storage-types.js";
import {
  selectedStoragePlace,
  validObjectStorageSelection,
  validObjectStorageBundle,
  validNonLoopBundleTag,
  declaredStorage,
} from "../storage/selection.js";
import {
  machineInstruction,
  type LoweredValue,
  modeForValue,
  operandForValue,
  typeBytes,
  bindingLabel,
} from "./lower-control.js";
import { type AggregateInductionRuntime } from "./lower-induction.js";
import type { MultiplyHelper } from "./lower-multiply.js";
import type { DivideHelper } from "./lower-division.js";
import type {
  MachineBlock,
  MachineDataObject,
  MachineInstruction,
  MachineLoweringInput,
  MachineFunctionSourceFacts,
  MachineFunction,
  AggregateAddressCache,
} from "./machine-types.js";

export type { AggregateAddressCache } from "./machine-types.js";

/** Internal proving failure converted to the direct lowering error union. */
export interface LoweringFailure extends Error {
  /** Source which selected the unsupported or inconsistent operation. */
  readonly source: SourceSpan | null;
  /** Exact user-facing code when the failure is a proved source/layout constraint. */
  readonly code?: "E10143" | "E10273";
  /** Named objects, addresses or intervals which contributed to the failure. */
  readonly contributors?: readonly string[];
}

/** Construct one proving failure without adding an exception-class hierarchy. */
export function loweringFailure(
  message: string,
  source: SourceSpan | null,
  details?: { readonly code?: "E10143" | "E10273"; readonly contributors?: readonly string[] },
): LoweringFailure {
  return Object.assign(new Error(message), {
    name: "LoweringFailure",
    source,
    ...(details?.code === undefined ? {} : { code: details.code }),
    ...(details?.contributors === undefined ? {} : { contributors: details.contributors }),
  });
}

/** Recognize a proving failure at the public lowering boundary. */
export function isLoweringFailure(error: unknown): error is LoweringFailure {
  return error instanceof Error && error.name === "LoweringFailure" && "source" in error;
}

/** Keep existing scalar-width and label entries with their common value/control owner. */
export { typeBytes, bindingLabel, isSignedType } from "./lower-control.js";

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
  /** Exact per-source function facts; every machine context keeps its own mutable state. */
  readonly sourceFacts?: MachineFunctionSourceFacts;
  /** Context-local complement values and already declared cache setup. */
  byteComplements?: ByteComplementRuntime;
  /** Explicit occurrence schedule; original source positions remain the storage authority. */
  readonly fixedLoops?: FixedLoopRuntime;
  /** Memoized certified source root; null records the ordinary separate-home path. */
  returnedLocalRoot?: BindingId | null;
  /** Proven vector nesting at this machine variant's entry. */
  readonly interruptDepth: InterruptExecutionContext;
  /** Machine location of each already selected semantic value. */
  readonly values: Map<string, LoweredValue>;
  /** Opt-in actual capture demands retained until the symbolic function is frozen. */
  readonly aggregateCaptures?: NonNullable<MachineFunction["observerCaptures"]>[number][];
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
  readonly forwardedRegisterValues: Set<string>;
  /** Values whose fresh Z may be consumed by an adjacent closed zero test. */
  readonly zeroFlagValues: Set<string>;
  /** Values proved to hold exactly `0` or `1` from a `mask == 1` bit test. */
  readonly booleanValues: Set<string>;
  /** Values proved Boolean from a single-bit mask, with their normalization shift count. */
  readonly booleanShiftValues: ReadonlyMap<string, number>;
  /** Masked values materialized as a Boolean through an inline expert branch. */
  readonly booleanBranchValues: ReadonlySet<string>;
  /** NMI local bindings whose request was omitted before SFA allocation. */
  readonly elidedLocalBindings: ReadonlySet<string>;
  /** Zero-extending conversion results whose low byte stays in A. */
  readonly zeroExtensionValues: ReadonlySet<string>;
  /** NMI local bindings retained on the hardware stack for this handler. */
  readonly stackRetainedBindings: ReadonlySet<string>;
  /** Current number of bytes pushed by the handler body. */
  stackDepth: number;
  /** Assigned push order for each stack-retained binding. */
  readonly stackSlots: Map<string, number>;
  /** Whether X still holds SP for a subsequent stack-relative load. */
  stackXValid: boolean;
  /** Exact sole adjacent indexed additions selected from that access's unsigned proof. */
  readonly byteOrdinalAdditions?: ReadonlySet<string>;
  /** Proved `constant + byte index` raw-read addresses; absent without size observers. */
  readonly ordinalRawReads?: ReadonlyMap<string, { readonly base: number; readonly index: string }>;
  /** Proved `constant + byte index` raw-write addresses in every non-metadata mode. */
  readonly ordinalRawWrites?: ReadonlyMap<
    string,
    { readonly base: number; readonly index: string }
  >;
  /** One adjacent fixed byte read delivered by its proved store or bitwise consumer. */
  adjacentByteRead?: {
    /** Sole consuming operation's semantic value identity. */
    readonly value: string;
    /** Original instruction, including its source and ordered volatile effect. */
    readonly instruction: MachineInstruction;
  };
  /** Word BCD results written directly to one fixed volatile destination. */
  readonly directBcdWrites: ReadonlyMap<string, MemoryWriteOperation>;
  /** Static place addresses consumed directly by one raw read or write. */
  readonly staticRawAddresses?: ReadonlySet<string>;
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
  /** Existing inclusive unsigned maxima valid at this exact indexed access or shift. */
  ordinalBounds?: ReadonlyMap<string, bigint>;
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

/** Compare unchanged immutable source fields, ignoring only an explicitly owned representation field. */
function sameSourceFields(left: object, right: object, ignored: string): boolean {
  const keys = Reflect.ownKeys(left).filter((key) => key !== ignored);
  return (
    keys.length === Reflect.ownKeys(right).filter((key) => key !== ignored).length &&
    keys.every(
      (key) => Reflect.has(right, key) && Reflect.get(left, key) === Reflect.get(right, key),
    )
  );
}

/**
 * Reject stale facts before any selected machine operation can consume them.
 * The only allowed source representation change is zero-page global placement;
 * source functions, domains, effects, routes and initializer operations stay exact.
 * @param input Lowering source, its optional precomputed facts and current placement.
 * @throws {LoweringFailure} If any source, function, loop or lifetime belongs to another input.
 */
export function validateMachineSourceFacts(input: MachineLoweringInput): void {
  const facts = input.sourceFacts;
  if (facts === undefined) return;
  if (!validNonLoopBundleTag(facts.nonLoopBundle))
    throw loweringFailure("Unknown machine non-loop construction bundle", null);
  if (
    facts.objectOnly === true &&
    (facts.nonLoopBundle !== undefined ||
      facts.loopPolicy !== undefined ||
      facts.startupPolicy !== undefined ||
      ![...facts.functions.values()].some((entry) => entry.storage !== undefined) ||
      [...facts.functions.values()].some((entry) => entry.complements !== undefined))
  )
    throw loweringFailure("Canonical object facts cannot activate a construction bundle", null);
  const source = facts.program;
  const current = input.program;
  const globals = current.semantic.globals;
  const validGlobals =
    source.semantic.globals.length === globals.length &&
    source.semantic.globals.every((global, index) => {
      const placed = globals[index]!;
      if (global === placed) return true;
      return (
        global.zeropage === true &&
        sameSourceFields(global, placed, "placement") &&
        placed.placement?.at != null &&
        (global.placement?.at == null || global.placement.at === placed.placement.at) &&
        (global.placement?.align ?? 1) === placed.placement.align &&
        (global.placement?.noCross ?? null) === placed.placement.noCross &&
        placed.placement.region === null
      );
    });
  if (
    !sameSourceFields(source, current, "semantic") ||
    !sameSourceFields(source.semantic, current.semantic, "globals") ||
    !validGlobals
  )
    throw loweringFailure("Machine source facts do not match the checked source program", null);
  if (
    !validObjectStorageBundle(
      facts.functions,
      facts.nonLoopBundle !== "direct",
      facts.objectOnly === true
        ? "canonical-object"
        : facts.nonLoopBundle === "closed"
          ? "closed"
          : undefined,
    )
  )
    throw loweringFailure(
      "Machine object recipes do not match the complete selected source bundle",
      null,
    );
  for (const [fn, selected] of facts.functions) {
    if (
      !source.semantic.functions.includes(fn) ||
      selected.function !== fn ||
      selected.objects.program !== source ||
      selected.loops.some((loop) => loop.program !== source || loop.function !== fn) ||
      selected.objects.rangeObservers.some(
        (loop) => loop.program !== source || !source.semantic.functions.includes(loop.function),
      ) ||
      [...selected.lifetimes].some(
        ([key, lifetime]) =>
          lifetime.function !== fn.id || !validLocalStorageLifetime(source, key, lifetime),
      ) ||
      (selected.storage !== undefined &&
        !validObjectStorageSelection(selected.storage, selected.objects, fn))
    )
      throw loweringFailure(
        "Machine function facts do not match the checked source function",
        fn.source,
      );
  }
}

/**
 * Inventory the existing value-use obligations once before constructing function state.
 * Same-place aggregate stores do not count as a later retained aggregate use;
 * this query deliberately preserves the established direct lowering decisions.
 * @param blocks Actual selected source blocks for one execution context.
 * @returns Existing materialization, address and single-use facts without any rewrite.
 */
export function functionValueUses(
  blocks: readonly SemanticBlock[],
): Pick<
  FunctionLoweringState,
  "materializedValues" | "singleUseValues" | "retainedAggregateResults" | "addressValues"
> {
  const materializedValues = new Set<string>();
  const valueUseCounts = new Map<string, number>();
  const aggregateDestinations = new Map(
    blocks.flatMap((block) =>
      block.operations.flatMap((operation) =>
        operation.kind === "aggregate"
          ? [
              [
                operation.result,
                operation.destination?.kind === "place" ? operation.destination.place : null,
              ] as const,
            ]
          : [],
      ),
    ),
  );
  const retainedAggregateResults = new Set<string>();
  const recordUse = (value: string, consumer: SemanticOperation | null): void => {
    materializedValues.add(value);
    valueUseCounts.set(value, (valueUseCounts.get(value) ?? 0) + 1);
    if (!aggregateDestinations.has(value)) return;
    const destination = aggregateDestinations.get(value);
    if (
      consumer?.kind === "store" &&
      destination !== null &&
      destination !== undefined &&
      (consumer.place === destination ||
        (consumer.place.path.length === 0 &&
          destination.path.length === 0 &&
          bindingIdentityKey(consumer.place.root) === bindingIdentityKey(destination.root)))
    )
      return;
    retainedAggregateResults.add(value);
  };
  const addressValues = new Set<string>();
  for (const block of blocks) {
    for (const operation of block.operations) {
      const indexedPlace =
        operation.kind === "load" ||
        operation.kind === "store" ||
        operation.kind === "place-address"
          ? operation.place
          : operation.kind === "aggregate" && operation.destination?.kind === "place"
            ? operation.destination.place
            : null;
      if (indexedPlace !== null)
        for (const component of indexedPlace.path) {
          if (component.kind === "index") {
            addressValues.add(component.value);
            recordUse(component.value, operation);
          }
        }
      if (operation.kind === "store") recordUse(operation.value, operation);
      else if (operation.kind === "convert" || operation.kind === "unary")
        recordUse(operation.operand, operation);
      else if (operation.kind === "binary" || operation.kind === "bcd") {
        recordUse(operation.left, operation);
        recordUse(operation.right, operation);
      } else if (operation.kind === "call" || operation.kind === "platform") {
        for (const argument of operation.arguments) recordUse(argument, operation);
      } else if (operation.kind === "indirect-call") {
        recordUse(operation.target, operation);
        for (const argument of operation.arguments) recordUse(argument, operation);
      } else if (operation.kind === "memory-read") recordUse(operation.address, operation);
      else if (operation.kind === "memory-write") {
        recordUse(operation.address, operation);
        recordUse(operation.value, operation);
      } else if (operation.kind === "aggregate") {
        for (const element of operation.elements) recordUse(element.value, operation);
        if (operation.fill !== null) recordUse(operation.fill, operation);
      } else if (operation.kind === "merge") {
        for (const incoming of operation.incoming) recordUse(incoming.value, operation);
      }
    }
    if (block.terminator.kind === "return" && block.terminator.value !== null)
      recordUse(block.terminator.value, null);
  }
  const singleUseValues = new Set(
    [...valueUseCounts].filter(([, uses]) => uses === 1).map(([value]) => value),
  );
  return { materializedValues, singleUseValues, retainedAggregateResults, addressValues };
}

/** Use the existing source lifetime for functions and executable initializers alike. */
function selectedValueLifetime(state: FunctionLoweringState, value: string) {
  const owner = bindingIdentityKey(state.owner);
  const lifetimes =
    state.input.program.initializers?.find(
      (initializer) => bindingIdentityKey(initializer.binding) === owner,
    )?.lifetimes ?? state.input.program.lifetimes;
  return lifetimes.find(
    (lifetime) => bindingIdentityKey(lifetime.function) === owner && lifetime.value === value,
  );
}

/** Build a conservative finite lifetime for machine-discovered function storage. */
function machineLifetime(state: FunctionLoweringState, value: string, precise = true) {
  const semantic = selectedValueLifetime(state, value);
  if (precise && semantic !== undefined) return semantic;
  return Object.freeze({
    function: state.owner,
    value,
    definition:
      semantic?.definition ??
      state.allPositions[0] ??
      Object.freeze({ block: "entry", operation: 0 }),
    liveAt: state.allPositions,
    callsCrossed: state.callSpans,
  });
}

/**
 * Add or return one stable machine request. An explicit source value preserves
 * its original lifetime independently of the request's representation-specific ID.
 * Function-wide retention is explicit when unproved views may keep the backing alive.
 */
export function requestStorage(
  state: FunctionLoweringState,
  idSuffix: string,
  storageClass: "temporary" | "pointer" | "spill",
  bytes: number,
  region: StorageRequest["region"],
  source: SourceSpan,
  reason: string,
  type: SemanticType | null = null,
  value: string = idSuffix,
  lifetime: "source" | "function" = "source",
): StorageRequest {
  const id = `machine:${bindingIdentityKey(state.owner)}:${idSuffix}`;
  const existing = state.requests.find((request) => request.id === id);
  if (existing !== undefined) return existing;
  const request: StorageRequest = Object.freeze({
    id,
    storageClass,
    owner: state.owner,
    binding: null,
    value,
    type,
    bytes,
    alignment: 1,
    region,
    lifetime: machineLifetime(state, value, lifetime === "source"),
    source,
    reason,
  });
  state.requests.push(request);
  return request;
}

/** Match a certified root once per execution context, before any direct-home fallback. */
export function isReturnedLocalPlace(place: SemanticPlace, state: FunctionLoweringState): boolean {
  const selected = state.sourceFacts?.storage?.resultLocal;
  if (selected != null && bindingIdentityKey(selected) === bindingIdentityKey(place.root))
    return true;
  if (state.input.program.returnedLocalDestinations === undefined) return false;
  if (state.returnedLocalRoot === undefined) {
    const owner = bindingIdentityKey(state.owner);
    state.returnedLocalRoot =
      state.input.program.returnedLocalDestinations?.find(
        (binding) => bindingIdentityKey(binding.function) === owner,
      )?.local ?? null;
  }
  return (
    state.returnedLocalRoot !== null &&
    bindingIdentityKey(state.returnedLocalRoot) === bindingIdentityKey(place.root)
  );
}

/** Resolve the existing fixed-result ABI's closed pointer, never an object's data bytes. */
export function aggregateResultPointer(
  owner: BindingId,
  state: FunctionLoweringState,
  source: SourceSpan,
): Extract<LoweredValue, { readonly kind: "storage" }> {
  const requestId = `${bindingIdentityKey(owner)}:pointer:aggregate-return-destination`;
  if (declaredStorage(state.input, (id) => id === requestId) === undefined)
    throw loweringFailure("Aggregate return destination has no certified pointer home", source);
  return Object.freeze({ kind: "storage", requestId, bytes: 2, signed: false });
}

/** Find a source object's direct home, or its certified caller-result base pointer. */
export function loweredPlace(
  place: SemanticPlace,
  bytes: number,
  signed: boolean,
  state: FunctionLoweringState,
): LoweredValue {
  place = selectedStoragePlace(place, state.sourceFacts?.storage);
  if (isReturnedLocalPlace(place, state)) {
    return aggregateResultPointer(state.owner, state, place.root.span);
  }
  if (place.asset !== undefined) {
    return Object.freeze({ kind: "label", label: `asset.${place.asset}`, bytes, signed });
  }
  const bindingKey = bindingIdentityKey(place.root);
  const home = declaredStorage(
    state.input,
    (id) => id.endsWith(`:parameter:${bindingKey}`) || id.endsWith(`:local:${bindingKey}`),
  );
  if (home !== undefined) {
    return Object.freeze({
      kind: "storage",
      requestId: home.id,
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
  options: { readonly zeroPagePreferred?: boolean } = {},
): { readonly instructions: readonly MachineInstruction[]; readonly value: LoweredValue } {
  const hasSemanticLifetime = selectedValueLifetime(state, resultId) !== undefined;
  const register = value.kind === "zero-extended" ? value.low : value;
  // Bounds guards insert instruction-producing blocks before the indexed
  // consumer. Its ordinal must be stable even when ordinary adjacency holds.
  const checkedOrdinal = state.input.boundsCheck && state.addressValues.has(resultId);
  let checkedRead = false;
  const instruction = instructionsInput.length === 1 ? instructionsInput[0]! : null;
  if (
    state.forwardedRegisterValues.has(resultId) &&
    value.kind === "register" &&
    value.registers === "a" &&
    value.bytes === 1 &&
    instruction?.opcode === "lda" &&
    instruction.operand?.kind === "absolute" &&
    instruction.memory.length === 1 &&
    instruction.memory[0]!.volatile &&
    instruction.memory[0]!.kind === "read"
  ) {
    const owner = bindingIdentityKey(state.owner);
    const blocks =
      state.input.program.semantic.functions.find((fn) => bindingIdentityKey(fn.id) === owner)
        ?.blocks ??
      state.input.program.semantic.globals.find((global) => bindingIdentityKey(global.id) === owner)
        ?.blocks;
    const operations =
      blocks?.find((block) => block.id === state.currentSemanticBlockId)?.operations ?? [];
    const producerIndex = operations.findIndex(
      (operation) => "result" in operation && operation.result === resultId,
    );
    let next = producerIndex < 0 ? operations.length : producerIndex + 1;
    while (next < operations.length) {
      const operation = operations[next]!;
      if (
        operation.kind !== "constant" &&
        (operation.kind !== "convert" || state.values.get(operation.operand)?.kind !== "constant")
      )
        break;
      next += 1;
    }
    const store = operations[next];
    if (
      store?.kind === "binary" &&
      ["&", "|", "^"].includes(store.operator) &&
      typeBytes(store.type) === 1 &&
      store.right === resultId &&
      state.forwardedRegisterValues.has(store.left) &&
      state.values.get(store.left)?.kind === "register" &&
      state.adjacentByteRead === undefined
    ) {
      // The ALU instruction performs this exact read after the first sample.
      // No intervening instruction or effect is removed or reordered.
      state.adjacentByteRead = Object.freeze({ value: resultId, instruction });
      return Object.freeze({ instructions: Object.freeze([]), value });
    }
    const component = store?.kind === "store" ? store.place.path[0] : undefined;
    const ordinal = component?.kind === "index" ? state.values.get(component.value) : undefined;
    const ordinalByte = ordinal?.kind === "zero-extended" ? ordinal.low : ordinal;
    checkedRead =
      state.input.boundsCheck === true &&
      component?.kind === "index" &&
      !state.fixedLoops?.indexViews.has(component.value);
    if (
      !state.input.boundsCheck &&
      store?.kind === "store" &&
      store.value === resultId &&
      typeBytes(store.type) === 1 &&
      store.place.path.length === 1 &&
      ordinalByte?.kind === "register" &&
      ordinalByte.registers === "a" &&
      ordinalByte.bytes === 1 &&
      state.adjacentByteRead === undefined &&
      state.input.profile.storage.zeroPage.every(
        ({ start, end }) =>
          instruction.operand!.kind === "absolute" &&
          (instruction.operand!.value < start || instruction.operand!.value > end),
      )
    ) {
      // Only the existing ZP pair is written before this read. Its fixed address
      // is outside every permitted pair window; no read, call or bounds guard moves.
      state.adjacentByteRead = Object.freeze({ value: resultId, instruction });
      return Object.freeze({ instructions: Object.freeze([]), value });
    }
  }
  if (
    !state.materializedValues.has(resultId) ||
    (state.forwardedRegisterValues.has(resultId) && !checkedOrdinal && !checkedRead) ||
    register.kind !== "register" ||
    !hasSemanticLifetime
  ) {
    return Object.freeze({ instructions: instructionsInput, value });
  }
  const loopValue =
    register.bytes === 1 &&
    (state.fixedLoops?.counterFacts.some((loop) =>
      loop.body.operations.some(
        (operation) => operation.span.start <= source.start && operation.span.end >= source.end,
      ),
    ) ??
      false);
  const request = requestStorage(
    state,
    `retained-value:${resultId}`,
    "temporary",
    register.bytes,
    (loopValue &&
      state.input.preferZeroPage === true &&
      state.input.sourceFacts?.loopPolicy === "mixed") ||
      (options.zeroPagePreferred === true &&
        state.input.preferZeroPage === true &&
        register.bytes === 1)
      ? "zero-page-preferred"
      : "ram",
    source,
    "Semantic value retained across later machine clobbers",
    value.kind === "zero-extended" ? null : type,
  );
  const retained: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: request.id,
    bytes: register.bytes,
    signed: register.signed ?? false,
  });
  const instructions = [...instructionsInput, storeA(retained, 0, state, source)];
  if (register.registers === "ax") {
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
    value: value.kind === "zero-extended" ? Object.freeze({ ...value, low: retained }) : retained,
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
  if (value.kind === "zero-extended" && offset === 0) {
    appendLoadA(instructions, value.low, 0, state, source);
    return;
  }
  if (value.kind === "stack") {
    if (offset !== 0) throw loweringFailure("Stack-retained value has only one byte", source);
    // The retention proof admits only consumers that leave X and SP unchanged,
    // so one TSX serves every read until the next push or pop.
    if (!state.stackXValid) {
      instructions.push(
        machineInstruction(state.input.profile.cpu, "tsx", "implied", null, [], source),
      );
      state.stackXValid = true;
    }
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "lda",
        "absolute-x",
        Object.freeze({
          kind: "absolute" as const,
          value: 0x0100 + state.stackDepth - value.slot + 1,
        }),
        [],
        source,
      ),
    );
    return;
  }
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
