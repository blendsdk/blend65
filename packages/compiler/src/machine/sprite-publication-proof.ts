import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import {
  literalResolver,
  placeUses,
  rawMayObserve,
  rawMaySelectHardwareRam,
  valueDefinitions,
} from "../semantic/aggregate-place-proof.js";
import type {
  LoadOperation,
  MemoryWriteOperation,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  SemanticPlace,
} from "../semantic/operations.js";
import { potentialValueInputs, reachableBlocks } from "../semantic/value-lifetimes.js";
import { hasUnobservedByteCapture } from "./byte-capture-observers.js";
import type { ByteCapturePublicationProof } from "./byte-capture-observers.js";
import type { MachineLoweringInput } from "./machine-types.js";

/** A single counter property, not a general range or loop-recurrence domain. */
enum CounterFact {
  /** The byte is nonzero and smaller than the selected exclusive limit. */
  PositiveBelow,
  /** The byte is smaller than the limit, but can be zero. */
  Below,
  /** No useful bound is known. An unreachable edge is represented by absence instead. */
  Unknown,
}

/** Keep only the property shared by every reachable predecessor. */
function joinCounterFacts(left: CounterFact, right: CounterFact): CounterFact {
  if (left === CounterFact.Unknown || right === CounterFact.Unknown) return CounterFact.Unknown;
  if (left === CounterFact.Below || right === CounterFact.Below) return CounterFact.Below;
  return CounterFact.PositiveBelow;
}

/** The actual direct CFG edges, with no guessed successor for a terminal block. */
function successors(block: SemanticBlock): readonly string[] {
  const edge = block.terminator;
  return edge.kind === "jump"
    ? [edge.target]
    : edge.kind === "branch"
      ? [...new Set([edge.whenTrue, edge.whenFalse])]
      : [];
}

/** A comparison of the current counter, not an older captured value. */
interface CounterCondition {
  /** Exact source operator; the query does not rewrite it. */
  readonly operator: string;
  /** Constant compared with the counter. */
  readonly constant: bigint;
  /** Whether the counter is the left operand. */
  readonly counterOnLeft: boolean;
}

/** Refine only comparisons which directly establish the selected scalar property. */
function counterEdge(
  fact: CounterFact,
  condition: CounterCondition | undefined,
  truth: boolean,
  limit: bigint,
): CounterFact {
  if (condition === undefined) return fact;
  const { operator, constant, counterOnLeft } = condition;
  if (
    constant === limit &&
    (counterOnLeft
      ? (operator === ">=" && !truth) || (operator === "<" && truth)
      : (operator === "<=" && !truth) || (operator === ">" && truth))
  )
    return CounterFact.Below;
  if (constant !== 0n || (operator !== "==" && operator !== "!=")) return fact;
  const zero = operator === "==" ? truth : !truth;
  return zero ? CounterFact.Below : fact === CounterFact.Unknown ? fact : CounterFact.PositiveBelow;
}

/**
 * Prove which actual byte loads are below one positive exclusive limit.
 *
 * The caller supplies the alias boundary for this private root. A finite three-state
 * property handles initialization, increment/clamp and guarded decrement without
 * assuming a loop invariant. Unvisited edges are unreachable, not unknown inputs.
 * Facts are recorded only after convergence, so a first iteration cannot certify a
 * later load which becomes out of range on a backedge.
 * @param source Actual immutable source function.
 * @param counter Private unsigned-byte binding whose loads are being considered.
 * @param limit Positive exclusive byte limit.
 * @param mayAliasLocals Whether an operation can change the root outside a typed store.
 * @returns Only original load objects which hold a proved value below the limit.
 * @example const loads = boundedCounterLoads(source, frame, 4n, mayAliasLocals);
 */
