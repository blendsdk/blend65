import { projectDiagnostic } from "../project/diagnostics.js";
import {
  createScalarTypedExpression,
  integerFacts,
  isIntegerType,
  SCALAR_TYPES,
} from "./constants.js";
import { clearCallVisibleScalarFacts } from "./flow-facts.js";
import {
  analyzeEncodedLiteral,
  analyzeEncodingCall,
  analyzeStringArrayLiteral,
} from "./encoded-literals.js";
import {
  AggregateRegistry,
  semanticTypeName,
  semanticTypesEqual,
  semanticTypeSize,
} from "./aggregate-types.js";
import { functionSignatureDifference } from "./semantic-type-relations.js";
export {
  AggregateRegistry,
  semanticTypeName,
  semanticTypesEqual,
  semanticTypeSize,
} from "./aggregate-types.js";
import type {
  ArrayType,
  FunctionSignature,
  ScalarExpressionContext,
  ScalarExpressionHost,
  ScalarExpressionResult,
  SemanticType,
  StructType,
  TypedExpr,
} from "./semantic-types.js";
import type { Expr } from "./syntax.js";

/** Recursive expression callback supplied by the existing expression analyzer. */
export type AnalyzeExpression = (
  expression: Expr,
  expected: SemanticType | null,
  context: ScalarExpressionContext,
) => ScalarExpressionResult;

/** Apply an aggregate declaration, argument, or return context. */
export function applyExpectedAggregate(
  result: ScalarExpressionResult,
  expected: SemanticType,
  expression: Expr,
  host: ScalarExpressionHost,
): ScalarExpressionResult {
  const node = result.node;
  if (node === null) return result;
  if (node.outerUnsized) {
    host.diagnose(
      projectDiagnostic(
        "E10253",
        "An unsized array parameter is a borrow, not a complete fixed-array value",
        expression.span,
      ),
    );
    return { node: null, exact: result.exact };
  }
  if (semanticTypesEqual(node.type, expected)) {
    return {
      node: node.type === expected ? node : Object.freeze({ ...node, type: expected }),
      exact: result.exact,
    };
  }
  host.diagnose(
    projectDiagnostic(
      "E10080",
      node.type.kind === "function" && expected.kind === "function"
        ? `Function signatures differ at ${functionSignatureDifference(node.type, expected)} — no cast can repair the signature`
        : `Cannot implicitly convert '${semanticTypeName(node.type)}' to '${semanticTypeName(expected)}'`,
      expression.span,
    ),
  );
  return { node: null, exact: result.exact };
}

/**
 * Analyze the aggregate, query, and built-in expressions layered onto the scalar
 * expression recursion. Null means the expression belongs to scalar handling.
 */
