/**
 * Recursively freezes an object graph in place.
 *
 * Relation snapshots contain only validated data objects, arrays, and scalar values. Walking the
 * graph iteratively keeps freezing independent of the caller's nesting depth and safely handles a
 * repeated reference if a future modeled case introduces one.
 *
 * @param value Validated relation data to make immutable.
 * @returns The same value with every reachable object frozen.
 */
export function freezeSemanticRelationValue<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  const pending: object[] = [value];
  const seen = new Set<object>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    for (const child of Object.values(current)) {
      if (typeof child === "object" && child !== null) pending.push(child);
    }
    Object.freeze(current);
  }
  return value;
}

/**
 * Creates a detached immutable snapshot of validated relation data.
 *
 * @param value Validated data whose caller-owned identity must not escape.
 * @returns A deeply frozen structured clone.
 */
export function snapshotSemanticRelationValue<T>(value: T): T {
  return freezeSemanticRelationValue(structuredClone(value));
}
