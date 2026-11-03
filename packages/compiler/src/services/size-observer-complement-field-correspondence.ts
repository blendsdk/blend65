import {
  byteContinuationQuery,
  BYTE_WINDOW_CHANGED,
  machineSuccessors,
} from "../machine/lower-control.js";
import {
  literalResolver,
  ordinalBoundResolver,
  valueDefinitions,
} from "../semantic/aggregate-place-proof.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { ordinalBoundsForFunction } from "../machine/lower-bounds.js";
import { operandAddress } from "../machine/nmos6510-access.js";
import { validateByteWindowObservers } from "./size-observer-byte-windows.js";
import { stateSafe } from "./size-observer-complement-field-state.js";
import type { MachineFunctionSourceFacts } from "../machine/machine-types.js";
import type { SemanticBlock, SemanticFunction } from "../semantic/operations.js";
import type { StorageHome, StorageRange, StorageRequest } from "../storage/storage-types.js";
import type { FinalObserverInput } from "./size-observers.js";
import type { ResidualEffectsResult } from "./size-observer-raw-layout.js";
import {
  direct,
  edge,
  immediate,
  request,
  scalar,
  storage,
} from "./size-observer-complement-field-layout.js";
import type { Body, Item } from "./size-observer-complement-field-layout.js";

/** Invocation-local accounting; no collection grants source or producer authority. */
type Changes = {
  removed: Set<string>;
  replacements: Map<string, string>;
  watchesBefore: { range: StorageRange; allowed: ReadonlySet<string> }[];
};

/** Rebind a coordinate without confusing fresh wrappers with real instruction identity. */
const boundOccurrence = (pair: Body, old: Item) =>
  pair.items.some(
    (item) =>
      item.key === old.key &&
      item.block === old.block &&
      item.source === old.source &&
      item.instruction === old.instruction,
  );

/** Seed only this input's group-owned windows; field consumers still match their own code. */
function initialChanges(
  effects: Extract<ResidualEffectsResult, { readonly kind: "complete" }>,
  source: SemanticFunction,
  route: SemanticFunction,
  before: Body,
  after: Body,
): Changes | string {
  const group = effects.lowByteComposition?.functions.get(source);
  const changes: Changes = { removed: new Set(), replacements: new Map(), watchesBefore: [] };
  if (group === undefined) return changes;
  if (
    group.source !== source ||
    group.before !== before.actual ||
    group.after !== after.actual ||
    group.delegated.some(
      (item) =>
        item.route !== route ||
        !boundOccurrence(before, item.before) ||
        !boundOccurrence(after, item.after),
    ) ||
    group.continuations.some(
      (cut) =>
        !boundOccurrence(before, cut.before.last) ||
        !boundOccurrence(after, cut.after.last) ||
        cut.before.start !== cut.before.last.index + 1 ||
        cut.after.start !== cut.after.last.index + 1,
    )
  )
    return "Composed field occurrence context is stale";
  for (const view of group.counters.values())
    if (
      before.view.requests.get(view.original.declared.id) !== view.original.declared ||
      before.view.homes.get(view.original.home.requestId) !== view.original.home ||
      (view.selected !== null &&
        (after.view.requests.get(view.selected.declared.id) !== view.selected.declared ||
          after.view.homes.get(view.selected.home.requestId) !== view.selected.home))
    )
      return "Composed field counter view is stale";
  for (const key of group.removed) {
    if (!before.items.some((item) => item.key === key) || group.replacements.has(key))
      return "Composed removed field occurrence is unresolved";
    changes.removed.add(key);
  }
  const used = new Set<string>();
  for (const [old, current] of group.replacements) {
    if (
      !before.items.some((item) => item.key === old) ||
      !after.items.some((item) => item.key === current) ||
      used.has(current)
    )
      return "Composed field replacement is unresolved";
    changes.replacements.set(old, current);
    used.add(current);
  }
  return changes;
}

/** Reject overlapping changes before recording any of a bounded template. */
function claim(
  changes: Changes,
  removed: readonly Item[],
  pairs: readonly (readonly [Item, Item])[],
): boolean {
  const keys = [...removed, ...pairs.map(([old]) => old)].map((item) => item.key);
  const targets = pairs.map(([, item]) => item.key);
  if (
    new Set(keys).size !== keys.length ||
    new Set(targets).size !== targets.length ||
    keys.some((key) => changes.removed.has(key) || changes.replacements.has(key)) ||
    targets.some((key) => [...changes.replacements.values()].includes(key))
  )
    return false;
  removed.forEach((item) => changes.removed.add(item.key));
  pairs.forEach(([old, current]) => changes.replacements.set(old.key, current.key));
  return true;
}