export function boundedCounterLoads(
  source: SemanticFunction,
  counter: BindingId,
  limit: bigint,
  mayAliasLocals: (operation: SemanticOperation) => boolean,
): ReadonlySet<LoadOperation> {
  const certified = new Set<LoadOperation>();
  if (limit <= 0n || limit > 255n) return certified;
  if (new Set(source.blocks.map(({ id }) => id)).size !== source.blocks.length) return certified;
  const blocks = reachableBlocks(source.entry, source.blocks);
  const byId = new Map(blocks.map((block) => [block.id, block]));
  if (
    !byId.has(source.entry) ||
    blocks.some((block) => successors(block).some((id) => !byId.has(id)))
  )
    return certified;
  const definitions = valueDefinitions(blocks);
  const literal = literalResolver(definitions);
  const root = bindingIdentityKey(counter);
  const sameRoot = (place: SemanticPlace): boolean => bindingIdentityKey(place.root) === root;
  const byteLoad = (operation: SemanticOperation): operation is LoadOperation =>
    operation.kind === "load" &&
    sameRoot(operation.place) &&
    operation.place.path.length === 0 &&
    operation.type.kind === "scalar" &&
    operation.type.name === "byte";

  /** Replay one block with a fresh mutation epoch for its current-root loads. */
  const walk = (block: SemanticBlock, input: CounterFact, record = false) => {
    let fact = input;
    let epoch = 0;
    const loads = new Map<string, number>();
    /** Conversions can keep the byte's identity, but cannot revive an older root load. */
    const fresh = (value: string): boolean => {
      const seen = new Set<string>();
      while (!seen.has(value)) {
        seen.add(value);
        const operation = definitions.get(value);
        if (operation === undefined) return false;
        if (byteLoad(operation)) return loads.get(value) === epoch;
        if (
          operation.kind !== "convert" ||
          (operation.conversion !== "identity" && operation.conversion !== "zero-extend")
        )
          return false;
        value = operation.operand;
      }
      return false;
    };
    for (const operation of block.operations) {
      if (mayAliasLocals(operation)) {
        fact = CounterFact.Unknown;
        epoch += 1;
      }
      if (byteLoad(operation)) {
        loads.set(operation.result, epoch);
        if (record && fact !== CounterFact.Unknown) certified.add(operation);
      }
      if (operation.kind !== "store" || !sameRoot(operation.place)) continue;
      let next = CounterFact.Unknown;
      if (
        operation.place.path.length === 0 &&
        operation.type.kind === "scalar" &&
        operation.type.name === "byte"
      ) {
        const constant = literal(operation.value);
        const value = definitions.get(operation.value);
        if (constant !== undefined && constant >= 0n && constant < limit)
          next = constant === 0n ? CounterFact.Below : CounterFact.PositiveBelow;
        else if (
          fact === CounterFact.PositiveBelow &&
          value?.kind === "binary" &&
          value.operator === "-" &&
          value.type.kind === "scalar" &&
          value.type.name === "byte" &&
          literal(value.right) === 1n &&
          fresh(value.left)
        )
          next = CounterFact.Below;
      }
      fact = next;
      epoch += 1;
    }
    let condition: CounterCondition | undefined;
    if (block.terminator.kind === "branch") {
      const comparison = definitions.get(block.terminator.condition);
      if (comparison?.kind === "binary" && block.operations.includes(comparison)) {
        const right = literal(comparison.right);
        const left = literal(comparison.left);
        if (right !== undefined && fresh(comparison.left))
          condition = { operator: comparison.operator, constant: right, counterOnLeft: true };
        else if (left !== undefined && fresh(comparison.right))
          condition = { operator: comparison.operator, constant: left, counterOnLeft: false };
      }
    }
    return { fact, condition };
  };

  const before = new Map<string, CounterFact>([[source.entry, CounterFact.Unknown]]);
  const pending = [source.entry];
  const queued = new Set(pending);
  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const id = pending[cursor]!;
    queued.delete(id);
    const input = before.get(id)!;
    const block = byId.get(id)!;
    const output = walk(block, input);
    for (const target of successors(block)) {
      const edge = block.terminator;
      const next =
        edge.kind === "branch" && edge.whenTrue !== edge.whenFalse
          ? counterEdge(output.fact, output.condition, target === edge.whenTrue, limit)
          : output.fact;
      const previous = before.get(target);
      const joined = previous === undefined ? next : joinCounterFacts(previous, next);
      if (previous === joined) continue;
      before.set(target, joined);
      if (!queued.has(target)) {
        pending.push(target);
        queued.add(target);
      }
    }
  }
  for (const block of blocks) {
    const input = before.get(block.id);
    if (input !== undefined) walk(block, input, true);
  }
  return certified;
}

/** A nonnegative scalar bound or an offset anchored to one whole immutable sprite asset. */
interface SpriteValue {
  /** Null means an ordinary scalar, never an inferred physical address. */
  readonly asset: string | null;
  /** Inclusive nonnegative maximum, relative to the asset when anchored. */
  readonly maximum: bigint;
}

