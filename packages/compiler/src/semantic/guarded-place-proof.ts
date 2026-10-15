import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { placeUses } from "./aggregate-place-proof.js";
import type { BlockId, SemanticBlock, SemanticOperation, ValueId } from "./operations.js";

/** Inclusive nonnegative maxima, valid only on every path reaching this position. */
interface GuardFacts {
  /** Already evaluated values keep their meaning when their source binding changes. */
  readonly values: Map<ValueId, bigint>;
  /** Only unexposed function-local scalar bindings may be read again under a guard. */
  readonly bindings: Map<string, bigint>;
  /** A load still equals its binding until that binding is written. */
  readonly loads: Map<ValueId, string>;
}

/** Start without assumptions about parameters, globals, or a previous loop iteration. */
function emptyFacts(): GuardFacts {
  return { values: new Map(), bindings: new Map(), loads: new Map() };
}

/** Keep edge states independent when one successor gains a comparison fact. */
function copyFacts(facts: GuardFacts): GuardFacts {
  return {
    values: new Map(facts.values),
    bindings: new Map(facts.bindings),
    loads: new Map(facts.loads),
  };
}

/** A join keeps only common facts and the larger maximum of all possible paths. */
function joinFacts(paths: readonly GuardFacts[]): GuardFacts {
  if (paths.length === 0) return emptyFacts();
  const joined = copyFacts(paths[0]!);
  for (const path of paths.slice(1)) {
    for (const bounds of ["values", "bindings"] as const) {
      for (const [key, bound] of joined[bounds]) {
        const other = path[bounds].get(key);
        if (other === undefined) joined[bounds].delete(key);
        else if (other > bound) joined[bounds].set(key, other);
      }
    }
    for (const [value, root] of joined.loads)
      if (path.loads.get(value) !== root) joined.loads.delete(value);
  }
  return joined;
}

/** Compare maps by content so convergence does not depend on traversal order. */
function sameFacts(left: GuardFacts, right: GuardFacts): boolean {
  return (["values", "bindings", "loads"] as const).every(
    (kind) =>
      left[kind].size === right[kind].size &&
      [...left[kind]].every(([key, value]) => right[kind].get(key) === value),
  );
}

/** Invalidate reloads, but not the immutable values captured before this write. */
function forgetBinding(facts: GuardFacts, root: string): void {
  facts.bindings.delete(root);
  for (const [value, binding] of facts.loads) if (binding === root) facts.loads.delete(value);
}

/**
 * Derive only use-site unsigned comparison bounds for the existing object-footprint
 * and runtime-shift consumers. This does not infer loop recurrence, narrow counters,
 * change source operations, or make an exact raw-address claim. Shared and address-exposed roots
 * never gain reload facts; ordinary callees cannot name an unexposed local scalar.
 * Unknown physical writes discard all reload facts. At joins, an absent bound on
 * even one path keeps the access unknown.
 *
 * @param entry Body entry with no incoming guard assumptions.
 * @param blocks Already selected reachable blocks.
 * @param definitions Body-local immutable value definitions.
 * @param unstableRoots Shared or address-exposed bindings, never safe to track by reload.
 * @param literal Existing exact literal resolver; never replaced by a bound.
 * @param baseBound Existing context-independent mask/conversion proof.
 * @param mayAliasLocals Whether an operation can change otherwise unexposed local storage.
 * @returns Sparse per-use maxima for indexes and shift counts, before function storage closes.
 */