export function analyzeAggregateExpression(
  expression: Expr,
  expected: SemanticType | null,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  registry: AggregateRegistry,
  analyze: AnalyzeExpression,
): ScalarExpressionResult | null {
  if (expression.kind === "literal") {
    return analyzeEncodedLiteral(
      expression,
      expected,
      "screen_codes",
      "upper_graphics",
      host,
      registry,
    );
  }
  if (expression.kind === "call" && expression.callee.kind === "name") {
    const name = expression.callee.name;
    if (name === "screen_codes" || name === "petscii") {
      return analyzeEncodingCall(expression, expected, name, host, registry);
    }
    if (name === "atascii" || name === "internal_codes") {
      host.diagnose(
        projectDiagnostic(
          "E10125",
          `Encoding '${name}' is unavailable for the selected C64 profile`,
          expression.callee.span,
        ),
      );
      return { node: null, exact: null };
    }
  }
  if (expression.kind === "array-literal") {
    return expected?.kind === "array"
      ? analyzeArrayLiteral(expression, expected, context, host, analyze)
      : deferAggregateLiteral(expression, host, "Array literal requires a fixed array context");
  }
  if (expression.kind === "struct-literal") {
    return expected?.kind === "struct"
      ? analyzeStructLiteral(expression, expected, context, host, analyze)
      : deferAggregateLiteral(expression, host, "Struct literal requires a nominal struct context");
  }
  if (expression.kind === "member") return analyzeMember(expression, context, host, analyze);
  if (expression.kind === "index") return analyzeIndex(expression, context, host, analyze);
  if (expression.kind === "sizeof") {
    if (expression.operand.kind === "array-type" && expression.operand.extent === null) {
      host.diagnose(
        projectDiagnostic(
          "E10266",
          `'sizeof' requires a fixed-size type — unsized array type '${host.sourceText(expression.operand.span)}' has no standalone extent`,
          expression.operand.span,
        ),
      );
      return { node: null, exact: null };
    }
    const operandType = registry.resolveType(expression.operand, context.module, null, true);
    if (operandType === null) return { node: null, exact: null };
    const constant = BigInt(semanticTypeSize(operandType));
    return {
      node: createScalarTypedExpression(expression, SCALAR_TYPES.word, constant, {
        operand: expression.operand,
        operandType,
      }),
      exact: constant,
    };
  }
  if (expression.kind === "offsetof") {
    const operandType = registry.resolveType(expression.operand, context.module, null, true);
    if (operandType === null) return { node: null, exact: null };
    if (operandType.kind !== "struct") {
      host.diagnose(
        projectDiagnostic(
          "E10201",
          `'offsetof' requires a struct type — found '${semanticTypeName(operandType)}'`,
          expression.operand.span,
        ),
      );
      return { node: null, exact: null };
    }
    const field = operandType.fields.find(({ name }) => name === expression.field);
    if (field === undefined) {
      host.diagnose(
        projectDiagnostic(
          "E10202",
          `Field '${expression.field}' is not present in struct '${host.sourceText(expression.operand.span)}' — available fields: ${operandType.fields.map(({ name }) => name).join(", ")}`,
          expression.fieldSpan,
        ),
      );
      return { node: null, exact: null };
    }
    const constant = BigInt(field.offset);
    return {
      node: createScalarTypedExpression(expression, SCALAR_TYPES.word, constant, {
        operand: expression.operand,
        operandType,
        field: expression.field,
      }),
      exact: constant,
    };
  }
  if (expression.kind === "length") {
    const operand = analyze(expression.operand, null, {
      ...context,
      constantContext: false,
      placeContext: true,
      compileTimeQuery: true,
    });
    if (operand.node === null) return { node: null, exact: null };
    if (operand.node.type.kind !== "array") {
      host.diagnose(
        projectDiagnostic(
          "E10203",
          `'length' requires an array — found '${semanticTypeName(operand.node.type)}'`,
          expression.operand.span,
        ),
      );
      return { node: null, exact: null };
    }
    if (operand.node.outerUnsized) {
      if (context.constantContext) {
        host.diagnose(
          projectDiagnostic(
            "E10191",
            "The length of an unsized array parameter is a runtime value",
            expression.span,
          ),
        );
        return { node: null, exact: null };
      }
      return {
        node: createScalarTypedExpression(expression, SCALAR_TYPES.word, null, {
          operand: operand.node,
        }),
        exact: null,
      };
    }
    const constant = BigInt(operand.node.type.length);
    return {
      node: createScalarTypedExpression(expression, SCALAR_TYPES.word, constant, {
        operand: operand.node,
      }),
      exact: constant,
    };
  }
  if (expression.kind === "call" && expression.callee.kind === "name") {
    return analyzeBuiltinCall(expression, context, host, analyze);
  }
  return null;
}

/** Diagnose an operator whose operand is an aggregate. */
export function diagnoseAggregateBinary(
  expression: Extract<Expr, { readonly kind: "binary" }>,
  left: TypedExpr,
  right: TypedExpr,
  host: ScalarExpressionHost,
): boolean {
  if (left.type.kind === "scalar" && right.type.kind === "scalar") return false;
  if (left.type.kind === "array" || right.type.kind === "array") {
    host.diagnose(
      projectDiagnostic(
        "E10121",
        `Cannot compare arrays with '${expression.operator}' — compare individual elements`,
        expression.span,
      ),
    );
  } else {
    host.diagnose(
      projectDiagnostic(
        "E10095",
        `Cannot compare structs with '${expression.operator}' — compare individual fields`,
        expression.span,
      ),
    );
  }
  return true;
}

