import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { SemanticBlock, SemanticOperation, SemanticPlace } from "../semantic/operations.js";
import { machineInstruction, type LoweredValue } from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  createAggregateAddressCache,
  loadA,
  loweredPlace,
  requestStorage,
  storeA,
  type AggregateAddressCache,
  type FunctionLoweringState,
  typeBytes,
} from "./lower.js";

/** Compile-time description of one narrowly proved fixed-stride loop. */
interface AggregateInductionPlan {
  readonly preheader: string;
  readonly header: string;
  readonly latch: string;
  readonly index: BindingId;
  readonly root: BindingId;
  readonly rootType: SemanticType;
  readonly initial: number;
  readonly step: number;
  readonly stride: number;
  readonly updateSource: SourceSpan;
  readonly accessSource: SourceSpan;
}

/** Lowering facts for the one admitted loop-carried aggregate pointer. */
export interface AggregateInductionRuntime {
  readonly preheader: string;
  readonly header: string;
  readonly updateSourceStart: number;
  readonly indexRequestId: string;
  readonly delta: number;
  readonly cache: AggregateAddressCache;
  readonly initialization: readonly MachineInstruction[];
}

/** Return direct CFG successors without constructing a separate graph representation. */
function successors(block: SemanticBlock): readonly string[] {
  if (block.terminator.kind === "jump") return Object.freeze([block.terminator.target]);
  if (block.terminator.kind !== "branch") return Object.freeze([]);
  return block.terminator.whenTrue === block.terminator.whenFalse
    ? Object.freeze([block.terminator.whenTrue])
    : Object.freeze([block.terminator.whenTrue, block.terminator.whenFalse]);
}

/** Return whether two source bindings have the same stable identity. */
function sameBinding(left: BindingId, right: BindingId): boolean {
  return bindingIdentityKey(left) === bindingIdentityKey(right);
}

/** Find a scalar load from one exact binding. */
function loadsBinding(operation: SemanticOperation | undefined, binding: BindingId): boolean {
  return (
    operation?.kind === "load" &&
    operation.place.path.length === 0 &&
    sameBinding(operation.place.root, binding)
  );
}

/** Recover one constant as a safe nonnegative host integer. */
function constantValue(operation: SemanticOperation | undefined): number | null {
  if (operation?.kind !== "constant" || typeof operation.value !== "bigint") return null;
  const value = Number(operation.value);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Recover the single dynamic index and its fixed byte stride from an aggregate place. */
function indexedPlaceFact(
  place: SemanticPlace,
  definitions: ReadonlyMap<string, SemanticOperation>,
): { readonly index: BindingId; readonly stride: number; readonly staticOffset: number } | null {
  if (place.rootType === undefined) return null;
  let current = place.rootType;
  let staticOffset = 0;
  let found: { readonly index: BindingId; readonly stride: number } | null = null;
  for (const component of place.path) {
    if (component.kind === "field") {
      if (current.kind !== "struct") return null;
      const field = current.fields.find(({ name }) => name === component.name);
      if (field === undefined) return null;
      staticOffset += field.offset;
      current = field.type;
      continue;
    }
    if (current.kind !== "array" || found !== null) return null;
    const definition = definitions.get(component.value);
    if (definition?.kind !== "load" || definition.place.path.length !== 0) return null;
    found = Object.freeze({ index: definition.place.root, stride: typeBytes(current.element) });
    current = current.element;
  }
  return found === null ? null : Object.freeze({ ...found, staticOffset });
}

/** Collect blocks reachable from the loop body without crossing its header or exit. */
function loopBodyBlocks(
  body: string,
  header: string,
  exit: string,
  blocksById: ReadonlyMap<string, SemanticBlock>,
): ReadonlySet<string> {
  const found = new Set<string>();
  const pending = [body];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (id === header || id === exit || found.has(id)) continue;
    const block = blocksById.get(id);
    if (block === undefined) continue;
    found.add(id);
    pending.push(...successors(block));
  }
  return found;
}

/**
 * Recognize one conservative canonical loop. Any extra mutation, effect, backedge, root, or
 * dynamic index rejects the transformation and leaves ordinary lowering unchanged.
 */
