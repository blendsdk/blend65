import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticBinding, TypedExpr } from "../frontend/semantic-types.js";
import { SCALAR_TYPES } from "../frontend/constants.js";
import type { ControlFlowBuilder, LowerSemanticExpression } from "./cfg.js";
import type { AggregateDestination, SemanticPlacePath, ValueId } from "./operations.js";

/** A constant's namespace/enum qualifier cannot hide an evaluated object or call. */
function isStaticQualifier(expression: TypedExpr | undefined): boolean {
  if (expression === undefined) return true;
  if (expression.memory != null) return false;
  return (
    expression.kind === "name" ||
    (expression.kind === "member" &&
      expression.place === null &&
      isStaticQualifier(expression.object))
  );
}

/**
 * Prove the complete literal before forwarding any child into its final local home.
 * Known values alone are insufficient: calls, assignments, addresses and volatile
 * expressions must stay on the ordinary evaluation/capture path. This walk uses
 * completed frontend constants; it does not evaluate source expressions itself.
 */
export function isConstantAggregateLiteral(
  expression: TypedExpr,
  bindings: ReadonlyMap<string, SemanticBinding>,
): boolean {
  if (expression.memory != null) return false;
  if (expression.kind === "array-literal") {
    const fill = expression.fill;
    return (
      (expression.elements ?? []).every((child) => isConstantAggregateLiteral(child, bindings)) &&
      (fill == null ||
        ((fill.type.kind === "scalar" || fill.type.kind === "enum") &&
          isConstantAggregateLiteral(fill, bindings)))
    );
  }
  if (expression.kind === "struct-literal") {
    return (expression.fields ?? []).every(({ value }) =>
      isConstantAggregateLiteral(value, bindings),
    );
  }
  if (
    (expression.type.kind !== "scalar" && expression.type.kind !== "enum") ||
    expression.constant === null
  )
    return false;
  switch (expression.kind) {
    case "number":
    case "boolean":
    case "sizeof":
    case "offsetof":
    case "literal":
      return true;
    case "length":
      return (
        expression.operand === undefined ||
        !("type" in expression.operand) ||
        expression.operand.kind === "name"
      );
    case "name":
      return (
        expression.binding !== null &&
        bindings.get(bindingIdentityKey(expression.binding))?.storage === "constant"
      );
    case "member":
      return expression.place === null && isStaticQualifier(expression.object);
    case "unary":
    case "cast":
      return (
        expression.operator !== "&" &&
        expression.operand !== undefined &&
        "type" in expression.operand &&
        isConstantAggregateLiteral(expression.operand, bindings)
      );
    case "binary":
      return (
        expression.left !== undefined &&
        expression.right !== undefined &&
        isConstantAggregateLiteral(expression.left, bindings) &&
        isConstantAggregateLiteral(expression.right, bindings)
      );
    case "conditional":
      return (
        expression.condition !== undefined &&
        expression.whenTrue !== undefined &&
        expression.whenFalse !== undefined &&
        isConstantAggregateLiteral(expression.condition, bindings) &&
        isConstantAggregateLiteral(expression.whenTrue, bindings) &&
        isConstantAggregateLiteral(expression.whenFalse, bindings)
      );
    default:
      return false;
  }
}

/** Conservatively identify later expressions that can change an earlier place value. */
function mayWriteDuringEvaluation(expression: TypedExpr): boolean {
  if (expression.kind === "assignment" || expression.kind === "call") return true;
  if (expression.kind === "array-literal") {
    return (
      (expression.elements ?? []).some(mayWriteDuringEvaluation) ||
      (expression.fill != null && mayWriteDuringEvaluation(expression.fill))
    );
  }
  if (expression.kind === "struct-literal") {
    return (expression.fields ?? []).some(({ value }) => mayWriteDuringEvaluation(value));
  }
  if (expression.kind === "binary") {
    return (
      (expression.left !== undefined && mayWriteDuringEvaluation(expression.left)) ||
      (expression.right !== undefined && mayWriteDuringEvaluation(expression.right))
    );
  }
  if (expression.kind === "conditional") {
    return (
      (expression.condition !== undefined && mayWriteDuringEvaluation(expression.condition)) ||
      (expression.whenTrue !== undefined && mayWriteDuringEvaluation(expression.whenTrue)) ||
      (expression.whenFalse !== undefined && mayWriteDuringEvaluation(expression.whenFalse))
    );
  }
  if (expression.kind === "index") {
    return (
      (expression.object !== undefined && mayWriteDuringEvaluation(expression.object)) ||
      (expression.index !== undefined && mayWriteDuringEvaluation(expression.index))
    );
  }
  if (expression.kind === "member") {
    return expression.object !== undefined && mayWriteDuringEvaluation(expression.object);
  }
  const operand = expression.operand;
  return operand !== undefined && "type" in operand && mayWriteDuringEvaluation(operand);
}