/** Type a contextual fixed-array literal and retain initialized ranges. */
function analyzeArrayLiteral(
  expression: Extract<Expr, { readonly kind: "array-literal" }>,
  expected: ArrayType,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  analyze: AnalyzeExpression,
): ScalarExpressionResult {
  const string = analyzeStringArrayLiteral(expression, expected, context, host, analyze);
  if (string !== null) return string;
  if (expression.elements.length > expected.length) {
    host.diagnose(
      projectDiagnostic(
        "E10112",
        `Array initializer has ${expression.elements.length} elements but the declared size is ${expected.length}`,
        expression.span,
      ),
    );
  }
  const elements: TypedExpr[] = [];
  let valid = expression.elements.length <= expected.length;
  for (const element of expression.elements) {
    const result = analyze(element, expected.element, context);
    if (result.node === null) valid = false;
    else elements.push(result.node);
  }
  let fill: TypedExpr | null = null;
  if (expression.fill !== null) {
    const result = analyze(expression.fill, expected.element, {
      ...context,
      constantContext: true,
    });
    fill = result.node;
    if (fill === null || (fill.constant === null && fill.type.kind === "scalar")) valid = false;
  }
  if (!valid) return { node: null, exact: null };
  const end = fill === null ? Math.min(elements.length, expected.length) : expected.length;
  const initialized = end === 0 ? Object.freeze([]) : Object.freeze([{ start: 0, end }]);
  return {
    node: createScalarTypedExpression(expression, expected, null, {
      elements: Object.freeze(elements),
      fill,
      initialized,
    }),
    exact: null,
  };
}

/** Type a complete nominal struct literal in declaration order. */
function analyzeStructLiteral(
  expression: Extract<Expr, { readonly kind: "struct-literal" }>,
  expected: StructType,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  analyze: AnalyzeExpression,
): ScalarExpressionResult {
  let valid = true;
  let orderDiagnosticReported = false;
  const fields: { readonly name: string; readonly value: TypedExpr }[] = [];
  for (let index = 0; index < expression.fields.length; index += 1) {
    const sourceField = expression.fields[index]!;
    const declared = expected.fields[index];
    if (!expected.fields.some(({ name }) => name === sourceField.name)) {
      host.diagnose(
        projectDiagnostic(
          "E10243",
          `Struct initializer for 'struct' contains unknown field '${sourceField.name}'`,
          sourceField.nameSpan,
        ),
      );
      valid = false;
      continue;
    }
    if (declared?.name !== sourceField.name) {
      if (!orderDiagnosticReported) {
        host.diagnose(
          projectDiagnostic(
            "E10097",
            `Struct literal fields must follow declaration order — expected '${declared?.name ?? expected.fields[0]?.name ?? "<field>"}', found '${sourceField.name}'`,
            sourceField.nameSpan,
          ),
        );
        orderDiagnosticReported = true;
      }
      valid = false;
      continue;
    }
    const value = analyze(sourceField.value, declared.type, context).node;
    if (value === null) valid = false;
    else fields.push(Object.freeze({ name: sourceField.name, value }));
  }
  if (expression.fields.length < expected.fields.length) {
    const missing = expected.fields[expression.fields.length]!;
    host.diagnose(
      projectDiagnostic(
        "E10096",
        `Struct literal must initialize all fields — missing '${missing.name}'`,
        expression.span,
      ),
    );
    valid = false;
  }
  if (!valid) return { node: null, exact: null };
  return {
    node: createScalarTypedExpression(expression, expected, null, {
      fields: Object.freeze(fields),
    }),
    exact: null,
  };
}

