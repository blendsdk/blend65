import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { SemanticFunction, SemanticOperation } from "../semantic/operations.js";
import {
  literalResolver,
  ordinalBoundResolver,
  rawMayObserve,
  valueDefinitions,
} from "../semantic/aggregate-place-proof.js";
import { guardedOrdinalBounds } from "../semantic/guarded-place-proof.js";
import { validLocalStorageLifetime } from "../semantic/local-storage-lifetimes.js";
import { reachableBlocks } from "../semantic/value-lifetimes.js";
import { coveredBindingRequests, machineStorageAccesses } from "../storage/interference.js";
import { ordinalBoundsForFunction } from "../machine/lower-bounds.js";
import { bindingLabel } from "../machine/lower-control.js";
import { instructionAccessEnvelope } from "../machine/nmos6510-access.js";
import type { MachineFunctionSourceFacts } from "../machine/machine-types.js";
import type { StorageRange } from "../storage/storage-types.js";
import { body, immediate, request, storage } from "./size-observer-complement-field-layout.js";
import type { Body, Item } from "./size-observer-complement-field-layout.js";
import { findNamedObjectBacking } from "./size-observer-backing.js";
import type { LowByteFunctionChanges } from "./size-observer-low-byte-occurrences.js";
import type { FinalObserverInput } from "./size-observers.js";

/** Access witnesses retain every existing decoder role and range. */
type Access = LowByteFunctionChanges["accessesBefore"][number];
/** NMOS data writers; stack/control transfers retain the separate route proof. */
const DATA_WRITERS = new Set(["sta", "stx", "sty", "inc", "dec", "asl", "lsr", "rol", "ror"]);
/** Word copies use consecutive, unindexed storage bytes inside one block. */
const contiguous = (items: readonly Item[]) =>
  items.length > 0 &&
  items.every(
    (item, index) =>
      item.block === items[0]!.block &&
      item.index === items[0]!.index + index &&
      (item.source.operand?.kind !== "storage" ||
        ["absolute", "zero-page"].includes(item.instruction.mode)),
  );

/** Bind decoder inputs to this occurrence; callers separately prove value domains. */
function accessInput(input: FinalObserverInput, pair: Body, item: Item) {
  return {
    cpu: input.checked.profile.cpu,
    instruction: item.instruction,
    pc:
      item.block.origin! +
      item.block.instructions.slice(0, item.index).reduce((sum, old) => sum + old.cost.bytes, 0),
    labels: pair.view.labels,
  };
}

/**
 * Retain reload guards across calls only for unexposed, continuously occupied
 * scalar homes. Both layouts must exclude every transitive callee demand and
 * every actual foreign write. The group still authenticates all code entries
 * and complete raw effects before these conditional facts can be published.
 */
