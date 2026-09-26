import { projectDiagnostic } from "../project/diagnostics.js";
import {
  createScalarTypedExpression,
  integerFacts,
  isIntegerType,
  scalarWarning,
  SCALAR_TYPES,
} from "./constants.js";
import { analyzeBuiltinCall } from "./builtin-calls.js";
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
  reportMismatch?: (actual: SemanticType) => void,
) => ScalarExpressionResult;

/** Apply an aggregate declaration, argument, or return context. */
export function applyExpectedAggregate(
  result: ScalarExpressionResult,
  expected: SemanticType,
  expression: Expr,
  host: ScalarExpressionHost,
  context: ScalarExpressionContext,
): ScalarExpressionResult {
  const node = result.node;
  if (node === null) return result;
  if (node.outerUnsized) {
    const declaration = host.resolveName(host.sourceText(expression.span), context);
    host.diagnose(
      projectDiagnostic(
        "E10253",
        `Array use at '${host.sourceText(expression.span)}' has no compile-time-known extent — add '[N]', use an extent-inferencing initializer, or keep 'T[]' as an outermost parameter form`,
        expression.span,
        null,
        declaration === null
          ? []
          : [{ span: declaration.nameSpan, message: "Unsized parameter is declared here" }],
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
  if (node.embedded !== undefined && expected.kind === "array" && node.type.kind === "array") {
    host.diagnose(
      projectDiagnostic(
        "E10140",
        `Embedded data size mismatch — expected ${expected.length} elements, got ${node.type.length}`,
        expression.span,
      ),
    );
    return { node: null, exact: result.exact };
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
          `Encoding or character map '${name}' is unavailable for platform '${host.profileId}' — available: petscii, screen_codes`,
          expression.span,
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
    const value =
      expression.operand.kind === "named-type"
        ? host.resolveName(expression.operand.name, context)
        : null;
    if (value !== null && value.binding.storage !== "type") {
      host.diagnose(
        projectDiagnostic(
          "E10200",
          `'sizeof' requires a type name — found '${host.sourceText(expression.operand.span)}'`,
          expression.operand.span,
        ),
      );
      return { node: null, exact: null };
    }
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
    const result = analyze(
      expression.fill,
      expected.element,
      {
        ...context,
        constantContext: true,
      },
      (actual) =>
        host.diagnose(
          projectDiagnostic(
            "E10115",
            `Fill value has type '${semanticTypeName(actual)}' but array element type is '${semanticTypeName(expected.element)}'`,
            expression.fill!.span,
          ),
        ),
    );
    fill = result.node;
    // Constant aggregate roots evaluate nested calls together after dependency ordering.
    // Runtime initializers still need their fill evaluated before publication.
    if (
      fill !== null &&
      fill.constant === null &&
      fill.type.kind === "scalar" &&
      !context.constantContext
    ) {
      fill = host.comptimeCall?.(fill) ?? null;
    }
    if (fill === null) valid = false;
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
          `Struct initializer for '${semanticTypeName(expected)}' contains unknown field '${sourceField.name}'`,
          sourceField.nameSpan,
          null,
          expected.nameSpan === undefined
            ? []
            : [{ span: expected.nameSpan, message: "Struct declared here" }],
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
            null,
            declared?.nameSpan === undefined
              ? []
              : [{ span: declared.nameSpan, message: "Expected field declared here" }],
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
        null,
        missing.nameSpan === undefined
          ? []
          : [{ span: missing.nameSpan, message: "Missing field declared here" }],
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
        `Struct '${semanticTypeName(object.node.type)}' has no field '${expression.member}'`,
        expression.span,
        null,
        object.node.type.nameSpan === undefined
          ? []
          : [{ span: object.node.type.nameSpan, message: "Struct declared here" }],
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
        null,
        object.node.place === null
          ? []
          : [
              {
                span:
                  host.resolveName(host.sourceText(expression.object.span), context)?.nameSpan ??
                  object.node.place.binding.span,
                message: "Array declared here",
              },
            ],
      ),
    );
  }
  const stride = semanticTypeSize(object.node.type.element);
  if (
    index.node.constant === null &&
    object.node.type.element.kind === "struct" &&
    (stride & (stride - 1)) !== 0
  ) {
    host.diagnose(
      scalarWarning(
        "W10111",
        `Variable indexing of struct array '${host.sourceText(expression.object.span)}' requires multiplication by non-power-of-two size ${stride}`,
        expression.span,
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

/** Retain a valid but context-free aggregate literal as an implementation obligation. */
function deferAggregateLiteral(
  expression: Expr,
  host: ScalarExpressionHost,
  message: string,
): ScalarExpressionResult {
  host.defer(expression.span, message);
  return { node: null, exact: null };
}
