import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type {
  SemanticBlock,
  SemanticFunction,
  SemanticGlobal,
  SemanticOperation,
} from "./operations.js";
import type { VectorState } from "./interrupt-context-facts.js";

/** Combine a fresh returning write effect with this invocation's earlier writes. */
export function combineInterruptHomeWrites(state: VectorState, previous: VectorState): VectorState {
  return state.cia2 === undefined
    ? state
    : { ...state, writesHomes: state.writesHomes === true || previous.writesHomes === true };
}

/** Exact copied scalar inputs; absent facts never enumerate possible source values. */
export interface InterruptArgumentFacts {
  /** Already evaluated loads/conversions, independent of later storage writes. */
  readonly values: ReadonlyMap<string, bigint>;
  /** Mutable scalar parameter homes belonging only to this invocation. */
  readonly parameters: ReadonlyMap<string, bigint>;
}

/** Seed scalar by-value parameters, not borrowed aggregates or guessed addresses. */
export function interruptArgumentInputs(
  body: SemanticFunction | SemanticGlobal,
  arguments_: readonly (bigint | undefined)[],
): InterruptArgumentFacts {
  const parameters = new Map<string, bigint>();
  if ("parameters" in body)
    body.parameters.forEach(({ id, type }, index) => {
      const value = arguments_[index];
      if (value !== undefined && (type.kind === "scalar" || type.kind === "enum"))
        parameters.set(bindingIdentityKey(id), value);
    });
  return { values: new Map(), parameters };
}

/** Stable finite identity contains only actual exact facts, never hypothetical integers. */
export function interruptArgumentFactsKey(facts: InterruptArgumentFacts): string {
  return JSON.stringify([
    [...facts.values].map(([id, value]) => [id, value.toString()]).sort(),
    [...facts.parameters].map(([id, value]) => [id, value.toString()]).sort(),
  ]);
}

/** Literal facts are immutable; evaluated parameter loads remain distinct snapshots. */
export function interruptArgumentValue(
  facts: InterruptArgumentFacts,
  literals: ReadonlyMap<string, bigint>,
  value: string,
): bigint | undefined {
  return facts.values.get(value) ?? literals.get(value);
}

/** An opaque call, arrival or raw write may change homes, but not evaluated SSA values. */
export function forgetInterruptArgumentHomes(
  facts: InterruptArgumentFacts,
): InterruptArgumentFacts {
  return facts.parameters.size === 0 ? facts : { ...facts, parameters: new Map() };
}

/**
 * Advance only parameter copies and the existing literal/conversion relationships.
 * No arithmetic evaluator, return-value interpreter or separate CFG solver is used.
 * Taking an address and reading through it do not change a home. The ordered
 * caller invalidates homes on possible writes; assignment can establish a new fact.
 */
export function advanceInterruptArgumentFacts(
  facts: InterruptArgumentFacts,
  literals: ReadonlyMap<string, bigint>,
  operation: SemanticOperation,
  parameterRoots: ReadonlySet<string>,
): InterruptArgumentFacts {
  if (!["load", "convert", "store"].includes(operation.kind)) return facts;
  if (parameterRoots.size === 0 && facts.values.size === 0) return facts;
  const values = new Map(facts.values);
  const parameters = new Map(facts.parameters);
  const value = (id: string): bigint | undefined => interruptArgumentValue(facts, literals, id);
  if (operation.kind === "load" || operation.kind === "convert") {
    const exact =
      operation.kind === "load"
        ? operation.place.path.length === 0
          ? parameters.get(bindingIdentityKey(operation.place.root))
          : undefined
        : value(operation.operand);
    values.delete(operation.result);
    if (exact !== undefined && operation.integer !== null) {
      const { width, signed } = operation.integer;
      values.set(
        operation.result,
        signed ? BigInt.asIntN(width, exact) : BigInt.asUintN(width, exact),
      );
    }
  } else if (operation.kind === "store") {
    const root = bindingIdentityKey(operation.place.root);
    parameters.delete(root);
    const exact = value(operation.value);
    if (parameterRoots.has(root) && operation.place.path.length === 0 && exact !== undefined)
      parameters.set(root, exact);
  }
  return { values, parameters };
}

/** Bind each merge from this actual incoming edge, never from an unrelated branch. */
export function enterInterruptArgumentBlock(
  facts: InterruptArgumentFacts,
  literals: ReadonlyMap<string, bigint>,
  block: SemanticBlock,
  predecessor: string,
): InterruptArgumentFacts {
  const values = new Map(facts.values);
  for (const operation of block.operations) {
    if (operation.kind !== "merge") continue;
    const incoming = operation.incoming.find(({ block }) => block === predecessor);
    const exact =
      incoming === undefined ? undefined : interruptArgumentValue(facts, literals, incoming.value);
    values.delete(operation.result);
    if (exact !== undefined) values.set(operation.result, exact);
  }
  return { ...facts, values };
}
