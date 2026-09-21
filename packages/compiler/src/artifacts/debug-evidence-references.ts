import { areEvidenceIndexes } from "./evidence-validation.js";

/** Validate every forward and reverse index in an already shape-checked debug graph. */
export function validateDebugReverseIndexes(
  functions: readonly Record<string, unknown>[],
  contexts: readonly Record<string, unknown>[],
  symbols: readonly Record<string, unknown>[],
  locations: readonly Record<string, unknown>[],
  ranges: readonly Record<string, unknown>[],
  optimizations: readonly Record<string, unknown>[],
): boolean {
  for (let functionIndex = 0; functionIndex < functions.length; functionIndex += 1) {
    const selected = functions[functionIndex]!;
    if (!areEvidenceIndexes(selected.rangeIndexes, ranges.length)) return false;
    if (
      !(selected.rangeIndexes as number[]).every(
        (rangeIndex) =>
          (ranges[rangeIndex]!.owner as Record<string, unknown>).kind === "function" &&
          (ranges[rangeIndex]!.owner as Record<string, unknown>).functionIndex === functionIndex,
      )
    ) {
      return false;
    }
    for (const variant of selected.entryVariants as Record<string, unknown>[]) {
      if (!areEvidenceIndexes(variant.rangeIndexes, ranges.length)) return false;
      if (
        !(variant.rangeIndexes as number[]).every((index) =>
          (selected.rangeIndexes as number[]).includes(index),
        )
      ) {
        return false;
      }
    }
  }
  if (
    ranges.some((range, rangeIndex) => {
      const selectedOwner = range.owner as Record<string, unknown>;
      if (selectedOwner.kind !== "function") return false;
      const functionIndex = selectedOwner.functionIndex as number;
      return (
        !(functions[functionIndex]!.rangeIndexes as number[]).includes(rangeIndex) ||
        range.contextIndex === undefined ||
        (range.contextIndex as number) >= contexts.length ||
        contexts[range.contextIndex as number]!.functionIndex !== functionIndex
      );
    })
  ) {
    return false;
  }
  for (let symbolIndex = 0; symbolIndex < symbols.length; symbolIndex += 1) {
    const selected = symbols[symbolIndex]!;
    if (!areEvidenceIndexes(selected.locationIndexes, locations.length)) return false;
    if (
      !(selected.locationIndexes as number[]).every(
        (locationIndex) => locations[locationIndex]!.symbolIndex === symbolIndex,
      )
    ) {
      return false;
    }
  }
  if (
    locations.some(
      (location, locationIndex) =>
        !(symbols[location.symbolIndex as number]!.locationIndexes as number[]).includes(
          locationIndex,
        ),
    )
  ) {
    return false;
  }
  for (const selected of locations) {
    for (const rangeIndex of selected.liveRangeIndexes as number[]) {
      const range = ranges[rangeIndex]!;
      if (selected.contextIndex !== undefined && range.contextIndex !== selected.contextIndex) {
        return false;
      }
    }
  }
  for (
    let optimizationIndex = 0;
    optimizationIndex < optimizations.length;
    optimizationIndex += 1
  ) {
    for (const rangeIndex of optimizations[optimizationIndex]!.outputRangeIndexes as number[]) {
      if (!(ranges[rangeIndex]!.optimizationIndexes as number[]).includes(optimizationIndex)) {
        return false;
      }
    }
  }
  return ranges.every((range, rangeIndex) =>
    (range.optimizationIndexes as number[]).every((index) =>
      (optimizations[index]!.outputRangeIndexes as number[]).includes(rangeIndex),
    ),
  );
}