/** Resolve a struct field place without turning the base computation into a read. */
function analyzeMember(
  expression: Extract<Expr, { readonly kind: "member" }>,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  analyze: AnalyzeExpression,
): ScalarExpressionResult {
  const object = analyze(expression.object, null, { ...context, placeContext: true });
  if (object.node === null) return { node: null, exact: null };
  if (object.node.type.kind !== "struct") {
    host.diagnose(
      projectDiagnostic(
        "E10242",
        `Struct '${semanticTypeName(object.node.type)}' has no field '${expression.member}'`,
        expression.memberSpan,
      ),
    );
    return { node: null, exact: null };
  }
  const field = object.node.type.fields.find(({ name }) => name === expression.member);
  if (field === undefined) {
    host.diagnose(
      projectDiagnostic(
        "E10242",
        `Struct 'struct' has no field '${expression.member}'`,
        expression.memberSpan,
      ),
    );
    return { node: null, exact: null };
  }
  const place =
    object.node.place === null
      ? null
      : Object.freeze({
          binding: object.node.place.binding,
          path: Object.freeze([...object.node.place.path, expression.member]),
          readonly: object.node.place.readonly,
          readonlyOrigin: object.node.place.readonlyOrigin,
          byteRange:
            object.node.place.byteRange == null
              ? null
              : Object.freeze({
                  start: object.node.place.byteRange.start + field.offset,
                  end:
                    object.node.place.byteRange.start + field.offset + semanticTypeSize(field.type),
                }),
        });
  if (!context.placeContext && place !== null) host.read(place, expression.span);
  return {
    node: createScalarTypedExpression(expression, field.type, null, {
      object: object.node,
      member: expression.member,
      ...(object.node.name === undefined ? {} : { name: object.node.name }),
      binding: object.node.binding,
      place,
      integer: integerFacts(field.type, true),
    }),
    exact: null,
  };
}

/** Resolve an indexed place and validate a known element ordinal. */
function analyzeIndex(
  expression: Extract<Expr, { readonly kind: "index" }>,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  analyze: AnalyzeExpression,
): ScalarExpressionResult {
  const object = analyze(expression.object, null, { ...context, placeContext: true });
  const index = analyze(expression.index, null, {
    ...context,
    placeContext: false,
    ordinalContext: true,
  });
  if (object.node === null || index.node === null) return { node: null, exact: null };
  if (object.node.type.kind !== "array") {
    host.defer(expression.span, "Indexing this value remains outside the admitted aggregate slice");
    return { node: null, exact: null };
  }
  if (!isIntegerType(index.node.type)) {
    host.diagnose(
      projectDiagnostic(
        "E10263",
        `Array index must have an integer type — found '${semanticTypeName(index.node.type)}'`,
        expression.index.span,
      ),
    );
    return { node: null, exact: null };
  }
  if (
    typeof index.node.constant === "bigint" &&
    !object.node.outerUnsized &&
    (index.node.constant < 0n || index.node.constant >= BigInt(object.node.type.length))
  ) {
    host.diagnose(
      projectDiagnostic(
        "E10240",
        `Index ${index.node.constant} is provably outside array '${host.sourceText(expression.object.span)}' with extent ${object.node.type.length}`,
        expression.index.span,
      ),
    );
  }
  const place =
    object.node.place === null
      ? null
      : Object.freeze({
          binding: object.node.place.binding,
          path: Object.freeze([...object.node.place.path, index.node]),
          readonly: object.node.place.readonly,
          readonlyOrigin: object.node.place.readonlyOrigin,
          byteRange:
            object.node.place.byteRange == null || typeof index.node.constant !== "bigint"
              ? null
              : Object.freeze({
                  start:
                    object.node.place.byteRange.start +
                    Number(index.node.constant) * semanticTypeSize(object.node.type.element),
                  end:
                    object.node.place.byteRange.start +
                    (Number(index.node.constant) + 1) * semanticTypeSize(object.node.type.element),
                }),
        });
  if (!context.placeContext && place !== null) host.read(place, expression.span);
  return {
    node: createScalarTypedExpression(expression, object.node.type.element, null, {
      object: object.node,
      index: index.node,
      ...(object.node.name === undefined ? {} : { name: object.node.name }),
      binding: object.node.binding,
      place,
      integer: integerFacts(object.node.type.element, true),
    }),
    exact: null,
  };
}

