import { projectDiagnostic } from "../project/diagnostics.js";
import { resolveAggregateDeclaration } from "./aggregate-names.js";
import { qualifiedCallName } from "./direct-calls.js";
import {
  commonIntegerType,
  commonScalarType,
  convertInteger,
  defaultIntegerType,
  evaluateBinaryInteger,
  evaluateUnaryInteger,
  isIntegerType,
  SCALAR_TYPES,
} from "./constants.js";
import { bindingIdentityKey } from "./semantic-types.js";
import { semanticTypeName, semanticTypeSize } from "./semantic-type-relations.js";
import type { ScalarScope, ScalarType, SemanticType } from "./semantic-types.js";
import type { Expr } from "./syntax.js";
import type { AggregateRegistry } from "./aggregate-types.js";

/** Evaluate the admitted compile-time expression subset used by fixed extents. */
export function evaluateConstant(
  registry: AggregateRegistry,
  expression: Expr,
  module: string,
  scope: ScalarScope | undefined,
  report: boolean,
  failure: { handled: boolean },
): { readonly value: bigint | boolean; readonly type: ScalarType } | null {
  if (expression.kind === "number") {
    const type = defaultIntegerType(expression.value);
    return type === null ? null : { value: expression.value, type };
  }
  if (expression.kind === "boolean") {
    return { value: expression.value, type: SCALAR_TYPES.boolean };
  }
  if (expression.kind === "name") {
    return evaluateNamedConstant(registry, expression, module, scope, report, failure);
  }
  if (expression.kind === "member") {
    const name = qualifiedCallName(expression);
    const root = name?.split(".", 1)[0];
    if (
      name !== null &&
      root !== undefined &&
      resolveConstantValueType(
        registry,
        { kind: "name", name: root, span: expression.span },
        module,
        scope,
      ) === null
    ) {
      const value = evaluateNamedConstant(
        registry,
        { kind: "name", name, span: expression.span },
        module,
        scope,
        report,
        failure,
      );
      if (value !== null) return value;
    }
  }
  if (expression.kind === "member" && expression.object.kind === "name") {
    const member = registry.enums.member(
      expression.object.name,
      expression.member,
      module,
      expression.span.sourceId,
    );
    return member === null ? null : { value: member.value, type: SCALAR_TYPES.byte };
  }
  if (expression.kind === "unary") {
    const operand = evaluateConstant(registry, expression.operand, module, scope, report, failure);
    if (operand === null) return null;
    if (expression.operator === "!") {
      return typeof operand.value === "boolean"
        ? { value: !operand.value, type: SCALAR_TYPES.boolean }
        : null;
    }
    if (typeof operand.value !== "bigint" || !isIntegerType(operand.type)) return null;
    const value = evaluateUnaryInteger(expression.operator, operand.value);
    if (value === null) return null;
    const type = expression.operator === "-" ? defaultIntegerType(value) : operand.type;
    return type === null ? null : { value, type };
  }
  if (expression.kind === "binary") {
    const left = evaluateConstant(registry, expression.left, module, scope, report, failure);
    const right = evaluateConstant(registry, expression.right, module, scope, report, failure);
    if (left === null || right === null) return null;
    if (expression.operator === "&&" || expression.operator === "||") {
      if (typeof left.value !== "boolean" || typeof right.value !== "boolean") return null;
      return {
        value: expression.operator === "&&" ? left.value && right.value : left.value || right.value,
        type: SCALAR_TYPES.boolean,
      };
    }
    if (
      typeof left.value === "boolean" &&
      typeof right.value === "boolean" &&
      (expression.operator === "==" || expression.operator === "!=")
    ) {
      return {
        value:
          expression.operator === "==" ? left.value === right.value : left.value !== right.value,
        type: SCALAR_TYPES.boolean,
      };
    }
    if (
      typeof left.value !== "bigint" ||
      typeof right.value !== "bigint" ||
      !isIntegerType(left.type) ||
      !isIntegerType(right.type)
    ) {
      return null;
    }
    const shift = expression.operator === "<<" || expression.operator === ">>";
    const operationType = shift ? left.type : commonIntegerType(left.type, right.type);
    if (operationType === null) return null;
    const value = evaluateBinaryInteger(
      expression.operator,
      left.value,
      right.value,
      operationType,
    );
    if (value === null) return null;
    return {
      value,
      type: typeof value === "boolean" ? SCALAR_TYPES.boolean : operationType,
    };
  }
  if (expression.kind === "conditional") {
    const condition = evaluateConstant(
      registry,
      expression.condition,
      module,
      scope,
      report,
      failure,
    );
    if (condition?.type !== SCALAR_TYPES.boolean || typeof condition.value !== "boolean") {
      return null;
    }
    // Early type expressions use pure scalar computations. Check both arms just as
    // the later expression checker does; selecting a value cannot hide an invalid arm.
    const whenTrue = evaluateConstant(
      registry,
      expression.whenTrue,
      module,
      scope,
      report,
      failure,
    );
    const whenFalse = evaluateConstant(
      registry,
      expression.whenFalse,
      module,
      scope,
      report,
      failure,
    );
    if (whenTrue === null || whenFalse === null) return null;
    const type = commonScalarType(whenTrue.type, whenFalse.type);
    if (type === null) {
      if (report)
        registry.host.diagnose(
          projectDiagnostic(
            "E10162",
            `Conditional arms have incompatible types '${semanticTypeName(whenTrue.type)}' and '${semanticTypeName(whenFalse.type)}'`,
            expression.span,
          ),
        );
      failure.handled = true;
      return null;
    }
    return { value: condition.value ? whenTrue.value : whenFalse.value, type };
  }
  if (expression.kind === "cast") {
    const operand = evaluateConstant(registry, expression.operand, module, scope, report, failure);
    const destination = registry.resolveType(expression.type, module, null, report, scope);
    if (
      operand === null ||
      typeof operand.value !== "bigint" ||
      !isIntegerType(operand.type) ||
      destination === null ||
      !isIntegerType(destination)
    ) {
      return null;
    }
    return {
      value: convertInteger(operand.value, operand.type, destination).value,
      type: destination,
    };
  }
  if (expression.kind === "sizeof") {
    if (expression.operand.kind === "array-type" && expression.operand.extent === null) {
      if (report) {
        registry.host.diagnose(
          projectDiagnostic(
            "E10266",
            `'sizeof' requires a fixed-size type — unsized array type '${registry.host.sourceText(expression.operand.span)}' has no standalone extent`,
            expression.operand.span,
          ),
        );
      }
      failure.handled = true;
      return null;
    }
    const type = registry.resolveType(expression.operand, module, null, report, scope);
    if (type === null) failure.handled = true;
    return type === null
      ? null
      : { value: BigInt(semanticTypeSize(type)), type: SCALAR_TYPES.word };
  }
  if (expression.kind === "offsetof") {
    const type = registry.resolveType(expression.operand, module, null, report, scope);
    if (type === null) {
      failure.handled = true;
      return null;
    }
    if (type.kind !== "struct") {
      if (report) {
        registry.host.diagnose(
          projectDiagnostic(
            "E10201",
            `'offsetof' requires a struct type — found '${semanticTypeName(type)}'`,
            expression.operand.span,
          ),
        );
      }
      failure.handled = true;
      return null;
    }
    const field = type.fields.find(({ name }) => name === expression.field);
    if (field === undefined) {
      if (report) {
        registry.host.diagnose(
          projectDiagnostic(
            "E10202",
            `Field '${expression.field}' is not present in struct '${registry.host.sourceText(expression.operand.span)}' — available fields: ${type.fields.map(({ name }) => name).join(", ")}`,
            expression.fieldSpan,
          ),
        );
      }
      failure.handled = true;
      return null;
    }
    return { value: BigInt(field.offset), type: SCALAR_TYPES.word };
  }
  if (expression.kind === "length") {
    const type = resolveConstantValueType(registry, expression.operand, module, scope);
    if (type !== null && type.kind !== "array") {
      if (report) {
        registry.host.diagnose(
          projectDiagnostic(
            "E10203",
            `'length' requires an array — found '${semanticTypeName(type)}'`,
            expression.operand.span,
          ),
        );
      }
      failure.handled = true;
      return null;
    }
    return type?.kind === "array" ? { value: BigInt(type.length), type: SCALAR_TYPES.word } : null;
  }
  if (
    expression.kind === "call" &&
    expression.callee.kind === "name" &&
    (expression.callee.name === "lo" || expression.callee.name === "hi") &&
    expression.arguments.length === 1
  ) {
    const argument = evaluateConstant(
      registry,
      expression.arguments[0]!,
      module,
      scope,
      report,
      failure,
    );
    if (argument === null || typeof argument.value !== "bigint" || !isIntegerType(argument.type)) {
      return null;
    }
    const width = argument.type.name.endsWith("byte") ? 8 : 16;
    let bits = argument.value & ((1n << BigInt(width)) - 1n);
    if (expression.callee.name === "hi" && argument.type.name === "sbyte" && bits >= 0x80n) {
      bits |= 0xff00n;
    }
    return {
      value: expression.callee.name === "lo" ? bits & 0xffn : (bits >> 8n) & 0xffn,
      type: SCALAR_TYPES.byte,
    };
  }
  return null;
}

