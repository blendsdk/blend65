import {
  BYTE_WINDOW_CHANGED as STATE,
  byteContinuationQuery,
  machineSuccessors,
  bindingLabel,
} from "../machine/lower-control.js";
import { semanticTypesEqual } from "../frontend/semantic-type-relations.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import { siteKey } from "./size-observer-selected-loop-layout.js";
import type {
  FixedCounterProof,
  MachineInstruction,
  MachineFunction,
  MachineBlock,
} from "../machine/machine-types.js";
import type { Side } from "./size-observer-selected-loop-layout.js";
import type { FinalObserverInput } from "./size-observers.js";

/** Complete register controls do not invent a memory home for the semantic word counter. */
function controls(proof: FixedCounterProof, current: Side): boolean {
  const register = proof.representation;
  if (register !== "x" && register !== "y") return false;
  for (const [role, opcode, value, source] of [
    [0, `ld${register}`, 0, proof.loop.initialization.span],
    [1, `cp${register}`, proof.loop.bound, proof.loop.comparison.span],
    [3, `in${register}`, null, proof.loop.updateStore.span],
  ] as const) {
    const items = current.symbols[role]!.instructions;
    const item = items[0];
    if (
      items.length !== 1 ||
      item?.opcode !== opcode ||
      item.source !== source ||
      (value === null
        ? item.mode !== "implied" || item.operand !== null
        : item.mode !== "immediate" ||
          item.operand?.kind !== "immediate" ||
          item.operand.value !== value)
    )
      return false;
  }
  return true;
}

/** Compare one complete body member, changing only its independently identified ordinal operand. */
function paired(
  left: MachineInstruction,
  right: MachineInstruction,
  original: string,
  snapshot: string,
): boolean {
  const normalize = (item: MachineInstruction, id: string) =>
    item.operand?.kind === "storage" &&
    item.operand.requestId === id &&
    (item.operand.offset ?? 0) === 0 &&
    item.operand.addressByte === undefined
      ? { ...item.operand, requestId: "ordinal", offset: 0 }
      : item.operand;
  return (
    left.opcode === right.opcode &&
    left.mode === right.mode &&
    left.source === right.source &&
    JSON.stringify(normalize(left, original)) === JSON.stringify(normalize(right, snapshot)) &&
    left.memory.length === 0 &&
    right.memory.length === 0 &&
    JSON.stringify(left.observerOrigins) === JSON.stringify(right.observerOrigins)
  );
}

/**
 * Prove the register-specific controls and one byte snapshot without accepting a loop.
 * The caller still owns source eligibility, original controls/T0, full inventory,
 * occupancy, actual binding/access, startup and all foreign-entry/caller checks.
 * @param proof Actual selected counter record belonging to the checked source.
 * @param before Independently resolved reference owner with its word counter home.
 * @param after Actual register owner, whose memory-counter identity is null.
 * @returns The verified snapshot request identity, or null for an unsupported difference.
 * @example const snapshot = registerCounterSnapshot(proof, before, after);
 */