/**
 * Lower literal members in source order, capturing earlier values before later writes.
 * A declaration's whole-tree proof permits child construction in a fixed subplace;
 * every other literal retains ordinary value/capture lowering. The proof is inherited,
 * not recomputed for each nested child, so deeply nested pure literals are walked once.
 */
export function lowerAggregateLiteral(
  expression: TypedExpr,
  destination: AggregateDestination | undefined,
  builder: ControlFlowBuilder,
  lower: LowerSemanticExpression,
  captureValue: (expression: TypedExpr) => ValueId,
): ValueId {
  const elements =
    expression.kind === "array-literal"
      ? (expression.elements ?? []).map((element) => ({ field: null, expression: element }))
      : (expression.fields ?? []).map(({ name, value }) => ({ field: name, expression: value }));
  const fresh = destination?.kind === "place" && destination.freshConstant === true;
  /** Use completed typed values only after the entire tree's no-effect proof. */
  const lowerMember: LowerSemanticExpression = (member, childDestination) => {
    if (
      fresh &&
      member.constant !== null &&
      (member.type.kind === "scalar" || member.type.kind === "enum")
    ) {
      const result = builder.nextValue();
      builder.emit(
        Object.freeze({
          kind: "constant",
          result,
          value: member.constant,
          type: member.type,
          integer: member.integer,
          span: member.span,
        }),
      );
      return result;
    }
    return lower(member, childDestination);
  };
  const laterMayWrite = new Array<boolean>(elements.length).fill(false);
  if (!fresh) {
    let followingMayWrite =
      expression.fill == null ? false : mayWriteDuringEvaluation(expression.fill);
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      laterMayWrite[index] = followingMayWrite;
      followingMayWrite ||= mayWriteDuringEvaluation(elements[index]!.expression);
    }
  }
  const values = elements.map(({ field, expression: element }, index) => {
    let childDestination: AggregateDestination | undefined;
    if (
      fresh &&
      destination.kind === "place" &&
      (element.type.kind === "array" || element.type.kind === "struct")
    ) {
      let selection: SemanticPlacePath;
      if (field === null) {
        const ordinal = builder.nextValue();
        builder.emit(
          Object.freeze({
            kind: "constant",
            result: ordinal,
            value: BigInt(index),
            type: SCALAR_TYPES.word,
            integer: null,
            span: element.span,
          }),
        );
        selection = Object.freeze({ kind: "index", value: ordinal });
      } else {
        selection = Object.freeze({ kind: "field", name: field });
      }
      childDestination = Object.freeze({
        kind: "place",
        freshConstant: true,
        place: Object.freeze({
          ...destination.place,
          path: Object.freeze([...destination.place.path, selection]),
        }),
      });
    }
    const capture =
      laterMayWrite[index] === true &&
      (element.type.kind === "array" || element.type.kind === "struct") &&
      (((element.kind === "name" || element.kind === "member" || element.kind === "index") &&
        element.place !== null) ||
        element.kind === "assignment");
    const value = capture ? captureValue(element) : lowerMember(element, childDestination);
    if (value === null) throw new Error("Completed aggregate element has no value");
    return Object.freeze({ field, value });
  });
  const fill = expression.fill == null ? null : lowerMember(expression.fill);
  const result = builder.nextValue();
  builder.emit(
    Object.freeze({
      kind: "aggregate",
      result,
      elements: Object.freeze(values),
      fill,
      type: expression.type,
      ...(destination === undefined ? {} : { destination }),
      integer: null,
      span: expression.span,
    }),
  );
  return result;
}