/** Check a bound address-byte immediate without guessing a request's spelling. */
function addressByte(pair: Body, item: Item | undefined, opcode: string, value: number): boolean {
  const instruction = item?.instruction,
    operand = instruction?.operand;
  if (instruction?.opcode !== opcode || instruction.mode !== "immediate") return false;
  if (operand?.kind === "immediate") return operand.value === value;
  if (
    operand?.kind !== "label" ||
    operand.addressByte === undefined ||
    operand.transform !== undefined
  )
    return false;
  const base = pair.view.labels.get(operand.label);
  return (
    base !== undefined &&
    (operand.addressByte === "low"
      ? (base + (operand.offset ?? 0)) & 255
      : (base + (operand.offset ?? 0)) >>> 8) === value
  );
}

/** Match only the fixed-field and bounded unit-stride address constructions used by these bodies. */
function typedReads(
  input: FinalObserverInput,
  effects: Extract<ResidualEffectsResult, { readonly kind: "complete" }>,
  packet: MachineFunctionSourceFacts,
  before: Body,
  after: Body,
  parameters: readonly { declared: StorageRequest; home: StorageHome }[],
  backing: StorageRange,
  changes: Changes,
): string | null {
  const source = packet.function,
    definitions = valueDefinitions(source.blocks),
    ordinary = ordinalBoundResolver(definitions, literalResolver(definitions));
  const composed = effects.lowByteComposition?.functions.get(source);
  const pending = new Set(composed?.delegated ?? []);
  const guarded = ordinalBoundsForFunction(
    [
      source.blocks.find((b) => b.id === source.entry)!,
      ...source.blocks.filter((b) => b.id !== source.entry),
    ],
    { program: input.checked.program, profile: input.checked.profile },
    [],
  );
  const firstLoad = after.symbolic.byteComplementProofs?.[0]?.selection?.[1].load;
  for (const old of before.items) {
    const origin = old.source.observerOrigins?.find(
      (o) =>
        o.kind === "typed" &&
        o.operation.kind === "load" &&
        o.position === 0 &&
        o.length === 1 &&
        o.byte === 0,
    );
    if (origin?.operation.kind !== "load" || origin.operation === firstLoad) continue;
    const operation = origin.operation,
      parameter = parameters.find((p) => p.declared.binding === operation.place.root);
    if (parameter === undefined) continue;
    const matches = after.items.filter((item) =>
      item.source.observerOrigins?.some(
        (o) =>
          o.kind === "typed" &&
          o.operation === operation &&
          o.position === 0 &&
          o.length === 1 &&
          o.byte === 0,
      ),
    );
    const current = matches[0],
      selection = packet.storage?.parameters.get(bindingIdentityKey(operation.place.root));
    if (
      matches.length !== 1 ||
      current === undefined ||
      selection === undefined ||
      !current.source.observerOrigins?.some(
        (o) =>
          o.place?.root === selection.origin.place.root &&
          JSON.stringify(o.place.path) === JSON.stringify(operation.place.path),
      )
    )
      return "Original retained typed origin disagrees";
    let type = operation.place.rootType,
      offset = 0,
      index: string | undefined,
      length = 0;
    for (const part of operation.place.path) {
      if (part.kind === "field" && type?.kind === "struct") {
        const field = type.fields.find((f) => f.name === part.name);
        if (field === undefined) return "Original retained field path disagrees";
        offset += field.offset;
        type = field.type;
      } else if (
        part.kind === "index" &&
        type?.kind === "array" &&
        index === undefined &&
        type.element.kind === "scalar" &&
        type.element.name === "byte"
      ) {
        index = part.value;
        length = type.length;
        type = type.element;
      } else return "Original retained typed path is unsupported";
    }
    if (
      type?.kind !== "enum" &&
      !(type?.kind === "scalar" && ["byte", "sbyte", "boolean"].includes(type.name))
    )
      return "Original retained read is not one byte";
    const pointer = old.source.operand,
      a = before.items.filter((i) => i.block === old.block),
      b = after.items.filter((i) => i.block === current.block);
    if (
      old.source.opcode !== "lda" ||
      old.source.mode !== "indirect-indexed-y" ||
      pointer?.kind !== "indirect-y" ||
      (pointer.offset ?? 0) !== 0 ||
      request(before.view, pointer.requestId, 2, source.id) === null
    )
      return "Original retained pointer is unresolved";
    const at = a.indexOf(old),
      next = b.indexOf(current),
      prefix = a.slice(at - (index === undefined ? (offset === 0 ? 5 : 8) : 8), at);
    let pairs: (readonly [Item, Item])[] = [],
      removed: Item[] = [];
    let handoff: NonNullable<typeof composed>["delegated"][number] | undefined;
    let heldCounter = false;
    if (index === undefined) {
      const copied =
        offset === 0 &&
        prefix.length === 5 &&
        storage(prefix[0], "lda", parameter.declared.id) &&
        storage(prefix[1], "sta", pointer.requestId) &&
        storage(prefix[2], "lda", parameter.declared.id, 1) &&
        storage(prefix[3], "sta", pointer.requestId, 1) &&
        immediate(prefix[4], "ldy", 0);
      const added =
        offset !== 0 &&
        prefix.length === 8 &&
        immediate(prefix[0], "ldy", 0) &&
        storage(prefix[1], "lda", parameter.declared.id) &&
        prefix[2]?.source.opcode === "clc" &&
        immediate(prefix[3], "adc", offset) &&
        storage(prefix[4], "sta", pointer.requestId) &&
        prefix[5]?.source.opcode === "tya" &&
        storage(prefix[6], "adc", parameter.declared.id, 1) &&
        storage(prefix[7], "sta", pointer.requestId, 1);
      if (
        !(copied || added) ||
        !direct(after, current, "lda", backing.start + offset, input) ||
        backing.start + offset > backing.end ||
        !pointerDead(before, pointer.requestId, old)
      )
        return "Original retained field address disagrees";
      removed = prefix;
      pairs = [[old, current]];
    } else {
      const maximum =
        effects.originalCallGuards?.get(operation)?.get(index) ??
        guarded.get(operation)?.get(index) ??
        effects.bounds.get(source.id)?.get(index) ??
        ordinary(index);
      const definition = definitions.get(index),
        counter =
          definition?.kind === "load"
            ? [...before.view.requests.values()].find(
                (p) => p.binding === definition.place.root && p.owner === source.id,
              )
            : undefined;
      const view =
        definition?.kind === "load" ? composed?.counters.get(definition.place.root) : undefined;
      heldCounter = view?.register !== null && view?.register !== undefined;
      if (view !== undefined) {
        handoff = [...pending].find(
          (item) =>
            item.load === definition &&
            item.consumer === operation &&
            item.before.key === old.key &&
            item.after.key === current.key,
        );
        if (
          view.original.declared !== counter ||
          definition?.kind !== "load" ||
          !view.loads.has(definition) ||
          handoff === undefined ||
          !boundOccurrence(before, handoff.before) ||
          !boundOccurrence(after, handoff.after)
        )
          return "Composed typed counter consumer is unresolved";
      }
      if (
        maximum === undefined ||
        maximum >= BigInt(length) ||
        maximum > 255n ||
        offset + Number(maximum) >= backing.end - backing.start + 1 ||
        counter === undefined ||
        definition?.kind !== "load" ||
        definition.place.path.length !== 0 ||
        offset !== 0
      )
        return "Original retained index has no contained bound";
      if (
        prefix.length !== 8 ||
        !storage(prefix[0], "lda", counter.id) ||
        prefix[1]?.source.opcode !== "clc" ||
        !storage(prefix[2], "adc", parameter.declared.id) ||
        !storage(prefix[3], "sta", pointer.requestId) ||
        !storage(prefix[4], "lda", parameter.declared.id, 1) ||
        !immediate(prefix[5], "adc", 0) ||
        !storage(prefix[6], "sta", pointer.requestId, 1) ||
        !immediate(prefix[7], "ldy", 0)
      )
        return "Original retained index template disagrees";
      if (current.source.mode === "indirect-indexed-y") {
        const q = b.slice(next - 8, next);
        if (
          current.source.opcode !== "lda" ||
          q.length !== 8 ||
          !addressByte(after, q[2], "adc", backing.start & 255) ||
          !addressByte(after, q[4], "lda", backing.start >>> 8) ||
          ![0, 1, 3, 5, 6, 7].every(
            (n) =>
              JSON.stringify([
                prefix[n]!.source.opcode,
                prefix[n]!.source.mode,
                prefix[n]!.source.operand,
              ]) === JSON.stringify([q[n]!.source.opcode, q[n]!.source.mode, q[n]!.source.operand]),
          ) ||
          JSON.stringify(pointer) !== JSON.stringify(current.source.operand)
        )
          return "Original retained fixed index base disagrees";
        pairs = [...prefix.map((item, n) => [item, q[n]!] as const), [old, current]];
      } else if (view?.register !== null && view?.register !== undefined) {
        const register = view.register;
        if (
          current.source.mode !== `absolute-${register}` ||
          current.source.opcode !== "lda" ||
          operandAddress({
            cpu: input.checked.profile.cpu,
            instruction: current.instruction,
            pc: current.block.origin!,
            labels: after.view.labels,
          }) !== backing.start
        )
          return "Original retained direct index disagrees";
        removed = prefix;
        pairs = [[old, current]];
      } else {
        if (
          current.source.mode !== "absolute-y" ||
          current.source.opcode !== "lda" ||
          !storage(b[next - 1], "ldy", view?.selected?.declared.id ?? counter.id) ||
          operandAddress({
            cpu: input.checked.profile.cpu,
            instruction: current.instruction,
            pc: current.block.origin!,
            labels: after.view.labels,
          }) !== backing.start
        )
          return "Original retained direct index disagrees";
        removed = prefix.slice(1);
        pairs = [
          [prefix[0]!, b[next - 1]!],
          [old, current],
        ];
      }
    }
    // A held counter's Y value is the induction variable itself. Its loop
    // control and dead-at-exit continuation are proved by the counter premises;
    // only the address-computation flags remain ordinary changed state here.
    if (
      !stateSafe(before, old) ||
      !stateSafe(
        after,
        current,
        heldCounter ? BYTE_WINDOW_CHANGED.c | BYTE_WINDOW_CHANGED.v : undefined,
      )
    )
      return "Original retained address exposes changed state";
    if (!claim(changes, removed, pairs)) return "Original retained read is multiply accounted";
    if (handoff !== undefined && !pending.delete(handoff))
      return "Composed typed consumer is multiply accounted";
  }
  return pending.size === 0 ? null : "Composed typed consumers remain unaccounted";
}