export function registerCounterSnapshot(
  proof: FixedCounterProof,
  before: Side,
  after: Side,
): string | null {
  const register = proof.representation;
  const read = proof.reads[0];
  if (
    (register !== "x" && register !== "y") ||
    proof.requestId !== null ||
    proof.firstTestElided !== true ||
    proof.indexUses?.length !== 0 ||
    proof.reads.length !== 1 ||
    read === undefined ||
    read.stagingRequestId !== null ||
    before.counter !== proof.originalRequestId ||
    after.counter !== null ||
    !controls(proof, after)
  )
    return null;
  const operation = proof.loop.body.operations.find(
    (operation) => operation.kind === "load" && operation.result === read.value,
  );
  const requests = [...after.requests.values()].filter(
    ({ owner, value }) => owner === proof.loop.function.id && value === read.value,
  );
  const request = requests[0];
  if (
    operation?.kind !== "load" ||
    requests.length !== 1 ||
    request === undefined ||
    operation.place.root !== proof.loop.counter ||
    operation.place.path.length !== 0 ||
    operation.type.kind !== "scalar" ||
    operation.type.name !== "word" ||
    request.storageClass !== "temporary" ||
    request.binding !== null ||
    request.bytes !== 1 ||
    request.type?.kind !== "scalar" ||
    request.type.name !== "byte" ||
    request.source !== operation.span ||
    request.lifetime.value !== read.value ||
    request.lifetime.definition.block !== proof.loop.body.id ||
    request.lifetime.definition.operation !== proof.loop.body.operations.indexOf(operation)
  )
    return null;
  const original = before.symbols[2]!.instructions;
  const selected = after.symbols[2]!.instructions;
  const definition = selected[0];
  if (
    definition?.opcode !== `st${register}` ||
    definition.mode !== "storage" ||
    definition.source !== operation.span ||
    definition.operand?.kind !== "storage" ||
    definition.operand.requestId !== request.id ||
    (definition.operand.offset ?? 0) !== 0 ||
    definition.operand.addressByte !== undefined ||
    definition.memory.length !== 0 ||
    (definition.observerOrigins?.length ?? 0) !== 0 ||
    original.length + 1 !== selected.length
  )
    return null;
  const sites = [siteKey(after.source.id, after.symbols[2]!.label, 0)];
  for (const [index, left] of original.entries()) {
    const right = selected[index + 1]!;
    if (
      !paired(left, right, before.counter, request.id) ||
      [left, right].some(
        (item) =>
          item.uses.registers.includes(register) || item.defines.registers.includes(register),
      )
    )
      return null;
    if (right.operand?.kind === "storage" && right.operand.requestId === request.id)
      sites.push(siteKey(after.source.id, after.symbols[2]!.label, index + 1));
  }
  const uses = after.references.get(request.id) ?? [];
  if (
    sites.length < 2 ||
    uses.length !== sites.length ||
    uses.some((use, index) => use.memory || use.offset !== 0 || use.site !== sites[index])
  )
    return null;
  return request.id;
}

/** Resolve the one typed store and close every source permission absent from scalar-only tuples. */
function indexSource(input: FinalObserverInput, proof: FixedCounterProof) {
  const operations = proof.loop.body.operations;
  const [read, value, store] = operations;
  const use = proof.indexUses?.[0];
  if (
    operations.length !== 3 ||
    read?.kind !== "load" ||
    value === undefined ||
    store?.kind !== "store" ||
    proof.indexUses?.length !== 1 ||
    proof.reads.length !== 1 ||
    proof.reads[0]?.stagingRequestId !== null ||
    read.result !== proof.reads[0]?.value ||
    use?.value !== read.result ||
    use.consumer !== store ||
    store.value !== ("result" in value ? value.result : null) ||
    read.place.root !== proof.loop.counter ||
    read.place.path.length !== 0 ||
    read.type.kind !== "scalar" ||
    read.type.name !== "word" ||
    store.type.kind !== "scalar" ||
    store.type.name !== "byte" ||
    input.checked.snapshot.manifest.boundsCheck
  )
    return null;
  const program = input.checked.program;
  const target = program.semantic.globals.find(({ id }) => id === store.place.root);
  if (
    target === undefined ||
    store.place.rootType === undefined ||
    !semanticTypesEqual(target.type, store.place.rootType)
  )
    return null;
  let type: SemanticType = target.type;
  let offset = 0,
    extent = 0;
  for (const part of store.place.path) {
    if (part.kind === "field" && type.kind === "struct") {
      const field = type.fields.find(({ name }) => name === part.name);
      if (field === undefined) return null;
      offset += field.offset;
      type = field.type;
    } else if (
      part.kind === "index" &&
      part === store.place.path.at(-1) &&
      part.value === read.result &&
      type.kind === "array"
    ) {
      extent = type.length;
      type = type.element;
    } else return null;
  }
  if (
    type.kind !== "scalar" ||
    type.name !== "byte" ||
    extent < proof.loop.bound ||
    offset < 0 ||
    offset > 255
  )
    return null;
  let operand: MachineInstruction["operand"];
  let mode: string;
  if (
    value.kind === "constant" &&
    value.type.kind === "scalar" &&
    value.type.name === "byte" &&
    typeof value.value === "bigint" &&
    value.value >= 0n &&
    value.value <= 255n
  ) {
    operand = { kind: "immediate", value: Number(value.value) };
    mode = "immediate";
  } else if (
    value.kind === "load" &&
    value.place.path.length === 0 &&
    value.type.kind === "scalar" &&
    value.type.name === "byte" &&
    program.semantic.globals.some(
      ({ id, type }) => id === value.place.root && type.kind === "scalar" && type.name === "byte",
    )
  ) {
    operand = { kind: "label", label: bindingLabel("global", value.place.root), offset: 0 };
    mode = "absolute";
  } else return null;
  for (const fn of program.semantic.functions.filter(({ id }) =>
    program.reachableFunctions.includes(id),
  ))
    for (const operation of fn.blocks.flatMap(({ operations }) => operations))
      if (
        operation.kind === "aggregate" ||
        ((operation.kind === "load" || operation.kind === "store") &&
          operation !== store &&
          (operation.place.path.length !== 0 || !["scalar", "enum"].includes(operation.type.kind)))
      )
        return null;
  // A nested literal may be unnamed until its pure enclosing global initializer consumes it.
  for (const global of program.semantic.globals)
    for (const operation of global.blocks.flatMap(({ operations }) => operations))
      if (
        !["constant", "aggregate", "store"].includes(operation.kind) ||
        (operation.kind === "store" &&
          (operation.place.root !== global.id || operation.place.path.length !== 0)) ||
        (operation.kind === "aggregate" &&
          operation.destination !== undefined &&
          (operation.destination.kind !== "place" ||
            operation.destination.place.root !== global.id))
      )
        return null;
  return { store, operand, mode, root: target.id, offset, maximum: proof.loop.bound - 1 };
}

