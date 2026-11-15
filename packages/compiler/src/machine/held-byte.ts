import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BlockId, SemanticBlock, SemanticOperation } from "../semantic/operations.js";

/** One stable byte place whose value A is proved to hold at a block entry. */
interface HeldPlace {
  /** Stable root identity of the whole-byte place. */
  readonly key: string;
  /** Consecutive unsigned values `0..tested-1` already excluded on this path. */
  readonly tested: number;
}

/** Values whose leading load may be omitted because A already holds their byte. */
export interface HeldByteSelection {
  /** Load results served directly from A at block entry. */
  readonly values: ReadonlySet<string>;
}

/** Resolve one constant through converting operations. */
function constantValue(
  value: string,
  definitions: ReadonlyMap<string, SemanticOperation>,
): bigint | null {
  let current = definitions.get(value);
  while (current?.kind === "convert") current = definitions.get(current.operand);
  return current?.kind === "constant" && typeof current.value === "bigint" ? current.value : null;
}

/** Follow only value-preserving conversions to the defining operation. */
function throughConversions(
  value: string,
  definitions: ReadonlyMap<string, SemanticOperation>,
): SemanticOperation | undefined {
  let current = definitions.get(value);
  while (current?.kind === "convert") current = definitions.get(current.operand);
  return current;
}

/** Stable key for one whole stable byte place, or null when it cannot be held in A. */
function heldPlaceKey(
  operation: Extract<SemanticOperation, { readonly kind: "load" }>,
): string | null {
  if (operation.place.path.length !== 0) return null;
  if (operation.place.asset !== undefined) return null;
  if (operation.type.kind === "struct" || operation.type.kind === "array") return null;
  if (operation.type.kind === "function" || operation.type.kind === "interrupt-handler")
    return null;
  if (operation.type.kind === "scalar" && operation.type.name === "void") return null;
  if (operation.type.kind === "scalar" && operation.type.name === "word") return null;
  if (operation.type.kind === "scalar" && operation.type.name === "sword") return null;
  return bindingIdentityKey(operation.place.root);
}

/** One block's equality-classifier shape and its held place. */
interface EqualityShape {
  /** Load whose byte the comparison reads. */
  readonly load: Extract<SemanticOperation, { readonly kind: "load" }>;
  /** Stable place key of that load. */
  readonly key: string;
  /** Compared constant value. */
  readonly constant: number;
}

/** Recognize `[constant|convert]*; load; [constant|convert]*; == constant`. */
function equalityShape(
  block: SemanticBlock,
  definitions: ReadonlyMap<string, SemanticOperation>,
): EqualityShape | null {
  const terminator = block.terminator;
  if (terminator.kind !== "branch") return null;
  const operations = block.operations;
  const load = operations.find((operation) => operation.kind === "load");
  if (load?.kind !== "load") return null;
  const key = heldPlaceKey(load);
  if (key === null) return null;
  const binary = operations[operations.length - 1];
  if (binary?.kind !== "binary") return null;
  if (binary.operator !== "==") return null;
  if (terminator.condition !== binary.result) return null;
  const source = throughConversions(binary.left, definitions);
  if (source?.kind !== "load" || source.result !== load.result) return null;
  const constant = constantValue(binary.right, definitions);
  if (constant === null || constant < 0n || constant > 0xffn) return null;
  for (const operation of operations) {
    if (operation === load || operation === binary) continue;
    if (operation.kind !== "constant" && operation.kind !== "convert") return null;
  }
  return { load, key, constant: Number(constant) };
}

/** A jump-only block whose empty body passes the incoming A through unchanged. */
function passThrough(block: SemanticBlock): boolean {
  if (block.terminator.kind !== "jump") return false;
  return block.operations.every(
    (operation) => operation.kind === "constant" || operation.kind === "convert",
  );
}

/**
 * Select the leading loads of a dense equality classifier chain whose byte A
 * still holds from the incoming edge. The chain starts with `place == 0` and
 * continues through `place == k` for each consecutive `k`, so every comparison
 * is reached only when the tested lower values were excluded. Each member has
 * exactly one predecessor, so no join can substitute another A value. A load
 * without that proof keeps its ordinary `LDA`/`EOR` form.
 * @param blocks Semantic blocks of one function in declaration order.
 * @returns The load results that may use A instead of reloading their place.
 */
export function selectHeldByteEntryLoads(blocks: readonly SemanticBlock[]): HeldByteSelection {
  if (blocks.length === 0) return Object.freeze({ values: new Set<string>() });
  const byId = new Map(blocks.map((block) => [block.id, block] as const));
  const definitions = new Map<string, SemanticOperation>();
  for (const block of blocks)
    for (const operation of block.operations) {
      const result = "result" in operation ? operation.result : null;
      if (result !== null && result !== undefined) definitions.set(result, operation);
    }
  const predecessors = new Map<BlockId, number>(blocks.map((block) => [block.id, 0]));
  for (const block of blocks) {
    const terminator = block.terminator;
    const successors =
      terminator.kind === "jump"
        ? [terminator.target]
        : terminator.kind === "branch"
          ? [terminator.whenTrue, terminator.whenFalse]
          : [];
    for (const successor of successors)
      predecessors.set(successor, (predecessors.get(successor) ?? 0) + 1);
  }
  const values = new Set<string>();
  for (const block of blocks) {
    const shape = equalityShape(block, definitions);
    if (shape === null || shape.constant !== 0) continue;
    if (block.terminator.kind !== "branch") continue;
    let fact: HeldPlace = { key: shape.key, tested: 1 };
    let pending: BlockId | null = block.terminator.whenFalse;
    const visited = new Set<BlockId>([block.id]);
    while (pending !== null && !visited.has(pending)) {
      const next = byId.get(pending);
      if (next === undefined || (predecessors.get(next.id) ?? 0) !== 1) break;
      visited.add(next.id);
      if (passThrough(next)) {
        pending = next.terminator.kind === "jump" ? next.terminator.target : null;
        continue;
      }
      const nextShape = equalityShape(next, definitions);
      if (
        nextShape === null ||
        nextShape.key !== fact.key ||
        nextShape.constant === 0 ||
        nextShape.constant !== fact.tested ||
        next.terminator.kind !== "branch"
      )
        break;
      values.add(nextShape.load.result);
      fact = { key: fact.key, tested: fact.tested + 1 };
      pending = next.terminator.whenFalse;
    }
  }
  return Object.freeze({ values });
}