/** Compose only exact occurrences whose existing Boolean/BYTE validator also succeeds. */
function windows(
  input: FinalObserverInput,
  effects: Extract<ResidualEffectsResult, { readonly kind: "complete" }>,
  before: Body,
  after: Body,
  changes: Changes,
): string | null {
  const booleans = after.symbolic.booleanCallProofs ?? [],
    bytes = after.symbolic.byteAvailabilityProofs ?? [];
  if (booleans.length + bytes.length === 0) return null;
  if (validateByteWindowObservers(input, effects) !== null)
    return "Original associated window is unresolved";
  for (const proof of booleans) {
    if (proof.removed.length === 0) continue;
    const calls = before.items.filter(
        (item) =>
          item.block.label === proof.block &&
          item.source.opcode === "jsr" &&
          item.source.source === proof.call.span,
      ),
      call = calls[0];
    const comparison =
      call === undefined
        ? undefined
        : before.items.find((item) => item.block === call.block && item.index === call.index + 1);
    if (
      calls.length !== 1 ||
      comparison === undefined ||
      !immediate(comparison, "cmp", 0) ||
      comparison.source.source !== proof.removed[0]?.source ||
      !claim(changes, [comparison], [])
    )
      return "Original Boolean occurrence disagrees";
  }
  for (const proof of bytes) {
    /** The reference may wrap the selected body in its negative bounds expansion. */
    const referenceLabel = (label: string) => {
      const expanded = `${label}.bounds.0.0.pass`;
      const direct = before.actual.blocks.find((block) => block.label === label);
      const pass = before.actual.blocks.find((block) => block.label === expanded);
      const checked =
        direct !== undefined &&
        direct.terminator.kind === "branch" &&
        [direct.terminator.target, direct.terminator.fallthrough].some((target) =>
          target?.includes(".bounds."),
        );
      return checked && pass !== undefined ? expanded : label;
    };
    const old = before.items.filter((item) => item.block.label === referenceLabel(proof.from)),
      current = after.items.filter((item) => item.block.label === proof.from),
      use = before.items.filter((item) => item.block.label === referenceLabel(proof.to)),
      next = after.items.filter((item) => item.block.label === proof.to);
    if (
      old.at(-1)?.source.source !== proof.producer ||
      current.at(-1)?.source.source !== proof.producer ||
      use[1]?.source.source !== proof.consumer ||
      next[0]?.source.source !== proof.consumer ||
      use[0] === undefined ||
      !claim(changes, [use[0]], [[old.at(-1)!, current.at(-1)!]])
    )
      return "Original byte-window occurrence disagrees";
  }
  return null;
}

