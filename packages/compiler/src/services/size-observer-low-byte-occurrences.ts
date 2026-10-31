import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { LoadOperation, SemanticFunction, SemanticOperation } from "../semantic/operations.js";
import { valueDefinitions } from "../semantic/aggregate-place-proof.js";
import { bindingLabel, BYTE_WINDOW_CHANGED as STATE } from "../machine/lower-control.js";
import { instructionAccessEnvelope } from "../machine/nmos6510-access.js";
import type { InstructionAccessEnvelope } from "../machine/nmos6510-access.js";
import type {
  FixedCounterProof,
  MachineFunction,
  MachineFunctionSourceFacts,
} from "../machine/machine-types.js";
import type { StorageRequest, StorageRange } from "../storage/storage-types.js";
import { immediate, request, storage } from "./size-observer-complement-field-layout.js";
import type { Body, Item } from "./size-observer-complement-field-layout.js";
import { unchanged } from "./size-observer-complement-field-correspondence.js";
import { findNamedObjectBacking } from "./size-observer-backing.js";
import { matchLowByteReadInputs } from "./size-observer-low-byte-read-inputs.js";
import type { FinalObserverInput } from "./size-observers.js";

/** Both existing declarations and homes, prepared by the group storage check. */
type Home = NonNullable<ReturnType<typeof request>>;
/** One source counter's two actual representations. */
type Counter = {
  /** Authentic source/producer relationship. */ readonly proof: FixedCounterProof;
  /** Complete original word home. */ readonly original: Home;
  /** Complete selected byte home. */ readonly selected: Home;
  /** Exact source loads allowed to consume this counter. */ readonly loads: ReadonlySet<LoadOperation>;
};
/** A continuation starts immediately after its last matched real occurrence. */
type Cut = {
  /** Last matched instruction. */ readonly last: Item;
  /** Next index. */ readonly start: number;
};
/** Complete decoder information for one actual occurrence. */
type Access = {
  /** Real bound occurrence. */ readonly item: Item;
  /** Independently matched X/Y domain. */ readonly index?: StorageRange;
  /** Independently matched pointer values. */ readonly pointees?: readonly StorageRange[];
  /** All decoder roles and ranges, not an instruction-wide exemption. */ readonly envelope: readonly InstructionAccessEnvelope[];
};
/** One load whose remaining instruction correspondence belongs to field matching. */
type Delegated = {
  /** Source counter value. */ readonly load: LoadOperation;
  /** Actual typed element consumer. */ readonly consumer: LoadOperation;
  /** Original element access. */ readonly before: Item;
  /** Selected element access. */ readonly after: Item;
  /** Field group whose callee/caller traversal must consume this pair. */ readonly route: SemanticFunction;
};

/** Invocation-local exact changes; no collection authenticates a construction. */
export interface LowByteFunctionChanges {
  /** Exact source owner. */ readonly source: SemanticFunction;
  /** Original actual function. */ readonly before: MachineFunction;
  /** Selected actual function. */ readonly after: MachineFunction;
  /** Prepared source counter views. */ readonly counters: ReadonlyMap<BindingId, Counter>;
  /** Exact original occurrences permitted to disappear. */ readonly removed: ReadonlySet<string>;
  /** Exact original-to-selected occurrence pairs. */ readonly replacements: ReadonlyMap<
    string,
    string
  >;
  /** Actual state cuts for the group's unchanged continuation queries. */ readonly continuations: readonly {
    /** Matched source operation. */ readonly source: SemanticOperation;
    /** Original cut. */ readonly before: Cut;
    /** Selected cut. */ readonly after: Cut;
    /** Conservative architectural differences. */ readonly changed: number;
  }[];
  /** Exact original declarations justified only by matched disappearing windows. */ readonly removedDemands: ReadonlySet<StorageRequest>;
  /** Mandatory field-consumer handoffs. */ readonly delegated: readonly Delegated[];
  /** Complete original access envelopes. */ readonly accessesBefore: readonly Access[];
  /** Complete selected access envelopes. */ readonly accessesAfter: readonly Access[];
  /** Conditional exact-use guards, never induction or raw-address bounds. */ readonly callGuards: ReadonlyMap<
    SemanticOperation,
    ReadonlyMap<string, bigint>
  >;
}