/** Resolve and evaluate one module or imported constant by source identity. */
function evaluateNamedConstant(
  registry: AggregateRegistry,
  expression: Extract<Expr, { readonly kind: "name" }>,
  module: string,
  scope: ScalarScope | undefined,
  report: boolean,
  failure: { handled: boolean },
): { readonly value: bigint | boolean; readonly type: ScalarType } | null {
  if (!expression.name.includes(".")) {
    for (
      let current: ScalarScope | null | undefined = scope;
      current !== undefined && current !== null;
      current = current.parent
    ) {
      const state = current.values.get(expression.name);
      if (state === undefined) continue;
      registry.host.reference?.(state.binding.id);
      const type = state.binding.type;
      return state.binding.storage === "constant" &&
        type?.kind === "scalar" &&
        type.name !== "void" &&
        state.known !== null
        ? { value: state.known, type }
        : null;
    }
  }
  const selected = registry.host.profileConstant?.(
    expression.name,
    module,
    expression.span.sourceId,
  );
  if (selected !== undefined && selected !== null) {
    registry.host.reference?.(selected.binding.id);
    return selected.binding.type?.kind === "scalar" && selected.known !== null
      ? { value: selected.known, type: selected.binding.type }
      : null;
  }
  const resolved = resolveAggregateDeclaration(
    registry.graph,
    registry.declarations,
    expression.name,
    module,
    expression.span.sourceId,
  );
  if (resolved === null || resolved.declaration.kind !== "variable") return null;
  registry.host.reference?.(resolved.binding);
  const declaration = resolved.declaration;
  if (declaration.declarationKind !== "const" || declaration.initializer === null) return null;
  const key = bindingIdentityKey(resolved.binding);
  if (registry.evaluatingConstants.has(key)) return null;
  const type = registry.resolveType(
    declaration.type,
    resolved.module,
    declaration.initializer,
    false,
  );
  if (type === null || type.kind !== "scalar" || type.name === "void") return null;
  registry.evaluatingConstants.add(key);
  const value = evaluateConstant(
    registry,
    declaration.initializer,
    resolved.module,
    undefined,
    report,
    failure,
  );
  registry.evaluatingConstants.delete(key);
  return value === null ? null : { value: value.value, type };
}

