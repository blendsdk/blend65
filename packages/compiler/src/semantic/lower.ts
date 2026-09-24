import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { EmbeddedValue } from "../assets/asset-types.js";
import type {
  ConversionKind,
  SemanticBinding,
  SemanticType,
  TypedDeclaration,
  TypedExpr,
} from "../frontend/semantic-types.js";
import type { AnalysisResult } from "../frontend/service.js";
import { ControlFlowBuilder } from "./cfg.js";
import { lowerConditional, lowerShortCircuit, typeBeforeConversion } from "./lower-control.js";
import { initializerBytes } from "./lower-data.js";
import type {
  AggregateDestination,
  ArrayCountSource,
  SemanticFunction,
  SemanticGlobal,
  SemanticPlace,
  SemanticPlacePath,
  SemanticProgram,
  StorageValue,
  ValueId,
} from "./operations.js";

/** Complete semantic construction or an unchanged frontend failure state. */
export type SemanticBuildResult =
  | { readonly kind: "complete"; readonly program: SemanticProgram }
  | Extract<AnalysisResult, { readonly kind: "error" | "incomplete" }>;

/** Fail loudly when a completed frontend node is missing one of its required fields. */
function required<T>(value: T | undefined, description: string): T {
  if (value === undefined) throw new Error(`Completed frontend node is missing ${description}`);
  return value;
}

/** Narrow the overloaded typed-expression value field to an expression child. */
function expressionValue(expression: TypedExpr): TypedExpr {
  const value = expression.value;
  if (value === null || typeof value !== "object" || !("kind" in value)) {
    throw new Error("Completed assignment expression is missing its value expression");
  }
  return value;
}

