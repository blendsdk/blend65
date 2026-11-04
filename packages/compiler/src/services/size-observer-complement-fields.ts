import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { semanticTypesEqual } from "../frontend/semantic-type-relations.js";
import { validByteComplementFacts } from "../machine/byte-value-availability.js";
import {
  bindingLabel,
  byteContinuationQuery,
  BYTE_WINDOW_CHANGED,
  machineSuccessors,
} from "../machine/lower-control.js";
import { instructionAccessEnvelope, operandAddress } from "../machine/nmos6510-access.js";
import { nmosInstructionForm } from "../target/nmos6510.js";
import { findNamedObjectBacking } from "./size-observer-backing.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { MachineFunction, MachineFunctionSourceFacts } from "../machine/machine-types.js";
import type { ObjectRoot } from "./size-observer-backing.js";
import type { FinalObserverInput } from "./size-observers.js";
import type { ResidualEffectsResult } from "./size-observer-raw-layout.js";
import type { StorageHome, StorageRange, StorageRequest } from "../storage/storage-types.js";
import {
  body,
  direct,
  immediate,
  key,
  ram,
  request,
  scalar,
  side,
  storage,
} from "./size-observer-complement-field-layout.js";
import type { Body, Item } from "./size-observer-complement-field-layout.js";
import { stateSafe } from "./size-observer-complement-field-state.js";
import {
  occupied,
  pointerDead,
  unchanged,
  copiedParameterLocals,
  deadStageStores,
  foldedRegisterReloads,
  forwardedLocalReloads,
  matchFieldCorrespondence,
  matchRecordedFieldCaller,
} from "./size-observer-complement-field-correspondence.js";

/** Source/borrow/Original induction premises already checked by the atomic owner. */
type Effects = Extract<ResidualEffectsResult, { readonly kind: "complete" }>;

/** NMOS data writers; stack/control writes stay on page one, outside every watched RAM extent. */
const DATA_WRITERS = new Set(["sta", "stx", "sty", "asl", "lsr", "rol", "ror", "inc", "dec"]);

/** Derive the packed byte offset from the checked field path, never a fixture's numeric displacement. */
function field(
  type: SemanticType,
  path: readonly { readonly kind: string; readonly name?: string }[],
): number | null {
  let offset = 0;
  for (const part of path) {
    if (part.kind !== "field" || type.kind !== "struct") return null;
    const member = type.fields.find((member) => member.name === part.name);
    if (member === undefined) return null;
    offset += member.offset;
    type = member.type;
  }
  return type.kind === "scalar" && type.name === "byte" ? offset : null;
}

/** A generated terminal halt has no register consumer or ordinary return ABI. No target code is changed. */
function continuation(pair: Body) {
  const blocks = new Map(
    pair.actual.blocks.map((block) => [
      block.label,
      block.instructions.length === 1 &&
      block.instructions[0]?.opcode === "sei" &&
      block.terminator.kind === "jump" &&
      block.terminator.target === block.label
        ? { ...block, terminator: { kind: "return" as const } }
        : block,
    ]),
  );
  return byteContinuationQuery(blocks);
}

/** Check the small actual caller suffix, then hand remaining A/N/Z differences to each callee entry. */
function entrySafe(caller: Body, from: number, call: Item, callee: Body): boolean {
  let a = true,
    n = true,
    z = true;
  for (const item of caller.items.filter(
    (item) => item.block === call.block && item.index >= from && item.index < call.index,
  )) {
    const instruction = item.instruction;
    if (
      instruction.opcode === "jsr" ||
      (a && instruction.uses.registers.includes("a")) ||
      (n && instruction.uses.flags.includes("n")) ||
      (z && instruction.uses.flags.includes("z"))
    )
      return false;
    a &&= !instruction.defines.registers.includes("a");
    n &&= !instruction.defines.flags.includes("n");
    z &&= !instruction.defines.flags.includes("z");
  }
  return byteContinuationQuery(callee.blocks)(
    callee.actual.blocks[0]!.label,
    0,
    (a ? BYTE_WINDOW_CHANGED.a : 0) |
      (n ? BYTE_WINDOW_CHANGED.n : 0) |
      (z ? BYTE_WINDOW_CHANGED.z : 0),
  );
}