/**
 * Check the exact source position, never a request-name convention.
 * @param value Original declared lifetime.
 * @param block Checked source block.
 * @param operation Operation position that must be occupied.
 * @returns Whether the declared bytes are live at that position.
 * @example occupied(request, sourceBlock, index)
 */
export const occupied = (value: StorageRequest, block: SemanticBlock, operation: number) =>
  value.lifetime.liveAt.some(
    (position) => position.block === block.id && position.operation === operation,
  );

/** Only linear emitted bounds chains may connect a source body's instruction windows. */
function stream(pair: Body, source: SemanticBlock) {
  const labels = pair.mapping.get(source);
  if (labels === undefined || labels.length === 0) return null;
  const incoming = new Map<string, number>();
  for (const block of pair.actual.blocks)
    for (const target of machineSuccessors(block))
      incoming.set(target, (incoming.get(target) ?? 0) + 1);
  for (const [index, label] of labels.entries()) {
    const block = pair.blocks.get(label);
    if (block === undefined || (index > 0 && incoming.get(label) !== 1)) return null;
    if (index + 1 === labels.length) continue;
    const targets = machineSuccessors(block);
    if (!targets.includes(labels[index + 1]!)) return null;
    for (const target of targets.filter((target) => target !== labels[index + 1])) {
      const stop = pair.blocks.get(target);
      if (
        stop?.instructions.length !== 1 ||
        stop.instructions[0]?.opcode !== "sei" ||
        stop.terminator.kind !== "jump" ||
        stop.terminator.target !== stop.label
      )
        return null;
    }
  }
  return labels.flatMap((label) => pair.items.filter((item) => item.block.label === label));
}