/** Return whether a scalar type is the language's void type. */
function isVoid(type: SemanticType): boolean {
  return type.kind === "scalar" && type.name === "void";
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
class ExpressionLowerer {
  private readonly builder: ControlFlowBuilder;
  private readonly bindingsByKey: ReadonlyMap<string, SemanticBinding>;
  private readonly embeddedByBinding: ReadonlyMap<string, EmbeddedValue>;

  /** Bind expression lowering to one function or initializer graph. */
  constructor(
    builder: ControlFlowBuilder,
    bindingsByKey: ReadonlyMap<string, SemanticBinding>,
    embeddedByBinding: ReadonlyMap<string, EmbeddedValue>,
  ) {
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
        if (expression.encodedBytes !== undefined && typeof expression.constant === "bigint") {
          return this.emitConstant(
            expression.constant,
            operationType,
            expression.span,
            expression.integer,
          );
        }
        return this.lowerCall(expression, operationType, destination);
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
    return Object.freeze({
      root: source.binding,
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
        kind: type.kind === "scalar" || type.kind === "enum" ? "load" : "place-address",
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

  /** Lower raw-memory, profile, or ordinary direct calls after source-ordered arguments. */
  private lowerCall(
    expression: TypedExpr,
    type: SemanticType,
    destination?: AggregateDestination,
  ): ValueId | null {
    if (expression.embedded !== undefined) {
      const result = this.builder.nextValue();
      this.builder.emit(
        Object.freeze({
          kind: "embedded-address",
          result,
          asset: expression.embedded.assetId,
          type,
          integer: expression.integer,
          span: expression.span,
        }),
      );
      return result;
    }
    const arguments_ = (expression.arguments ?? []).map((argument) => {
      const value = this.lower(argument);
      if (value === null) throw new Error("Completed call argument has no value");
      return value;
    });
    if (expression.memory !== null && expression.memory !== undefined) {
      return this.lowerMemory(expression, type, arguments_);
    }

    const callee = required(expression.callee, "call target");
    if (callee.binding === null) {
      if ((callee.name === "lo" || callee.name === "hi") && arguments_.length === 1) {
        const result = this.builder.nextValue();
        this.builder.emit(
          Object.freeze({
            kind: "unary",
            result,
            operator: callee.name,
            operand: arguments_[0]!,
            type,
            integer: expression.integer,
            span: expression.span,
          }),
        );
        return result;
      }
      throw new Error("Completed direct call has no resolved callee");
    }
    const binding = this.bindingsByKey.get(bindingIdentityKey(callee.binding));
    const argumentArrayCounts: (ArrayCountSource | null)[] = (expression.arguments ?? []).map(
      (argument, index) => {
        const parameter = expression.signature?.parameters[index];
        if (!parameter?.outerUnsized) return null;
        if (argument.outerUnsized) {
          if (argument.binding === null || argument.binding === undefined) {
            throw new Error("Forwarded unsized array has no parameter binding");
          }
          return Object.freeze({ kind: "parameter" as const, binding: argument.binding });
        }
        if (argument.type.kind !== "array")
          throw new Error("Unsized array argument has no array extent");
        return Object.freeze({ kind: "fixed" as const, count: argument.type.length });
      },
    );
    const result = isVoid(type) ? null : this.builder.nextValue();
    if (binding?.operationEffect !== undefined) {
      this.builder.emit(
        Object.freeze({
          kind: "platform",
          result,
          capability: binding.qualifiedName ?? binding.name,
          arguments: Object.freeze(arguments_),
          type,
          effect: binding.operationEffect,
          span: expression.span,
        }),
      );
    } else {
      this.builder.emit(
        Object.freeze({
          kind: "call",
          result,
          callee: callee.binding,
          arguments: Object.freeze(arguments_),
          ...(argumentArrayCounts.some((count) => count !== null)
            ? { argumentArrayCounts: Object.freeze(argumentArrayCounts) }
            : {}),
          type,
          ...(destination === undefined ? {} : { aggregateDestination: destination }),
          span: expression.span,
        }),
      );
    }
    return result;
  }

  /** Emit one volatile raw-memory access from already evaluated operands. */
  private lowerMemory(
    expression: TypedExpr,
    type: SemanticType,
    arguments_: readonly ValueId[],
  ): ValueId | null {
    const memory = expression.memory!;
    const address = arguments_[0];
    if (address === undefined) throw new Error("Raw-memory operation is missing its address");
    if (memory.access === "read") {
      const result = this.builder.nextValue();
      this.builder.emit(
        Object.freeze({
          kind: "memory-read",
          result,
          address,
          width: memory.width,
          byteOrder: memory.byteOrder,
          volatile: true,
          type,
          integer: expression.integer,
          span: expression.span,
        }),
      );
      return result;
    }
    const value = arguments_[1];
    if (value === undefined) throw new Error("Raw-memory write is missing its value");
    this.builder.emit(
      Object.freeze({
        kind: "memory-write",
        address,
        value,
        width: memory.width,
        byteOrder: memory.byteOrder,
        volatile: true,
        span: expression.span,
      }),
    );
    return null;
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

/** Create the source-order parameter list for one function declaration. */
function functionParameters(
  declaration: TypedDeclaration,
  bindings: readonly SemanticBinding[],
): readonly StorageValue[] {
  return Object.freeze(
    bindings
      .filter(
        (binding) =>
          binding.storage === "parameter" &&
          binding.id.sourceId === declaration.binding.sourceId &&
          binding.declaration.start >= declaration.binding.span.start &&
          binding.declaration.end <= declaration.binding.span.end &&
          binding.type !== null,
      )
      .sort((left, right) => left.declaration.start - right.declaration.start)
      .map((binding) => {
        if (binding.type === null) throw new Error("Completed parameter has no type");
        return Object.freeze({
          id: binding.id,
          type: binding.type,
          ...(binding.outerUnsized ? { outerUnsized: true as const } : {}),
        });
      }),
  );
}

/** Lower one completed function declaration. */
function lowerFunction(
  declaration: TypedDeclaration,
  bindings: readonly SemanticBinding[],
  bindingsByKey: ReadonlyMap<string, SemanticBinding>,
  embeddedByBinding: ReadonlyMap<string, EmbeddedValue>,
): SemanticFunction {
  if (declaration.body === null) throw new Error("Cannot lower a non-function as a function");
  const builder = new ControlFlowBuilder(`function:${bindingIdentityKey(declaration.binding)}`);
  const expressions = new ExpressionLowerer(builder, bindingsByKey, embeddedByBinding);
  builder.lowerBody(declaration.body, expressions.lower);
  const blocks = Object.freeze(
    builder.finish(declaration.type).map((block) =>
      Object.freeze({
        ...block,
        operations: Object.freeze(
          block.operations.map((operation) => {
            if (
              operation.kind !== "load" &&
              operation.kind !== "store" &&
              operation.kind !== "place-address"
            ) {
              return operation;
            }
            if (operation.place.rootType !== undefined) return operation;
            const placeRoot = bindingsByKey.get(bindingIdentityKey(operation.place.root));
            if (placeRoot?.type === null || placeRoot?.type === undefined) {
              throw new Error("Completed place root has no declared type");
            }
            return Object.freeze({
              ...operation,
              place: Object.freeze({ ...operation.place, rootType: placeRoot.type }),
            });
          }),
        ),
      }),
    ),
  );
  const binding = bindingsByKey.get(bindingIdentityKey(declaration.binding));
  if (binding === undefined) throw new Error("Completed function has no retained binding");
  return Object.freeze({
    id: declaration.binding,
    name: binding.qualifiedName ?? binding.name,
    parameters: functionParameters(declaration, bindings),
    result: declaration.type,
    entry: builder.entry,
    blocks,
    source: declaration.binding.span,
    ...(declaration.placement ? { placement: declaration.placement } : {}),
  });
}

/** Lower one completed module or constant declaration. */
function lowerGlobal(
  declaration: TypedDeclaration,
  binding: SemanticBinding,
  bindingsByKey: ReadonlyMap<string, SemanticBinding>,
  embeddedByBinding: ReadonlyMap<string, EmbeddedValue>,
): SemanticGlobal {
  if (binding.storage !== "module" && binding.storage !== "constant") {
    throw new Error("Completed global has a non-global storage class");
  }
  if (declaration.initializer === null) {
    return Object.freeze({
      id: declaration.binding,
      storage: binding.storage,
      type: declaration.type,
      initialBytes: null,
      runtimeInitialBytes: null,
      entry: null,
      blocks: Object.freeze([]),
      source: declaration.binding.span,
      ...(declaration.placement ? { placement: declaration.placement } : {}),
      ...(declaration.zeropage ? { zeropage: true } : {}),
    });
  }
  if (binding.storage === "constant") {
    return Object.freeze({
      id: declaration.binding,
      storage: binding.storage,
      type: declaration.type,
      initialBytes:
        (declaration.type.kind === "scalar" || declaration.type.kind === "enum") &&
        !declaration.placement
          ? null
          : initializerBytes(declaration.initializer, declaration.type),
      runtimeInitialBytes: null,
      entry: null,
      blocks: Object.freeze([]),
      source: declaration.binding.span,
      ...(declaration.placement ? { placement: declaration.placement } : {}),
      ...(declaration.zeropage ? { zeropage: true } : {}),
    });
  }
  const builder = new ControlFlowBuilder(`initializer:${bindingIdentityKey(declaration.binding)}`);
  const expressions = new ExpressionLowerer(builder, bindingsByKey, embeddedByBinding);
  const destination: AggregateDestination | undefined =
    declaration.type.kind === "array" || declaration.type.kind === "struct"
      ? Object.freeze({
          kind: "place",
          place: Object.freeze({
            root: declaration.binding,
            rootType: declaration.type,
            path: Object.freeze([]),
          }),
        })
      : undefined;
  const value = expressions.lower(declaration.initializer, destination);
  if (value === null) throw new Error("Completed module initializer did not produce a value");
  builder.emit(
    Object.freeze({
      kind: "store",
      place: Object.freeze({
        root: binding.id,
        rootType: declaration.type,
        path: Object.freeze([]),
      }),
      value,
      type: declaration.type,
      span: declaration.initializer.span,
    }),
  );
  const blocks = builder.finish(Object.freeze({ kind: "scalar", name: "void" }));
  return Object.freeze({
    id: declaration.binding,
    storage: binding.storage,
    type: declaration.type,
    initialBytes: null,
    runtimeInitialBytes: initializerBytes(declaration.initializer, declaration.type),
    entry: builder.entry,
    blocks,
    source: declaration.binding.span,
    ...(declaration.placement ? { placement: declaration.placement } : {}),
    ...(declaration.zeropage ? { zeropage: true } : {}),
  });
}

/** Build the target-neutral semantic program only from a complete frontend result. */
export function buildSemanticProgram(analysis: AnalysisResult): SemanticBuildResult {
  if (analysis.kind !== "complete") return analysis;
  const frontend = analysis.program;
  const bindingsByKey = new Map(
    frontend.bindings.map((binding) => [bindingIdentityKey(binding.id), binding] as const),
  );
  const embeddedByBinding = new Map(
    frontend.declarations.flatMap((declaration) =>
      declaration.initializer?.embedded === undefined
        ? []
        : [[bindingIdentityKey(declaration.binding), declaration.initializer.embedded] as const],
    ),
  );
  const embeddedBindings = new Set(embeddedByBinding.keys());
  const mainCandidates = frontend.bindings.filter(
    (binding) => binding.storage === "function" && binding.name === "main",
  );
  if (mainCandidates.length !== 1) {
    throw new Error("Completed frontend program must contain exactly one selected main function");
  }

  const functions: SemanticFunction[] = [];
  const globals: SemanticGlobal[] = [];
  for (const declaration of frontend.declarations) {
    const binding = bindingsByKey.get(bindingIdentityKey(declaration.binding));
    if (binding === undefined) throw new Error("Completed declaration has no retained binding");
    if (declaration.body !== null) {
      functions.push(
        lowerFunction(declaration, frontend.bindings, bindingsByKey, embeddedByBinding),
      );
    } else if (
      (binding.storage === "module" || binding.storage === "constant") &&
      !declaration.loadable &&
      !embeddedBindings.has(bindingIdentityKey(declaration.binding))
    ) {
      globals.push(lowerGlobal(declaration, binding, bindingsByKey, embeddedByBinding));
    }
  }
  return Object.freeze({
    kind: "complete",
    program: Object.freeze({
      main: mainCandidates[0]!.id,
      globals: Object.freeze(globals),
      functions: Object.freeze(functions),
      effects: frontend.effects,
      assets: frontend.assets,
      initializerOrder: Object.freeze(
        frontend.initializerOrder.filter(
          (binding) => !embeddedBindings.has(bindingIdentityKey(binding)),
        ),
      ),
    }),
  });
}
