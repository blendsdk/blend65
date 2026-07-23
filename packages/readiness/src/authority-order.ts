/** Compares authority strings by Unicode code point without locale-dependent collation. */
export function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Compares structured string tuples without delimiter-based key collisions. */
export function compareStringTuples(left: readonly string[], right: readonly string[]): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const order = compareOrdinal(left[index]!, right[index]!);
    if (order !== 0) return order;
  }
  return left.length - right.length;
}

/** Reports exact equality for structured tuples. */
export function equalStringTuples(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
