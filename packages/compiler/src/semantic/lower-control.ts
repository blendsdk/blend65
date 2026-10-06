import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticBinding, SemanticType, TypedExpr } from "../frontend/semantic-types.js";
import type { ControlFlowBuilder } from "./cfg.js";
import type { BlockId, SemanticFunction, SemanticOperation, ValueId } from "./operations.js";
import { reachableBlocks } from "./value-lifetimes.js";

/** Count actual uses, including predecessor merges and computed place indexes. */
function valueUses(operation: SemanticOperation, value: ValueId): number {
  const operands: ValueId[] = [];
  if ("operand" in operation) operands.push(operation.operand);
  if ("left" in operation) operands.push(operation.left, operation.right);
  if ("target" in operation) operands.push(operation.target);
  if ("address" in operation) operands.push(operation.address);
  if ("value" in operation && typeof operation.value === "string") operands.push(operation.value);
  if ("arguments" in operation) operands.push(...operation.arguments);
  if ("incoming" in operation) operands.push(...operation.incoming.map((item) => item.value));
  if ("elements" in operation) {
    operands.push(...operation.elements.map((item) => item.value));
    if (operation.fill !== null) operands.push(operation.fill);
  }
  const place =
    "place" in operation
      ? operation.place
      : operation.kind === "aggregate"
        ? operation.destination?.kind === "place"
          ? operation.destination.place
          : null
        : "aggregateDestination" in operation && operation.aggregateDestination?.kind === "place"
          ? operation.aggregateDestination.place
          : null;
  if (place !== null)
    operands.push(...place.path.flatMap((part) => (part.kind === "index" ? [part.value] : [])));
  return operands.filter((operand) => operand === value).length;
}

/**
 * Finish an immediate, single-use local terminal callback choice in its existing
 * predecessor blocks, before any SFA home is inventoried. Only constant-only
 * no-argument/void terminal leaves qualify; returning, escaped, argument-bearing
 * and effect-interleaved choices keep ordinary function-value construction.
 * The condition and each ordinary call retain their source order and identity.
 */
