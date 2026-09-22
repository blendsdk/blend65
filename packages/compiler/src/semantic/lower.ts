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
import type {
  BlockId,
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

/** Infer the value type before a retained widening or narrowing conversion. */
function typeBeforeConversion(expression: TypedExpr): SemanticType {
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
  lower = (expression: TypedExpr): ValueId | null => {
    const value = this.lowerValue(expression);
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
  private lowerValue(expression: TypedExpr): ValueId | null {
    const operationType = typeBeforeConversion(expression);
    switch (expression.kind) {
      case "number":
      case "boolean":
      case "sizeof":
      case "offsetof":
      case "length": {
        const constant = expression.constant;
        if (constant === null) throw new Error("Completed constant expression has no value");
        return this.emitConstant(constant, expression.type, expression.span, expression.integer);
      }
      case "literal":
        throw new Error("Unencoded literals cannot enter completed semantic lowering");
      case "name":
      case "index":
      case "member":
        return this.lowerPlaceValue(expression, operationType);
      case "unary":
        return this.lowerUnary(expression, operationType);
      case "binary":
        return expression.evaluation === "short-circuit"
          ? this.lowerShortCircuit(expression)
          : this.lowerBinary(expression, operationType);
      case "conditional":
        return this.lowerConditional(expression);
      case "cast": {
        const operandNode = required(expression.operand, "cast operand");
        if (!("type" in operandNode)) throw new Error("Cast operand is not a typed expression");
        return this.lower(operandNode);
      }
      case "assignment":
        return this.lowerAssignment(expression);
      case "call":
        return this.lowerCall(expression, operationType);
      case "array-literal":
      case "struct-literal":
        return this.lowerAggregate(expression);
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
  private lowerPlaceValue(expression: TypedExpr, type: SemanticType): ValueId {
    const place = this.lowerPlace(expression);
    const result = this.builder.nextValue();
    this.builder.emit(
      Object.freeze({
        kind: type.kind === "scalar" ? "load" : "place-address",
        result,
        place,
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
    const right = this.lower(required(expression.right, "binary right operand"));
    if (left === null || right === null) throw new Error("Completed binary operand has no value");
    const result = this.builder.nextValue();
    this.builder.emit(
      Object.freeze({
        kind: "binary",
        result,
        operator: required(expression.operator, "binary operator"),
        left,
        right,
        type,
        integer: expression.integer,
        span: expression.span,
      }),
    );
    return result;
  }

  /** Lower Boolean short circuit with no operations in the bypassed right arm. */
  private lowerShortCircuit(expression: TypedExpr): ValueId {
    const leftNode = required(expression.left, "logical left operand");
    const rightNode = required(expression.right, "logical right operand");
    const left = this.lower(leftNode);
    if (left === null) throw new Error("Completed logical left operand has no value");
    const operator = required(expression.operator, "logical operator");
    if (typeof leftNode.constant === "boolean") {
      const evaluateRight = operator === "&&" ? leftNode.constant : !leftNode.constant;
      if (evaluateRight) {
        const right = this.lower(rightNode);
        if (right === null) throw new Error("Completed logical right operand has no value");
        return right;
      }
      return this.emitConstant(leftNode.constant, expression.type, expression.span);
    }

    const conditionBlock = this.builder.currentBlock!;
    const selected = this.builder.createBlock("logical-selected");
    const bypassed = this.builder.createBlock("logical-bypassed");
    conditionBlock.terminator = Object.freeze({
      kind: "branch",
      condition: left,
      whenTrue: operator === "&&" ? selected.id : bypassed.id,
      whenFalse: operator === "&&" ? bypassed.id : selected.id,
    });

    this.builder.select(selected);
    const selectedValue = this.lower(rightNode);
    if (selectedValue === null) throw new Error("Completed logical right operand has no value");
    const selectedExit = this.builder.currentBlock!;
    this.builder.select(bypassed);
    const bypassValue = this.emitConstant(operator === "||", expression.type, expression.span);
    const bypassExit = this.builder.currentBlock!;

    const merge = this.builder.createBlock("logical-end");
    this.builder.jumpFrom(selectedExit, merge.id);
    this.builder.jumpFrom(bypassExit, merge.id);
    this.builder.select(merge);
    return this.emitMerge(expression, [
      { block: selectedExit.id, value: selectedValue },
      { block: bypassExit.id, value: bypassValue },
    ]);
  }

  /** Lower a selected-arm expression to two exclusive blocks and one merge. */
  private lowerConditional(expression: TypedExpr): ValueId {
    const conditionNode = required(expression.condition, "conditional condition");
    const condition = this.lower(conditionNode);
    if (condition === null) throw new Error("Completed conditional test has no value");
    const whenTrueNode = required(expression.whenTrue, "conditional true arm");
    const whenFalseNode = required(expression.whenFalse, "conditional false arm");
    if (typeof conditionNode.constant === "boolean") {
      const value = this.lower(conditionNode.constant ? whenTrueNode : whenFalseNode);
      if (value === null) throw new Error("Completed conditional arm has no value");
      return value;
    }

    const conditionBlock = this.builder.currentBlock!;
    const whenTrue = this.builder.createBlock("conditional-true");
    const whenFalse = this.builder.createBlock("conditional-false");
    conditionBlock.terminator = Object.freeze({
      kind: "branch",
      condition,
      whenTrue: whenTrue.id,
      whenFalse: whenFalse.id,
    });

    this.builder.select(whenTrue);
    const trueValue = this.lower(whenTrueNode);
    if (trueValue === null) throw new Error("Completed true arm has no value");
    const trueExit = this.builder.currentBlock!;
    this.builder.select(whenFalse);
    const falseValue = this.lower(whenFalseNode);
    if (falseValue === null) throw new Error("Completed false arm has no value");
    const falseExit = this.builder.currentBlock!;

    const merge = this.builder.createBlock("conditional-end");
    this.builder.jumpFrom(trueExit, merge.id);
    this.builder.jumpFrom(falseExit, merge.id);
    this.builder.select(merge);
    return this.emitMerge(expression, [
      { block: trueExit.id, value: trueValue },
      { block: falseExit.id, value: falseValue },
    ]);
  }

  /** Emit one merge for values defined by mutually exclusive predecessor blocks. */
  private emitMerge(
    expression: TypedExpr,
    incoming: readonly { readonly block: BlockId; readonly value: ValueId }[],
  ): ValueId {
    const result = this.builder.nextValue();
    this.builder.emit(
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

  /** Lower simple or compound assignment with one shared evaluated place. */
  private lowerAssignment(expression: TypedExpr): ValueId {
    const target = required(expression.target, "assignment target");
    const place = this.lowerPlace(target);
    const operator = required(expression.operator, "assignment operator");
    let value: ValueId;
    if (operator === "=") {
      const lowered = this.lower(expressionValue(expression));
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
      const right = this.lower(expressionValue(expression));
      if (right === null) throw new Error("Completed compound assignment value has no result");
      value = this.builder.nextValue();
      this.builder.emit(
        Object.freeze({
          kind: "binary",
          result: value,
          operator: operator.slice(0, -1),
          left: old,
          right,
          type: expression.type,
          integer: expression.integer,
          span: expression.span,
        }),
      );
    }
    this.builder.emit(
      Object.freeze({ kind: "store", place, value, type: expression.type, span: expression.span }),
    );
    return value;
  }

  /** Lower raw-memory, profile, or ordinary direct calls after source-ordered arguments. */
  private lowerCall(expression: TypedExpr, type: SemanticType): ValueId | null {
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
          type,
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
  private lowerAggregate(expression: TypedExpr): ValueId {
    const elements =
      expression.kind === "array-literal"
        ? (expression.elements ?? []).map((element) => ({ field: null, expression: element }))
        : (expression.fields ?? []).map(({ name, value }) => ({ field: name, expression: value }));
    const values = elements.map(({ field, expression: element }) => {
      const value = this.lower(element);
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
        return Object.freeze({ id: binding.id, type: binding.type });
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
  });
}

/** Encode one complete compile-time initializer in packed little-endian layout order. */
function initializerBytes(expression: TypedExpr, type: SemanticType): readonly number[] | null {
  if (type.kind === "scalar") {
    if (expression.constant === null || type.name === "void") return null;
    const bytes = type.name === "word" || type.name === "sword" ? 2 : 1;
    const value =
      typeof expression.constant === "boolean"
        ? expression.constant
          ? 1n
          : 0n
        : BigInt.asUintN(bytes * 8, expression.constant);
    return Object.freeze(
      Array.from({ length: bytes }, (_, offset) => Number((value >> BigInt(offset * 8)) & 0xffn)),
    );
  }
  if (type.kind === "struct") {
    if (expression.kind !== "struct-literal" || expression.fields === undefined) return null;
    const bytes: number[] = [];
    for (const field of type.fields) {
      const value = expression.fields.find((candidate) => candidate.name === field.name)?.value;
      if (value === undefined) return null;
      const encoded = initializerBytes(value, field.type);
      if (encoded === null) return null;
      bytes.push(...encoded);
    }
    return Object.freeze(bytes);
  }
  if (expression.kind !== "array-literal" || expression.elements === undefined) return null;
  const values = [...expression.elements];
  while (values.length < type.length) {
    if (expression.fill === undefined || expression.fill === null) return null;
    values.push(expression.fill);
  }
  if (values.length !== type.length) return null;
  const bytes: number[] = [];
  for (const value of values) {
    const encoded = initializerBytes(value, type.element);
    if (encoded === null) return null;
    bytes.push(...encoded);
  }
  return Object.freeze(bytes);
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
      entry: null,
      blocks: Object.freeze([]),
      source: declaration.binding.span,
    });
  }
  const builder = new ControlFlowBuilder(`initializer:${bindingIdentityKey(declaration.binding)}`);
  const expressions = new ExpressionLowerer(builder, bindingsByKey, embeddedByBinding);
  const value = expressions.lower(declaration.initializer);
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
    initialBytes: initializerBytes(declaration.initializer, declaration.type),
    entry: builder.entry,
    blocks,
    source: declaration.binding.span,
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
