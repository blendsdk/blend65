import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import type { BindingId, IntegerFacts, SemanticType } from "../frontend/semantic-types.js";
import type {
  SemanticBlock,
  SemanticGlobal,
  SemanticOperation,
  SemanticProgram,
  PlaceAddressOperation,
  MemoryWriteOperation,
} from "./operations.js";
import type { TargetProfile } from "../target/profile.js";
import type { StorageRange } from "../storage/storage-types.js";
import type { IndirectTargetSets } from "./function-targets.js";
import { reachableBlocks } from "./value-lifetimes.js";

/** Exact bits or selected windows containing an owned object's direct address. */
export type InterruptWriteAddress =
  | bigint
  | {
      /** The address is not yet placed, but its owned storage windows are known. */
      readonly kind: "owned-place";
      /** Inclusive selected windows, never inferred from arbitrary integer bits. */
      readonly ranges: readonly StorageRange[];
    };

/** Absence means unknown; symbolic facts never become invented numeric addresses. */
type AddressValues = Map<string, InterruptWriteAddress>;

/** Globals which each selected interrupt domain can change, including through helpers. */
export type InterruptGlobalClobbers = Readonly<Record<"irq" | "nmi", ReadonlySet<string>>>;

/** Net vector depth change on a callable body's proved returning paths. */
export type InterruptDepthChange = Readonly<Record<"irq" | "nmi", number>>;

/** Alias facts follow source vector lifetimes, not an invented atomic global snapshot. */
interface AddressState {
  /** Evaluated values and mutable whole-place facts. */
  readonly values: AddressValues;
  /** Null means an incoming or opaque effect may leave a domain active. */
  readonly depths: Record<"irq" | "nmi", number | null>;
}

/** Apply the source integer width after arithmetic, conversion or a signed load. */
function normalized(value: bigint, integer: IntegerFacts | null): bigint {
  if (integer === null) return value;
  return integer.signed
    ? BigInt.asIntN(integer.width, value)
    : BigInt.asUintN(integer.width, value);
}

/** Keep only facts agreed by every incoming path, including loop backedges. */
function intersect(previous: AddressValues, incoming: AddressValues): boolean {
  let changed = false;
  for (const [key, value] of previous) {
    if (incoming.get(key) !== value) {
      previous.delete(key);
      changed = true;
    }
  }
  return changed;
}

/** Preserve equal lifetime depths; a differing incoming lifetime stays conservatively active. */
function join(previous: AddressState, incoming: AddressState): boolean {
  let changed = intersect(previous.values, incoming.values);
  for (const sink of ["irq", "nmi"] as const) {
    if (previous.depths[sink] !== incoming.depths[sink] && previous.depths[sink] !== null) {
      previous.depths[sink] = null;
      changed = true;
    }
  }
  return changed;
}

/** Mutable places can change across a call or raw write; evaluated values cannot. */
function forgetPlaces(
  state: AddressValues,
  globals: ReadonlyMap<string, SemanticGlobal>,
  written: readonly number[] = [],
  addressSpace?: Pick<TargetProfile["storage"], "ram" | "zeroPage">,
): void {
  for (const key of state.keys()) {
    if (!key.startsWith("place:")) continue;
    const global = globals.get(key);
    const regions = global?.zeropage ? addressSpace?.zeroPage : addressSpace?.ram;
    const fixed = global?.placement?.at;
    const bytes = global?.runtimeInitialBytes ?? global?.initialBytes;
    const disjoint =
      written.length > 0 &&
      global !== undefined &&
      (fixed != null && bytes != null
        ? written.every((byte) => byte < fixed || byte >= fixed + bytes.length)
        : regions !== undefined &&
          written.every((byte) =>
            regions.every((region) => byte < region.start || byte > region.end),
          ));
    if (!disjoint) state.delete(key);
  }
}

/**
 * Recover simple startup scalar values only when every initializer has an exact
 * byte image and writes its own global. Other startup effects need caller facts
 * that a function-local analysis does not have, so they remain unknown here.
 */
function initialPlaces(program: SemanticProgram, isMain: boolean): AddressValues {
  const result: AddressValues = new Map();
  if (!isMain) return result;
  const globals = new Map(program.globals.map((global) => [bindingIdentityKey(global.id), global]));
  for (const id of program.initializerOrder) {
    const global = globals.get(bindingIdentityKey(id));
    if (
      global?.runtimeInitialBytes === null ||
      global === undefined ||
      global.blocks.some((block) =>
        block.operations.some(
          (operation) =>
            !["constant", "convert", "store"].includes(operation.kind) ||
            (operation.kind === "store" &&
              bindingIdentityKey(operation.place.root) !== bindingIdentityKey(global.id)),
        ),
      )
    )
      return result;
  }
  for (const global of program.globals) {
    const bytes = global.runtimeInitialBytes ?? global.initialBytes;
    if (bytes === null || bytes.length < 1 || bytes.length > 2) continue;
    result.set(
      `place:${bindingIdentityKey(global.id)}`,
      BigInt(bytes[0]! | ((bytes[1] ?? 0) << 8)),
    );
  }
  return result;
}