export function sinkTerminalChoice(
  fn: SemanticFunction,
  functions: readonly SemanticFunction[],
  bindings: ReadonlyMap<string, SemanticBinding>,
): SemanticFunction {
  if (!fn.blocks.some((block) => block.operations[0]?.kind === "merge")) return fn;
  const terminalLeaves = new Set(
    functions
      .filter(
        (callee) =>
          callee.entryKind === "ordinary" &&
          callee.parameters.length === 0 &&
          callee.result.kind === "scalar" &&
          callee.result.name === "void" &&
          reachableBlocks(callee.entry, callee.blocks).every(
            (block) =>
              block.terminator.kind === "jump" &&
              block.operations.every((op) => op.kind === "constant"),
          ),
      )
      .map((callee) => bindingIdentityKey(callee.id)),
  );
  const operations = fn.blocks.flatMap((block) => block.operations);
  const uses = (value: ValueId): number =>
    operations.reduce((sum, op) => sum + valueUses(op, value), 0) +
    fn.blocks.filter(({ terminator }) =>
      terminator.kind === "branch"
        ? terminator.condition === value
        : terminator.kind === "return" && terminator.value === value,
    ).length;
  const byId = new Map(fn.blocks.map((block) => [block.id, block]));
  const replacements = new Map(byId);
  for (const block of fn.blocks) {
    const [merge, store, load, call] = block.operations;
    if (
      merge?.kind !== "merge" ||
      merge.incoming.length !== 2 ||
      store?.kind !== "store" ||
      store.value !== merge.result ||
      store.place.path.length !== 0 ||
      load?.kind !== "load" ||
      load.place.path.length !== 0 ||
      bindingIdentityKey(load.place.root) !== bindingIdentityKey(store.place.root) ||
      bindings.get(bindingIdentityKey(store.place.root))?.storage !== "local" ||
      call?.kind !== "indirect-call" ||
      call.target !== load.result ||
      call.arguments.length !== 0 ||
      call.signature.parameters.length !== 0 ||
      call.result !== null ||
      call.type.kind !== "scalar" ||
      call.type.name !== "void" ||
      uses(merge.result) !== 1 ||
      uses(load.result) !== 1
    )
      continue;
    const root = bindingIdentityKey(store.place.root);
    const rootUses = operations.filter((op) => {
      if ("place" in op && bindingIdentityKey(op.place.root) === root) return true;
      const destination =
        op.kind === "aggregate"
          ? op.destination
          : "aggregateDestination" in op
            ? op.aggregateDestination
            : undefined;
      return destination?.kind === "place" && bindingIdentityKey(destination.place.root) === root;
    });
    if (rootUses.length !== 2 || !rootUses.includes(store) || !rootUses.includes(load)) continue;
    const arms = merge.incoming.map((incoming) => {
      const arm = byId.get(incoming.block);
      const address = arm?.operations[0];
      return arm?.operations.length === 1 &&
        address?.kind === "function-address" &&
        address.result === incoming.value &&
        uses(address.result) === 1 &&
        terminalLeaves.has(bindingIdentityKey(address.function)) &&
        arm.terminator.kind === "jump" &&
        arm.terminator.target === block.id
        ? { arm, address }
        : null;
    });
    const incoming = new Set(merge.incoming.map((item) => item.block));
    const predecessors = fn.blocks.filter(({ terminator }) =>
      terminator.kind === "jump"
        ? terminator.target === block.id
        : terminator.kind === "branch" &&
          (terminator.whenTrue === block.id || terminator.whenFalse === block.id),
    );
    if (
      arms.some((arm) => arm === null) ||
      incoming.size !== 2 ||
      predecessors.length !== 2 ||
      predecessors.some((arm) => !incoming.has(arm.id))
    )
      continue;
    for (const selected of arms) {
      if (selected === null) continue;
      replacements.set(
        selected.arm.id,
        Object.freeze({
          ...selected.arm,
          operations: Object.freeze([
            Object.freeze({
              kind: "call" as const,
              result: null,
              callee: selected.address.function,
              arguments: Object.freeze([]),
              type: call.type,
              span: call.span,
            }),
          ]),
        }),
      );
    }
    replacements.set(
      block.id,
      Object.freeze({ ...block, operations: Object.freeze(block.operations.slice(4)) }),
    );
  }
  return Object.freeze({
    ...fn,
    blocks: Object.freeze(fn.blocks.map((block) => replacements.get(block.id)!)),
  });
}

/** Infer the operation type before a retained integer conversion. */
export function typeBeforeConversion(expression: TypedExpr): SemanticType {
  if (expression.conversion === null || expression.conversion === "identity")
    return expression.type;
  if (expression.kind === "cast") {
    const operand = expression.operand;
    if (operand !== undefined && "type" in operand) return operand.type;
  }
  const integer = expression.integer;
  if (integer === null) return expression.type;
  const name =
    integer.width === 8 ? (integer.signed ? "sbyte" : "byte") : integer.signed ? "sword" : "word";
  return Object.freeze({ kind: "scalar", name });
}

/** Emit a value chosen by mutually exclusive predecessor blocks. */
function emitMerge(
  builder: ControlFlowBuilder,
  expression: TypedExpr,
  incoming: readonly { readonly block: BlockId; readonly value: ValueId }[],
): ValueId {
  const result = builder.nextValue();
  builder.emit(
    Object.freeze({
      kind: "merge",
      result,
      incoming: Object.freeze(incoming.map((item) => Object.freeze({ ...item }))),
      type: typeBeforeConversion(expression),
      integer: expression.integer,
      span: expression.span,
    }),
  );
  return result;
}