function planAggregateInduction(blocks: readonly SemanticBlock[]): AggregateInductionPlan | null {
  const indexes = new Map(blocks.map((block, index) => [block.id, index] as const));
  const blocksById = new Map(blocks.map((block) => [block.id, block] as const));
  const predecessors = new Map(blocks.map((block) => [block.id, [] as string[]] as const));
  const definitions = new Map<string, SemanticOperation>();
  for (const block of blocks) {
    for (const operation of block.operations) {
      if ("result" in operation && operation.result !== null) {
        definitions.set(operation.result, operation);
      }
    }
    for (const target of successors(block)) predecessors.get(target)?.push(block.id);
  }

  const backedges = blocks.flatMap((block) =>
    successors(block).flatMap((target) => {
      const from = indexes.get(block.id);
      const to = indexes.get(target);
      return from !== undefined && to !== undefined && to <= from ? [[block, target] as const] : [];
    }),
  );
  if (backedges.length !== 1) return null;
  const [latch, headerId] = backedges[0]!;
  if (latch.terminator.kind !== "jump" || latch.terminator.target !== headerId) return null;
  const header = blocksById.get(headerId);
  if (header?.terminator.kind !== "branch") return null;

  const incoming = predecessors.get(headerId) ?? [];
  if (incoming.length !== 2 || !incoming.includes(latch.id)) return null;
  const preheaderId = incoming.find((id) => id !== latch.id);
  const preheader = preheaderId === undefined ? undefined : blocksById.get(preheaderId);
  if (preheader?.terminator.kind !== "jump" || preheader.terminator.target !== headerId)
    return null;

  const condition = definitions.get(header.terminator.condition);
  if (condition?.kind !== "binary" || condition.operator !== "<") return null;
  const conditionLoad = definitions.get(condition.left);
  const bound = constantValue(definitions.get(condition.right));
  if (conditionLoad?.kind !== "load" || conditionLoad.place.path.length !== 0 || bound === null) {
    return null;
  }
  const index = conditionLoad.place.root;
  if (condition.type.kind !== "scalar" || conditionLoad.type.kind !== "scalar") return null;
  if (conditionLoad.type.name !== "byte") return null;
  if (
    header.operations.length !== 3 ||
    header.operations.some(
      (operation) =>
        operation.kind !== "load" && operation.kind !== "constant" && operation.kind !== "binary",
    )
  ) {
    return null;
  }

  const initialStores = preheader.operations.flatMap((operation) => {
    if (
      operation.kind !== "store" ||
      operation.place.path.length !== 0 ||
      !sameBinding(operation.place.root, index)
    ) {
      return [];
    }
    const initial = constantValue(definitions.get(operation.value));
    return initial === null ? [] : [{ operation, initial }];
  });
  if (initialStores.length !== 1 || initialStores[0]!.initial >= bound) return null;

  const update = latch.operations.at(-1);
  if (
    update?.kind !== "store" ||
    update.place.path.length !== 0 ||
    !sameBinding(update.place.root, index)
  ) {
    return null;
  }
  const addition = definitions.get(update.value);
  if (addition?.kind !== "binary" || addition.operator !== "+") return null;
  const left = definitions.get(addition.left);
  const right = definitions.get(addition.right);
  const step = loadsBinding(left, index)
    ? constantValue(right)
    : loadsBinding(right, index)
      ? constantValue(left)
      : null;
  if (step === null || step <= 0 || step > 0xff || bound > 0xff || bound - 1 + step > 0xff) {
    return null;
  }

  const bodyId = header.terminator.whenTrue;
  const exitId = header.terminator.whenFalse;
  const loopBlocks = loopBodyBlocks(bodyId, headerId, exitId, blocksById);
  if (!loopBlocks.has(latch.id)) return null;
  for (const id of loopBlocks) {
    const block = blocksById.get(id)!;
    for (const target of successors(block)) {
      if (target === headerId && id !== latch.id) return null;
      const from = indexes.get(id)!;
      const to = indexes.get(target);
      if (to !== undefined && to <= from && !(id === latch.id && target === headerId)) return null;
    }
    for (const operation of block.operations) {
      if (
        operation.kind === "call" ||
        operation.kind === "platform" ||
        operation.kind === "memory-read" ||
        operation.kind === "memory-write" ||
        operation.kind === "place-address"
      ) {
        return null;
      }
      if (
        operation.kind === "store" &&
        operation.place.path.length === 0 &&
        sameBinding(operation.place.root, index) &&
        operation !== update
      ) {
        return null;
      }
    }
  }

  const aggregateOperations = [...loopBlocks].flatMap((id) =>
    blocksById.get(id)!.operations.flatMap((operation) => {
      if (
        (operation.kind !== "load" &&
          operation.kind !== "store" &&
          operation.kind !== "place-address") ||
        operation.place.path.length === 0
      ) {
        return [];
      }
      return [{ operation, place: operation.place, source: operation.span }];
    }),
  );
  const accesses = aggregateOperations.flatMap(({ operation, place, source }) => {
    const fact = indexedPlaceFact(place, definitions);
    const accessBytes = typeBytes(operation.type);
    return fact !== null && fact.staticOffset + accessBytes <= 0x100
      ? [{ operation, place, fact, source }]
      : [];
  });
  if (accesses.length !== aggregateOperations.length) return null;
  if (accesses.length === 0) return null;
  const first = accesses[0]!;
  if (!sameBinding(first.fact.index, index)) return null;
  if (
    accesses.some(
      ({ place, fact }) =>
        !sameBinding(fact.index, index) ||
        !sameBinding(place.root, first.place.root) ||
        fact.stride !== first.fact.stride ||
        place.rootType !== first.place.rootType,
    )
  ) {
    return null;
  }

  return Object.freeze({
    preheader: preheader.id,
    header: header.id,
    latch: latch.id,
    index,
    root: first.place.root,
    rootType: first.place.rootType!,
    initial: initialStores[0]!.initial,
    step,
    stride: first.fact.stride,
    updateSource: update.span,
    accessSource: first.source,
  });
}