/** Compare symbolic computations before either layout's physical relocation. */
const same = (a: Item | undefined, b: Item | undefined) =>
  a !== undefined &&
  b !== undefined &&
  JSON.stringify([a.source.opcode, a.source.mode, a.source.operand]) ===
    JSON.stringify([b.source.opcode, b.source.mode, b.source.operand]);
/** A matched window must not skip another instruction or cross a block entry. */
const contiguous = (items: readonly Item[]) =>
  items.length > 0 &&
  items.every(
    (item, index) => item.block === items[0]!.block && item.index === items[0]!.index + index,
  );

/** Resolve only complete resident objects; caller-private objects keep their existing proof. */
function resident(pair: Body, binding: BindingId, type: SemanticType | undefined) {
  return type?.kind === "array" || type?.kind === "struct"
    ? (findNamedObjectBacking({ binding, owner: null, type }, pair.view.shared, pair.view.homes)
        ?.range ?? null)
    : null;
}

/**
 * Match only emitted memory-counter substitutions and their complete access windows.
 * Existing field matching still owns its delegated element loads and strict suffixes.
 * @param input Same checked source and independently closed actual constructions.
 * @param packet Exact source facts for this function.
 * @param before Independently bound original occurrences.
 * @param after Independently bound selected occurrences.
 * @param counters Storage-checked word-to-byte source views.
 * @returns Exact local changes, or the first unsupported/inconsistent window.
 * @example const changes = matchLowByteOccurrences(input, packet, before, after, counters);
 */