/**
 * Require both pointer bytes to be redefined before later indirect reads in each source stream.
 * @param pair Independently bound function whose control/source obligations already closed.
 * @param id Removed pointer initialization's existing request identity.
 * @param read Original effective read, before the removed initialization becomes dead.
 * @returns False for unresolved streams or a pointer byte read before its next write.
 * @example pointerDead(before, pointer.requestId, originalRead)
 */
export function pointerDead(pair: Body, id: string, read: Item): boolean {
  const uses = (item: Item) =>
    (item.source.operand?.kind === "storage" || item.source.operand?.kind === "indirect-y") &&
    item.source.operand.requestId === id;
  const labels = new Set([...pair.mapping.values()].flat());
  for (const block of pair.actual.blocks) {
    const items = pair.items.filter((item) => item.block === block && uses(item));
    if (items.length === 0) continue;
    if (!labels.has(block.label)) return false;
    const pending = new Set([0, 1]);
    for (const item of items) {
      if (item === read) {
        pending.add(0);
        pending.add(1);
        continue;
      }
      const operand = item.source.operand;
      if (operand?.kind === "indirect-y") {
        if (pending.size > 0) return false;
      } else if (operand?.kind === "storage") {
        const byte = operand.offset ?? 0;
        if (item.source.opcode === "sta") pending.delete(byte);
        else if (pending.has(byte)) return false;
      }
    }
  }
  return true;
}

/**
 * Compare all code except explicitly identified occurrence-level changes.
 * @param before Bound reference function.
 * @param after Independently bound selected function.
 * @param removed Exact reference occurrence coordinates permitted to disappear.
 * @param replacements Exact reference-to-selected occurrence pairs proved elsewhere.
 * @param expandedReference Whether the reference wraps a selected body in its
 *   unreachable negative bounds expansion. The expansion is proved dead by the
 *   held-counter control and bounds premises before this comparison runs.
 * @param redirected Proved forward-edge changes: reference block label to the
 *   selected target. A bottom-tested loop preheader enters its body directly.
 * @returns Whether source mappings, edges and every remaining instruction correspond.
 * @example unchanged(before, after, removed, replacements)
 */
