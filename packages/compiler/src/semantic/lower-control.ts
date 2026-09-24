import type { SemanticType, TypedExpr } from "../frontend/semantic-types.js";
import type { ControlFlowBuilder } from "./cfg.js";
import type { BlockId, ValueId } from "./operations.js";

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