/**
 * Certify a call-free mainline's sprite publications without modelling general hardware state.
 *
 * Every enabled slot must first receive a pointer into an exact immutable asset. The existing
 * whole-asset layout contract supplies visibility and disjointness from all function homes.
 * Unknown selectors, aliases, raw accesses or source ownership simply decline the certificate.
 * @param input Closed source program and selected cooperative profile.
 * @param source Original reachable main function, not a transformed replacement.
 * @returns Exact publication operations, or null when any premise remains unproved.
 */
export function proveSpritePublications(
  input: MachineLoweringInput,
  source: SemanticFunction,
): ByteCapturePublicationProof | null {
  const { program, profile } = input;
  const key = bindingIdentityKey(source.id);
  const domains = program.executionDomains?.find(
    (entry) => bindingIdentityKey(entry.function) === key,
  );
  if (
    !/^c64-(pal|ntsc)-prg-kernal-(6581|8580)$/u.test(profile.id) ||
    !program.semantic.functions.includes(source) ||
    bindingIdentityKey(program.semantic.main) !== key ||
    program.reachableFunctions.length !== 1 ||
    bindingIdentityKey(program.reachableFunctions[0]!) !== key ||
    domains?.domains.length !== 1 ||
    domains.domains[0] !== "main" ||
    program.interruptContextAnalysis === undefined ||
    program.interruptContextAnalysis.diagnostics.length !== 0 ||
    program.semantic.globals.some((global) => global.entry !== null) ||
    source.parameters.length !== 0 ||
    source.entryKind === "interrupt"
  )
    return null;
  const blocks = reachableBlocks(source.entry, source.blocks);
  const operations = blocks.flatMap((block) => block.operations);
  const definitions = valueDefinitions(blocks);
  const literal = literalResolver(definitions);
  const stores = new Map<string, Extract<SemanticOperation, { kind: "store" }>[]>();
  const firstStores = new Map(blocks.map(({ id }) => [id, new Map<string, number>()]));
  const firstLoads = new Map(blocks.map(({ id }) => [id, new Map<string, number>()]));
  const forbiddenRoots = new Set([
    ...source.parameters.map(({ id }) => bindingIdentityKey(id)),
    ...program.semantic.globals.map(({ id }) => bindingIdentityKey(id)),
  ]);
  const windows = [...profile.storage.ram, ...profile.storage.zeroPage];
  const writes = new Set<MemoryWriteOperation>();
  const slots = new Map<MemoryWriteOperation, number>();
  const enables = new Map<MemoryWriteOperation, number>();
  for (const block of blocks)
    for (const [index, operation] of block.operations.entries()) {
      if (
        placeUses(operation).some(
          ({ place }) =>
            place.path.length !== 0 || forbiddenRoots.has(bindingIdentityKey(place.root)),
        )
      )
        return null;
      if (operation.kind === "load" || operation.kind === "store") {
        const root = bindingIdentityKey(operation.place.root);
        const first = (operation.kind === "load" ? firstLoads : firstStores).get(block.id)!;
        if (!first.has(root)) first.set(root, index);
        if (operation.kind === "store") {
          const entries = stores.get(root) ?? [];
          entries.push(operation);
          stores.set(root, entries);
        }
      } else if (operation.kind === "memory-read" || operation.kind === "memory-write") {
        const address = literal(operation.address);
        if (address === undefined || rawMayObserve(address, operation.width, windows)) return null;
        if (operation.kind === "memory-read") continue;
        for (let offset = 0; offset < operation.width; offset += 1) {
          const byte = Number(BigInt.asUintN(16, address + BigInt(offset)));
          // Low workspace can redirect retained firmware's indirect accesses. CIA
          // configuration can change those routes too. Neither is a proved local write.
          if (
            (byte < 0x0800 &&
              (byte < profile.machine.spritePointerBase ||
                byte >= profile.machine.spritePointerBase + 8)) ||
            (byte >= profile.machine.cia1Base && byte < profile.machine.cia2Base + 0x100) ||
            byte >= 0xfffa ||
            (byte >= 0xd000 && byte < 0xd400 && (byte & 0x3f) === 0x16)
          )
            return null;
        }
        if (!rawMaySelectHardwareRam(address, operation.width, profile)) continue;
        const byte = Number(BigInt.asUintN(16, address));
        if (operation.width !== 1) return null;
        if (
          byte >= profile.machine.spritePointerBase &&
          byte < profile.machine.spritePointerBase + 8
        )
          slots.set(operation, byte - profile.machine.spritePointerBase);
        else if (byte === profile.machine.spriteEnable) {
          const mask = literal(operation.value);
          if (mask === undefined || mask < 0n || mask > 255n) return null;
          enables.set(operation, Number(mask));
        } else return null;
        writes.add(operation);
      } else if (operation.kind === "platform") {
        if (operation.capability !== "c64.vic.vicSpriteBlock" || operation.effect !== "pure")
          return null;
      } else if (
        !["constant", "binary", "unary", "convert", "embedded-address"].includes(operation.kind)
      )
        return null;
    }

  const byId = new Map(blocks.map((block) => [block.id, block]));
  const candidateBlocks = new Map<string, string[]>();
  for (const [block, roots] of firstStores)
    for (const root of roots.keys()) {
      const entries = candidateBlocks.get(root) ?? [];
      entries.push(block);
      candidateBlocks.set(root, entries);
    }
  const checkedBlocks = new Set<string>();
  const initializedRoots = new Map<string, boolean>();
  /** Share one traversal across a block's candidates, then discard its reachability set. */
  const initialized = (root: string): boolean => {
    if (initializedRoots.has(root)) return initializedRoots.get(root)!;
    for (const removed of candidateBlocks.get(root) ?? []) {
      if (checkedBlocks.has(removed)) continue;
      checkedBlocks.add(removed);
      const candidates = new Set(
        [...firstStores.get(removed)!]
          .filter(([binding, index]) => index < (firstLoads.get(removed)!.get(binding) ?? Infinity))
          .map(([binding]) => binding),
      );
      const reached = new Set<string>();
      const pending = [source.entry];
      for (let cursor = 0; cursor < pending.length; cursor += 1) {
        const id = pending[cursor]!;
        if (id === removed || reached.has(id)) continue;
        reached.add(id);
        for (const binding of firstLoads.get(id)!.keys()) candidates.delete(binding);
        pending.push(...successors(byId.get(id)!));
      }
      for (const binding of candidates) initializedRoots.set(binding, true);
      if (initializedRoots.get(root) === true) return true;
    }
    const result = initializedRoots.get(root) === true;
    initializedRoots.set(root, result);
    return result;
  };
  const limits = new Map<string, Set<bigint>>();
  for (const operation of operations) {
    if (operation.kind !== "binary" || ![">=", "<"].includes(operation.operator)) continue;
    const load = definitions.get(operation.left);
    const limit = literal(operation.right);
    if (
      load?.kind !== "load" ||
      load.type.kind !== "scalar" ||
      load.type.name !== "byte" ||
      limit === undefined ||
      limit <= 0n ||
      limit > 255n
    )
      continue;
    const root = bindingIdentityKey(load.place.root);
    const entries = limits.get(root) ?? new Set<bigint>();
    entries.add(limit);
    limits.set(root, entries);
  }
  const counterFacts = new Map<string, ReadonlySet<LoadOperation>>();
  /** Query a single source guard limit once; competing limits remain unsupported. */
  const counterValue = (load: LoadOperation): SpriteValue | null => {
    const root = bindingIdentityKey(load.place.root);
    const candidates = limits.get(root);
    if (candidates?.size !== 1) return null;
    const limit = [...candidates][0]!;
    let facts = counterFacts.get(root);
    if (facts === undefined) {
      // Direct aliases and unproved firmware-routing writes were rejected above;
      // remaining raw accesses cannot mutate this private typed root.
      facts = boundedCounterLoads(source, load.place.root, limit, () => false);
      counterFacts.set(root, facts);
    }
    return facts.has(load) ? { asset: null, maximum: limit - 1n } : null;
  };
  const assets = new Map(
    program.semantic.assets.flatMap((asset) =>
      asset.kind === "resident-asset" && program.reachableAssets.includes(asset.id)
        ? [[asset.id, asset] as const]
        : [],
    ),
  );
  const memo = new Map<string, SpriteValue | null>();
  /** Dependencies use disjoint namespaces for evaluated values and mutable helper roots. */
  const dependencies = (node: string): readonly string[] => {
    if (node.startsWith("root:"))
      return (stores.get(node.slice(5)) ?? []).map((op) => `value:${op.value}`);
    const op = definitions.get(node.slice(6));
    if (op?.kind === "load" && counterValue(op) === null)
      return [`root:${bindingIdentityKey(op.place.root)}`];
    if (op?.kind === "binary" && ["+", "*"].includes(op.operator))
      return [`value:${op.left}`, `value:${op.right}`];
    if (op?.kind === "convert" && ["identity", "zero-extend"].includes(op.conversion))
      return [`value:${op.operand}`];
    return [];
  };
  /** Evaluate one node only after all dependencies, preserving symbolic asset provenance. */
  const evaluate = (node: string): SpriteValue | null => {
    if (node.startsWith("root:")) {
      const root = node.slice(5);
      if (!initialized(root)) return null;
      let result: SpriteValue | null = null;
      for (const store of stores.get(root) ?? []) {
        const value = memo.get(`value:${store.value}`);
        if (value == null || (result !== null && result.asset !== value.asset)) return null;
        result = {
          asset: value.asset,
          maximum:
            result === null || value.maximum > result.maximum ? value.maximum : result.maximum,
        };
      }
      return result;
    }
    const op = definitions.get(node.slice(6));
    const constant = literal(node.slice(6));
    if (constant !== undefined) return constant < 0n ? null : { asset: null, maximum: constant };
    if (op?.kind === "load")
      return counterValue(op) ?? memo.get(`root:${bindingIdentityKey(op.place.root)}`) ?? null;
    if (
      op?.kind === "platform" &&
      op.capability === "c64.vic.vicSpriteBlock" &&
      op.arguments.length === 1
    ) {
      const address = definitions.get(op.arguments[0]!);
      return address?.kind === "embedded-address" && assets.has(address.asset)
        ? { asset: address.asset, maximum: 0n }
        : null;
    }
    if (op?.kind === "convert" && ["identity", "zero-extend"].includes(op.conversion))
      return memo.get(`value:${op.operand}`) ?? null;
    if (op?.kind !== "binary" || !["+", "*"].includes(op.operator)) return null;
    const left = memo.get(`value:${op.left}`);
    const right = memo.get(`value:${op.right}`);
    if (left == null || right == null || (left.asset !== null && right.asset !== null)) return null;
    const asset = left.asset ?? right.asset;
    if (op.operator === "*" && asset !== null) return null;
    const maximum =
      op.operator === "+" ? left.maximum + right.maximum : left.maximum * right.maximum;
    if (op.integer === null || op.integer.signed || maximum >= 1n << BigInt(op.integer.width))
      return null;
    if (asset !== null && (maximum + 1n) * 64n > BigInt(assets.get(asset)!.bytes.length))
      return null;
    return { asset, maximum };
  };
  /** Iterative postorder avoids exhausting the host stack on long source expressions. */
  const resolve = (value: string): SpriteValue | null => {
    const active = new Set<string>();
    const pending = [{ node: `value:${value}`, finish: false }];
    while (pending.length > 0) {
      const task = pending.pop()!;
      if (memo.has(task.node)) continue;
      if (task.finish) {
        memo.set(task.node, evaluate(task.node));
        active.delete(task.node);
        continue;
      }
      if (active.has(task.node)) {
        memo.set(task.node, null);
        continue;
      }
      active.add(task.node);
      pending.push({ ...task, finish: true });
      for (const node of dependencies(task.node))
        if (!memo.has(node)) pending.push({ node, finish: false });
    }
    return memo.get(`value:${value}`) ?? null;
  };
  for (const write of slots.keys()) {
    const value = resolve(write.value);
    if (
      value?.asset == null ||
      (value.maximum + 1n) * 64n > BigInt(assets.get(value.asset)!.bytes.length)
    )
      return null;
  }
  // Must-initialized masks can only lose bits as additional predecessors become
  // reachable. A slot is added only after a completely proved pointer write.
  const before = new Map<string, number>([[source.entry, 0]]);
  const pending = [source.entry];
  const queued = new Set(pending);
  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const id = pending[cursor]!;
    queued.delete(id);
    let mask = before.get(id)!;
    for (const op of byId.get(id)!.operations)
      if (op.kind === "memory-write" && slots.has(op)) mask |= 1 << slots.get(op)!;
    for (const target of successors(byId.get(id)!)) {
      const previous = before.get(target);
      const joined = previous === undefined ? mask : previous & mask;
      if (previous === joined) continue;
      before.set(target, joined);
      if (!queued.has(target)) {
        pending.push(target);
        queued.add(target);
      }
    }
  }
  for (const block of blocks) {
    let mask = before.get(block.id)!;
    for (const op of block.operations) {
      if (op.kind !== "memory-write") continue;
      const slot = slots.get(op);
      if (slot !== undefined) mask |= 1 << slot;
      const enabled = enables.get(op);
      if (enabled !== undefined && (enabled & mask) !== enabled) return null;
    }
  }
  return { program, source, writes };
}