/** Prepare the existing shared pointer for one proved loop, or conservatively decline. */
export function prepareAggregateInduction(
  blocks: readonly SemanticBlock[],
  state: FunctionLoweringState,
): AggregateInductionRuntime | null {
  const plan = planAggregateInduction(blocks);
  if (plan === null) return null;
  const index = loweredPlace(
    Object.freeze({ root: plan.index, path: Object.freeze([]) }),
    1,
    false,
    state,
  );
  const root = loweredPlace(
    Object.freeze({ root: plan.root, rootType: plan.rootType, path: Object.freeze([]) }),
    typeBytes(plan.rootType),
    false,
    state,
  );
  if (
    index.kind !== "storage" ||
    (root.kind !== "storage" && root.kind !== "label") ||
    (root.kind === "storage" && root.requestId.includes(":parameter:"))
  ) {
    return null;
  }

  const pointerRequest = requestStorage(
    state,
    "aggregate-address",
    "pointer",
    2,
    "zero-page-required",
    plan.accessSource,
    "Page-safe packed aggregate address",
  );
  const pointer: Extract<LoweredValue, { readonly kind: "storage" }> = Object.freeze({
    kind: "storage",
    requestId: pointerRequest.id,
    bytes: 2,
    signed: false,
  });
  const offset = plan.initial * plan.stride;
  const delta = plan.stride * plan.step;
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 0xffff ||
    !Number.isSafeInteger(delta) ||
    delta <= 0 ||
    delta > 0xffff
  ) {
    return null;
  }
  const initialization: MachineInstruction[] = [];
  for (const addressByte of ["low", "high"] as const) {
    const operand =
      root.kind === "storage"
        ? Object.freeze({
            kind: "storage" as const,
            requestId: root.requestId,
            offset,
            addressByte,
          })
        : Object.freeze({ kind: "label" as const, label: root.label, offset, addressByte });
    initialization.push(
      machineInstruction(
        state.input.profile.cpu,
        "lda",
        "immediate",
        operand,
        [],
        plan.accessSource,
      ),
      storeA(pointer, addressByte === "low" ? 0 : 1, state, plan.accessSource),
    );
  }
  const cache = createAggregateAddressCache(bindingIdentityKey(plan.root), [
    Object.freeze({ requestId: index.requestId, bytes: 1, signed: false, stride: plan.stride }),
  ]);
  return Object.freeze({
    preheader: plan.preheader,
    header: plan.header,
    updateSourceStart: plan.updateSource.start,
    indexRequestId: index.requestId,
    delta,
    cache,
    initialization: Object.freeze(initialization),
  });
}

/** Advance the shared pointer after the source-visible induction variable has been stored. */
export function advanceAggregateInductionAddress(
  runtime: AggregateInductionRuntime,
  state: FunctionLoweringState,
  source: SourceSpan,
): readonly MachineInstruction[] {
  const pointerRequest = requestStorage(
    state,
    "aggregate-address",
    "pointer",
    2,
    "zero-page-required",
    source,
    "Page-safe packed aggregate address",
  );
  const pointer: Extract<LoweredValue, { readonly kind: "storage" }> = Object.freeze({
    kind: "storage",
    requestId: pointerRequest.id,
    bytes: 2,
    signed: false,
  });
  return Object.freeze([
    loadA(pointer, 0, state, source),
    machineInstruction(state.input.profile.cpu, "clc", "implied", null, [], source),
    machineInstruction(
      state.input.profile.cpu,
      "adc",
      "immediate",
      Object.freeze({ kind: "immediate", value: runtime.delta & 0xff }),
      [],
      source,
    ),
    storeA(pointer, 0, state, source),
    loadA(pointer, 1, state, source),
    machineInstruction(
      state.input.profile.cpu,
      "adc",
      "immediate",
      Object.freeze({ kind: "immediate", value: (runtime.delta >> 8) & 0xff }),
      [],
      source,
    ),
    storeA(pointer, 1, state, source),
  ]);
}