/** Resolve the declared type of a value used by a constant query. */
function resolveConstantValueType(
  registry: AggregateRegistry,
  expression: Expr,
  module: string,
  scope: ScalarScope | undefined,
): SemanticType | null {
  if (expression.kind !== "name") return null;
  if (!expression.name.includes(".")) {
    for (
      let current: ScalarScope | null | undefined = scope;
      current !== undefined && current !== null;
      current = current.parent
    ) {
      const state = current.values.get(expression.name);
      if (state !== undefined) {
        registry.host.reference?.(state.binding.id);
        return state.binding.type;
      }
    }
  }
  const selected = registry.host.profileConstant?.(
    expression.name,
    module,
    expression.span.sourceId,
  );
  if (selected !== undefined && selected !== null) {
    registry.host.reference?.(selected.binding.id);
    return selected.binding.type;
  }
  const resolved = resolveAggregateDeclaration(
    registry.graph,
    registry.declarations,
    expression.name,
    module,
    expression.span.sourceId,
  );
  if (resolved?.declaration.kind === "variable") registry.host.reference?.(resolved.binding);
  return resolved?.declaration.kind === "variable"
    ? registry.resolveType(
        resolved.declaration.type,
        resolved.module,
        resolved.declaration.initializer,
        false,
      )
    : null;
}
