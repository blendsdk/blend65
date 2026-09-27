import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { EmbeddedValue } from "../assets/asset-types.js";
import type {
  ConversionKind,
  SemanticBinding,
  SemanticType,
  TypedExpr,
} from "../frontend/semantic-types.js";
import type { ControlFlowBuilder } from "./cfg.js";
import {
  lowerConditional,
  lowerShortCircuit,
  typeBeforeConversion,
  required,
} from "./lower-control.js";
import { CallLowerer } from "./lower-calls.js";
import type {
  AggregateDestination,
  SemanticPlace,
  SemanticPlacePath,
  ValueId,
} from "./operations.js";

/** Narrow the overloaded typed-expression value field to an expression child. */
function expressionValue(expression: TypedExpr): TypedExpr {
  const value = expression.value;
  if (value === null || typeof value !== "object" || !("kind" in value)) {
    throw new Error("Completed assignment expression is missing its value expression");
  }
  return value;
}

/** Conservatively identify later expressions that can change an earlier place value. */
function mayWriteDuringEvaluation(expression: TypedExpr): boolean {
  if (expression.kind === "assignment" || expression.kind === "call") return true;
  if (expression.kind === "array-literal") {
    return (
      (expression.elements ?? []).some(mayWriteDuringEvaluation) ||
      (expression.fill !== null &&
        expression.fill !== undefined &&
        mayWriteDuringEvaluation(expression.fill))
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

/** Direct expression-to-operation lowering for one owning CFG builder. */
export class ExpressionLowerer {
  private readonly calls: CallLowerer;
  private readonly builder: ControlFlowBuilder;
  private readonly bindingsByKey: ReadonlyMap<string, SemanticBinding>;
  private readonly embeddedByBinding: ReadonlyMap<string, EmbeddedValue>;

  /** Bind expression lowering to one function or initializer graph. */
  constructor(
    builder: ControlFlowBuilder,
    bindingsByKey: ReadonlyMap<string, SemanticBinding>,
    embeddedByBinding: ReadonlyMap<string, EmbeddedValue>,
  ) {
    this.calls = new CallLowerer(builder, bindingsByKey, this.lower);
    this.builder = builder;
    this.bindingsByKey = bindingsByKey;
    this.embeddedByBinding = embeddedByBinding;
  }

  /** Lower one expression and then its retained conversion, if any. */
  lower = (expression: TypedExpr, destination?: AggregateDestination): ValueId | null => {
    const value = this.lowerValue(expression, destination);
    const conversion = expression.conversion;
    if (
      value === null ||
      conversion === null ||
      conversion === "identity" ||
      expression.kind === "number" ||
      expression.kind === "boolean" ||
      expression.kind === "sizeof" ||
      expression.kind === "offsetof" ||
      expression.kind === "length"
    ) {
      return value;
    }
    return this.emitConversion(value, conversion, expression);
  };

  /** Lower the expression's own operation without applying an outer conversion. */
  private lowerValue(expression: TypedExpr, destination?: AggregateDestination): ValueId | null {
    const operationType = typeBeforeConversion(expression);
    switch (expression.kind) {
      case "number":
      case "boolean":
      case "sizeof":
      case "offsetof": {
        const constant = expression.constant;
        if (constant === null) throw new Error("Completed constant expression has no value");
        return this.emitConstant(constant, expression.type, expression.span, expression.integer);
      }
      case "length": {
        if (expression.constant !== null) {
          return this.emitConstant(
            expression.constant,
            expression.type,
            expression.span,
            expression.integer,
          );
        }
        const operand = expression.operand;
        const parameter = operand !== undefined && "binding" in operand ? operand.binding : null;
        if (
          parameter === null ||
          operand === undefined ||
          !("outerUnsized" in operand) ||
          !operand.outerUnsized
        ) {
          throw new Error("Runtime array length has no unsized parameter");
        }
        const result = this.builder.nextValue();
        this.builder.emit(
          Object.freeze({
            kind: "array-count",
            result,
            parameter,
            type: expression.type,
            integer: expression.integer,
            span: expression.span,
          }),
        );
        return result;
      }
      case "literal":
        if (expression.encodedBytes !== undefined && typeof expression.constant === "bigint") {
          return this.emitConstant(
            expression.constant,
            operationType,
            expression.span,
            expression.integer,
          );
        }
        throw new Error("Encoded array literal requires aggregate lowering");
      case "name": {
        const binding =
          expression.binding === null
            ? undefined
            : this.bindingsByKey.get(bindingIdentityKey(expression.binding));
        if (
          (operationType.kind === "scalar" || operationType.kind === "enum") &&
          binding?.storage === "constant" &&
          expression.constant !== null
        ) {
          return this.emitConstant(
            expression.constant,
            operationType,
            expression.span,
            expression.integer,
          );
        }
        return this.lowerPlaceValue(expression, operationType);
      }
      case "index":
        return this.lowerPlaceValue(expression, operationType);
      case "member":
        return expression.place === null && typeof expression.constant === "bigint"
          ? this.emitConstant(
              expression.constant,
              operationType,
              expression.span,
              expression.integer,
            )
          : this.lowerPlaceValue(expression, operationType);
      case "unary":
        return this.lowerUnary(expression, operationType);
      case "binary":
        return expression.evaluation === "short-circuit"
          ? lowerShortCircuit(expression, this.builder, this.lower, (value, source) =>
              this.emitConstant(value, source.type, source.span),
            )
          : this.lowerBinary(expression, operationType);
      case "conditional":
        return lowerConditional(expression, this.builder, this.lower);
      case "cast": {
        const operandNode = required(expression.operand, "cast operand");
        if (!("type" in operandNode)) throw new Error("Cast operand is not a typed expression");
        return this.lower(operandNode);
      }
      case "assignment":
        return this.lowerAssignment(expression);
      case "call":
        if (
          typeof expression.constant === "bigint" &&
          (expression.encodedBytes !== undefined ||
            expression.callee?.name === "bcd_add" ||
            expression.callee?.name === "bcd_sub")
        ) {
          return this.emitConstant(
            expression.constant,
            operationType,
            expression.span,
            expression.integer,
          );
        }
        return this.calls.lowerCall(expression, operationType, destination);
      case "array-literal":
      case "struct-literal":
        return this.lowerAggregate(expression, destination);
    }
  }

  /** Emit one immutable constant value. */
  private emitConstant(
    value: bigint | boolean,
    type: SemanticType,
    span: TypedExpr["span"],
    integer: TypedExpr["integer"] = null,
  ): ValueId {
    const result = this.builder.nextValue();
    this.builder.emit(Object.freeze({ kind: "constant", result, value, type, integer, span }));
    return result;
  }

  /** Emit one explicit conversion after its operand. */
  private emitConversion(
    operand: ValueId,
    conversion: ConversionKind,
    expression: TypedExpr,
  ): ValueId {
    const result = this.builder.nextValue();
    this.builder.emit(
      Object.freeze({
        kind: "convert",
        result,
        operand,
        conversion,
        type: expression.type,
        integer: expression.integer,
        span: expression.span,
      }),
    );
    return result;
  }

  /** Evaluate dynamic index components once and freeze a reusable place. */
  private lowerPlace(expression: TypedExpr): SemanticPlace {
    const source = expression.place;
    if (source === null) throw new Error("Completed place expression has no place metadata");
    const root = this.bindingsByKey.get(bindingIdentityKey(source.binding));
    if (root?.type === null || root?.type === undefined) {
      throw new Error("Completed place root has no declared type");
    }
    const path: SemanticPlacePath[] = [];
    for (const component of source.path) {
      if (typeof component === "string") {
        path.push(Object.freeze({ kind: "field", name: component }));
      } else {
        const value = this.lower(component);
        if (value === null) throw new Error("Completed index expression has no value");
        path.push(Object.freeze({ kind: "index", value }));
      }
    }
    const embedded = this.embeddedByBinding.get(bindingIdentityKey(source.binding));
    return Object.freeze({
      root: source.binding,
      ...(embedded === undefined ? {} : { asset: embedded.assetId }),
      rootType: root.type,
      path: Object.freeze(path),
    });
  }

  /** Read a scalar place or retain an aggregate place address. */
  private lowerPlaceValue(
    expression: TypedExpr,
    type: SemanticType,
    captureValue = false,
  ): ValueId {
    const place = this.lowerPlace(expression);
    const result = this.builder.nextValue();
    this.builder.emit(
      Object.freeze({
        kind: type.kind === "array" || type.kind === "struct" ? "place-address" : "load",
        result,
        place,
        ...(captureValue ? { captureValue: true as const } : {}),
        type,
        integer: expression.integer,
        span: expression.span,
      }),
    );
    return result;
  }

  /** Lower one source unary operation. */
  private lowerUnary(expression: TypedExpr, type: SemanticType): ValueId {
    const operandNode = required(expression.operand, "unary operand");
    if (!("type" in operandNode)) throw new Error("Unary operand is not a typed expression");
    const operator = required(expression.operator, "unary operator");
    if (operator === "&") {
      if (
        (type.kind === "function" || type.kind === "interrupt-handler") &&
        operandNode.binding !== null
      ) {
        const result = this.builder.nextValue();
        this.builder.emit(
          Object.freeze({
            kind: "function-address",
            result,
            function: operandNode.binding,
            type,
            integer: null,
            span: expression.span,
          }),
        );
        return result;
      }
      if (operandNode.place === null) {
        throw new Error("Completed address-of operand has no place metadata");
      }
      const embedded = this.embeddedByBinding.get(bindingIdentityKey(operandNode.place.binding));
      const result = this.builder.nextValue();
      if (embedded !== undefined && operandNode.place.path.length === 0) {
        this.builder.emit(
          Object.freeze({
            kind: "embedded-address",
            result,
            asset: embedded.assetId,
            type,
            integer: expression.integer,
            span: expression.span,
          }),
        );
      } else {
        this.builder.emit(
          Object.freeze({
            kind: "place-address",
            result,
            place: this.lowerPlace(operandNode),
            type,
            integer: expression.integer,
            span: expression.span,
          }),
        );
      }
      return result;
    }
    const operand = this.lower(operandNode);
    if (operand === null) throw new Error("Completed unary operand has no value");
    const result = this.builder.nextValue();
    this.builder.emit(
      Object.freeze({
        kind: "unary",
        result,
        operator,
        operand,
        type,
        integer: expression.integer,
        span: expression.span,
      }),
    );
    return result;
  }

  /** Lower an ordinary left-to-right binary expression. */
  private lowerBinary(expression: TypedExpr, type: SemanticType): ValueId {
    const left = this.lower(required(expression.left, "binary left operand"));
    const rightExpression = required(expression.right, "binary right operand");
    const right = this.lower(rightExpression);
    if (left === null || right === null) throw new Error("Completed binary operand has no value");
    // Preserve both operand effects in order, but do not recreate a computation already proved
    // constant by typing. This keeps unused comparisons and their temporaries out of SFA.
    if (expression.constant !== null) {
      return this.emitConstant(expression.constant, type, expression.span, expression.integer);
    }
    const result = this.builder.nextValue();
    this.builder.emit(
      Object.freeze({
        kind: "binary",
        result,
        operator: required(expression.operator, "binary operator"),
        left,
        right,
        rightSpan: rightExpression.span,
        type,
        integer: expression.integer,
        span: expression.span,
      }),
    );
    return result;
  }

  /** Lower simple or compound assignment with one shared evaluated place. */
  private lowerAssignment(expression: TypedExpr, captureValue = false): ValueId {
    const target = required(expression.target, "assignment target");
    const place = this.lowerPlace(target);
    const operator = required(expression.operator, "assignment operator");
    let value: ValueId;
    if (operator === "=") {
      const lowered = this.lower(
        expressionValue(expression),
        expression.type.kind === "array" || expression.type.kind === "struct"
          ? Object.freeze({ kind: "place", place })
          : undefined,
      );
      if (lowered === null) throw new Error("Completed assignment value has no result");
      value = lowered;
    } else {
      const old = this.builder.nextValue();
      this.builder.emit(
        Object.freeze({
          kind: "load",
          result: old,
          place,
          type: target.type,
          integer: target.integer,
          span: target.span,
        }),
      );
      const rightExpression = expressionValue(expression);
      const right = this.lower(rightExpression);
      if (right === null) throw new Error("Completed compound assignment value has no result");
      value = this.builder.nextValue();
      this.builder.emit(
        Object.freeze({
          kind: "binary",
          result: value,
          operator: operator.slice(0, -1),
          left: old,
          right,
          rightSpan: rightExpression.span,
          type: expression.type,
          integer: expression.integer,
          span: expression.span,
        }),
      );
    }
    this.builder.emit(
      Object.freeze({ kind: "store", place, value, type: expression.type, span: expression.span }),
    );
    if (captureValue && (expression.type.kind === "array" || expression.type.kind === "struct")) {
      const captured = this.builder.nextValue();
      this.builder.emit(
        Object.freeze({
          kind: "place-address",
          result: captured,
          place,
          captureValue: true,
          type: expression.type,
          integer: null,
          span: expression.span,
        }),
      );
      return captured;
    }
    return value;
  }

  /** Lower a fixed array or struct literal as one direct aggregate construction. */
  private lowerAggregate(expression: TypedExpr, destination?: AggregateDestination): ValueId {
    const elements =
      expression.kind === "array-literal"
        ? (expression.elements ?? []).map((element) => ({ field: null, expression: element }))
        : (expression.fields ?? []).map(({ name, value }) => ({ field: name, expression: value }));
    // A place-backed member is a value, not a promise to read that place later.
    // Capture it before a following expression can write through the same object.
    const laterMayWrite: boolean[] = new Array(elements.length);
    let followingMayWrite =
      expression.fill === null || expression.fill === undefined
        ? false
        : mayWriteDuringEvaluation(expression.fill);
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      laterMayWrite[index] = followingMayWrite;
      followingMayWrite ||= mayWriteDuringEvaluation(elements[index]!.expression);
    }
    const values = elements.map(({ field, expression: element }, index) => {
      const capture =
        laterMayWrite[index] === true &&
        (element.type.kind === "array" || element.type.kind === "struct") &&
        (((element.kind === "name" || element.kind === "member" || element.kind === "index") &&
          element.place !== null) ||
          element.kind === "assignment");
      const value = capture
        ? element.kind === "assignment"
          ? this.lowerAssignment(element, true)
          : this.lowerPlaceValue(element, element.type, true)
        : this.lower(element);
      if (value === null) throw new Error("Completed aggregate element has no value");
      return Object.freeze({ field, value });
    });
    const fill =
      expression.fill === null || expression.fill === undefined
        ? null
        : this.lower(expression.fill);
    const result = this.builder.nextValue();
    this.builder.emit(
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
}
