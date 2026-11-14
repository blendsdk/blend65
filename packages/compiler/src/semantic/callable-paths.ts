import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticPlace } from "./operations.js";

/** A dynamic index may select any element; named fields never alias each other. */
export function placePath(place: SemanticPlace): string {
  return place.path
    .map((part) => (part.kind === "field" ? `field:${part.name}` : "index:*"))
    .join("\0");
}

/** Attach a child aggregate path without confusing a field with its similarly named sibling. */
export function joinPath(parent: string, child: string): string {
  return parent.length === 0 ? child : child.length === 0 ? parent : `${parent}\0${child}`;
}

/** Enumerate only callable leaves, without allocating a path for every array element. */
export function callablePaths(type: SemanticType): readonly string[] {
  if (type.kind === "function" || type.kind === "interrupt-handler") return [""];
  if (type.kind === "struct") {
    return type.fields.flatMap((field) =>
      callablePaths(field.type).map((path) => joinPath(`field:${field.name}`, path)),
    );
  }
  if (type.kind === "array" && type.length > 0) {
    return callablePaths(type.element).map((path) => joinPath("index:*", path));
  }
  return [];
}