function preservedGuards(
  input: FinalObserverInput,
  fn: SemanticFunction,
  before: Body,
  after: Body,
) {
  const blocks = reachableBlocks(fn.entry, fn.blocks),
    operations = blocks.flatMap((block) => block.operations),
    calls = operations.filter((operation) => operation.kind === "call");
  if (calls.length === 0) return new Map<SemanticOperation, ReadonlyMap<string, bigint>>();
  const definitions = valueDefinitions(blocks),
    literal = literalResolver(definitions),
    ordinary = ordinalBoundResolver(definitions, literal);
  const unstable = new Set(
    input.checked.program.semantic.globals.map(({ id }) => bindingIdentityKey(id)),
  );
  for (const operation of operations)
    if (operation.kind === "place-address") unstable.add(bindingIdentityKey(operation.place.root));
  // The group authenticates all actual calls before publishing any result.
  // A sealed lifetime alone is insufficient: replay existing access coverage.
  const coverage = [before, after].map((pair) =>
    coveredBindingRequests(
      input.candidate.lowered.program.storageSelection!.sourceFacts,
      [...pair.view.requests.values()],
      machineStorageAccesses(pair.view.functions),
    ),
  );
  const roots = new Set(
    operations.flatMap((operation) =>
      operation.kind === "load" && operation.place.path.length === 0 ? [operation.place.root] : [],
    ),
  );
  for (const binding of roots) {
    const key = bindingIdentityKey(binding);
    if (unstable.has(key)) continue;
    let safe = true;
    for (const [index, pair] of [before, after].entries()) {
      const declarations = [...pair.view.requests.values()].filter(
        (value) => value.owner === fn.id && value.binding === binding,
      );
      const declared = declarations.length === 1 ? declarations[0] : undefined;
      const demand =
        declared === undefined ? null : request(pair.view, declared.id, declared.bytes, fn.id);
      // Failed coverage returns its original request, even with the same lifetime.
      const covered = coverage[index]!.find((value) => value.id === declared?.id);
      if (
        demand === null ||
        (declared?.storageClass !== "local" && declared?.storageClass !== "parameter") ||
        declared.type?.kind !== "scalar" ||
        declared.persistent ||
        declared.lifetime.function !== fn.id ||
        declared.lifetime.callsCrossed.some((span) => !calls.some((call) => call.span === span)) ||
        (validLocalStorageLifetime(input.checked.program, key, declared.lifetime)
          ? covered === declared || covered?.lifetime !== declared.lifetime
          : calls.some((call) => !declared.lifetime.callsCrossed.includes(call.span)) ||
            blocks.some((block) =>
              Array.from({ length: block.operations.length + 1 }, (_, index) =>
                declared.lifetime.liveAt.some(
                  (at) => at.block === block.id && at.operation === index,
                ),
              ).some((live) => !live),
            ))
      ) {
        safe = false;
        break;
      }
      const range = {
        start: demand.home.address,
        end: demand.home.address + demand.home.bytes - 1,
      };
      // A proved last use permits later callees to reuse the home. Only calls
      // crossed by this binding's authenticated occupancy need interference.
      const active = new Set(
        calls
          .filter((call) => declared.lifetime.callsCrossed.includes(call.span))
          .map((call) => call.callee),
      );
      for (let size = -1; size !== active.size; ) {
        size = active.size;
        for (const edge of input.checked.program.callGraph)
          if (active.has(edge.function)) edge.callees.forEach((callee) => active.add(callee));
      }
      active.add(fn.id);
      const conflicts = (id: string) =>
        pair.view.shared.certificate.certificate.interference.some(
          (edge) =>
            (edge.left === declared.id && edge.right === id) ||
            (edge.right === declared.id && edge.left === id),
        );
      for (const other of pair.view.requests.values()) {
        if (other === declared || !active.has(other.owner)) continue;
        if (other.owner === fn.id && !conflicts(other.id)) continue;
        const home = pair.view.homes.get(other.id);
        if (
          home === undefined ||
          (home.address <= range.end && range.start < home.address + home.bytes)
        )
          safe = false;
      }
      for (const source of input.checked.program.semantic.functions.filter((source) =>
        active.has(source.id),
      )) {
        const code = body(pair.view, source.id, source);
        if (code === null) return "Composed guard callee binding is unresolved";
        for (const item of code.items) {
          if (item.instruction.mode === "accumulator" || !DATA_WRITERS.has(item.instruction.opcode))
            continue;
          const accesses = instructionAccessEnvelope(accessInput(input, pair, item));
          if (accesses === null) {
            safe = false;
            continue;
          }
          for (const access of accesses.filter((access) => access.kind === "write"))
            if (
              access.ranges.some((value) => value.start <= range.end && range.start <= value.end)
            ) {
              const operand = item.source.operand;
              const target =
                operand?.kind === "storage" ? pair.view.requests.get(operand.requestId) : undefined;
              if (
                source === fn &&
                target !== undefined &&
                target !== declared &&
                !conflicts(target.id) &&
                operand?.kind === "storage" &&
                item.source.mode === "storage" &&
                operand.addressByte === undefined &&
                (operand.offset ?? 0) >= 0 &&
                (operand.offset ?? 0) < target.bytes &&
                (target.owner === fn.id ||
                  (target.storageClass === "parameter" &&
                    calls.some(
                      (call) =>
                        call.span === item.source.source &&
                        call.callee === target.owner &&
                        !declared.lifetime.callsCrossed.includes(call.span),
                    )))
              )
                continue;
              if (
                source !== fn ||
                access.role !== "data" ||
                operand?.kind !== "storage" ||
                operand.requestId !== declared.id ||
                item.source.opcode !== "sta" ||
                !operations.some(
                  (operation) =>
                    operation.kind === "store" &&
                    operation.place.root === binding &&
                    operation.place.path.length === 0 &&
                    operation.span === item.source.source,
                )
              )
                safe = false;
            }
        }
      }
    }
    if (!safe) unstable.add(key);
  }
  const windows = [...input.checked.profile.storage.ram, ...input.checked.profile.storage.zeroPage];
  return guardedOrdinalBounds(
    fn.entry,
    blocks,
    definitions,
    unstable,
    literal,
    ordinary,
    (operation) =>
      operation.kind === "indirect-call" ||
      operation.kind === "platform" ||
      (operation.kind === "store" && operation.place.path.length > 0) ||
      (operation.kind === "aggregate" &&
        operation.destination?.kind === "place" &&
        operation.destination.place.path.length > 0) ||
      (operation.kind === "memory-write" &&
        rawMayObserve(literal(operation.address), operation.width, windows)),
    undefined,
    true,
  );
}