/** Decode watched writes independently of optional annotations; typed targets still need their original containment proof. */
function writes(
  input: FinalObserverInput,
  pair: Body,
  watched: readonly { range: StorageRange; allowed: ReadonlySet<string> }[],
): boolean {
  for (const item of pair.items) {
    if (!DATA_WRITERS.has(item.instruction.opcode)) continue;
    const store = item.instruction.observerOrigins?.find(
      (origin) => origin.kind === "typed" && origin.operation.kind === "store",
    );
    const rootType = store?.place?.rootType;
    let target: StorageRange | undefined;
    if (store?.place !== undefined && (rootType?.kind === "array" || rootType?.kind === "struct")) {
      const binding = store.place.root,
        local = [...pair.view.requests.values()].find(
          (value) => value.binding === binding && value.storageClass === "local",
        );
      target = findNamedObjectBacking(
        { binding, owner: local?.owner ?? null, type: rootType },
        pair.view.shared,
        pair.view.homes,
      )?.range;
    }
    const accesses = instructionAccessEnvelope({
      cpu: input.checked.profile.cpu,
      instruction: item.instruction,
      pc:
        item.block.origin! +
        item.block.instructions
          .slice(0, item.index)
          .reduce((sum, instruction) => sum + instruction.cost.bytes, 0),
      labels: pair.view.labels,
      ...(target === undefined ? {} : { index: { start: 0, end: 0 }, pointees: [target] }),
    });
    if (
      accesses === null ||
      accesses.some(
        (access) =>
          access.kind === "write" &&
          access.ranges.some((range) =>
            watched.some(
              (watch) =>
                range.start <= watch.range.end &&
                range.end >= watch.range.start &&
                !watch.allowed.has(item.key),
            ),
          ),
      )
    )
      return false;
  }
  return true;
}

/**
 * Check the bounded named-field double-complement class without changing storage or target instructions.
 * The atomic caller retains source/status/asynchronous and both physical-footprint checks.
 * @param input Original checked source and independently closed reference/candidate.
 * @param effects Already discharged named borrowing and Original-loop premises.
 * @param selected Actual selected symbolic function, not a filtered or rebuilt candidate.
 * @param packet Original sealed source and storage selections for this function.
 * @returns A specific failed obligation, or null for a complete bounded function proof.
 * @example const reason = validateFieldComplements(input, effects, fn, packet);
 */