export function unchanged(
  before: Body,
  after: Body,
  removed: ReadonlySet<string>,
  replacements: ReadonlyMap<string, string>,
  expandedReference = false,
  redirected?: ReadonlyMap<string, string>,
  swappedTests?: ReadonlySet<string>,
): boolean {
  if (before.mapping.size !== after.mapping.size) return false;
  for (const [source] of before.mapping) if (!after.mapping.has(source)) return false;
  const used = new Set<string>();
  for (const original of before.symbolic.blocks) {
    const block = before.blocks.get(original.label)!;
    const base = block.label.replace(/\.bounds\.\d+\.\d+\.(low|pass)$/u, "");
    const expanded = block.label !== base;
    const head =
      block.instructions.length === 1 &&
      block.terminator.kind === "branch" &&
      [block.terminator.target, block.terminator.fallthrough].some((target) =>
        target?.includes(".bounds."),
      );
    const trap =
      block.instructions.length === 1 &&
      block.instructions[0]?.opcode === "sei" &&
      block.terminator.kind === "jump" &&
      block.terminator.target === block.label;
    let other = after.blocks.get(block.label),
      next = after.symbolic.blocks.find((item) => item.label === block.label);
    const otherHead =
      other !== undefined &&
      other.instructions.length === 1 &&
      other.terminator.kind === "branch" &&
      [other.terminator.target, other.terminator.fallthrough].some((target) =>
        target?.includes(".bounds."),
      );
    if (expandedReference && head && other !== undefined && !otherHead) {
      other = undefined;
      next = undefined;
    }
    if (other === undefined && expandedReference && block.label.endsWith(".pass")) {
      other = after.blocks.get(base);
      next = after.symbolic.blocks.find((item) => item.label === base);
    } else if (other === undefined && expandedReference && (expanded || head || trap)) continue;
    if (other === undefined || next === undefined) return false;
    used.add(other.label);
    if (
      original.terminator.kind === "return" &&
      next.terminator.kind === "return" &&
      original.instructions.length === 1 &&
      next.instructions.length === 1 &&
      original.instructions[0]?.opcode === "lda" &&
      original.instructions[0].operand?.kind === "immediate" &&
      JSON.stringify([
        original.instructions[0].opcode,
        original.instructions[0].mode,
        original.instructions[0].operand,
      ]) ===
        JSON.stringify([
          next.instructions[0]!.opcode,
          next.instructions[0]!.mode,
          next.instructions[0]!.operand,
        ]) &&
      (block.instructions.length === 0 || other.instructions.length === 0)
    )
      continue;
    const a = edge(block, before.blocks),
      b = edge(other, after.blocks);
    const forward = redirected?.get(block.label);
    /** The bottom-tested header swaps only the tested flag C -> Z. */
    const swapped = (left: string, right: string) => {
      try {
        const first: unknown = JSON.parse(left),
          second: unknown = JSON.parse(right);
        if (
          !Array.isArray(first) ||
          !Array.isArray(second) ||
          first.length !== 3 ||
          second.length !== 3
        )
          return false;
        const flags = (value: unknown) =>
          Array.isArray(value) && value.length === 1 && (value[0] === "c" || value[0] === "z");
        return (
          flags(first[0]) && flags(second[0]) && first[1] === second[1] && first[2] === second[2]
        );
      } catch {
        return false;
      }
    };
    if (
      a === null ||
      b === null ||
      (a !== b &&
        (forward === undefined || b !== JSON.stringify(["go", forward])) &&
        !(swappedTests?.has(block.label) === true && swapped(a, b)))
    )
      return false;
    const left = before.items.filter((item) => item.block === block && !removed.has(item.key));
    const right = after.items.filter((item) => item.block === other);
    if (
      left.length !== right.length ||
      left.some((item, index) =>
        replacements.has(item.key)
          ? replacements.get(item.key) !== right[index]!.key
          : JSON.stringify([item.source.opcode, item.source.mode, item.source.operand]) !==
            JSON.stringify([
              right[index]!.source.opcode,
              right[index]!.source.mode,
              right[index]!.source.operand,
            ]),
      )
    )
      return false;
  }
  return after.symbolic.blocks.every((block) => used.has(block.label));
}

/**
 * Match exact field-complement substitutions without allocating or changing either program.
 * The caller checks the shared first definition, backing, source group and entry state.
 * @param input Same checked source and actual constructions.
 * @param effects Source and induction obligations already discharged by the caller.
 * @param packet Exact source function and its selected recipes.
 * @param before Independently bound original instructions.
 * @param after Independently bound selected instructions.
 * @param context Resolved original parameter, backing, inverse and field displacement.
 * @returns A failed obligation or local occurrence changes and original capture watches.
 * @example const changes = matchFieldCorrespondence(input, effects, packet, before, after, context);
 */