/**
 * Prove one indirect-to-native typed store, not an entire loop or physical layout.
 * The reference pointer contains root+ordinal; its packed displacement remains
 * in Y. Returning those facts separately preserves discarded page-cross accesses.
 * V may survive any iteration, but this exact finite template cannot observe it;
 * the parent must still carry V and changed index registers to the actual caller.
 * @param input Original checked source with its unchanged safety policy.
 * @param proof Actual selected source counter and its sole typed index consumer.
 * @param before Independently closed reference with complete pointer occurrences.
 * @param after Selected construction, with no memory-counter or snapshot home.
 * @returns Exact pointer/root/displacement/ordinal facts, or null for unsupported code.
 * @example const index = registerCounterIndex(input, proof, before, after);
 */
export function registerCounterIndex(
  input: FinalObserverInput,
  proof: FixedCounterProof,
  before: Side,
  after: Side,
) {
  const source = indexSource(input, proof);
  const pointer = before.symbols[2]!.instructions[3]?.operand;
  if (
    source === null ||
    before.counter === null ||
    after.counter !== null ||
    proof.requestId !== null ||
    proof.firstTestElided !== true ||
    !controls(proof, after) ||
    pointer?.kind !== "storage"
  )
    return null;
  const id = pointer.requestId;
  const request = before.requests.get(id);
  if (
    request?.storageClass !== "pointer" ||
    request.binding !== null ||
    request.bytes !== 2 ||
    request.type !== null ||
    request.region !== "zero-page-required" ||
    request.source !== source.store.span
  )
    return null;
  const label = bindingLabel("global", source.root);
  const reference: readonly (readonly [string, string, MachineInstruction["operand"]])[] = [
    ["lda", "storage", { kind: "storage", requestId: before.counter, offset: 0 }],
    ["clc", "implied", null],
    ["adc", "immediate", { kind: "label", label, offset: 0, addressByte: "low" }],
    ["sta", "storage", { kind: "storage", requestId: id, offset: 0 }],
    ["lda", "immediate", { kind: "label", label, offset: 0, addressByte: "high" }],
    ["adc", "immediate", { kind: "immediate", value: 0 }],
    ["sta", "storage", { kind: "storage", requestId: id, offset: 1 }],
    ["ldy", "immediate", { kind: "immediate", value: source.offset }],
    ["lda", source.mode, source.operand],
    ["sta", "indirect-indexed-y", { kind: "indirect-y", requestId: id, offset: 0 }],
  ];
  const selected: typeof reference = [
    ["lda", source.mode, source.operand],
    ["sta", `absolute-${proof.representation}`, { kind: "label", label, offset: source.offset }],
  ];
  for (const [current, template, recipe, register, stride] of [
    [before, reference, "typed-indirect", "y", 0],
    [after, selected, "typed-indexed", proof.representation, 1],
  ] as const) {
    const items = current.symbols[2]!.instructions;
    if (items.length !== template.length) return null;
    for (const [index, item] of items.entries()) {
      if (
        JSON.stringify([item.opcode, item.mode, item.operand]) !==
          JSON.stringify(template[index]) ||
        item.source !== source.store.span ||
        item.memory.length !== 0 ||
        item.sourceIteration !== undefined
      )
        return null;
      const origins = item.observerOrigins ?? [];
      if (index + 1 !== items.length) {
        if (origins.length !== 0) return null;
        continue;
      }
      const origin = origins[0];
      if (
        origins.length !== 1 ||
        origin?.kind !== "typed" ||
        origin.operation !== source.store ||
        origin.place !== source.store.place ||
        origin.recipe !== recipe ||
        origin.position !== 0 ||
        origin.byte !== 0 ||
        origin.length !== 1 ||
        origin.indexRegister !== register ||
        origin.displacement !== source.offset ||
        origin.stride !== stride ||
        origin.indexBounds?.get(proof.reads[0]!.value) !== BigInt(source.maximum)
      )
        return null;
    }
    if (
      current.actual.blocks.some(
        (block) =>
          block.instructions.some((item) => item.uses.flags.includes("v")) ||
          ((block.terminator.kind === "branch" || block.terminator.kind === "long-branch") &&
            block.terminator.uses.flags.includes("v")),
      )
    )
      return null;
  }
  const uses = before.references.get(id) ?? [];
  if (
    uses.length !== 3 ||
    uses.some(
      (use, index) =>
        use.memory ||
        use.offset !== [0, 1, 0][index] ||
        use.site !== siteKey(before.source.id, before.symbols[2]!.label, [3, 6, 9][index]!),
    )
  )
    return null;
  return Object.freeze({
    /** Exact reference-only pointer request, never a generated-name inference. */
    pointer: id,
    /** Original global binding independently resolved by each physical layout. */
    root: source.root,
    /** Packed field displacement retained separately from the reference pointer. */
    offset: source.offset,
    /** Inclusive proved ordinal maximum; zero is the common minimum. */
    maximum: source.maximum,
  });
}

