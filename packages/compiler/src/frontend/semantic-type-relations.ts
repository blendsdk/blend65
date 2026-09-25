import { bindingIdentityKey } from "./semantic-types.js";
import type { FunctionType, SemanticType } from "./semantic-types.js";

/** Return the packed byte size of a complete type without assigning storage. */
export function semanticTypeSize(type: SemanticType): number {
  if (type.kind === "struct" || type.kind === "array") return type.size;
  if (type.kind === "function" || type.kind === "interrupt-handler") return 2;
  if (type.kind === "enum") return 1;
  if (type.name === "word" || type.name === "sword") return 2;
  if (type.name === "void") return 0;
  return 1;
}

/** Compare types structurally except where a declaration gives nominal identity. */
export function semanticTypesEqual(left: SemanticType, right: SemanticType): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "scalar" && right.kind === "scalar") return left.name === right.name;
  if (left.kind === "enum" && right.kind === "enum") {
    return bindingIdentityKey(left.binding) === bindingIdentityKey(right.binding);
  }
  if (left.kind === "struct" && right.kind === "struct") {
    return bindingIdentityKey(left.binding) === bindingIdentityKey(right.binding);
  }
  if (left.kind === "array" && right.kind === "array") {
    return left.length === right.length && semanticTypesEqual(left.element, right.element);
  }
  if (left.kind === "function" && right.kind === "function") {
    return (
      left.parameters.length === right.parameters.length &&
      left.parameters.every((parameter, index) => {
        const other = right.parameters[index]!;
        return (
          parameter.readonly === other.readonly &&
          Boolean(parameter.outerUnsized) === Boolean(other.outerUnsized) &&
          semanticTypesEqual(parameter.type, other.type)
        );
      }) &&
      semanticTypesEqual(left.returnType, right.returnType)
    );
  }
  if (left.kind === "interrupt-handler" && right.kind === "interrupt-handler") return true;
  return false;
}

/** Describe the first invariant function-signature difference for a source diagnostic. */
export function functionSignatureDifference(actual: FunctionType, expected: FunctionType): string {
  if (actual.parameters.length !== expected.parameters.length) {
    return `parameter count ${actual.parameters.length} versus ${expected.parameters.length}`;
  }
  for (let index = 0; index < actual.parameters.length; index += 1) {
    const left = actual.parameters[index]!;
    const right = expected.parameters[index]!;
    if (left.readonly !== right.readonly) return `parameter ${index + 1} const qualifier`;
    if (Boolean(left.outerUnsized) !== Boolean(right.outerUnsized)) {
      return `parameter ${index + 1} array extent`;
    }
    if (!semanticTypesEqual(left.type, right.type)) {
      return `parameter ${index + 1} type '${semanticTypeName(left.type)}' versus '${semanticTypeName(right.type)}'`;
    }
  }
  return `return type '${semanticTypeName(actual.returnType)}' versus '${semanticTypeName(expected.returnType)}'`;
}

/** Render a diagnostic type name without exposing a representation detail. */
export function semanticTypeName(type: SemanticType): string {
  if (type.kind === "scalar") return type.name;
  if (type.kind === "enum") return type.name;
  if (type.kind === "struct") return "struct";
  if (type.kind === "function") {
    const params = type.parameters.map(
      ({ type: parameter, readonly, outerUnsized }) =>
        `${readonly ? "const " : ""}${semanticTypeName(outerUnsized && parameter.kind === "array" ? parameter.element : parameter)}${outerUnsized ? "[]" : ""}`,
    );
    return `fn(${params.join(", ")}): ${semanticTypeName(type.returnType)}`;
  }
  if (type.kind === "interrupt-handler") return "interrupt handler";
  const dimensions: number[] = [];
  let element: SemanticType = type;
  while (element.kind === "array") {
    dimensions.push(element.length);
    element = element.element;
  }
  return `${semanticTypeName(element)}${dimensions.map((length) => `[${length}]`).join("")}`;
}