export function matchLowByteOccurrences(
  input: FinalObserverInput,
  packet: MachineFunctionSourceFacts,
  before: Body,
  after: Body,
  counters: LowByteFunctionChanges["counters"],
): LowByteFunctionChanges | string {
  const source = packet.function,
    definitions = valueDefinitions(source.blocks);
  // This class proves fixed frame bytes. An indexed frame reference would need
  // an independent index premise before any counter or store claim is published.
  if (
    [before, after].some((pair) =>
      pair.items.some(
        (item) =>
          item.source.operand?.kind === "storage" &&
          item.source.operand.addressByte === undefined &&
          !["absolute", "zero-page"].includes(item.instruction.mode),
      ),
    )
  )
    return "Composed frame data reference needs an unindexed byte proof";
  const removed = new Set<string>(),
    replacements = new Map<string, string>(),
    usedAfter = new Set<string>();
  const continuations: LowByteFunctionChanges["continuations"][number][] = [];
  const removedDemands = new Set<StorageRequest>(),
    delegated: Delegated[] = [];
  const accessesBefore: Access[] = [],
    accessesAfter: Access[] = [];
  const parts = (pair: Body, spans: readonly SemanticOperation[]) =>
    pair.items.filter((item) => spans.some((operation) => operation.span === item.source.source));
  /** Claim the whole exact window, preserving explicit one-to-one retained positions. */
  const claim = (
    a: readonly Item[],
    b: readonly Item[],
    from: readonly number[],
    operation: SemanticOperation,
    changed: number,
  ) => {
    if (
      !contiguous(a) ||
      !contiguous(b) ||
      from.length !== b.length ||
      new Set(from).size !== from.length ||
      a.some((item) => removed.has(item.key) || replacements.has(item.key)) ||
      b.some((item) => usedAfter.has(item.key))
    )
      return false;
    for (const [index, item] of a.entries()) {
      const to = from.indexOf(index);
      if (to < 0) removed.add(item.key);
      else replacements.set(item.key, b[to]!.key);
    }
    b.forEach((item) => usedAfter.add(item.key));
    continuations.push({
      source: operation,
      before: { last: a.at(-1)!, start: a.at(-1)!.index + 1 },
      after: { last: b.at(-1)!, start: b.at(-1)!.index + 1 },
      changed,
    });
    return true;
  };
  for (const view of counters.values()) {
    const loop = view.proof.loop,
      old = view.original.declared.id,
      current = view.selected.declared.id;
    const a = parts(before, [loop.initialization]),
      b = parts(after, [loop.initialization]);
    if (
      a.length !== 4 ||
      b.length !== 2 ||
      !same(a[0], b[0]) ||
      !storage(a[1], "sta", old) ||
      !storage(a[3], "sta", old, 1) ||
      !storage(b[1], "sta", current)
    )
      return "Composed counter initialization disagrees";
    if (loop.initial.kind === "constant") {
      if (loop.initial.value !== 0 || !immediate(a[0], "lda", 0) || !immediate(a[2], "lda", 0))
        return "Composed zero initialization is unresolved";
    } else {
      const operand = a[0]!.source.operand,
        add = definitions.get(loop.initialization.value);
      const parent = counters.get(loop.initial.parent);
      if (
        parent === undefined ||
        loop.parent !== parent.proof.loop ||
        add?.kind !== "binary" ||
        add.operator !== "+" ||
        operand?.kind !== "storage" ||
        !storage(a[2], "lda", operand.requestId, 1) ||
        request(before.view, operand.requestId, 2, source.id) === null ||
        request(after.view, operand.requestId, 2, source.id) === null ||
        loop.initial.domain.minimum !== 1 ||
        loop.initial.domain.maximum > parent.proof.loop.bound
      )
        return "Composed parent initialization is unresolved";
      const sum = parts(before, [add]),
        next = parts(after, [add]);
      if (
        sum.length !== 7 ||
        next.length !== 7 ||
        !storage(sum[0], "lda", parent.original.declared.id) ||
        sum[1]?.source.opcode !== "clc" ||
        !immediate(sum[2], "adc", 1) ||
        !storage(sum[3], "sta", operand.requestId) ||
        !storage(sum[4], "lda", parent.original.declared.id, 1) ||
        !immediate(sum[5], "adc", 0) ||
        !storage(sum[6], "sta", operand.requestId, 1)
      )
        return "Composed parent sum is not the proved word increment";
    }
    if (
      !claim(
        a,
        b,
        [0, 1],
        loop.initialization,
        loop.initial.kind === "constant" ? 0 : STATE.a | STATE.n | STATE.z,
      )
    )
      return "Composed initialization occurrence overlaps";
    const test = parts(before, [loop.comparison]),
      selectedTest = parts(after, [loop.comparison]);
    if (
      test.length !== 4 ||
      ![2, 3].includes(selectedTest.length) ||
      !storage(test[0], "lda", old) ||
      !immediate(test[1], "cmp", loop.bound) ||
      !storage(test[2], "lda", old, 1) ||
      !immediate(test[3], "sbc", 0) ||
      !storage(selectedTest[0], "lda", current) ||
      !immediate(selectedTest[1], "cmp", loop.bound) ||
      (selectedTest.length === 3 && selectedTest[2]?.source.opcode !== "clv") ||
      !claim(
        test,
        selectedTest,
        selectedTest.length === 3 ? [0, 1, 3] : [0, 1],
        loop.comparison,
        STATE.a | STATE.v,
      )
    )
      return "Composed counter comparison disagrees";
    const step = parts(before, [loop.increment, loop.updateStore]),
      selectedStep = parts(after, [loop.increment, loop.updateStore]);
    const capture = step[3]?.source.operand;
    if (
      step.length !== 11 ||
      selectedStep.length !== 1 ||
      capture?.kind !== "storage" ||
      !storage(step[0], "lda", old) ||
      step[1]?.source.opcode !== "clc" ||
      !immediate(step[2], "adc", 1) ||
      !storage(step[3], "sta", capture.requestId) ||
      !storage(step[4], "lda", old, 1) ||
      !immediate(step[5], "adc", 0) ||
      !storage(step[6], "sta", capture.requestId, 1) ||
      !storage(step[7], "lda", capture.requestId) ||
      !storage(step[8], "sta", old) ||
      !storage(step[9], "lda", capture.requestId, 1) ||
      !storage(step[10], "sta", old, 1) ||
      !storage(selectedStep[0], "inc", current) ||
      !claim(
        step,
        selectedStep,
        [0],
        loop.updateStore,
        STATE.a | STATE.n | STATE.z | STATE.c | STATE.v,
      )
    )
      return "Composed counter increment disagrees";
    const demand = request(before.view, capture.requestId, 2, source.id);
    if (demand?.declared.storageClass !== "temporary" || after.view.requests.has(capture.requestId))
      return "Composed update scratch is not removed";
    removedDemands.add(demand.declared);
  }

  /** Resolve an index only from this source load and its authentic selected counter. */
  const counterFor = (value: string) => {
    const load = definitions.get(value);
    if (load?.kind !== "load" || load.place.path.length !== 0) return null;
    const counter = counters.get(load.place.root);
    return counter?.loads.has(load) ? { counter, load } : null;
  };
  const deferredBefore = new Set<string>(),
    deferredAfter = new Set<string>();
  for (const old of before.items) {
    const origin = old.source.observerOrigins?.find(
      (origin) =>
        origin.kind === "typed" &&
        origin.operation.kind === "load" &&
        origin.position === 0 &&
        origin.byte === 0,
    );
    if (origin?.operation.kind !== "load") continue;
    const consumer = origin.operation,
      index = consumer.place.path.find((part) => part.kind === "index");
    if (index?.kind !== "index") continue;
    const value = counterFor(index.value);
    if (value === null) continue;
    const current = after.items.filter((item) =>
      item.source.observerOrigins?.some(
        (origin) =>
          origin.kind === "typed" &&
          origin.operation === consumer &&
          origin.position === 0 &&
          origin.byte === 0,
      ),
    );
    const root = packet.storage?.parameters.get(bindingIdentityKey(consumer.place.root))?.origin;
    const routes = [
      ...(input.candidate.lowered.program.storageSelection?.sourceFacts.functions.values() ?? []),
    ].filter(
      (entry) =>
        input.candidate.lowered.program.functions.some(
          (fn) =>
            fn.sourceFunction === entry.function.id && (fn.byteComplementProofs?.length ?? 0) > 0,
        ) &&
        [...(entry.storage?.parameters.values() ?? [])].some(
          (parameter) =>
            parameter.origin.owner === null &&
            parameter.origin.place.root === root?.place.root &&
            (entry.function === source || parameter.calls.some((call) => call.owner === source.id)),
        ),
    );
    const at = after.items.indexOf(current[0]!);
    const previous = after.items[at - 1];
    if (
      current.length !== 1 ||
      current[0]!.source.opcode !== "lda" ||
      current[0]!.source.mode !== "absolute-y" ||
      previous?.block !== current[0]!.block ||
      !storage(previous, "ldy", value.counter.selected.declared.id) ||
      routes.length !== 1
    )
      return "Composed field consumer has no mandatory route";
    delegated.push({
      load: value.load,
      consumer,
      before: old,
      after: current[0]!,
      route: routes[0]!.function,
    });
    const prefix = before.items.filter(
      (item) => item.block === old.block && item.index >= old.index - 8 && item.index < old.index,
    );
    if (prefix.length !== 8 || !storage(prefix[0], "lda", value.counter.original.declared.id))
      return "Composed field counter prefix is unresolved";
    prefix.forEach((item) => deferredBefore.add(item.key));
    deferredBefore.add(old.key);
    deferredAfter.add(previous.key);
    deferredAfter.add(current[0]!.key);
  }

  if (source.id === input.checked.program.semantic.main) {
    for (const block of source.blocks)
      for (const operation of block.operations) {
        if (
          operation.kind !== "store" ||
          !operation.place.path.some((part) => part.kind === "index")
        )
          continue;
        const index = operation.place.path.find((part) => part.kind === "index"),
          root = resident(before, operation.place.root, operation.place.rootType),
          selectedRoot = resident(after, operation.place.root, operation.place.rootType);
        const value = index?.kind === "index" ? counterFor(index.value) : null;
        const sinks = (pair: Body) =>
          parts(pair, [operation]).filter(
            (item) =>
              item.source.opcode === "sta" &&
              ["indirect-indexed-y", "absolute-y"].includes(item.source.mode),
          );
        const oldSink = sinks(before),
          newSink = sinks(after);
        if (oldSink.length !== 1 || newSink.length !== 1)
          return "Composed typed store has no unique actual sink";
        const a = before.items.filter(
            (item) =>
              item.block === oldSink[0]!.block &&
              item.index >= oldSink[0]!.index - 9 &&
              item.index <= oldSink[0]!.index,
          ),
          b = after.items.filter(
            (item) =>
              item.block === newSink[0]!.block &&
              item.index >= newSink[0]!.index - 2 &&
              item.index <= newSink[0]!.index,
          );
        const pointer = a[3]?.source.operand,
          held = a[8]?.source.operand;
        const label = bindingLabel("global", operation.place.root);
        const field = operation.place.path[0],
          type = operation.place.rootType;
        const element =
          field?.kind === "field" && type?.kind === "struct"
            ? type.fields.find((part) => part.name === field.name)
            : undefined;
        if (
          value === null ||
          root === null ||
          selectedRoot === null ||
          operation.place.path.length !== 2 ||
          operation.place.path[0]?.kind !== "field" ||
          element?.offset !== 0 ||
          element.type.kind !== "array" ||
          element.type.element.kind !== "scalar" ||
          element.type.element.name !== "byte" ||
          element.type.length < value.counter.proof.loop.bound ||
          a.length !== 10 ||
          b.length !== 3 ||
          pointer?.kind !== "storage" ||
          held?.kind !== "storage" ||
          !storage(a[0], "lda", value.counter.original.declared.id) ||
          a[1]?.source.opcode !== "clc" ||
          a[2]?.source.opcode !== "adc" ||
          a[2].source.operand?.kind !== "label" ||
          a[2].source.operand.label !== label ||
          (a[2].source.operand.offset ?? 0) !== 0 ||
          a[2].source.operand.addressByte !== "low" ||
          !storage(a[3], "sta", pointer.requestId) ||
          a[4]?.source.opcode !== "lda" ||
          a[4].source.operand?.kind !== "label" ||
          a[4].source.operand.label !== label ||
          (a[4].source.operand.offset ?? 0) !== 0 ||
          a[4].source.operand.addressByte !== "high" ||
          !immediate(a[5], "adc", 0) ||
          !storage(a[6], "sta", pointer.requestId, 1) ||
          !immediate(a[7], "ldy", 0) ||
          !storage(a[8], "lda", held.requestId) ||
          a[9]?.source.opcode !== "sta" ||
          a[9].source.operand?.kind !== "indirect-y" ||
          a[9].source.operand.requestId !== pointer.requestId ||
          !storage(b[0], "ldy", value.counter.selected.declared.id) ||
          !same(a[8], b[1]) ||
          b[2]?.source.opcode !== "sta" ||
          b[2].source.mode !== "absolute-y" ||
          b[2].source.operand?.kind !== "label" ||
          b[2].source.operand.label !== label ||
          (b[2].source.operand.offset ?? 0) !== 0 ||
          !claim(a, b, [0, 8, 9], operation, STATE.y | STATE.c | STATE.v)
        )
          return "Composed main indexed store disagrees";
        const demand = request(before.view, pointer.requestId, 2, source.id);
        if (
          demand?.declared.storageClass !== "pointer" ||
          after.view.requests.has(pointer.requestId)
        )
          return "Composed main pointer demand disagrees";
        removedDemands.add(demand.declared);
        const maximum = value.counter.proof.loop.bound - 1;
        if (root.start + maximum > root.end || selectedRoot.start + maximum > selectedRoot.end)
          return "Composed indexed store is not contained";
        const addAccess = (pair: Body, item: Item, selected: boolean) => {
          const index = selected ? { start: 0, end: maximum } : { start: 0, end: 0 };
          const pointees = selected
            ? undefined
            : [{ start: root.start, end: root.start + maximum }];
          const envelope = instructionAccessEnvelope({
            cpu: input.checked.profile.cpu,
            instruction: item.instruction,
            pc:
              item.block.origin! +
              item.block.instructions
                .slice(0, item.index)
                .reduce((sum, item) => sum + item.cost.bytes, 0),
            labels: pair.view.labels,
            index,
            ...(pointees === undefined ? {} : { pointees }),
          });
          if (envelope === null) return false;
          (selected ? accessesAfter : accessesBefore).push({
            item,
            index,
            ...(pointees === undefined ? {} : { pointees }),
            envelope,
          });
          return true;
        };
        if (!addAccess(before, a[9]!, false) || !addAccess(after, b[2]!, true))
          return "Composed store access envelope is unavailable";
      }
    for (const entry of input.candidate.lowered.program.storageSelection!.sourceFacts.functions.values())
      for (const parameter of entry.storage?.parameters.values() ?? []) {
        for (const call of parameter.calls.filter((call) => call.owner === source.id)) {
          const formal = [...before.view.requests.values()].filter(
            (request) =>
              request.owner === entry.function.id && request.binding === parameter.parameter,
          );
          if (
            formal.length !== 1 ||
            formal[0]!.bytes !== 2 ||
            after.view.requests.has(formal[0]!.id) ||
            parameter.origin.owner !== null
          )
            return "Composed omitted formal is unresolved";
          const a = parts(before, [call.operation]),
            b = parts(after, [call.operation]);
          const at = a.findIndex((item) => storage(item, "sta", formal[0]!.id));
          const delivery = a.slice(at - 1, at + 3),
            label = bindingLabel("global", parameter.origin.place.root);
          if (
            delivery.length !== 4 ||
            !contiguous(delivery) ||
            ![0, 2].every(
              (n) =>
                delivery[n]?.source.opcode === "lda" &&
                delivery[n].source.mode === "immediate" &&
                delivery[n].source.operand?.kind === "label" &&
                delivery[n].source.operand.label === label &&
                (delivery[n].source.operand.offset ?? 0) === 0 &&
                delivery[n].source.operand.addressByte === (n === 0 ? "low" : "high"),
            ) ||
            !storage(delivery[1], "sta", formal[0]!.id) ||
            !storage(delivery[3], "sta", formal[0]!.id, 1) ||
            delivery.some((item) => removed.has(item.key) || replacements.has(item.key))
          )
            return "Composed direct-global argument delivery disagrees";
          const remaining = a.filter((item) => !delivery.includes(item));
          const formalIndex = entry.function.parameters.findIndex(
            (formal) => formal.id === parameter.parameter,
          );
          const argument = definitions.get(call.operation.arguments[formalIndex] ?? "");
          if (
            argument?.kind !== "place-address" ||
            argument.place.path.length !== 0 ||
            argument.place.root !== parameter.origin.place.root ||
            a.at(-1)?.source.opcode !== "jsr" ||
            !same(a.at(-1), b.at(-1)) ||
            remaining.length !== b.length ||
            !remaining.every((item, index) => same(item, b[index])) ||
            at !== 1 ||
            b.length < 3 ||
            !claim(
              a.slice(0, -1),
              b.slice(0, -1),
              b.slice(0, -1).map((_, index) => index + 4),
              call.operation,
              0,
            )
          )
            return "Composed argument suffix or immutable root disagrees";
          removedDemands.add(formal[0]!);
        }
      }
  }

  for (const view of counters.values())
    for (const old of before.items) {
      const operand = old.source.operand;
      if (
        operand?.kind !== "storage" ||
        operand.requestId !== view.original.declared.id ||
        removed.has(old.key) ||
        replacements.has(old.key) ||
        deferredBefore.has(old.key)
      )
        continue;
      if (
        operand.addressByte !== undefined ||
        ![0, 1].includes(operand.offset ?? 0) ||
        !["lda", "adc", "sbc", "cmp", "and", "ora", "eor", "ldx", "ldy"].includes(old.source.opcode)
      )
        return "Composed counter has an unaccounted observer";
      const candidates = after.items.filter(
        (item) =>
          !usedAfter.has(item.key) &&
          !deferredAfter.has(item.key) &&
          item.source.source === old.source.source &&
          item.source.opcode === old.source.opcode &&
          ((operand.offset ?? 0) === 0
            ? storage(item, old.source.opcode, view.selected.declared.id)
            : immediate(item, old.source.opcode, 0)),
      );
      const operation = source.blocks
        .flatMap((block) => block.operations)
        .find((operation) => operation.span === old.source.source);
      if (
        candidates.length !== 1 ||
        operation === undefined ||
        !claim([old], candidates, [0], operation, 0)
      )
        return "Composed counter read substitution is ambiguous";
    }
  if (
    source.id === input.checked.program.semantic.main &&
    !unchanged(before, after, removed, replacements)
  )
    return "Composed main remaining code disagrees";
  const readInputs = matchLowByteReadInputs(input, packet, before, after, counters);
  if (typeof readInputs === "string") return readInputs;
  accessesBefore.push(...readInputs.before);
  accessesAfter.push(...readInputs.after);
  return {
    source,
    before: before.actual,
    after: after.actual,
    counters,
    removed,
    replacements,
    continuations,
    removedDemands,
    delegated,
    accessesBefore,
    accessesAfter,
    callGuards: readInputs.callGuards,
  };
}