/**
 * Check a real main continuation against the normal BASIC terminal contract.
 * Outgoing A/X/Y values are unpromised only at that terminal. Intermediate reads,
 * ordinary function results and all status observations remain observable. The
 * caller independently checks canonical startup preservation and D/I/S duties.
 * @param input Original checked source and authenticated construction.
 * @param current One actual layout containing the selected or reference owner.
 * @param caller Actual direct caller already matched to its source call operation.
 * @param block Actual caller block containing that call.
 * @param start First instruction after the call.
 * @param register Counter register whose final value may differ from the reference.
 * @param originalYChanged Carry the removed indirect-store Y setup to this caller only.
 * @returns True only when the restricted main-to-restore continuation closes.
 * @example registerMainContinuation(input, current, caller, block, index + 1, "x");
 */
export function registerMainContinuation(
  input: FinalObserverInput,
  current: Side,
  caller: MachineFunction,
  block: MachineBlock,
  start: number,
  register: "x" | "y",
  originalYChanged = false,
): boolean {
  const main = input.checked.program.semantic.main;
  const source = input.checked.program.semantic.functions.find(({ id }) => id === main);
  const owners = current.program.functions.filter(({ sourceFunction }) => sourceFunction === main);
  const restore = current.program.startup.blocks.find(({ label }) => label === "startup.restore");
  if (
    source?.result.kind !== "scalar" ||
    source.result.name !== "void" ||
    owners.length !== 1 ||
    owners[0] !== caller ||
    !caller.blocks.includes(block) ||
    !Number.isInteger(start) ||
    start < 1 ||
    start > block.instructions.length ||
    block.instructions[start - 1]?.opcode !== "jsr" ||
    caller.observerBodies !== undefined ||
    caller.executionContext?.domain !== "main" ||
    caller.executionContext.activationRoot !== undefined ||
    restore === undefined ||
    restore.terminator.kind !== "return" ||
    caller.blocks.some(
      (item) =>
        item.observerBodies !== undefined ||
        item.terminator.kind === "return" ||
        item.terminator.kind === "unreachable",
    )
  )
    return false;
  const blocks = new Map([...caller.blocks, restore].map((item) => [item.label, item]));
  if (
    blocks.size !== caller.blocks.length + 1 ||
    caller.blocks.some((item) => machineSuccessors(item).some((target) => !blocks.has(target)))
  )
    return false;
  return byteContinuationQuery(blocks, { registers: [], flags: ["n", "z", "c", "v"] })(
    block.label,
    start,
    STATE.a | STATE.v | STATE[register] | (originalYChanged ? STATE.y : 0),
  );
}
