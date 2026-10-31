import { bindingLabel, machineSuccessors as machineTargets } from "../machine/lower-control.js";
import { operandAddress } from "../machine/nmos6510-access.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type {
  MachineFunction,
  MachineBlock,
  MachineInstruction,
} from "../machine/machine-types.js";
import type { FinalObserverInput } from "./size-observers.js";
import type { StorageRange } from "../storage/storage-types.js";
import type { SemanticFunction } from "../semantic/operations.js";
import { isOriginalSharedByteReturn } from "./size-observer-original-returns.js";

/** Resolve free aliases; costed bridge traversal is allowed only after body validates ownership. */
function destination(
  label: string,
  actual: ReadonlyMap<string, MachineBlock>,
  bridges = false,
): string | null {
  const seen = new Set<string>();
  while (!seen.has(label)) {
    seen.add(label);
    const block = actual.get(label);
    if (block === undefined) return label;
    const term = block.terminator;
    if (
      block.instructions.length !== 0 ||
      (term.kind !== "fallthrough" && (!bridges || term.kind !== "jump"))
    )
      return label;
    const next = actual.get(term.target);
    if (next === undefined || (term.kind === "fallthrough" && next.origin !== block.origin))
      return null;
    label = term.target;
  }
  return null;
}

/** Actual successful closure, never a fabricated unavailable reference. */
type Shared = FinalObserverInput["candidate"]["shared"];

/**
 * Distinguish executions even when instruction objects are reused.
 * @param fn Actual owning function.
 * @param block Actual owning block.
 * @param index Instruction position within that block.
 * @returns An unambiguous function/block/index coordinate.
 * @example key(fn, block, 0)
 */
export const key = (fn: MachineFunction, block: MachineBlock, index: number) =>
  JSON.stringify([fn.id, block.label, index]);

/**
 * Check CPU-visible ordinary RAM under the cooperative mapping.
 * @param range Complete inclusive byte extent.
 * @returns False for malformed extents, ports, stack and device/ROM windows.
 * @example ram({ start: 0x200, end: 0x201 })
 */
export function ram(range: StorageRange): boolean {
  return (
    Number.isSafeInteger(range.start) &&
    Number.isSafeInteger(range.end) &&
    range.start <= range.end &&
    ((range.start >= 2 && range.end <= 255) || (range.start >= 512 && range.end <= 0xcfff))
  );
}

/**
 * Compare flag-set/clear destinations after the owning body authenticates every costed bridge.
 * @param block Real structured transfer; no instruction or terminator is removed.
 * @param actual Same-function blocks, including checked same-PC aliases and executing bridges.
 * @returns A normalized edge, or null for cyclic or inconsistent aliases.
 * @example const transfer = edge(block, body.blocks);
 */
export function edge(
  block: MachineBlock,
  actual: ReadonlyMap<string, MachineBlock>,
): string | null {
  const term = block.terminator;
  const targetOf = (label: string) => destination(label, actual, true);
  if (term.kind === "branch" || term.kind === "long-branch") {
    const target = targetOf(term.kind === "branch" ? term.target : term.jump.target),
      fallthrough = targetOf(term.fallthrough);
    if (target === null || fallthrough === null) return null;
    const set = ["beq", "bcs", "bmi", "bvs"].includes(term.opcode) === (term.kind === "branch");
    return JSON.stringify([
      term.uses.flags,
      set ? target : fallthrough,
      set ? fallthrough : target,
    ]);
  }
  const target =
    term.kind === "jump" || term.kind === "fallthrough" ? targetOf(term.target) : undefined;
  return target === null
    ? null
    : JSON.stringify(target === undefined ? [term.kind] : ["go", target]);
}

/**
 * Build indexes for exactly one independently closed representation.
 * @param shared Actual certificate and final layout.
 * @param functions Symbolic functions from that same construction.
 * @returns Layout-local label, home and request indexes; nothing is cached across layouts.
 * @example const before = side(reference.shared, reference.checked.lowered.program.functions);
 */