/** Keep a visible handler address through an explicit word conversion. */
function retainsHandlerAddress(expression: TypedExpr): boolean {
  if (expression.type.kind === "interrupt-handler") return true;
  const operand = expression.operand;
  return expression.kind === "cast" && operand !== undefined && "type" in operand
    ? retainsHandlerAddress(operand)
    : false;
}

/** Type raw-memory and byte-extraction built-ins without fabricating declarations. */
function analyzeBuiltinCall(
  expression: Extract<Expr, { readonly kind: "call" }>,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  analyze: AnalyzeExpression,
): ScalarExpressionResult | null {
  const name = expression.callee.kind === "name" ? expression.callee.name : "";
  if (name === "embed") {
    const embedded = host.embeddedValue(expression);
    if (embedded === null) return null;
    return {
      node: createScalarTypedExpression(expression, embedded.type, null, {
        embedded,
        initialized: Object.freeze([{ start: 0, end: embedded.type.length }]),
        evaluation: "left-to-right",
      }),
      exact: null,
    };
  }
  if (name === "lo" || name === "hi") {
    return analyzeByteExtraction(expression, name, context, host, analyze);
  }
  const signatures: Readonly<
    Record<
      string,
      {
        readonly parameters: readonly SemanticType[];
        readonly result: SemanticType;
        readonly memory: NonNullable<TypedExpr["memory"]> | null;
      }
    >
  > = {
    peek: { parameters: [SCALAR_TYPES.word], result: SCALAR_TYPES.byte, memory: memory("read", 1) },
    poke: {
      parameters: [SCALAR_TYPES.word, SCALAR_TYPES.byte],
      result: SCALAR_TYPES.void,
      memory: memory("write", 1),
    },
    peekw: {
      parameters: [SCALAR_TYPES.word],
      result: SCALAR_TYPES.word,
      memory: memory("read", 2),
    },
    pokew: {
      parameters: [SCALAR_TYPES.word, SCALAR_TYPES.word],
      result: SCALAR_TYPES.void,
      memory: memory("write", 2),
    },
  };
  const builtin = signatures[name];
  if (builtin === undefined) return null;
  let valid = expression.arguments.length === builtin.parameters.length;
  if (!valid) {
    host.diagnose(
      projectDiagnostic(
        "E10171",
        `Wrong argument count — '${name}()' expects ${builtin.parameters.length} parameters, got ${expression.arguments.length}`,
        expression.span,
      ),
    );
  }
  const arguments_: TypedExpr[] = [];
  expression.arguments.forEach((argument, index) => {
    const result = analyze(argument, builtin.parameters[index] ?? null, {
      ...context,
      ordinalContext: false,
    });
    if (result.node === null) valid = false;
    else arguments_.push(result.node);
  });
  if (!valid) return { node: null, exact: null };
  if (
    name === "pokew" &&
    (arguments_[0]?.constant === 0x0314n || arguments_[0]?.constant === 0x0318n) &&
    arguments_[1] !== undefined &&
    retainsHandlerAddress(arguments_[1])
  ) {
    const vector = arguments_[0].constant === 0x0314n ? "$0314" : "$0318";
    const sink = vector === "$0314" ? "c64.system.setIRQ" : "c64.system.setNMI";
    host.diagnose(
      projectDiagnostic(
        "E10252",
        `Raw interrupt-entry address '${host.sourceText(expression.arguments[1]!.span)}' cannot be written directly to firmware vector '${vector}' — use '${sink}' so the compiler selects the required entry variant`,
        expression.span,
      ),
    );
    return { node: null, exact: null };
  }
  if (
    (name === "poke" || name === "pokew") &&
    arguments_[0]?.addressPlaces?.some((place) => place.readonly)
  ) {
    host.diagnose(
      projectDiagnostic(
        "E10123",
        "Cannot write through an address derived from read-only storage",
        expression.arguments[0]?.span ?? expression.span,
      ),
    );
    return { node: null, exact: null };
  }
  if (builtin.memory !== null) clearCallVisibleScalarFacts(context.scope);
  const signature: FunctionSignature = Object.freeze({
    parameters: Object.freeze(
      builtin.parameters.map((type) => Object.freeze({ type, readonly: false })),
    ),
    returnType: builtin.result,
  });
  const callee = createScalarTypedExpression(expression.callee, builtin.result, null, {
    name,
  });
  return {
    node: createScalarTypedExpression(expression, builtin.result, null, {
      callee,
      arguments: Object.freeze(arguments_),
      signature,
      evaluation: "left-to-right",
      memory: builtin.memory,
      integer: integerFacts(builtin.result, true),
    }),
    exact: null,
  };
}