/** Prove a real const-global pointer through incoming word copies, not its source annotation. */
function incomingPointer(
  input: FinalObserverInput,
  pair: Body,
  fn: SemanticFunction,
  binding: BindingId,
  seen = new Set<BindingId>(),
): StorageRange | null {
  if (seen.has(binding)) return null;
  const facts = input.candidate.lowered.program.storageSelection!.sourceFacts;
  const packet = facts.functions.get(fn),
    parameter = packet?.storage?.parameters.get(bindingIdentityKey(binding));
  const declarations = [...pair.view.requests.values()].filter(
    (value) => value.owner === fn.id && value.binding === binding,
  );
  const demand =
    declarations.length === 1 ? request(pair.view, declarations[0]!.id, 2, fn.id) : null;
  if (
    parameter?.function !== fn ||
    parameter.origin.owner !== null ||
    parameter.origin.place.path.length !== 0 ||
    demand?.declared.storageClass !== "parameter" ||
    parameter.calls.length === 0
  )
    return null;
  const root =
    findNamedObjectBacking(
      { binding: parameter.origin.place.root, owner: null, type: parameter.origin.type },
      pair.view.shared,
      pair.view.homes,
    )?.range ?? null;
  if (root === null || root.end - root.start + 1 !== parameter.origin.type.size) return null;
  const positions = new Set(
    demand.declared.lifetime.liveAt.map((at) => JSON.stringify([at.block, at.operation])),
  );
  if (
    !fn.blocks.every((block) =>
      Array.from({ length: block.operations.length + 1 }, (_, at) =>
        positions.has(JSON.stringify([block.id, at])),
      ).every(Boolean),
    )
  )
    return null;
  const active = new Set([fn.id]);
  for (let size = -1; size !== active.size; ) {
    size = active.size;
    for (const edge of input.checked.program.callGraph)
      if (active.has(edge.function)) edge.callees.forEach((callee) => active.add(callee));
  }
  const range = { start: demand.home.address, end: demand.home.address + 1 };
  for (const value of pair.view.requests.values())
    if (value.id !== demand.declared.id && value.owner !== null && active.has(value.owner)) {
      const home = pair.view.homes.get(value.id);
      if (
        home === undefined ||
        (home.address <= range.end && range.start < home.address + home.bytes)
      )
        return null;
    }
  for (const owner of input.checked.program.semantic.functions.filter((owner) =>
    active.has(owner.id),
  )) {
    if (
      owner.blocks.some((block) =>
        block.operations.some(
          (operation) =>
            operation.kind === "memory-write" ||
            operation.kind === "indirect-call" ||
            operation.kind === "platform",
        ),
      )
    )
      return null;
    const current = body(pair.view, owner.id, owner);
    if (current === null) return null;
    // Full-function occupancy permits no writer of either formal byte.
    for (const item of current.items) {
      if (item.instruction.mode === "accumulator" || !DATA_WRITERS.has(item.instruction.opcode))
        continue;
      const accesses = instructionAccessEnvelope(accessInput(input, pair, item));
      if (
        accesses === null ||
        accesses.some(
          (access) =>
            access.kind === "write" &&
            access.ranges.some((value) => value.start <= range.end && range.start <= value.end),
        )
      )
        return null;
    }
  }
  for (const call of parameter.calls) {
    const caller = input.checked.program.semantic.functions.find((fn) => fn.id === call.owner);
    const code = caller === undefined ? null : body(pair.view, caller.id, caller);
    if (caller === undefined || code === null) return null;
    const definition = valueDefinitions(caller.blocks).get(
      call.operation.arguments[fn.parameters.findIndex((formal) => formal.id === binding)] ?? "",
    );
    if (
      definition?.kind !== "place-address" ||
      definition.captureValue === true ||
      definition.place.path.length !== 0
    )
      return null;
    const items = code.items.filter((item) => item.source.source === call.operation.span);
    const at = items.findIndex((item) => storage(item, "sta", demand.declared.id));
    const invokeLabel = pair.view.functions.find(
      (entry) =>
        entry.sourceFunction !== undefined &&
        bindingIdentityKey(entry.sourceFunction) === bindingIdentityKey(fn.id),
    )?.id;
    const delivery = items.slice(at - 1, at + 3),
      invoke = items.find(
        (item) =>
          item.source.opcode === "jsr" &&
          item.source.operand?.kind === "label" &&
          item.source.operand.label === invokeLabel,
      );
    if (
      delivery.length !== 4 ||
      !contiguous(delivery) ||
      !storage(delivery[1], "sta", demand.declared.id) ||
      !storage(delivery[3], "sta", demand.declared.id, 1) ||
      invoke?.source.opcode !== "jsr" ||
      invoke.source.operand?.kind !== "label" ||
      invoke.source.operand.label !== invokeLabel
    )
      return null;
    const literalCopy = definition.place.root === parameter.origin.place.root;
    if (literalCopy) {
      const label = bindingLabel("global", parameter.origin.place.root);
      if (
        ![0, 2].every(
          (index) =>
            delivery[index]?.source.opcode === "lda" &&
            delivery[index].source.mode === "immediate" &&
            delivery[index].source.operand?.kind === "label" &&
            delivery[index].source.operand.label === label &&
            (delivery[index].source.operand.offset ?? 0) === 0 &&
            delivery[index].source.operand.addressByte === (index === 0 ? "low" : "high"),
        )
      )
        return null;
    } else {
      const first = delivery[0]!.source.operand,
        origin = [...pair.view.requests.values()].filter(
          (value) => value.owner === caller.id && value.binding === definition.place.root,
        );
      const stage =
        first?.kind === "storage" ? request(pair.view, first.requestId, 2, caller.id) : null;
      const materialization = code.items.filter((item) => item.source.source === definition.span);
      const base = incomingPointer(
        input,
        code,
        caller,
        definition.place.root,
        new Set([...seen, binding]),
      );
      if (
        base?.start !== root.start ||
        base.end !== root.end ||
        origin.length !== 1 ||
        stage?.declared.storageClass !== "pointer" ||
        materialization.length !== 4 ||
        !contiguous([...materialization, ...delivery]) ||
        !storage(materialization[0], "lda", origin[0]!.id) ||
        !storage(materialization[1], "sta", stage.declared.id) ||
        !storage(materialization[2], "lda", origin[0]!.id, 1) ||
        !storage(materialization[3], "sta", stage.declared.id, 1) ||
        !storage(delivery[0], "lda", stage.declared.id) ||
        !storage(delivery[2], "lda", stage.declared.id, 1)
      )
        return null;
      const stageUses = code.items.filter(
        (item) =>
          item.source.operand?.kind === "storage" &&
          item.source.operand.requestId === stage.declared.id,
      );
      if (
        stageUses.length !== 4 ||
        stageUses.some(
          (item) =>
            ![materialization[1], materialization[3], delivery[0], delivery[2]].includes(item),
        )
      )
        return null;
    }
    const suffix = code.items.filter(
      (item) =>
        item.block === invoke.block && item.index > delivery[3]!.index && item.index < invoke.index,
    );
    if (invoke.block !== delivery[3]!.block) return null;
    for (const item of suffix) {
      const accesses = instructionAccessEnvelope(accessInput(input, pair, item));
      if (
        accesses === null ||
        accesses.some(
          (access) =>
            access.kind === "write" &&
            access.ranges.some((value) => value.start <= range.end && range.start <= value.end),
        )
      )
        return null;
    }
  }
  return root;
}