export function side(shared: Shared, functions: readonly MachineFunction[]) {
  const program = shared.layout.program;
  const labels = new Map(shared.layout.intervals.map(({ id, start }) => [id, start]));
  for (const fn of [program.startup, ...program.functions]) {
    labels.set(fn.id, fn.origin ?? fn.blocks[0]?.origin ?? -1);
    for (const block of fn.blocks) labels.set(block.label, block.origin ?? -1);
  }
  return {
    shared,
    functions,
    labels,
    homes: new Map(shared.certificate.certificate.homes.map((home) => [home.requestId, home])),
    requests: new Map(
      shared.certificate.inventory.requests.map((request) => [request.id, request]),
    ),
  };
}
/** One independent representation with no shared cross-layout cache. */
type Side = ReturnType<typeof side>;

/** Check physical binding, including address-byte immediates used by caller-private argument delivery. */
function bound(view: Side, source: MachineInstruction, actual: MachineInstruction): boolean {
  let operand = source.operand,
    mode = source.mode;
  if (operand?.kind === "storage" || operand?.kind === "indirect-y") {
    const home = view.homes.get(operand.requestId);
    if (home === undefined) return false;
    const address = home.address + (operand.offset ?? 0);
    operand =
      operand.kind === "storage" && operand.addressByte !== undefined
        ? {
            kind: "immediate",
            value: operand.addressByte === "low" ? address & 255 : address >>> 8,
          }
        : { kind: "absolute", value: address };
    if (mode === "storage") mode = home.region === "zero-page" ? "zero-page" : "absolute";
  }
  return (
    source.opcode === actual.opcode &&
    mode === actual.mode &&
    JSON.stringify(operand) === JSON.stringify(actual.operand)
  );
}

/**
 * Bind one unshared ordinary function without inferring missing ownership.
 * @param view Actual symbolic/physical construction indexes.
 * @param owner Exact source-function binding.
 * @param source Checked source identity; its caller has discharged any Original-loop group.
 * @returns Bound blocks and occurrence records, or null for missing/mismatched evidence.
 * @example const callee = body(view, packet.function.id);
 */