export function guardedOrdinalBounds(
  entry: BlockId,
  blocks: readonly SemanticBlock[],
  definitions: ReadonlyMap<ValueId, SemanticOperation>,
  unstableRoots: ReadonlySet<string>,
  literal: (value: ValueId) => bigint | undefined,
  baseBound: (value: ValueId) => bigint | undefined,
  mayAliasLocals: (operation: SemanticOperation) => boolean,
): ReadonlyMap<SemanticOperation, ReadonlyMap<ValueId, bigint>> {
  // Literal/mask proofs already cover straight-line bodies. Do not replay long
  // conversion chains when there is no comparison edge to add a use-site fact.
  if (!blocks.some(({ terminator }) => terminator.kind === "branch")) return new Map();
  const before = new Map<BlockId, GuardFacts>();
  const predecessors = new Map<BlockId, BlockId[]>();
  const edges = new Map<BlockId, Map<BlockId, GuardFacts>>();
  for (const block of blocks) {
    const { terminator } = block;
    const targets =
      terminator.kind === "jump"
        ? [terminator.target]
        : terminator.kind === "branch"
          ? [...new Set([terminator.whenTrue, terminator.whenFalse])]
          : [];
    edges.set(block.id, new Map(targets.map((target) => [target, emptyFacts()])));
    for (const target of targets) {
      const incoming = predecessors.get(target) ?? [];
      incoming.push(block.id);
      predecessors.set(target, incoming);
    }
  }

  const boundOf = (value: ValueId, facts: GuardFacts): bigint | undefined =>
    facts.values.get(value) ?? baseBound(value);
  const unsigned = (value: ValueId): boolean => {
    const operation = definitions.get(value);
    return operation !== undefined && "integer" in operation && operation.integer?.signed === false;
  };

  /** A conversion can propagate a bound only if no possible value changes. */
  const convertedBound = (value: bigint | undefined, operation: SemanticOperation) => {
    if (operation.kind !== "convert" || operation.integer === null || value === undefined)
      return undefined;
    const { width, signed } = operation.integer;
    return value <= (1n << BigInt(width - (signed ? 1 : 0))) - 1n ? value : undefined;
  };

  /** Replay actual operation order; never apply a later guard to an earlier access. */
  const walk = (
    block: SemanticBlock,
    input: GuardFacts,
    accesses?: Map<SemanticOperation, ReadonlyMap<ValueId, bigint>>,
  ): GuardFacts => {
    const facts = copyFacts(input);
    for (const operation of block.operations) {
      if (accesses !== undefined) {
        const ordinals = new Map<ValueId, bigint>();
        if (
          operation.kind === "binary" &&
          (operation.operator === "<<" || operation.operator === ">>")
        ) {
          const bound = boundOf(operation.right, facts);
          if (bound !== undefined) ordinals.set(operation.right, bound);
        }
        for (const { place } of placeUses(operation))
          for (const selection of place.path)
            if (selection.kind === "index") {
              const bound = boundOf(selection.value, facts);
              if (bound !== undefined) ordinals.set(selection.value, bound);
            }
        if (ordinals.size > 0) accesses.set(operation, ordinals);
      }
      if (mayAliasLocals(operation)) {
        facts.bindings.clear();
        facts.loads.clear();
      }
      if (operation.kind === "store") {
        const root = bindingIdentityKey(operation.place.root);
        const bound = boundOf(operation.value, facts);
        forgetBinding(facts, root);
        if (operation.place.path.length === 0 && !unstableRoots.has(root) && bound !== undefined)
          facts.bindings.set(root, bound);
      }
      if (!("result" in operation) || operation.result === null) continue;
      // A definition in a loop executes again; its previous iteration is not a fact.
      facts.values.delete(operation.result);
      facts.loads.delete(operation.result);
      let bound = baseBound(operation.result);
      if (operation.kind === "load" && operation.place.path.length === 0) {
        const root = bindingIdentityKey(operation.place.root);
        if (!unstableRoots.has(root)) {
          facts.loads.set(operation.result, root);
          bound = facts.bindings.get(root);
        }
      } else if (operation.kind === "convert") {
        bound = convertedBound(boundOf(operation.operand, facts), operation);
      } else if (
        operation.kind === "binary" &&
        operation.operator === "+" &&
        operation.integer?.signed === false
      ) {
        // Extend only a proved unsigned value by one exact constant, without wrap.
        const leftLiteral = literal(operation.left);
        const offset = leftLiteral ?? literal(operation.right);
        const value = leftLiteral === undefined ? operation.left : operation.right;
        const maximum = unsigned(value) ? boundOf(value, facts) : undefined;
        if (offset !== undefined && offset >= 0n && maximum !== undefined) {
          const sum = maximum + offset;
          if (sum <= (1n << BigInt(operation.integer.width)) - 1n) bound = sum;
        }
      } else if (
        operation.kind === "binary" &&
        operation.operator === ">>" &&
        operation.integer?.signed === false &&
        unsigned(operation.left)
      ) {
        const left = boundOf(operation.left, facts);
        const shift = literal(operation.right);
        if (left !== undefined && shift !== undefined && shift >= 0n)
          bound = shift >= BigInt(operation.integer.width) ? 0n : left >> shift;
      }
      if (bound !== undefined) facts.values.set(operation.result, bound);
    }
    return facts;
  };

  /** Refine only a real successful unsigned literal comparison edge. */
  const refine = (condition: ValueId, truth: boolean, input: GuardFacts): GuardFacts => {
    const facts = copyFacts(input);
    const comparison = definitions.get(condition);
    if (comparison?.kind !== "binary") return facts;
    let value = comparison.left;
    let limit = literal(comparison.right);
    let operator = comparison.operator;
    if (limit === undefined) {
      limit = literal(comparison.left);
      value = comparison.right;
      operator =
        ({ "<": ">", "<=": ">=", ">": "<", ">=": "<=" } as const)[
          operator as "<" | "<=" | ">" | ">="
        ] ?? operator;
    }
    if (limit === undefined || !unsigned(value)) return facts;
    const strict = (truth && operator === "<") || (!truth && operator === ">=");
    const inclusive = (truth && operator === "<=") || (!truth && operator === ">");
    if (!strict && !inclusive) return facts;
    const maximum = strict ? limit - 1n : limit;
    if (maximum < 0n) return facts;
    const seen = new Set<ValueId>();
    while (!seen.has(value) && unsigned(value)) {
      seen.add(value);
      const old = boundOf(value, facts);
      const bound = old === undefined || maximum < old ? maximum : old;
      facts.values.set(value, bound);
      const root = facts.loads.get(value);
      if (root !== undefined) facts.bindings.set(root, bound);
      const definition = definitions.get(value);
      if (
        definition?.kind !== "convert" ||
        (definition.conversion !== "identity" && definition.conversion !== "zero-extend") ||
        !unsigned(definition.operand)
      )
        break;
      value = definition.operand;
    }
    return facts;
  };

  /**
   * A short-circuit Boolean merge can reach a false edge only from its false
   * alternatives. Replay the current block on each feasible incoming edge so
   * writes after the merge still invalidate reloads. This is edge selection,
   * not a general Boolean-expression or interprocedural range solver.
   */
  const selectedEdge = (block: SemanticBlock, output: GuardFacts, truth: boolean): GuardFacts => {
    if (block.terminator.kind !== "branch") return output;
    const condition = definitions.get(block.terminator.condition);
    if (condition?.kind !== "merge" || !block.operations.includes(condition))
      return refine(block.terminator.condition, truth, output);
    const incoming = predecessors.get(block.id) ?? [];
    if (
      incoming.length !== condition.incoming.length ||
      incoming.some((id) => !condition.incoming.some((item) => item.block === id))
    )
      return output;
    const paths: GuardFacts[] = [];
    for (const item of condition.incoming) {
      const definition = definitions.get(item.value);
      if (definition?.kind === "constant" && typeof definition.value === "boolean") {
        if (definition.value !== truth) continue;
      }
      const input = edges.get(item.block)?.get(block.id);
      if (input === undefined) return output;
      paths.push(refine(item.value, truth, walk(block, input)));
    }
    return joinFacts(paths);
  };

  // Start every edge unknown. Revisit only successors whose incoming facts changed.
  const pending = [...blocks];
  const queued = new Set(blocks.map(({ id }) => id));
  const byId = new Map(blocks.map((block) => [block.id, block]));
  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const block = pending[cursor]!;
    queued.delete(block.id);
    const incoming = (predecessors.get(block.id) ?? []).map((id) => edges.get(id)!.get(block.id)!);
    if (block.id === entry) incoming.push(emptyFacts());
    const input = joinFacts(incoming);
    before.set(block.id, input);
    const output = walk(block, input);
    for (const [target, previous] of edges.get(block.id)!) {
      const { terminator } = block;
      const next =
        terminator.kind === "branch" && terminator.whenTrue !== terminator.whenFalse
          ? selectedEdge(block, output, target === terminator.whenTrue)
          : output;
      if (sameFacts(previous, next)) continue;
      edges.get(block.id)!.set(target, next);
      if (!queued.has(target)) {
        pending.push(byId.get(target)!);
        queued.add(target);
      }
    }
  }
  const accesses = new Map<SemanticOperation, ReadonlyMap<ValueId, bigint>>();
  for (const block of blocks) walk(block, before.get(block.id)!, accesses);
  return accesses;
}
