import { bindingIdentityKey } from "./semantic-types.js";
import type { SemanticType } from "./semantic-types.js";

/** Return the packed byte size of a complete type without assigning storage. */
export function semanticTypeSize(type: SemanticType): number {
  if (type.kind === "struct" || type.kind === "array") return type.size;
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
  return false;
}

/** Render a diagnostic type name without exposing a representation detail. */
export function semanticTypeName(type: SemanticType): string {
  if (type.kind === "scalar") return type.name;
  if (type.kind === "enum") return type.name;
  if (type.kind === "struct") return "struct";
  const dimensions: number[] = [];
  let element: SemanticType = type;
  while (element.kind === "array") {
    dimensions.push(element.length);
    element = element.element;
  }
  return `${semanticTypeName(element)}${dimensions.map((length) => `[${length}]`).join("")}`;
}
