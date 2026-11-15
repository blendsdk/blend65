import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticPlace } from "./operations.js";
import type { Definitions } from "./raw-write-kills.js";

/** A dynamic index may select any element; named fields never alias each other. */
export function placePath(place: SemanticPlace): string {
  return place.path
    .map((part) => (part.kind === "field" ? `field:${part.name}` : "index:*"))
    .join("\0");
}

/**
 * Resolve one call argument to the places its value borrows. A load or an
 * address names one place; a conversion keeps the same bytes; a merge unions
 * every incoming place. Any other producer has no proved origin.
 */
export function argumentOrigins(
  value: string | undefined,
  definitions: Definitions,
): readonly SemanticPlace[] | null {
  if (value === undefined) return null;
  const visited = new Set<string>();
  const resolve = (current: string): readonly SemanticPlace[] | null => {
    if (visited.has(current)) return null;
    visited.add(current);
    const operation = definitions.get(current);
    if (operation === undefined) return null;
    if (operation.kind === "load" || operation.kind === "place-address") return [operation.place];
    if (operation.kind === "convert") return resolve(operation.operand);
    if (operation.kind !== "merge") return null;
    const places: SemanticPlace[] = [];
    for (const incoming of operation.incoming) {
      const resolved = resolve(incoming.value);
      if (resolved === null) return null;
      places.push(...resolved);
    }
    return places;
  };
  const places = resolve(value);
  return places === null || places.length === 0 ? null : places;
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
