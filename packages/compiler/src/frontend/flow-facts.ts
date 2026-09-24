import type {
  InitializedRange,
  ScalarFactSnapshot,
  ScalarScope,
  ScalarValueFact,
  ScalarValueState,
} from "./semantic-types.js";

/** Capture mutable reaching facts without cloning declarations or scopes. */
export function snapshotScalarFacts(scope: ScalarScope): ScalarFactSnapshot {
  const facts = new Map<ScalarValueState, ScalarValueFact>();
  for (let current: ScalarScope | null = scope; current !== null; current = current.parent) {
    for (const state of current.values.values()) {
      if (!state.readonly && !facts.has(state)) {
        facts.set(
          state,
          Object.freeze({
            known: state.known,
            initialized: state.initialized,
            initializedRanges: state.initializedRanges,
            initializedPaths: state.initializedPaths,
            conditionalEffect: state.conditionalEffect ?? null,
          }),
        );
      }
    }
  }
  return facts;
}

/** Restore mutable reaching facts before checking an alternative path. */
export function restoreScalarFacts(snapshot: ScalarFactSnapshot): void {
  for (const [state, fact] of snapshot) {
    state.known = fact.known;
    state.initialized = fact.initialized;
    state.initializedRanges = fact.initializedRanges;
    state.initializedPaths = fact.initializedPaths;
    state.conditionalEffect = fact.conditionalEffect ?? null;
  }
}

/** Capture only facts already present at a split, excluding branch-local declarations. */
export function captureBranchFacts(snapshot: ScalarFactSnapshot): ScalarFactSnapshot {
  return new Map(
    [...snapshot.keys()].map((state) => [
      state,
      Object.freeze({
        known: state.known,
        initialized: state.initialized,
        initializedRanges: state.initializedRanges,
        initializedPaths: state.initializedPaths,
        conditionalEffect: state.conditionalEffect ?? null,
      }),
    ]),
  );
}

/** Keep a reaching fact only when every alternative proves it. */
export function mergeScalarFacts(
  baseline: ScalarFactSnapshot,
  alternatives: readonly ScalarFactSnapshot[],
): void {
  for (const [state, fallback] of baseline) {
    const first = alternatives[0]?.get(state) ?? fallback;
    const candidates = alternatives.map((facts) => facts.get(state) ?? fallback);
    state.known = candidates.every((fact) => fact.known === first.known) ? first.known : null;
    state.initialized = candidates.every((fact) => fact.initialized);
    state.initializedRanges = intersectInitializedRanges(
      candidates.map((fact) => fact.initializedRanges),
    );
    state.initializedPaths = Object.freeze(
      first.initializedPaths.filter((path) =>
        candidates.every((fact) => fact.initializedPaths.includes(path)),
      ),
    );
    const effect = first.conditionalEffect ?? null;
    state.conditionalEffect =
      effect !== null &&
      candidates.every((fact) => {
        const candidate = fact.conditionalEffect;
        return (
          candidate?.resultId === effect.resultId &&
          candidate.destination === effect.destination &&
          candidate.capturedRange.start === effect.capturedRange.start &&
          candidate.capturedRange.end === effect.capturedRange.end
        );
      })
        ? effect
        : null;
  }
}

/** Credit a proved captured write only on the matching stored result's true path. */
export function creditConditionalSuccess(result: ScalarValueState, resultId: string): void {
  const effect = result.conditionalEffect;
  if (result.known !== true || effect === undefined || effect === null) return;
  if (effect.resultId !== resultId) return;
  const destination = effect.destination;
  destination.initializedRanges = Object.freeze(
    normalizeRanges([...destination.initializedRanges, effect.capturedRange]),
  );
  const type = destination.binding.type;
  if (type?.kind === "array") {
    destination.initialized = destination.initializedRanges.some(
      (range) => range.start === 0 && range.end >= type.length,
    );
  }
}

/** Forget mutable scalar values after an operation with unknown writes. */
export function clearMutableScalarFacts(scope: ScalarScope): void {
  for (let current: ScalarScope | null = scope; current !== null; current = current.parent) {
    for (const state of current.values.values()) if (!state.readonly) state.known = null;
  }
}

/** Forget mutable module values after a call which cannot directly reach caller locals. */
export function clearCallVisibleScalarFacts(scope: ScalarScope): void {
  for (let current: ScalarScope | null = scope; current !== null; current = current.parent) {
    for (const state of current.values.values()) {
      if (!state.readonly && state.binding.storage === "module") state.known = null;
    }
  }
}

/** Compute the exact normalized intersection of half-open interval sets. */
function intersectInitializedRanges(
  alternatives: readonly (readonly InitializedRange[])[],
): readonly InitializedRange[] {
  if (alternatives.length === 0) return Object.freeze([]);
  let intersection = normalizeRanges(alternatives[0] ?? []);
  for (const ranges of alternatives.slice(1)) {
    const next = normalizeRanges(ranges);
    const overlaps: InitializedRange[] = [];
    let leftIndex = 0;
    let rightIndex = 0;
    while (leftIndex < intersection.length && rightIndex < next.length) {
      const left = intersection[leftIndex]!;
      const right = next[rightIndex]!;
      const start = Math.max(left.start, right.start);
      const end = Math.min(left.end, right.end);
      if (start < end) overlaps.push(Object.freeze({ start, end }));
      if (left.end < right.end) leftIndex += 1;
      else rightIndex += 1;
    }
    intersection = overlaps;
  }
  return Object.freeze(intersection);
}

/** Sort and merge one small half-open interval set. */
function normalizeRanges(ranges: readonly InitializedRange[]): InitializedRange[] {
  const sorted = [...ranges].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  const normalized: { start: number; end: number }[] = [];
  for (const range of sorted) {
    const last = normalized.at(-1);
    if (last !== undefined && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else normalized.push({ start: range.start, end: range.end });
  }
  return normalized.map((range) => Object.freeze(range));
}
