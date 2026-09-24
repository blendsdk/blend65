import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { SemanticBlock, SemanticPlace, SemanticTerminator } from "../semantic/operations.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { StorageRequest } from "../storage/storage-types.js";
import { storageInventoryHash } from "../storage/closure.js";
import { inventoryStorage } from "../storage/inventory.js";
import {
  createC64Startup,
  createC64StartupStateData,
  type C64StartupInitializer,
} from "../layout/startup.js";
import {
  lowerTerminator,
  machineCost,
  machineInstruction,
  machineState,
  type LoweredValue,
  modeForValue,
  operandForValue,
} from "./lower-control.js";
import { prepareAggregateInduction, type AggregateInductionRuntime } from "./lower-induction.js";
import { lowerOperation } from "./lower-operation.js";
import type {
  MachineBlock,
  MachineDataObject,
  MachineFunction,
  MachineInstruction,
  MachineLoweringInput,
  MachineLoweringResult,
  MachineMemoryEffect,
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
function isLoweringFailure(error: unknown): error is LoweringFailure {
  return error instanceof Error && error.name === "LoweringFailure" && "source" in error;
}

/** Return the exact packed byte width of one semantic type. */
export function typeBytes(type: SemanticType): number {
  if (type.kind === "array" || type.kind === "struct") return type.size;
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

/** Return each distinct semantic successor without adding a general CFG analysis layer. */
function semanticSuccessors(terminator: SemanticTerminator): readonly string[] {
  if (terminator.kind === "jump") return Object.freeze([terminator.target]);
  if (terminator.kind !== "branch") return Object.freeze([]);
  return terminator.whenTrue === terminator.whenFalse
    ? Object.freeze([terminator.whenTrue])
    : Object.freeze([terminator.whenTrue, terminator.whenFalse]);
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
  readonly owner: BindingId;
  readonly values: Map<string, LoweredValue>;
  readonly requests: StorageRequest[];
  readonly input: MachineLoweringInput;
  readonly allPositions: readonly { readonly block: string; readonly operation: number }[];
  readonly branchConditions: ReadonlySet<string>;
  readonly materializedValues: ReadonlySet<string>;
  readonly addressValues: ReadonlySet<string>;
  readonly callSpans: readonly SourceSpan[];
  readonly mergeCopies: {
    readonly predecessor: string;
    readonly incoming: string;
    readonly destination: LoweredValue;
    readonly bytes: number;
    readonly source: SourceSpan;
  }[];
  readonly generatedData: Map<string, MachineDataObject>;
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
      machineInstruction(state.input.profile.cpu, "txa", "implied", null, [], source),
      storeA(retained, 1, state, source),
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
    return;
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

/** Lower one semantic operation and retain its result identity. */

/** Lower one ordered block list into one machine function. */
function lowerFunction(
  id: string,
  owner: BindingId,
  blocks: readonly SemanticBlock[],
  input: MachineLoweringInput,
  requests: StorageRequest[],
  generatedData: Map<string, MachineDataObject>,
  returnsToStartup: boolean,
): MachineFunction {
  const blockIndexes = new Map(blocks.map((block, index) => [block.id, index] as const));
  const predecessors = new Map(blocks.map((block) => [block.id, [] as string[]] as const));
  for (const block of blocks) {
    for (const successor of semanticSuccessors(block.terminator)) {
      const incoming = predecessors.get(successor);
      if (incoming !== undefined) incoming.push(block.id);
    }
  }
  const positions = Object.freeze(
    blocks.flatMap((block) =>
      Array.from({ length: block.operations.length + 1 }, (_, operation) =>
        Object.freeze({ block: block.id, operation }),
      ),
    ),
  );
  const materializedValues = new Set<string>();
  const addressValues = new Set<string>();
  for (const block of blocks) {
    for (const operation of block.operations) {
      if (
        operation.kind === "load" ||
        operation.kind === "store" ||
        operation.kind === "place-address"
      ) {
        for (const component of operation.place.path) {
          if (component.kind === "index") {
            addressValues.add(component.value);
            materializedValues.add(component.value);
          }
        }
      }
      if (operation.kind === "store") materializedValues.add(operation.value);
      else if (operation.kind === "convert") materializedValues.add(operation.operand);
      else if (operation.kind === "unary") materializedValues.add(operation.operand);
      else if (operation.kind === "binary") {
        materializedValues.add(operation.left);
        materializedValues.add(operation.right);
      } else if (operation.kind === "call" || operation.kind === "platform") {
        for (const argument of operation.arguments) materializedValues.add(argument);
      } else if (operation.kind === "memory-read") materializedValues.add(operation.address);
      else if (operation.kind === "memory-write") {
        materializedValues.add(operation.address);
        materializedValues.add(operation.value);
      } else if (operation.kind === "aggregate") {
        for (const element of operation.elements) materializedValues.add(element.value);
        if (operation.fill !== null) materializedValues.add(operation.fill);
      } else if (operation.kind === "merge") {
        for (const incoming of operation.incoming) materializedValues.add(incoming.value);
      }
    }
    if (block.terminator.kind === "return" && block.terminator.value !== null) {
      materializedValues.add(block.terminator.value);
    }
  }
  const state: FunctionLoweringState = {
    owner,
    values: new Map(),
    requests,
    input,
    allPositions: positions,
    branchConditions: new Set(
      blocks.flatMap(({ terminator }) =>
        terminator.kind === "branch" ? [terminator.condition] : [],
      ),
    ),
    materializedValues,
    addressValues,
    callSpans: Object.freeze(
      blocks.flatMap((block) =>
        block.operations.flatMap((operation) =>
          operation.kind === "call" ? [operation.span] : [],
        ),
      ),
    ),
    mergeCopies: [],
    generatedData,
    aggregateAddressCache: null,
    aggregateInduction: null,
  };
  state.aggregateInduction = prepareAggregateInduction(blocks, state);
  const loweredBlocks: MachineBlock[] = [];
  const semanticExitLabels = new Map<string, string>();
  const aggregateAddressCacheAtExit = new Map<string, AggregateAddressCache | null>();
  for (const block of blocks) {
    const incoming = predecessors.get(block.id) ?? [];
    const blockIndex = blockIndexes.get(block.id)!;
    const incomingCaches =
      incoming.length > 0 &&
      incoming.every((predecessor) => {
        const predecessorIndex = blockIndexes.get(predecessor);
        return (
          predecessorIndex !== undefined &&
          predecessorIndex < blockIndex &&
          aggregateAddressCacheAtExit.has(predecessor)
        );
      })
        ? incoming.map((predecessor) => aggregateAddressCacheAtExit.get(predecessor) ?? null)
        : [];
    const firstIncomingCache = incomingCaches[0] ?? null;
    state.aggregateAddressCache =
      firstIncomingCache !== null &&
      incomingCaches.every((cache) => cache !== null && cache.key === firstIncomingCache.key)
        ? firstIncomingCache
        : null;
    if (state.aggregateInduction?.header === block.id) {
      state.aggregateAddressCache = state.aggregateInduction.cache;
    }
    let currentLabel = block.id;
    let currentInstructions: MachineInstruction[] = [];
    let waitIndex = 0;
    for (const operation of block.operations) {
      if (operation.kind !== "platform" || operation.capability !== "c64.video.waitNextFrame") {
        currentInstructions.push(...lowerOperation(operation, state));
        continue;
      }

      const waitInstructions = lowerOperation(operation, state);
      if (waitInstructions.length !== 4) {
        throw loweringFailure(
          "Frame wait did not produce its two raster-line comparisons",
          operation.span,
        );
      }
      const highLabel =
        currentInstructions.length === 0 ? currentLabel : `${block.id}.wait.${waitIndex}.high`;
      const lowLabel = `${block.id}.wait.${waitIndex}.low`;
      const continuationLabel = `${block.id}.wait.${waitIndex}.continue`;
      if (currentInstructions.length > 0) {
        loweredBlocks.push(
          Object.freeze({
            label: currentLabel,
            instructions: Object.freeze(currentInstructions),
            terminator: Object.freeze({ kind: "fallthrough", target: highLabel }),
          }),
        );
      }
      loweredBlocks.push(
        Object.freeze({
          label: highLabel,
          instructions: Object.freeze([waitInstructions[0]!, waitInstructions[1]!]),
          terminator: Object.freeze({
            kind: "branch",
            opcode: "beq",
            target: highLabel,
            fallthrough: lowLabel,
            uses: machineState([], ["z"]),
            cost: machineCost(input.profile.cpu, "beq", "relative"),
          }),
        }),
        Object.freeze({
          label: lowLabel,
          instructions: Object.freeze([waitInstructions[2]!, waitInstructions[3]!]),
          terminator: Object.freeze({
            kind: "branch",
            opcode: "bne",
            target: lowLabel,
            fallthrough: continuationLabel,
            uses: machineState([], ["z"]),
            cost: machineCost(input.profile.cpu, "bne", "relative"),
          }),
        }),
      );
      currentLabel = continuationLabel;
      currentInstructions = [];
      waitIndex += 1;
    }
    if (state.aggregateInduction?.preheader === block.id) {
      currentInstructions.push(...state.aggregateInduction.initialization);
      state.aggregateAddressCache = state.aggregateInduction.cache;
    }
    if (block.terminator.kind === "return" && block.terminator.value !== null) {
      const returned = state.values.get(block.terminator.value);
      if (returned === undefined || returned.kind === "condition") {
        throw loweringFailure("Return value was not retained", state.owner.span);
      }
      if (returned.kind === "register") {
        if (
          (returned.bytes === 1 && returned.registers !== "a") ||
          (returned.bytes === 2 && returned.registers !== "ax")
        ) {
          throw loweringFailure("Return register shape does not match its width", state.owner.span);
        }
      } else if (returned.bytes === 2) {
        appendLoadA(currentInstructions, returned, 1, state, state.owner.span);
        currentInstructions.push(
          machineInstruction(input.profile.cpu, "tax", "implied", null, [], state.owner.span),
        );
        appendLoadA(currentInstructions, returned, 0, state, state.owner.span);
      } else {
        appendLoadA(currentInstructions, returned, 0, state, state.owner.span);
      }
    }
    if (block.terminator.kind === "branch") {
      const condition = state.values.get(block.terminator.condition);
      if (condition === undefined) {
        throw loweringFailure("Branch condition was not retained", state.owner.span);
      }
      if (condition.kind !== "condition") {
        appendLoadA(currentInstructions, condition, 0, state, state.owner.span);
      }
    }
    loweredBlocks.push(
      Object.freeze({
        label: currentLabel,
        instructions: Object.freeze(currentInstructions),
        terminator: lowerTerminator(
          block.terminator,
          state.values,
          input.profile.cpu,
          returnsToStartup,
        ),
      }),
    );
    semanticExitLabels.set(block.id, currentLabel);
    aggregateAddressCacheAtExit.set(block.id, state.aggregateAddressCache);
  }
  for (const copy of state.mergeCopies) {
    const incoming = state.values.get(copy.incoming);
    const exitLabel = semanticExitLabels.get(copy.predecessor);
    if (incoming === undefined || incoming.kind === "condition" || exitLabel === undefined) {
      throw loweringFailure("Merge predecessor has no materialized incoming value", copy.source);
    }
    const blockIndex = loweredBlocks.findIndex(({ label }) => label === exitLabel);
    const block = loweredBlocks[blockIndex];
    if (block === undefined || block.terminator.kind !== "jump") {
      throw loweringFailure("Merge predecessor is not an edge-specific jump", copy.source);
    }
    const instructions = [...block.instructions];
    for (let offset = 0; offset < copy.bytes; offset += 1) {
      appendLoadA(instructions, incoming, offset, state, copy.source);
      instructions.push(storeA(copy.destination, offset, state, copy.source));
    }
    loweredBlocks[blockIndex] = Object.freeze({
      ...block,
      instructions: Object.freeze(instructions),
    });
  }
  return Object.freeze({ id, blocks: Object.freeze(loweredBlocks) });
}

/** Return the machine data objects owned by globals and reachable assets. */
function lowerData(
  program: WholeProgram,
  generatedData: ReadonlyMap<string, MachineDataObject>,
): readonly MachineDataObject[] {
  const globals = program.semantic.globals
    .filter((global) => !(global.storage === "constant" && global.type.kind === "scalar"))
    .map((global) => {
      const bytes = typeBytes(global.type);
      const encoded = global.initialBytes;
      if (encoded !== null && encoded.length !== bytes) {
        throw loweringFailure("Global initial bytes do not match the declared type", global.source);
      }
      return Object.freeze({
        id: bindingLabel("global", global.id),
        kind:
          encoded === null
            ? ("bss" as const)
            : global.storage === "constant"
              ? ("immutable" as const)
              : ("global" as const),
        alignment: 1,
        bytes: encoded ?? Object.freeze(new Array<number>(bytes).fill(0)),
      });
    });
  const reachable = new Set(program.reachableAssets);
  const assets = program.semantic.assets
    .filter(({ id }) => reachable.has(id))
    .map((asset) =>
      Object.freeze({
        id: `asset.${asset.id}`,
        kind: "asset" as const,
        assetId: asset.id,
        alignment: 64,
        bytes: asset.bytes,
      }),
    );
  const generated = [...generatedData.values()].sort((left, right) =>
    Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
  );
  return Object.freeze([...globals, ...assets, ...generated, createC64StartupStateData()]);
}

/** Lower a side-effect-free constant module initializer to inline runtime stores. */
function lowerConstantInitializer(
  global: WholeProgram["semantic"]["globals"][number],
  input: MachineLoweringInput,
  accumulator: number | null,
): { readonly instructions: readonly MachineInstruction[]; readonly accumulator: number | null } {
  const bytes = global.runtimeInitialBytes;
  if (bytes === null || global.entry === null || bytes.length !== typeBytes(global.type)) {
    throw loweringFailure(
      "Constant runtime initializer bytes do not match the global",
      global.source,
    );
  }
  const target = bindingLabel("global", global.id);
  const instructions: MachineInstruction[] = [];
  let currentAccumulator = accumulator;
  for (const [offset, value] of bytes.entries()) {
    if (value !== currentAccumulator) {
      instructions.push(
        machineInstruction(
          input.profile.cpu,
          "lda",
          "immediate",
          Object.freeze({ kind: "immediate", value }),
          [],
          global.source,
        ),
      );
      currentAccumulator = value;
    }
    const memory = Object.freeze([
      Object.freeze({
        kind: "write" as const,
        address: Object.freeze({ kind: "symbolic" as const, label: target, offset }),
        width: 1 as const,
        volatile: false,
        order: 0,
      }),
    ]) satisfies readonly MachineMemoryEffect[];
    instructions.push(
      machineInstruction(
        input.profile.cpu,
        "sta",
        "absolute",
        Object.freeze({ kind: "label", label: target, offset }),
        memory,
        global.source,
      ),
    );
  }
  return Object.freeze({
    instructions: Object.freeze(instructions),
    accumulator: currentAccumulator,
  });
}

/**
 * Lower one closed semantic program directly to documented NMOS machine operations.
 * @param input Closed program, provisional SFA placement and exact selected profile.
 * @returns Structured machine program plus its finite late-storage binder.
 */
export function lowerMachineProgram(input: MachineLoweringInput): MachineLoweringResult {
  const requests: StorageRequest[] = [];
  const generatedData = new Map<string, MachineDataObject>();
  try {
    const functionsByKey = new Map(
      input.program.semantic.functions.map((fn) => [bindingIdentityKey(fn.id), fn] as const),
    );
    const machineFunctions: MachineFunction[] = [];
    for (const functionId of input.program.reachableFunctions) {
      const semantic = functionsByKey.get(bindingIdentityKey(functionId));
      if (semantic === undefined) {
        throw loweringFailure("Reachable semantic function is absent", functionId.span);
      }
      const id = bindingLabel("fn", semantic.id);
      machineFunctions.push(
        lowerFunction(
          id,
          semantic.id,
          semantic.blocks,
          input,
          requests,
          generatedData,
          bindingIdentityKey(semantic.id) === bindingIdentityKey(input.program.semantic.main),
        ),
      );
    }

    const globalsByKey = new Map(
      input.program.semantic.globals.map(
        (global) => [bindingIdentityKey(global.id), global] as const,
      ),
    );
    const startupInitializers: C64StartupInitializer[] = [];
    let initializerAccumulator: number | null = 0;
    for (const initializer of input.program.semantic.initializerOrder) {
      const global = globalsByKey.get(bindingIdentityKey(initializer));
      if (global === undefined || global.entry === null) {
        throw loweringFailure("Initializer root is absent", initializer.span);
      }
      const label = bindingLabel("init", initializer);
      if (global.runtimeInitialBytes === null) {
        startupInitializers.push(Object.freeze({ kind: "call", label }));
        machineFunctions.push(
          lowerFunction(label, initializer, global.blocks, input, requests, generatedData, false),
        );
        initializerAccumulator = null;
      } else {
        const lowered = lowerConstantInitializer(global, input, initializerAccumulator);
        startupInitializers.push(
          Object.freeze({ kind: "inline", instructions: lowered.instructions }),
        );
        initializerAccumulator = lowered.accumulator;
      }
    }

    const mainFunction = functionsByKey.get(bindingIdentityKey(input.program.semantic.main));
    if (mainFunction === undefined) {
      throw loweringFailure("Main function is absent", input.program.semantic.main.span);
    }
    const mainLabel = bindingLabel("fn", mainFunction.id);
    const startup = createC64Startup({
      initializerLabels: Object.freeze([]),
      initializers: Object.freeze(startupInitializers),
      mainLabel,
      profile: input.profile,
    });
    if (startup.kind === "error") {
      throw loweringFailure(startup.reason, null);
    }

    requests.sort((left, right) => Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)));
    const initialInventory = inventoryStorage(input.program);
    const certifiedStorage = Object.freeze(
      [...initialInventory.requests, ...requests].sort((left, right) =>
        Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
      ),
    );
    const inventoryHash = storageInventoryHash(
      Object.freeze({
        program: input.program,
        requests: certifiedStorage,
        results: initialInventory.results,
      }),
    );
    const binder = Object.freeze({
      candidateRequestIds: Object.freeze(requests.map(({ id }) => id)),
      helperCalls: Object.freeze([]),
      discover: () => Object.freeze([...requests]),
    });
    return Object.freeze({
      kind: "complete",
      program: Object.freeze({
        functions: Object.freeze(machineFunctions),
        data: lowerData(input.program, generatedData),
        startup: startup.startup,
        requiredStorage: Object.freeze([...requests]),
        certifiedStorage,
        storageInventoryHash: inventoryHash,
        storageProfileId: input.profile.id,
        storageProfile: input.profile.storage,
      }),
      binder,
    });
  } catch (error) {
    if (isLoweringFailure(error)) {
      return Object.freeze({ kind: "error", reason: error.message, source: error.source });
    }
    throw error;
  }
}