/** Lower Boolean short circuit with no operation in the bypassed right arm. */
export function lowerShortCircuit(
  expression: TypedExpr,
  builder: ControlFlowBuilder,
  lower: (child: TypedExpr) => ValueId | null,
  emitConstant: (value: boolean, expression: TypedExpr) => ValueId,
): ValueId {
  const leftNode = expression.left;
  const rightNode = expression.right;
  const operator = expression.operator;
  if (leftNode === undefined || rightNode === undefined || operator === undefined) {
    throw new Error("Completed logical expression is missing an operand or operator");
  }
  const left = lower(leftNode);
  if (left === null) throw new Error("Completed logical left operand has no value");
  if (typeof leftNode.constant === "boolean") {
    const evaluateRight = operator === "&&" ? leftNode.constant : !leftNode.constant;
    if (evaluateRight) {
      const right = lower(rightNode);
      if (right === null) throw new Error("Completed logical right operand has no value");
      return right;
    }
    return emitConstant(leftNode.constant, expression);
  }

  const conditionBlock = builder.currentBlock!;
  const selected = builder.createBlock("logical-selected");
  const bypassed = builder.createBlock("logical-bypassed");
  conditionBlock.terminator = Object.freeze({
    kind: "branch",
    condition: left,
    whenTrue: operator === "&&" ? selected.id : bypassed.id,
    whenFalse: operator === "&&" ? bypassed.id : selected.id,
  });

  builder.select(selected);
  const selectedValue = lower(rightNode);
  if (selectedValue === null) throw new Error("Completed logical right operand has no value");
  const selectedExit = builder.currentBlock!;
  builder.select(bypassed);
  const bypassValue = emitConstant(operator === "||", expression);
  const bypassExit = builder.currentBlock!;

  const merge = builder.createBlock("logical-end");
  builder.jumpFrom(selectedExit, merge.id);
  builder.jumpFrom(bypassExit, merge.id);
  builder.select(merge);
  return emitMerge(builder, expression, [
    { block: selectedExit.id, value: selectedValue },
    { block: bypassExit.id, value: bypassValue },
  ]);
}

/** Lower a selected-arm expression into two exclusive blocks and one merge. */
export function lowerConditional(
  expression: TypedExpr,
  builder: ControlFlowBuilder,
  lower: (child: TypedExpr) => ValueId | null,
): ValueId {
  const conditionNode = expression.condition;
  const whenTrueNode = expression.whenTrue;
  const whenFalseNode = expression.whenFalse;
  if (conditionNode === undefined || whenTrueNode === undefined || whenFalseNode === undefined) {
    throw new Error("Completed conditional expression is missing an arm or condition");
  }
  const condition = lower(conditionNode);
  if (condition === null) throw new Error("Completed conditional test has no value");
  if (typeof conditionNode.constant === "boolean") {
    const value = lower(conditionNode.constant ? whenTrueNode : whenFalseNode);
    if (value === null) throw new Error("Completed conditional arm has no value");
    return value;
  }

  const conditionBlock = builder.currentBlock!;
  const whenTrue = builder.createBlock("conditional-true");
  const whenFalse = builder.createBlock("conditional-false");
  conditionBlock.terminator = Object.freeze({
    kind: "branch",
    condition,
    whenTrue: whenTrue.id,
    whenFalse: whenFalse.id,
  });

  builder.select(whenTrue);
  const trueValue = lower(whenTrueNode);
  if (trueValue === null) throw new Error("Completed true arm has no value");
  const trueExit = builder.currentBlock!;
  builder.select(whenFalse);
  const falseValue = lower(whenFalseNode);
  if (falseValue === null) throw new Error("Completed false arm has no value");
  const falseExit = builder.currentBlock!;

  const merge = builder.createBlock("conditional-end");
  builder.jumpFrom(trueExit, merge.id);
  builder.jumpFrom(falseExit, merge.id);
  builder.select(merge);
  return emitMerge(builder, expression, [
    { block: trueExit.id, value: trueValue },
    { block: falseExit.id, value: falseValue },
  ]);
}

/** Fail loudly when a completed frontend node is missing one of its required fields. */
export function required<T>(value: T | undefined, description: string): T {
  if (value === undefined) throw new Error(`Completed frontend node is missing ${description}`);
  return value;
}