/** Match each typed indirect read's pointer arithmetic and Y before decoding its bus domains. */
function typedReadInputs(
  input: FinalObserverInput,
  packet: MachineFunctionSourceFacts,
  pair: Body,
  counters: LowByteFunctionChanges["counters"],
  callGuards: ReadonlyMap<SemanticOperation, ReadonlyMap<string, bigint>>,
): readonly Access[] | string {
  const definitions = valueDefinitions(packet.function.blocks),
    ordinary = ordinalBoundResolver(definitions, literalResolver(definitions));
  const blocks = [
    packet.function.blocks.find((block) => block.id === packet.function.entry)!,
    ...packet.function.blocks.filter((block) => block.id !== packet.function.entry),
  ];
  const guarded = ordinalBoundsForFunction(blocks, {
    program: input.checked.program,
    profile: input.checked.profile,
  });
  const result: Access[] = [];
  /**
   * A returned-local aggregate construction writes its already-proved bytes
   * through the hidden destination pointer. Those stores carry the aggregate
   * operation span and are owned by the aggregate/borrow proof, not by this
   * typed-read matcher.
   */
  const aggregateSpans = new Set(
    packet.function.blocks
      .flatMap((block) => block.operations)
      .filter((operation) => operation.kind === "aggregate")
      .map(
        (operation) => `${operation.span.sourceId}\0${operation.span.start}\0${operation.span.end}`,
      ),
  );
  const aggregateStore = (item: Item): boolean =>
    item.source.source !== null &&
    aggregateSpans.has(
      `${item.source.source.sourceId}\0${item.source.source.start}\0${item.source.source.end}`,
    );
  // Store envelopes, including dummy reads, belong to occurrence matching.
  for (const item of pair.items.filter(
    (item) =>
      item.instruction.mode === "indirect-indexed-y" &&
      !aggregateStore(item) &&
      !item.source.observerOrigins?.some(
        (origin) => origin.kind === "raw" || origin.operation.kind === "store",
      ),
  )) {
    const origin = item.source.observerOrigins?.find(
      (origin) =>
        origin.kind === "typed" &&
        origin.operation.kind === "load" &&
        origin.position === 0 &&
        origin.byte === 0,
    );
    if (
      origin?.operation.kind !== "load" ||
      item.source.opcode !== "lda" ||
      item.source.operand?.kind !== "indirect-y" ||
      (item.source.operand.offset ?? 0) !== 0
    ) {
      return "Typed pointer read has no exact source consumer";
    }
    const operation = origin.operation,
      pointer = item.source.operand.requestId;
    const root = incomingPointer(input, pair, packet.function, operation.place.root);
    const formal = [...pair.view.requests.values()].find(
      (value) => value.owner === packet.function.id && value.binding === operation.place.root,
    );
    if (
      root === null ||
      formal === undefined ||
      request(pair.view, pointer, 2, packet.function.id) === null
    )
      return "Typed pointer's incoming value is unproved";
    let type = operation.place.rootType,
      offset = 0,
      indexValue: string | undefined;
    for (const part of operation.place.path) {
      if (part.kind === "field" && type?.kind === "struct") {
        const field = type.fields.find((field) => field.name === part.name);
        if (field === undefined) return "Typed pointer field offset is unresolved";
        offset += field.offset;
        type = field.type;
      } else if (
        part.kind === "index" &&
        type?.kind === "array" &&
        type.element.kind === "scalar" &&
        type.element.name === "byte" &&
        indexValue === undefined
      ) {
        indexValue = part.value;
        type = type.element;
      } else return "Typed pointer path is outside the byte-access class";
    }
    const prefix = pair.items.filter(
      (old) =>
        old.block === item.block &&
        old.index >= item.index - (indexValue === undefined && offset === 0 ? 5 : 8) &&
        old.index < item.index,
    );
    let maximum = 0n;
    if (indexValue !== undefined) {
      const definition = definitions.get(indexValue),
        selected = definition?.kind === "load" ? counters.get(definition.place.root) : undefined;
      maximum =
        callGuards.get(operation)?.get(indexValue) ??
        guarded.get(operation)?.get(indexValue) ??
        selected?.proof.loop.valueBounds.get(indexValue) ??
        ordinary(indexValue) ??
        65535n;
      const demand =
        definition?.kind === "load"
          ? [...pair.view.requests.values()].find(
              (value) =>
                value.owner === packet.function.id && value.binding === definition.place.root,
            )
          : undefined;
      if (
        offset !== 0 ||
        maximum > 255n ||
        demand === undefined ||
        prefix.length !== 8 ||
        !storage(prefix[0], "lda", demand.id) ||
        prefix[1]?.source.opcode !== "clc" ||
        !storage(prefix[2], "adc", formal.id) ||
        !storage(prefix[3], "sta", pointer) ||
        !storage(prefix[4], "lda", formal.id, 1) ||
        !immediate(prefix[5], "adc", 0) ||
        !storage(prefix[6], "sta", pointer, 1) ||
        !immediate(prefix[7], "ldy", 0)
      )
        return `Typed indexed pointer arithmetic is unproved at ${operation.span.start} (maximum ${maximum}; prefix ${prefix.length})`;
    } else if (offset === 0) {
      if (
        prefix.length !== 5 ||
        !storage(prefix[0], "lda", formal.id) ||
        !storage(prefix[1], "sta", pointer) ||
        !storage(prefix[2], "lda", formal.id, 1) ||
        !storage(prefix[3], "sta", pointer, 1) ||
        !immediate(prefix[4], "ldy", 0)
      )
        return "Typed base pointer copy is unproved";
    } else if (
      prefix.length !== 8 ||
      !immediate(prefix[0], "ldy", 0) ||
      !storage(prefix[1], "lda", formal.id) ||
      prefix[2]?.source.opcode !== "clc" ||
      !immediate(prefix[3], "adc", offset) ||
      !storage(prefix[4], "sta", pointer) ||
      prefix[5]?.source.opcode !== "tya" ||
      !storage(prefix[6], "adc", formal.id, 1) ||
      !storage(prefix[7], "sta", pointer, 1)
    )
      return "Typed field pointer addition is unproved";
    if (!contiguous(prefix) || root.start + offset + Number(maximum) > root.end)
      return "Typed pointer domain is not contained in its object";
    const index = { start: 0, end: 0 },
      pointees = [{ start: root.start + offset, end: root.start + offset + Number(maximum) }];
    const envelope = instructionAccessEnvelope({
      ...accessInput(input, pair, item),
      index,
      pointees,
    });
    if (envelope === null) return "Typed pointer bus envelope is incomplete";
    result.push({ item, index, pointees, envelope });
  }
  return result;
}