export function body(view: Side, owner: BindingId, source?: SemanticFunction) {
  const matches = view.functions.filter((fn) => fn.sourceFunction === owner);
  const symbolic = matches[0],
    actual =
      symbolic === undefined
        ? undefined
        : view.shared.layout.program.functions.find((fn) => fn.id === symbolic.id);
  if (
    matches.length !== 1 ||
    symbolic === undefined ||
    actual === undefined ||
    [symbolic, actual].some(
      (fn) =>
        fn.sourceFunction !== owner ||
        fn.executionContext?.domain !== "main" ||
        fn.executionContext.activationRoot !== undefined ||
        fn.observerBodies !== undefined ||
        fn.blocks.some((block) => block.observerBodies !== undefined),
    )
  )
    return null;
  if (
    source !== undefined &&
    (source.id !== owner ||
      !view.shared.certificate.inventory.program.semantic.functions.includes(source))
  )
    return null;
  const blocks = new Map(actual.blocks.map((block) => [block.label, block]));
  const originals = new Map(symbolic.blocks.map((block) => [block.label, block]));
  if (blocks.size !== actual.blocks.length) return null;
  for (const block of actual.blocks) {
    if (originals.has(block.label)) continue;
    const parents = actual.blocks.filter(
      (entry) =>
        (entry.terminator.kind === "branch" || entry.terminator.kind === "long-branch") &&
        entry.terminator.fallthrough === block.label,
    );
    const parent = parents[0],
      term = block.terminator;
    const groups =
      actual.observerBlocks?.filter(([, labels]) => labels.includes(block.label)) ?? [];
    const group = groups[0],
      rank = group?.[1].indexOf(block.label) ?? -1;
    if (
      source === undefined ||
      parents.length !== 1 ||
      parent === undefined ||
      group === undefined ||
      groups.length !== 1 ||
      !source.blocks.includes(group[0]) ||
      rank < 1 ||
      group[1][rank - 1] !== parent.label ||
      !symbolic.observerBlocks?.some(
        ([old, labels]) =>
          old === group[0] && labels[0] === group[1][0] && labels.includes(parent.label),
      ) ||
      block.instructions.length !== 0 ||
      term.kind !== "jump" ||
      term.opcode !== "jmp" ||
      !blocks.has(term.target) ||
      term.cost.bytes !== 3 ||
      term.cost.minCycles !== 3 ||
      term.cost.maxCycles !== 3 ||
      parent.origin === undefined ||
      block.origin !==
        parent.origin +
          parent.instructions.reduce((n, item) => n + item.cost.bytes, 0) +
          (parent.terminator.kind === "long-branch" ? 5 : 2)
    )
      return null;
    /** The executing JMP owns all three bytes, including its operand bytes. */
    const inBridge = (address: number | undefined) =>
      address !== undefined && address >= block.origin! && address < block.origin! + 3;
    /** Inspect the referenced symbol before byte extraction or another transform. */
    const referencesBridge = (operand: MachineInstruction["operand"]) =>
      operand?.kind === "label"
        ? operand.label === block.label ||
          inBridge((view.labels.get(operand.label) ?? NaN) + (operand.offset ?? 0))
        : operand?.kind === "absolute" && inBridge(operand.value);
    if (
      actual.blocks.some(
        (entry) => machineTargets(entry).includes(block.label) && entry !== parent,
      ) ||
      machineTargets(parent).filter((label) => label === block.label).length !== 1 ||
      [view.shared.layout.program.startup, ...view.shared.layout.program.functions].some((fn) =>
        fn.blocks.some(
          (entry) =>
            machineTargets(entry).some(
              (label) =>
                (label === block.label || inBridge(view.labels.get(label))) &&
                !(fn === actual && entry === parent && label === block.label),
            ) || entry.instructions.some(({ operand }) => referencesBridge(operand)),
        ),
      )
    )
      return null;
  }
  for (const block of symbolic.blocks) {
    const final = blocks.get(block.label);
    if (final?.origin === undefined || !Number.isSafeInteger(final.origin)) return null;
    const alias = destination(final.label, blocks);
    const sourceBlock = symbolic.observerBlocks?.find(([, labels]) =>
      labels.includes(block.label),
    )?.[0];
    if (
      source !== undefined &&
      sourceBlock !== undefined &&
      source.blocks.includes(sourceBlock) &&
      block.terminator.kind === "return" &&
      block.instructions.length === 1 &&
      block.instructions[0]?.opcode === "lda" &&
      alias !== null &&
      isOriginalSharedByteReturn(
        sourceBlock,
        source.result,
        final,
        alias,
        blocks,
        (label) =>
          destination(label, blocks) ?? {
            kind: "error",
            reason: "Invalid alias",
            source: null,
            objectId: label,
          },
      )
    )
      continue;
    const oldEdge = edge(block, blocks),
      actualEdge = edge(final, blocks);
    if (
      oldEdge === null ||
      actualEdge === null ||
      oldEdge !== actualEdge ||
      final.instructions.length !== block.instructions.length ||
      block.instructions.some(
        (instruction, index) => !bound(view, instruction, final.instructions[index]!),
      )
    )
      return null;
  }
  const items = actual.blocks.flatMap((block) =>
    block.instructions.map((instruction, index) => ({
      block,
      index,
      instruction,
      source: originals.get(block.label)!.instructions[index]!,
      key: key(actual, block, index),
    })),
  );
  return {
    view,
    symbolic,
    actual,
    blocks,
    items,
    mapping: new Map(source === undefined ? symbolic.observerBlocks : actual.observerBlocks),
  };
}
/** Bound symbolic/actual function, blocks, source mappings and occurrence records. */
export type Body = NonNullable<ReturnType<typeof body>>;
/** Actual instruction occurrence paired with its symbolic instruction and unique coordinate. */
export type Item = Body["items"][number];