export function matchFieldCorrespondence(
  input: FinalObserverInput,
  effects: Extract<ResidualEffectsResult, { readonly kind: "complete" }>,
  packet: MachineFunctionSourceFacts,
  before: Body,
  after: Body,
  context: {
    /** Complete original parameter pointer demand. */
    readonly parameter: { readonly declared: StorageRequest; readonly home: StorageHome };
    /** Independently resolved original whole-object extent. */
    readonly beforeBacking: StorageRange;
    /** Independently resolved selected whole-object extent. */
    readonly afterBacking: StorageRange;
    /** Original scalar storing the first inverse. */
    readonly inverse: { readonly address: number; readonly declared: StorageRequest };
    /** Packed field byte displacement. */
    readonly offset: number;
  },
):
  | string
  | {
      /** Exact original occurrences removed by these substitutions. */
      readonly removed: ReadonlySet<string>;
      /** Exact original-to-selected instruction correspondences. */
      readonly replacements: ReadonlyMap<string, string>;
      /** Original captures whose only permitted writer is recorded. */
      readonly watchesBefore: readonly {
        readonly range: StorageRange;
        readonly allowed: ReadonlySet<string>;
      }[];
    } {
  const source = packet.function,
    proofs = after.symbolic.byteComplementProofs ?? [],
    first = proofs[0];
  if (
    first === undefined ||
    packet.loops.length === 0 ||
    packet.loops.some((loop) => !effects.loops.has(loop))
  )
    return "Original field source class is unresolved";
  const beforeSide = before.view,
    afterSide = after.view,
    inverseBefore = context.inverse,
    offset = context.offset,
    rootAfter = { range: context.afterBacking };
  const changes = initialChanges(effects, packet.function, packet.function, before, after);
  if (typeof changes === "string") return changes;
  const { removed, replacements, watchesBefore } = changes;
  const definitions = valueDefinitions(source.blocks);
  for (const proof of proofs) {
    const use = proof.selection![0],
      useRecipe = proof.selection![1],
      sourceBlock = source.blocks.find((block) => block.operations.includes(use));
    const index = sourceBlock?.operations.indexOf(use) ?? -1,
      binary = sourceBlock?.operations[index + 1];
    const left = binary?.kind === "binary" ? definitions.get(binary.left) : undefined;
    if (
      sourceBlock === undefined ||
      !packet.loops.some((loop) => loop.members.has(sourceBlock.id)) ||
      binary?.kind !== "binary" ||
      binary.operator !== "&" ||
      binary.right !== use.result ||
      proof.preservedLeft !== binary.left ||
      (left?.kind !== "load" && (left?.kind !== "unary" || left.operator !== "~")) ||
      left.type.kind !== "scalar" ||
      left.type.name !== "byte" ||
      useRecipe.input.place.root !== first.binding ||
      !occupied(
        inverseBefore.declared,
        sourceBlock,
        sourceBlock.operations.indexOf(useRecipe.input),
      )
    )
      return "Original AND source association is incomplete";
    const bodyBefore = stream(before, sourceBlock),
      bodyAfter = stream(after, sourceBlock);
    if (bodyBefore === null || bodyAfter === null)
      return "Original AND source association is incomplete";
    const old = bodyBefore.filter(
        (item) => item.source.opcode === "and" && item.source.source === binary.span,
      ),
      current = bodyAfter.filter(
        (item) => item.source.opcode === "and" && item.source.source === binary.span,
      );
    const oldAnd = old[0],
      newAnd = current[0],
      operand = oldAnd?.source.operand;
    const capture =
      operand?.kind === "storage" && (operand.offset ?? 0) === 0
        ? request(beforeSide, operand.requestId, 1, source.id)
        : null;
    const leftBefore =
        left.kind === "load" && left.place.path.length === 0
          ? scalar(beforeSide, left.place.root, source.id)
          : null,
      leftAfter =
        left.kind === "load" && left.place.path.length === 0
          ? scalar(afterSide, left.place.root, source.id)
          : null;
    const at = oldAnd === undefined ? -1 : bodyBefore.indexOf(oldAnd),
      next = newAnd === undefined ? -1 : bodyAfter.indexOf(newAnd),
      rhs = bodyBefore.slice(at - 4, at - 1);
    let preserved =
      leftBefore !== null &&
      leftAfter !== null &&
      direct(before, bodyBefore[at - 1], "lda", leftBefore.address, input) &&
      direct(after, bodyAfter[next - 1], "lda", leftAfter.address, input);
    if (left.kind === "unary") {
      const held = bodyBefore[at - 5],
        reload = bodyBefore[at - 1],
        operand = held?.source.operand;
      const demand =
        operand?.kind === "storage" ? request(beforeSide, operand.requestId, 1, source.id) : null;
      preserved =
        demand?.declared.storageClass === "temporary" &&
        demand.declared.binding === null &&
        !afterSide.requests.has(demand.declared.id) &&
        held?.source.source === left.span &&
        storage(held, "sta", demand.declared.id) &&
        storage(reload, "lda", demand.declared.id) &&
        immediate(bodyBefore[at - 6], "eor", 255) &&
        bodyBefore[at - 6]?.source.source === left.span &&
        immediate(bodyAfter[next - 1], "eor", 255) &&
        bodyAfter[next - 1]?.source.source === left.span &&
        occupied(demand.declared, sourceBlock, sourceBlock.operations.indexOf(left)) &&
        occupied(demand.declared, sourceBlock, index + 1) &&
        before.items
          .filter(
            (item) =>
              (item.source.operand?.kind === "storage" ||
                item.source.operand?.kind === "indirect-y") &&
              item.source.operand.requestId === demand.declared.id,
          )
          .every((item) => item === held || item === reload);
      if (preserved && demand !== null && held !== undefined && reload !== undefined) {
        removed.add(held.key);
        removed.add(reload.key);
        watchesBefore.push({
          range: { start: demand.home.address, end: demand.home.address },
          allowed: new Set([held.key]),
        });
      }
    }
    if (
      old.length !== 1 ||
      current.length !== 1 ||
      oldAnd === undefined ||
      newAnd === undefined ||
      capture?.declared.storageClass !== "temporary" ||
      !preserved ||
      rhs.length !== 3 ||
      rhs.some((item) => item.block !== oldAnd.block) ||
      !direct(before, rhs[0], "lda", inverseBefore.address, input) ||
      !immediate(rhs[1], "eor", 255) ||
      !direct(before, rhs[2], "sta", capture.home.address, input) ||
      !direct(before, oldAnd, "and", capture.home.address, input) ||
      !direct(after, newAnd, "and", rootAfter.range.start + offset, input) ||
      !occupied(capture.declared, sourceBlock, index) ||
      !occupied(capture.declared, sourceBlock, index + 1) ||
      !byteContinuationQuery(before.blocks)(
        rhs[2]!.block.label,
        rhs[2]!.index + 1,
        BYTE_WINDOW_CHANGED.a | BYTE_WINDOW_CHANGED.n | BYTE_WINDOW_CHANGED.z,
      )
    )
      return "Original RHS capture or AND delivery disagrees";
    for (const item of rhs) removed.add(item.key);
    replacements.set(oldAnd.key, newAnd.key);
    watchesBefore.push({
      range: { start: capture.home.address, end: capture.home.address },
      allowed: new Set([rhs[2]!.key]),
    });
  }
  return (
    typedReads(
      input,
      effects,
      packet,
      before,
      after,
      [context.parameter],
      context.afterBacking,
      changes,
    ) ??
    windows(input, effects, before, after, changes) ??
    changes
  );
}