/**
 * Keep direct typed-place addresses without treating borrowed aggregate parameters
 * as owned storage. Constant fields/indexes remain within their actual object;
 * opaque indexes and arbitrary address arithmetic acquire no window proof.
 */
function ownedPlaceAddress(
  operation: PlaceAddressOperation,
  globals: ReadonlyMap<string, SemanticGlobal>,
  borrowedRoots: ReadonlySet<string>,
  values: AddressValues,
  ram: InterruptWriteAddress | undefined,
  zeroPage: InterruptWriteAddress | undefined,
): InterruptWriteAddress | undefined {
  const root = bindingIdentityKey(operation.place.root);
  if (operation.place.asset !== undefined || borrowedRoots.has(root)) return undefined;
  const global = globals.get(`place:${root}`);
  const rootType = operation.place.rootType ?? global?.type;
  if (rootType === undefined) return undefined;
  let type: SemanticType = rootType;
  let offset = 0;
  for (const component of operation.place.path) {
    if (component.kind === "field") {
      if (type.kind !== "struct") return undefined;
      const field = type.fields.find(({ name }) => name === component.name);
      if (field === undefined) return undefined;
      offset += field.offset;
      type = field.type;
    } else {
      const index = values.get(component.value);
      if (
        type.kind !== "array" ||
        typeof index !== "bigint" ||
        index < 0n ||
        index >= BigInt(type.length)
      )
        return undefined;
      offset += Number(index) * semanticTypeSize(type.element);
      type = type.element;
    }
  }
  const fixed = global?.placement?.at;
  if (fixed != null) return BigInt(fixed + offset) & 0xffffn;
  return global?.zeropage ? zeroPage : ram;
}

/**
 * Check every byte of a volatile write, including word writes across $FFFF.
 * Opaque writes may alias NMI vectors; the caller supplies that existing policy.
 * Owned windows prove disjointness without assigning a premature physical home.
 */
export function interruptWriteTouches(
  operation: MemoryWriteOperation,
  address: InterruptWriteAddress | undefined,
  protectedBytes: ReadonlySet<bigint>,
  opaqueMayTouch: boolean,
): boolean {
  if (address === undefined) return opaqueMayTouch;
  for (let offset = 0; offset < operation.width; offset += 1) {
    if (typeof address === "bigint") {
      if (protectedBytes.has((address + BigInt(offset)) & 0xffffn)) return true;
    } else {
      for (const byte of protectedBytes) {
        const start = Number((byte - BigInt(offset)) & 0xffffn);
        if (address.ranges.some((range) => start >= range.start && start <= range.end)) return true;
      }
    }
  }
  return false;
}

/**
 * Collect selected handlers' global writes once, using already-closed effects
 * and call targets. Raw writes retain globals only when existing placement or
 * selected memory windows prove disjointness. This does not allocate storage.
 */
export function interruptClobberedGlobals(
  program: SemanticProgram,
  selectedHandlers: ReadonlySet<string>,
  indirectTargets: IndirectTargetSets,
  addressSpace?: Pick<TargetProfile["storage"], "ram" | "zeroPage">,
): ReadonlySet<string> {
  const globals = new Map(
    program.globals.map((global) => [`place:${bindingIdentityKey(global.id)}`, global]),
  );
  const clobbered = new Set<string>();
  if (globals.size === 0 || selectedHandlers.size === 0) return clobbered;
  const functions = new Map(program.functions.map((fn) => [bindingIdentityKey(fn.id), fn]));
  const effects = new Map(
    (program.effects ?? []).map((effect) => [bindingIdentityKey(effect.function), effect]),
  );
  const pending = [...selectedHandlers];
  const seen = new Set<string>();
  const empty = { irq: new Set<string>(), nmi: new Set<string>() };
  for (let index = 0; index < pending.length; index += 1) {
    const key = pending[index]!;
    if (seen.has(key)) continue;
    seen.add(key);
    const fn = functions.get(key);
    if (fn === undefined) {
      for (const global of globals.keys()) clobbered.add(global);
      continue;
    }
    for (const write of effects.get(key)?.writes ?? []) {
      const place = `place:${bindingIdentityKey(write.binding)}`;
      if (globals.has(place)) clobbered.add(place);
    }
    const blocks = reachableBlocks(fn.entry, fn.blocks);
    const addresses = interruptWriteAddresses(
      program,
      fn.entry,
      blocks,
      false,
      empty,
      addressSpace,
    );
    for (const block of blocks) {
      for (const operation of block.operations) {
        if (operation.kind === "store") {
          const place = `place:${bindingIdentityKey(operation.place.root)}`;
          if (globals.has(place)) clobbered.add(place);
        } else if (operation.kind === "memory-write") {
          const address = addresses.get(operation);
          const written = typeof address !== "bigint" ? [] : [Number(address & 0xffffn)];
          if (typeof address === "bigint" && operation.width === 2)
            written.push(Number((address + 1n) & 0xffffn));
          const remaining = new Map([...globals.keys()].map((place) => [place, 0n]));
          forgetPlaces(remaining, globals, written, addressSpace);
          for (const place of globals.keys()) if (!remaining.has(place)) clobbered.add(place);
        } else if (operation.kind === "call" || operation.kind === "indirect-call") {
          const targets =
            operation.kind === "call" ? [operation.callee] : (indirectTargets.get(operation) ?? []);
          if (targets.length === 0) for (const place of globals.keys()) clobbered.add(place);
          else pending.push(...targets.map(bindingIdentityKey));
        }
      }
    }
  }
  return clobbered;
}