/**
 * Keep an anonymous byte in A through its adjacent constant equality and terminal branch.
 * Named stores, extra uses, transformed bodies and every uncertain observer keep ordinary
 * retention. EOR remains the comparison, so removing STA/LDA changes no live register or flag.
 * @param input Closed program and selected machine facts.
 * @param source Actual source owner, absent for generated initializer bodies.
 * @param blocks Exact original blocks being lowered.
 * @param singleUseValues Existing operation-use inventory, supplemented with terminator uses.
 * @param materializedValues Values needing concrete rather than terminal-condition storage.
 * @returns Producer IDs whose only use can consume the fresh accumulator directly.
 */
export function selectAnonymousComparisonValues(
  input: MachineLoweringInput,
  source: SemanticFunction | undefined,
  blocks: readonly SemanticBlock[],
  singleUseValues: ReadonlySet<string>,
  materializedValues: ReadonlySet<string>,
): ReadonlySet<string> {
  const selected = new Set<string>();
  if (
    source === undefined ||
    input.metadataOnly === true ||
    blocks.length !== source.blocks.length ||
    blocks.some((block, index) => block !== source.blocks[index])
  )
    return selected;
  const definitions = valueDefinitions(blocks);
  const literal = literalResolver(definitions);
  const uses = new Map<string, number>();
  const addUse = (value: string): void => {
    uses.set(value, (uses.get(value) ?? 0) + 1);
  };
  const windows = [...input.profile.storage.ram, ...input.profile.storage.zeroPage];
  for (const block of blocks) {
    for (const op of block.operations) {
      for (const value of potentialValueInputs(op)) addUse(value);
      if (
        (op.kind === "memory-read" || op.kind === "memory-write") &&
        rawMayObserve(literal(op.address), op.width, windows)
      )
        return selected;
    }
    if (block.terminator.kind === "branch") addUse(block.terminator.condition);
    if (block.terminator.kind === "return" && block.terminator.value !== null)
      addUse(block.terminator.value);
  }
  const candidates: Extract<SemanticOperation, { kind: "memory-read" }>[] = [];
  for (const block of blocks)
    for (const [index, read] of block.operations.entries()) {
      if (
        read.kind !== "memory-read" ||
        read.width !== 1 ||
        !read.volatile ||
        read.type.kind !== "scalar" ||
        read.type.name !== "byte" ||
        uses.get(read.result) !== 1 ||
        !singleUseValues.has(read.result) ||
        literal(read.address) === undefined
      )
        continue;
      let cursor = index + 1;
      while (cursor < block.operations.length) {
        const gap = block.operations[cursor]!;
        if (
          (gap.kind !== "constant" && gap.kind !== "convert") ||
          !("result" in gap) ||
          literal(gap.result) === undefined
        )
          break;
        cursor += 1;
      }
      const comparison = block.operations[cursor];
      if (
        comparison?.kind !== "binary" ||
        !["==", "!="].includes(comparison.operator) ||
        comparison.left !== read.result ||
        uses.get(comparison.result) !== 1 ||
        materializedValues.has(comparison.result) ||
        cursor !== block.operations.length - 1 ||
        block.terminator.kind !== "branch" ||
        block.terminator.condition !== comparison.result
      )
        continue;
      const right = literal(comparison.right);
      if (right !== undefined && right >= 0n && right <= 255n) candidates.push(read);
    }
  if (candidates.length === 0) return selected;
  const proof = proveSpritePublications(input, source);
  if (proof === null || !hasUnobservedByteCapture(input, source, candidates[0]!, proof))
    return selected;
  for (const read of candidates) selected.add(read.result);
  return selected;
}