/**
 * Match retained code in one recorded caller after the parent checks its argument delivery.
 * @param input Same checked source and actual constructions.
 * @param effects Discharged source/induction obligations, not a receipt.
 * @param packet Callee's field packet; caller identity is resolved separately.
 * @param before Bound original caller.
 * @param after Bound selected caller of that same checked source function.
 * @param context Original forwarding formals and independent backing extents.
 * @returns Failure or exact local changes; the parent still checks every remaining instruction.
 * @example const changes = matchRecordedFieldCaller(input, effects, packet, before, after, context);
 */
export function matchRecordedFieldCaller(
  input: FinalObserverInput,
  effects: Extract<ResidualEffectsResult, { readonly kind: "complete" }>,
  packet: MachineFunctionSourceFacts,
  before: Body,
  after: Body,
  context: {
    /** Exact original caller formals used by forwarding arguments. */ readonly parameters: readonly {
      readonly declared: StorageRequest;
      readonly home: StorageHome;
    }[];
    /** Original object extent. */ readonly beforeBacking: StorageRange;
    /** Selected object extent. */ readonly afterBacking: StorageRange;
  },
): ReturnType<typeof matchFieldCorrespondence> {
  const owner = after.symbolic.sourceFunction,
    facts = input.candidate.lowered.program.storageSelection?.sourceFacts;
  const caller = [...(facts?.functions.values() ?? [])].find((p) => p.function.id === owner);
  if (
    caller === undefined ||
    before.symbolic.sourceFunction !== owner ||
    ![...(packet.storage?.parameters.values() ?? [])].some((p) =>
      p.calls.some((call) => call.owner === owner),
    )
  )
    return "Original recorded caller identity is unresolved";
  const changes = initialChanges(effects, caller.function, packet.function, before, after);
  if (typeof changes === "string") return changes;
  return (
    typedReads(
      input,
      effects,
      caller,
      before,
      after,
      context.parameters,
      context.afterBacking,
      changes,
    ) ??
    windows(input, effects, before, after, changes) ??
    changes
  );
}