/**
 * Prove exact raw-write addresses and direct owned-place windows through ordinary flow.
 * Only equal facts survive joins. Unknown callees and raw writes invalidate
 * mutable places, and fixed-width arithmetic wraps before address comparison.
 * A proved helper effect updates vector lifetimes even when its platform effect
 * is opaque. Null marks a proved nonreturning target; undefined stays unknown.
 * A call whose closed targets are all nonreturning ends the current CFG path.
 * @returns Exact addresses or owned windows; a missing entry is potentially aliasing.
 */
export function interruptWriteAddresses(
  program: SemanticProgram,
  entry: string,
  blocks: readonly SemanticBlock[],
  isMain: boolean,
  clobbers: InterruptGlobalClobbers,
  addressSpace?: Pick<TargetProfile["storage"], "ram" | "zeroPage">,
  indirectTargets: IndirectTargetSets = new Map(),
  returningDepthChange?: (target: BindingId) => InterruptDepthChange | null | undefined,
): ReadonlyMap<SemanticOperation, InterruptWriteAddress> {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const globals = new Map(
    program.globals.map((global) => [`place:${bindingIdentityKey(global.id)}`, global]),
  );
  const effects = new Map(
    (program.effects ?? []).map((effect) => [bindingIdentityKey(effect.function), effect]),
  );
  const borrowedRoots = new Set(
    program.functions.flatMap((fn) =>
      fn.parameters.flatMap(({ id, type }) =>
        type.kind === "array" || type.kind === "struct" ? [bindingIdentityKey(id)] : [],
      ),
    ),
  );
  // Reuse the same immutable window facts at joins. They constrain address
  // bits, not object identity; different objects in one window are equally safe.
  const ram: InterruptWriteAddress | undefined =
    addressSpace === undefined ? undefined : { kind: "owned-place", ranges: addressSpace.ram };
  const zeroPage: InterruptWriteAddress | undefined =
    addressSpace === undefined ? undefined : { kind: "owned-place", ranges: addressSpace.zeroPage };
  // A caller or executable initializer can already own a vector. Ordinary
  // constant initialization cannot; copies made before installation stay exact.
  const incomingActive =
    !isMain ||
    program.globals.some((global) =>
      global.blocks.some((block) =>
        block.operations.some((operation) =>
          ["call", "indirect-call", "platform"].includes(operation.kind),
        ),
      ),
    );
  const entries = new Map<string, AddressState>([
    [
      entry,
      {
        values: initialPlaces(program, isMain),
        depths: { irq: incomingActive ? null : 0, nmi: incomingActive ? null : 0 },
      },
    ],
  ]);
  const pending = [entry];
  const addresses = new Map<SemanticOperation, InterruptWriteAddress>();
  for (let index = 0; index < pending.length; index += 1) {
    const id = pending[index]!;
    const block = byId.get(id);
    if (block === undefined) continue;
    const incoming = entries.get(id)!;
    const state = new Map(incoming.values);
    const depths = { ...incoming.depths };
    let continues = true;
    for (const operation of block.operations) {
      // Never relearn an interrupt-writable place from a later mainline store.
      // Already-evaluated values and unaffected globals are separate facts.
      for (const sink of ["irq", "nmi"] as const)
        if (depths[sink] !== 0) for (const place of clobbers[sink]) state.delete(place);
      let value: InterruptWriteAddress | undefined;
      if (operation.kind === "constant" && typeof operation.value === "bigint")
        value = operation.value;
      else if (operation.kind === "place-address")
        value = ownedPlaceAddress(operation, globals, borrowedRoots, state, ram, zeroPage);
      else if (operation.kind === "convert") {
        const operand = state.get(operation.operand);
        if (typeof operand === "bigint" || operation.integer?.width === 16) value = operand;
      } else if (operation.kind === "load" && operation.place.path.length === 0) {
        value = state.get(`place:${bindingIdentityKey(operation.place.root)}`);
      } else if (operation.kind === "merge") {
        // Each predecessor supplies its selected value before the entry join.
        // A fact survives only when every reachable incoming edge agrees.
        value = state.get(operation.result);
      } else if (operation.kind === "binary") {
        const left = state.get(operation.left);
        const right = state.get(operation.right);
        if (typeof left === "bigint" && typeof right === "bigint") {
          if (operation.operator === "+") value = left + right;
          else if (operation.operator === "-") value = left - right;
          else if (operation.operator === "&") value = left & right;
          else if (operation.operator === "|") value = left | right;
          else if (operation.operator === "^") value = left ^ right;
        }
      }
      if ("result" in operation && operation.result !== null) {
        state.delete(operation.result);
        if (value !== undefined && "integer" in operation)
          state.set(
            operation.result,
            typeof value === "bigint" ? normalized(value, operation.integer) : value,
          );
      }
      if (operation.kind === "store") {
        const key = `place:${bindingIdentityKey(operation.place.root)}`;
        const stored = state.get(operation.value);
        state.delete(key);
        if (operation.place.path.length === 0 && stored !== undefined) state.set(key, stored);
      } else if (operation.kind === "memory-write") {
        const address = state.get(operation.address);
        addresses.delete(operation);
        if (address !== undefined)
          addresses.set(operation, typeof address === "bigint" ? address & 0xffffn : address);
        const written = typeof address !== "bigint" ? [] : [Number(address & 0xffffn)];
        if (typeof address === "bigint" && operation.width === 2)
          written.push(Number((address + 1n) & 0xffffn));
        forgetPlaces(state, globals, written, addressSpace);
      } else if (operation.kind === "call" || operation.kind === "indirect-call") {
        forgetPlaces(state, globals);
        const targets =
          operation.kind === "call" ? [operation.callee] : (indirectTargets.get(operation) ?? []);
        const returning = targets
          .map((target) => returningDepthChange?.(target))
          .filter((change) => change !== null);
        // No returning alternative can reach later operations or successors.
        // An unknown target remains in the set, so it cannot suppress a path.
        if (targets.length > 0 && returning.length === 0) {
          continues = false;
          break;
        }
        const change = returning[0];
        if (
          change !== undefined &&
          returning.every((candidate) =>
            candidate === undefined
              ? false
              : candidate.irq === change.irq && candidate.nmi === change.nmi,
          )
        ) {
          for (const sink of ["irq", "nmi"] as const)
            if (depths[sink] !== null) depths[sink] = Math.max(0, depths[sink] + change[sink]);
        } else if (
          targets.length === 0 ||
          targets.some((target) => effects.get(bindingIdentityKey(target))?.opaque !== false)
        )
          depths.irq = depths.nmi = null;
      } else if (operation.kind === "platform") {
        const name = operation.capability;
        const sink = name.endsWith("NMI") || name.endsWith("NMIExclusive") ? "nmi" : "irq";
        if (
          [
            "c64.system.setIRQ",
            "c64.system.setIRQExclusive",
            "c64.system.setNMI",
            "c64.system.setNMIExclusive",
          ].includes(name)
        ) {
          if (depths[sink] !== null) depths[sink] += 1;
        } else if (name === "c64.system.restoreIRQ" || name === "c64.system.restoreNMI") {
          if (depths[sink] !== null) depths[sink] = Math.max(0, depths[sink] - 1);
        }
      }
    }
    if (!continues) continue;
    const terminal = block.terminator;
    const successors =
      terminal.kind === "jump"
        ? [terminal.target]
        : terminal.kind === "branch"
          ? [terminal.whenTrue, terminal.whenFalse]
          : [];
    for (const successor of successors) {
      const values = new Map(state);
      for (const operation of byId.get(successor)?.operations ?? []) {
        if (operation.kind !== "merge") continue;
        const selected = operation.incoming.find((incoming) => incoming.block === id);
        const value = selected === undefined ? undefined : state.get(selected.value);
        values.delete(operation.result);
        if (value !== undefined) values.set(operation.result, value);
      }
      const previous = entries.get(successor);
      if (previous === undefined) {
        entries.set(successor, { values, depths: { ...depths } });
        pending.push(successor);
      } else if (join(previous, { values, depths })) pending.push(successor);
    }
  }
  return addresses;
}