/**
 * Match one actual direct byte read/write without discharging its full bus footprint.
 * @param pair Independently bound function.
 * @param item Exact occurrence, or undefined when a template is incomplete.
 * @param opcode Required instruction mnemonic.
 * @param address Required effective byte address from this layout.
 * @param input Checked selected CPU context.
 * @returns Whether the actual direct instruction resolves to that byte.
 * @example direct(pair, item, "lda", backing.range.start, input)
 */
export function direct(
  pair: Body,
  item: Item | undefined,
  opcode: string,
  address: number,
  input: FinalObserverInput,
): boolean {
  return (
    item?.instruction.opcode === opcode &&
    ["absolute", "zero-page"].includes(item.instruction.mode) &&
    operandAddress({
      cpu: input.checked.profile.cpu,
      instruction: item.instruction,
      pc: 0,
      labels: pair.view.labels,
    }) === address
  );
}
/**
 * Match an exact immediate computation in the bound symbolic occurrence.
 * @param item Instruction occurrence, if present.
 * @param opcode Required mnemonic.
 * @param value Exact encoded immediate value.
 * @returns Whether all immediate-template fields agree.
 * @example immediate(item, "eor", 255)
 */
export const immediate = (item: Item | undefined, opcode: string, value: number) =>
  item?.source.opcode === opcode &&
  item.source.mode === "immediate" &&
  item.source.operand?.kind === "immediate" &&
  item.source.operand.value === value;
/**
 * Match declared memory identity before binding, never a request-name convention.
 * @param item Instruction occurrence, if present.
 * @param opcode Required mnemonic.
 * @param id Exact existing request identity.
 * @param offset Byte displacement, defaulting to zero.
 * @returns Whether the instruction names that non-address-byte storage operand.
 * @example storage(item, "sta", parameter.id, 1)
 */
export const storage = (item: Item | undefined, opcode: string, id: string, offset = 0) =>
  item?.source.opcode === opcode &&
  item.source.operand?.kind === "storage" &&
  item.source.operand.requestId === id &&
  (item.source.operand.offset ?? 0) === offset &&
  item.source.operand.addressByte === undefined;

/**
 * Resolve a declared private request and complete same-layout home.
 * @param view Actual inventory/certificate indexes.
 * @param id Exact producer-owned request identity.
 * @param bytes Required full request width.
 * @param owner Source function owning its ordinary mainline lifetime.
 * @returns Matching request/home, or null when identity, width or context is unresolved.
 * @example const parameter = request(view, id, 2, fn.id);
 */
export function request(view: Side, id: string, bytes: number, owner: BindingId) {
  const declared = view.requests.get(id),
    home = view.homes.get(id);
  return declared?.owner === owner &&
    declared.bytes === bytes &&
    home?.bytes === bytes &&
    declared.activationRoot === undefined &&
    (declared.domain === undefined || declared.domain === "main") &&
    declared.lifetime.function === owner &&
    ram({ start: home.address, end: home.address + bytes - 1 })
    ? { declared, home }
    : null;
}

/**
 * Resolve a named scalar byte through its real global or private binding.
 * @param view Actual inventory/layout indexes.
 * @param binding Exact source storage binding.
 * @param owner Owning source function for a private scalar.
 * @returns Actual byte address and private demand, or null when incomplete.
 * @example const inverse = scalar(view, recipe.binding, fn.id);
 */
export function scalar(view: Side, binding: BindingId, owner: BindingId) {
  const id = bindingLabel("global", binding),
    object = view.shared.layout.program.data.find((object) => object.id === id);
  if (object !== undefined) {
    const range = view.shared.layout.intervals.find((range) => range.id === id);
    return object.bytes.length === 1 &&
      range !== undefined &&
      range.start === range.end &&
      ram(range)
      ? { address: range.start, declared: null }
      : null;
  }
  const values = [...view.requests.values()].filter(
    (value) => value.binding === binding && value.owner === owner,
  );
  const value = values.length === 1 ? request(view, values[0]!.id, 1, owner) : null;
  return value === null ? null : { address: value.home.address, declared: value.declared };
}