/**
 * Prove pointer values and use-site inputs for both real read constructions.
 * Backing lookup alone is never treated as evidence of pointer contents.
 * @param input Same checked source and independently closed constructions.
 * @param packet Source facts of the represented function.
 * @param before Bound original occurrences.
 * @param after Bound selected occurrences.
 * @param counters Already checked source counter representations.
 * @returns Complete read witnesses and conditional guard facts, or a failed premise.
 * @example const inputs = matchLowByteReadInputs(input, packet, before, after, counters);
 */
export function matchLowByteReadInputs(
  input: FinalObserverInput,
  packet: MachineFunctionSourceFacts,
  before: Body,
  after: Body,
  counters: LowByteFunctionChanges["counters"],
):
  | {
      /** Actual original read domains. */ readonly before: LowByteFunctionChanges["accessesBefore"];
      /** Actual selected read domains. */ readonly after: LowByteFunctionChanges["accessesAfter"];
      /** Conditional exact-use bounds, never induction or raw-address authority. */ readonly callGuards: ReadonlyMap<
        SemanticOperation,
        ReadonlyMap<string, bigint>
      >;
    }
  | string {
  const callGuards = preservedGuards(input, packet.function, before, after);
  if (typeof callGuards === "string") return callGuards;
  const original = typedReadInputs(input, packet, before, counters, callGuards);
  if (typeof original === "string") return original;
  const selected = typedReadInputs(input, packet, after, counters, callGuards);
  if (typeof selected === "string") return selected;
  return { before: original, after: selected, callGuards };
}