/** Type low/high-byte extraction for every fixed-width integer input. */
function analyzeByteExtraction(
  expression: Extract<Expr, { readonly kind: "call" }>,
  name: "lo" | "hi",
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  analyze: AnalyzeExpression,
): ScalarExpressionResult {
  let valid = expression.arguments.length === 1;
  if (!valid) {
    host.diagnose(
      projectDiagnostic(
        "E10171",
        `Wrong argument count — '${name}()' expects 1 parameters, got ${expression.arguments.length}`,
        expression.span,
      ),
    );
  }
  const arguments_: TypedExpr[] = [];
  for (const argument of expression.arguments) {
    const result = analyze(argument, null, { ...context, ordinalContext: false });
    if (result.node === null) valid = false;
    else arguments_.push(result.node);
  }
  const argument = arguments_[0];
  if (argument !== undefined && !isIntegerType(argument.type)) {
    host.diagnose(
      projectDiagnostic(
        "E10080",
        `Cannot implicitly convert '${semanticTypeName(argument.type)}' to an integer accepted by '${name}()'`,
        expression.arguments[0]!.span,
      ),
    );
    valid = false;
  }
  if (!valid || argument === undefined || !isIntegerType(argument.type)) {
    return { node: null, exact: null };
  }
  const facts = integerFacts(argument.type, false)!;
  let bits =
    typeof argument.constant === "bigint"
      ? argument.constant & ((1n << BigInt(facts.width)) - 1n)
      : null;
  if (name === "hi" && bits !== null && facts.width === 8 && facts.signed && bits >= 0x80n) {
    bits |= 0xff00n;
  }
  const constant = bits === null ? null : name === "lo" ? bits & 0xffn : (bits >> 8n) & 0xffn;
  const signature: FunctionSignature = Object.freeze({
    parameters: Object.freeze([Object.freeze({ type: argument.type, readonly: false })]),
    returnType: SCALAR_TYPES.byte,
  });
  const callee = createScalarTypedExpression(expression.callee, SCALAR_TYPES.byte, null, { name });
  return {
    node: createScalarTypedExpression(expression, SCALAR_TYPES.byte, constant, {
      callee,
      arguments: Object.freeze(arguments_),
      signature,
      evaluation: "left-to-right",
      integer: integerFacts(SCALAR_TYPES.byte, true),
    }),
    exact: constant,
  };
}

/** Create immutable raw-memory metadata. */
function memory(access: "read" | "write", width: 1 | 2): NonNullable<TypedExpr["memory"]> {
  return Object.freeze({ volatile: true, access, width, byteOrder: "low-first" });
}

/** Retain a valid but context-free aggregate literal as an implementation obligation. */
function deferAggregateLiteral(
  expression: Expr,
  host: ScalarExpressionHost,
  message: string,
): ScalarExpressionResult {
  host.defer(expression.span, message);
  return { node: null, exact: null };
}