export function validateFieldComplements(
  input: FinalObserverInput,
  effects: Effects,
  selected: MachineFunction,
  packet: MachineFunctionSourceFacts,
): string | null {
  const facts = packet.complements,
    proofs = selected.byteComplementProofs ?? [],
    source = packet.function;
  const loop = packet.loops[0];
  if (
    input.reference.kind !== "feasible" ||
    facts === undefined ||
    !validByteComplementFacts(facts, packet, input.checked.profile.id) ||
    proofs.length === 0 ||
    proofs.length !== facts.replacements.size ||
    new Set(proofs.map((proof) => proof.selection?.[0])).size !== proofs.length ||
    effects.operations.size === 0 ||
    loop === undefined ||
    packet.loops.some((item) => !effects.loops.has(item))
  )
    return "Original field source class is unresolved";
  const first = proofs[0]!,
    selection = first.selection;
  if (selection === undefined) return "Original field selection is missing";
  const recipe = selection[1],
    formal = source.parameters.find((parameter) => parameter.id === recipe.load.place.root);
  const parameter =
    formal === undefined
      ? undefined
      : packet.storage?.parameters.get(bindingIdentityKey(formal.id));
  const rootType = parameter?.origin.type;
  if (
    recipe.kind !== "original" ||
    formal === undefined ||
    parameter === undefined ||
    rootType?.kind !== "struct" ||
    parameter.origin.place.path.length !== 0 ||
    !semanticTypesEqual(formal.type, rootType) ||
    !packet.objects.stableParameters.has(bindingIdentityKey(formal.id)) ||
    proofs.some(
      (proof) =>
        proof.kind !== "original" ||
        proof.function !== source.id ||
        proof.domain !== "main" ||
        proof.cacheRequestId !== null ||
        proof.binding !== first.binding ||
        proof.selection?.[1].first !== recipe.first ||
        proof.selection[1].load !== recipe.load ||
        facts.replacements.get(proof.selection[0]) !== proof.selection[1] ||
        !proof.selection[1].defer,
    )
  )
    return "Original field recipe or stable parameter disagrees";
  const offset = field(rootType, recipe.load.place.path);
  if (offset === null || offset < 0 || offset >= rootType.size || offset > 255)
    return "Original packed field has no supported byte offset";
  const root: ObjectRoot = {
    binding: parameter.origin.place.root,
    owner: parameter.origin.owner,
    type: rootType,
  };
  const beforeSide = side(
      input.reference.shared,
      input.reference.checked.lowered.program.functions,
    ),
    afterSide = side(input.candidate.shared, input.candidate.lowered.program.functions);
  const before = body(beforeSide, source.id, source),
    after = body(afterSide, source.id, source);
  if (before === null || after === null) return "Original field code binding is unresolved";
  const rootBefore = findNamedObjectBacking(root, beforeSide.shared, beforeSide.homes),
    rootAfter = findNamedObjectBacking(root, afterSide.shared, afterSide.homes);
  const params = [...beforeSide.requests.values()].filter(
    (value) =>
      value.binding === formal.id &&
      value.owner === source.id &&
      value.storageClass === "parameter",
  );
  const param = params.length === 1 ? request(beforeSide, params[0]!.id, 2, source.id) : null;
  if (
    rootBefore === null ||
    rootAfter === null ||
    !ram(rootBefore.range) ||
    !ram(rootAfter.range) ||
    param === null ||
    [...afterSide.requests.values()].some(
      (value) => value.binding === formal.id && value.owner === source.id,
    ) ||
    proofs.some(
      (proof) =>
        proof.source.offset !== offset ||
        (rootAfter.request === null
          ? proof.source.kind !== "symbol" ||
            proof.source.id !== bindingLabel("global", root.binding)
          : proof.source.kind !== "home" || proof.source.id !== rootAfter.request.id),
    )
  )
    return "Original field backing or parameter omission disagrees";
  const removed = new Set<string>(),
    replacements = new Map<string, string>();
  const sourceEntry = source.blocks.find((block) => block.id === source.entry)!;
  const stores = source.blocks
    .flatMap((block) => block.operations)
    .filter((operation) => operation.kind === "store" && operation.place.root === first.binding);
  const inverseStore = stores[0];
  if (
    stores.length !== 1 ||
    inverseStore?.kind !== "store" ||
    inverseStore.value !== recipe.first.result ||
    sourceEntry.operations.indexOf(inverseStore) !==
      sourceEntry.operations.indexOf(recipe.first) + 1
  )
    return "Original inverse definition is unresolved";
  const inverseBefore = scalar(beforeSide, first.binding, source.id),
    inverseAfter = scalar(afterSide, first.binding, source.id);
  /** Find every occurrence of this exact source load in one construction. */
  const entryLoads = (pair: Body) =>
    pair.items.filter((item) =>
      item.instruction.observerOrigins?.some(
        (origin) =>
          origin.kind === "typed" &&
          origin.operation === recipe.load &&
          origin.position === 0 &&
          origin.length === 1,
      ),
    );

  const loadsBefore = entryLoads(before),
    loadsAfter = entryLoads(after);
  const load = loadsBefore[0],
    fixed = loadsAfter[0];
  if (
    loadsBefore.length !== 1 ||
    loadsAfter.length !== 1 ||
    load === undefined ||
    fixed === undefined ||
    inverseBefore?.declared == null ||
    inverseAfter?.declared == null ||
    !occupied(param.declared, sourceEntry, sourceEntry.operations.indexOf(recipe.load)) ||
    !occupied(inverseBefore.declared, sourceEntry, sourceEntry.operations.indexOf(inverseStore)) ||
    !occupied(inverseAfter.declared, sourceEntry, sourceEntry.operations.indexOf(inverseStore))
  )
    return "Original field read or inverse occupancy is incomplete";
  const localBefore = before.items.filter((item) => item.block === load.block),
    localAfter = after.items.filter((item) => item.block === fixed.block);
  const pointer = load.source.operand;
  if (
    load.source.opcode !== "lda" ||
    load.source.mode !== "indirect-indexed-y" ||
    pointer?.kind !== "indirect-y" ||
    (pointer.offset ?? 0) !== 0
  )
    return "Original entry pointer or inverse template disagrees";
  // Zero displacement copies the pointer; nonzero displacement closes the exact carry chain.
  const prefix = localBefore.slice(load.index - (offset === 0 ? 5 : 8), load.index);
  const copied =
    offset === 0 &&
    prefix.length === 5 &&
    storage(prefix[0], "lda", param.declared.id) &&
    storage(prefix[1], "sta", pointer.requestId) &&
    storage(prefix[2], "lda", param.declared.id, 1) &&
    storage(prefix[3], "sta", pointer.requestId, 1) &&
    immediate(prefix[4], "ldy", 0);
  const added =
    offset !== 0 &&
    prefix.length === 8 &&
    immediate(prefix[0], "ldy", 0) &&
    storage(prefix[1], "lda", param.declared.id) &&
    prefix[2]?.source.opcode === "clc" &&
    immediate(prefix[3], "adc", offset) &&
    storage(prefix[4], "sta", pointer.requestId) &&
    prefix[5]?.source.opcode === "tya" &&
    storage(prefix[6], "adc", param.declared.id, 1) &&
    storage(prefix[7], "sta", pointer.requestId, 1);
  if (
    !(copied || added) ||
    !direct(after, fixed, "lda", rootAfter.range.start + offset, input) ||
    !immediate(localBefore[load.index + 1], "eor", 255) ||
    !immediate(localAfter[fixed.index + 1], "eor", 255) ||
    !direct(before, localBefore[load.index + 2], "sta", inverseBefore.address, input) ||
    !direct(after, localAfter[fixed.index + 2], "sta", inverseAfter.address, input)
  )
    return "Original entry pointer or inverse template disagrees";
  const invBefore = localBefore[load.index + 2]!,
    invAfter = localAfter[fixed.index + 2]!;
  for (const item of prefix) removed.add(item.key);
  replacements.set(load.key, fixed.key);
  if (
    !pointerDead(before, pointer.requestId, load) ||
    !pointerDead(after, pointer.requestId, fixed)
  )
    return "Original removed pointer state can reach a later read";
  const changed = BYTE_WINDOW_CHANGED.y | BYTE_WINDOW_CHANGED.c | BYTE_WINDOW_CHANGED.v;
  const composed = effects.lowByteComposition?.functions.get(source);
  if (
    (!continuation(before)(invBefore.block.label, invBefore.index + 1, changed) ||
      !continuation(after)(invAfter.block.label, invAfter.index + 1, changed)) &&
    !(
      composed?.source === source &&
      composed.before === before.actual &&
      composed.after === after.actual &&
      stateSafe(before, invBefore) &&
      stateSafe(after, invAfter)
    )
  )
    return "Original entry addressing exposes changed state";
  const watchesBefore: { range: StorageRange; allowed: ReadonlySet<string> }[] = [
    { range: rootBefore.range, allowed: new Set<string>() },
    {
      range: { start: param.home.address, end: param.home.address + 1 },
      allowed: new Set<string>(),
    },
    {
      range: { start: inverseBefore.address, end: inverseBefore.address },
      allowed: new Set([invBefore.key]),
    },
  ];
  const watchesAfter = [
    { range: rootAfter.range, allowed: new Set<string>() },
    {
      range: { start: inverseAfter.address, end: inverseAfter.address },
      allowed: new Set([invAfter.key]),
    },
  ];
  const changes = matchFieldCorrespondence(input, effects, packet, before, after, {
    parameter: param,
    beforeBacking: rootBefore.range,
    afterBacking: rootAfter.range,
    inverse: { address: inverseBefore.address, declared: inverseBefore.declared },
    offset,
  });
  if (typeof changes === "string") return changes;
  for (const key of changes.removed) removed.add(key);
  for (const [from, to] of changes.replacements) replacements.set(from, to);
  watchesBefore.push(...changes.watchesBefore);
  if (!writes(input, before, watchesBefore))
    return "Original reference field or private write disagrees";
  if (!writes(input, after, watchesAfter))
    return "Original selected field or private write disagrees";
  const redirected = new Map<string, string>(),
    swappedTests = new Set<string>();
  if (composed?.source === source && composed.before === before.actual)
    for (const view of composed.counters.values())
      if (view.register !== null && view.proof.firstTestElided === true) {
        redirected.set(view.proof.loop.preheader.id, view.proof.loop.body.id);
        swappedTests.add(view.proof.loop.header.id);
      }
  if (
    !unchanged(
      before,
      after,
      removed,
      replacements,
      true,
      redirected,
      swappedTests,
      new Set([
        ...forwardedLocalReloads(before, after),
        ...deadStageStores(before, input.candidate.lowered.program),
      ]),
      copiedParameterLocals(before, after),
      foldedRegisterReloads(before, after),
    )
  )
    return "Original unchanged callee code disagrees";
  const callerOwners = new Set(parameter.calls.map((call) => call.owner));
  const expectedCallsBefore = new Set<string>(),
    expectedCallsAfter = new Set<string>();
  for (const owner of callerOwners) {
    const caller = input.checked.program.semantic.functions.find((fn) => fn.id === owner),
      oldCaller = body(beforeSide, owner, caller),
      newCaller = body(afterSide, owner, caller),
      callerPacket =
        caller === undefined
          ? undefined
          : input.candidate.lowered.program.storageSelection?.sourceFacts?.functions.get(caller);
    if (oldCaller === null || newCaller === null || caller === undefined)
      return "Original caller ownership is unresolved";
    const callerRemoved = new Set<string>();
    const forwarded: { declared: StorageRequest; home: StorageHome }[] = [];
    const watched: { range: StorageRange; allowed: ReadonlySet<string> }[] = [];
    const boundaries: { old: Item; current: Item; end: number }[] = [];
    for (const call of parameter.calls.filter((call) => call.owner === owner)) {
      const sourceBlock = caller.blocks.find((block) => block.id === call.position.block),
        argument = caller.blocks
          .flatMap((block) => block.operations)
          .find(
            (operation) =>
              "result" in operation &&
              operation.result === call.operation.arguments[source.parameters.indexOf(formal)],
          );
      if (
        sourceBlock?.operations[call.position.operation] !== call.operation ||
        argument?.kind !== "place-address" ||
        argument.place.path.length !== 0 ||
        !semanticTypesEqual(argument.type, root.type) ||
        !effects.operations.has(argument)
      )
        return "Original evaluated argument identity is unresolved";
      const callAt = (pair: Body) =>
        pair.items.filter(
          (item) =>
            pair.mapping.get(sourceBlock)?.includes(item.block.label) &&
            item.source.opcode === "jsr" &&
            item.source.source === call.operation.span &&
            item.source.operand?.kind === "label" &&
            item.source.operand.label === before.symbolic.id &&
            (item.source.operand.offset ?? 0) === 0,
        );
      const oldCalls = callAt(oldCaller),
        newCalls = callAt(newCaller),
        oldCall = oldCalls[0],
        newCall = newCalls[0];
      if (
        oldCalls.length !== 1 ||
        newCalls.length !== 1 ||
        oldCall === undefined ||
        newCall === undefined
      )
        return "Original actual call occurrence is unresolved";
      const forwarding = argument.place.root !== root.binding;
      const origin = callerPacket?.storage?.parameters.get(bindingIdentityKey(argument.place.root));
      const demands = [...beforeSide.requests.values()].filter(
        (value) =>
          value.owner === owner &&
          value.binding === argument.place.root &&
          value.storageClass === "parameter",
      );
      const incoming =
        forwarding && demands.length === 1 ? request(beforeSide, demands[0]!.id, 2, owner) : null;
      if (
        forwarding &&
        (incoming === null ||
          origin?.origin.place.root !== root.binding ||
          origin.origin.owner !== root.owner ||
          origin.origin.place.path.length !== 0 ||
          !semanticTypesEqual(origin.origin.type, root.type) ||
          !caller.parameters.some(
            (p) => p.id === argument.place.root && semanticTypesEqual(p.type, root.type),
          ))
      )
        return "Original forwarded origin is unresolved";
      const low = oldCaller.items.filter(
        (item) =>
          item.block === oldCall.block &&
          item.index < oldCall.index &&
          item.source.source === call.operation.span &&
          storage(item, "sta", param.declared.id),
      );
      const firstLow = low[0],
        delivery =
          firstLow === undefined
            ? []
            : oldCaller.items.filter(
                (item) =>
                  item.block === oldCall.block &&
                  item.index >= firstLow.index - 1 &&
                  item.index <= firstLow.index + 2,
              );
      const address = (item: Item | undefined, byte: "low" | "high") => {
        const operand = item?.source.operand;
        return (
          item?.source.opcode === "lda" &&
          item.source.mode === "immediate" &&
          operand !== null &&
          operand !== undefined &&
          ((operand.kind === "label" &&
            rootBefore.request === null &&
            operand.label === bindingLabel("global", root.binding)) ||
            (operand.kind === "storage" && operand.requestId === rootBefore.request?.id)) &&
          (operand.offset ?? 0) === 0 &&
          operand.addressByte === byte
        );
      };
      let materialization: Item[] = [];
      if (forwarding && incoming !== null) {
        const operand = delivery[0]?.source.operand;
        const stage =
          operand?.kind === "storage" ? request(beforeSide, operand.requestId, 2, owner) : null;
        materialization = oldCaller.items.filter(
          (item) =>
            item.block === oldCall.block &&
            item.index >= (delivery[0]?.index ?? 0) - 4 &&
            item.index < (delivery[0]?.index ?? 0),
        );
        const argumentBlock = caller.blocks.find((b) => b.operations.includes(argument));
        if (
          stage === null ||
          stage.declared.storageClass !== "pointer" ||
          stage.declared.binding !== null ||
          argumentBlock === undefined ||
          !occupied(stage.declared, argumentBlock, argumentBlock.operations.indexOf(argument)) ||
          !occupied(stage.declared, sourceBlock, call.position.operation) ||
          !occupied(incoming.declared, sourceBlock, call.position.operation) ||
          afterSide.requests.has(stage.declared.id) ||
          afterSide.requests.has(incoming.declared.id) ||
          materialization.length !== 4 ||
          materialization.some((item) => item.source.source !== argument.span) ||
          !storage(materialization[0], "lda", incoming.declared.id) ||
          !storage(materialization[1], "sta", stage.declared.id) ||
          !storage(materialization[2], "lda", incoming.declared.id, 1) ||
          !storage(materialization[3], "sta", stage.declared.id, 1) ||
          !storage(delivery[0], "lda", stage.declared.id) ||
          !storage(delivery[2], "lda", stage.declared.id, 1) ||
          oldCaller.items.some(
            (item) =>
              (item.source.operand?.kind === "storage" ||
                item.source.operand?.kind === "indirect-y") &&
              item.source.operand.requestId === stage.declared.id &&
              ![materialization[1], materialization[3], delivery[0], delivery[2]].includes(item),
          )
        )
          return "Original forwarded materialization disagrees";
        forwarded.push(incoming);
        watched.push(
          {
            range: { start: incoming.home.address, end: incoming.home.address + 1 },
            allowed: new Set(),
          },
          {
            range: { start: stage.home.address, end: stage.home.address + 1 },
            allowed: new Set([materialization[1]!.key, materialization[3]!.key]),
          },
        );
      }
      if (
        low.length !== 1 ||
        delivery.length !== 4 ||
        delivery.some((item) => item.source.source !== call.operation.span) ||
        (!forwarding && !address(delivery[0], "low")) ||
        !storage(delivery[1], "sta", param.declared.id) ||
        (!forwarding && !address(delivery[2], "high")) ||
        !storage(delivery[3], "sta", param.declared.id, 1) ||
        delivery[3]!.index >= oldCall.index ||
        !entrySafe(oldCaller, delivery[3]!.index + 1, oldCall, before)
      )
        return "Original pointer delivery or call-entry state disagrees";
      for (const item of [...materialization, ...delivery]) {
        if (callerRemoved.has(item.key)) return "Original caller occurrence is multiply accounted";
        callerRemoved.add(item.key);
      }
      boundaries.push({ old: oldCall, current: newCall, end: delivery[3]!.index + 1 });
      expectedCallsBefore.add(oldCall.key);
      expectedCallsAfter.add(newCall.key);
    }
    const changes = matchRecordedFieldCaller(input, effects, packet, oldCaller, newCaller, {
      parameters: forwarded,
      beforeBacking: rootBefore.range,
      afterBacking: rootAfter.range,
    });
    if (typeof changes === "string") return changes;
    // The composition may already prove counter or delivery windows in this
    // caller; a shared occurrence is removed once and never re-paired differently.
    const shared = effects.lowByteComposition?.functions.get(caller);
    for (const key of changes.removed) {
      if (callerRemoved.has(key) && !shared?.removed.has(key))
        return "Original caller occurrence is multiply accounted";
      callerRemoved.add(key);
    }
    const callerReplacements = new Map(changes.replacements);
    for (const key of shared?.removed ?? [])
      if (!changes.replacements.has(key)) callerRemoved.add(key);
    for (const [from, to] of shared?.replacements ?? []) {
      const current = callerReplacements.get(from);
      if (current !== undefined && current !== to)
        return "Original caller occurrence is multiply accounted";
      callerReplacements.set(from, to);
    }
    if (!writes(input, oldCaller, [...watched, ...changes.watchesBefore]))
      return "Original caller private writes disagree";
    const callerRedirected = new Map<string, string>(),
      callerSwaps = new Set<string>();
    for (const view of shared?.counters.values() ?? [])
      if (view.register !== null && view.proof.firstTestElided === true) {
        callerRedirected.set(view.proof.loop.preheader.id, view.proof.loop.body.id);
        callerSwaps.add(view.proof.loop.header.id);
      }
    if (
      !unchanged(
        oldCaller,
        newCaller,
        callerRemoved,
        callerReplacements,
        true,
        callerRedirected,
        callerSwaps,
        new Set([
          ...forwardedLocalReloads(oldCaller, newCaller),
          ...deadStageStores(oldCaller, input.candidate.lowered.program),
        ]),
        copiedParameterLocals(oldCaller, newCaller),
        foldedRegisterReloads(oldCaller, newCaller),
      )
    )
      return "Original caller initialization or remaining argument code disagrees";
    for (const boundary of boundaries) {
      const retained: readonly Item[] = oldCaller.items.filter(
        (item) => item.block === boundary.old.block && !callerRemoved.has(item.key),
      );
      const suffix = retained.findIndex((item) => item.index >= boundary.end);
      const selected = newCaller.items.filter((item) => item.block === boundary.current.block);
      if (
        suffix < 0 ||
        selected[suffix] === undefined ||
        !entrySafe(oldCaller, boundary.end, boundary.old, before) ||
        !entrySafe(newCaller, selected[suffix]!.index, boundary.current, after)
      )
        return "Original matched call-entry state disagrees";
    }
  }
  if (parameter.calls.length === 0) return "Original parameter has no recorded caller";
  for (const [view, expected] of [
    [beforeSide, expectedCallsBefore],
    [afterSide, expectedCallsAfter],
  ] as const) {
    const target = view.shared.layout.program.functions.find(
      (fn) => fn.sourceFunction === source.id,
    )!;
    const labels = new Set([target.id, ...target.blocks.map((block) => block.label)]);
    const code = new Set<number>();
    // Decode byte extents from the selected CPU, not mutable reported costs.
    // Empty aliases emit nothing; executing bridge JMPs still occupy three bytes.
    for (const block of target.blocks) {
      let pc = block.origin!;
      for (const instruction of block.instructions) {
        const form = nmosInstructionForm(
          input.checked.profile.cpu,
          instruction.opcode,
          instruction.mode,
        );
        if (form === null) return "Original field code extent is unresolved";
        for (let byte = 0; byte < form.bytes; byte += 1) code.add(pc++);
      }
      const kind = block.terminator.kind;
      const bytes =
        kind === "return"
          ? 1
          : kind === "jump"
            ? 3
            : kind === "branch"
              ? 2
              : kind === "long-branch"
                ? 5
                : 0;
      for (let byte = 0; byte < bytes; byte += 1) code.add(pc++);
    }
    for (const fn of [view.shared.layout.program.startup, ...view.shared.layout.program.functions])
      for (const block of fn.blocks) {
        if (
          fn !== target &&
          machineSuccessors(block).some(
            (label) => labels.has(label) || code.has(view.labels.get(label) ?? -1),
          )
        )
          return "Original field has an unrecorded code entry";
        for (const [index, instruction] of block.instructions.entries()) {
          const operand = instruction.operand;
          const address = operandAddress({
            cpu: input.checked.profile.cpu,
            instruction,
            pc: block.origin!,
            labels: view.labels,
          });
          if (
            ((operand?.kind === "label" && labels.has(operand.label)) ||
              (address !== null && code.has(address)) ||
              (instruction.opcode === "jsr" && address === null)) &&
            !(
              instruction.opcode === "jsr" &&
              operand?.kind === "label" &&
              operand.label === target.id &&
              (operand.offset ?? 0) === 0 &&
              operand.addressByte === undefined &&
              operand.transform === undefined &&
              expected.has(key(fn, block, index))
            )
          )
            return "Original field has an unrecorded code entry";
        }
      }
  }
  return null;
}
