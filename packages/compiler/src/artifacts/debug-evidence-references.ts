import { areEvidenceIndexes } from "./evidence-validation.js";
import type { EvidenceFieldFailure } from "./evidence-diagnostics.js";

/** Validate every forward and reverse index in an already shape-checked debug graph. */
export function validateDebugReverseIndexes(
  functions: readonly Record<string, unknown>[],
  contexts: readonly Record<string, unknown>[],
  symbols: readonly Record<string, unknown>[],
  locations: readonly Record<string, unknown>[],
  ranges: readonly Record<string, unknown>[],
  optimizations: readonly Record<string, unknown>[],
  invalid?: EvidenceFieldFailure,
): boolean {
  for (let functionIndex = 0; functionIndex < functions.length; functionIndex += 1) {
    const selected = functions[functionIndex]!;
    if (!areEvidenceIndexes(selected.rangeIndexes, ranges.length)) {
      invalid?.(
        ["functions", functionIndex, "rangeIndexes"],
        "function range indexes must be ordered and in bounds",
      );
      return false;
    }
    if (
      !(selected.rangeIndexes as number[]).every(
        (rangeIndex) =>
          (ranges[rangeIndex]!.owner as Record<string, unknown>).kind === "function" &&
          (ranges[rangeIndex]!.owner as Record<string, unknown>).functionIndex === functionIndex,
      )
    ) {
      invalid?.(
        ["functions", functionIndex, "rangeIndexes"],
        "function ranges must identify the same function as their owner",
      );
      return false;
    }
    for (const [variantIndex, variant] of (
      selected.entryVariants as Record<string, unknown>[]
    ).entries()) {
      if (!areEvidenceIndexes(variant.rangeIndexes, ranges.length)) {
        invalid?.(
          ["functions", functionIndex, "entryVariants", variantIndex, "rangeIndexes"],
          "entry variant range indexes must be ordered and in bounds",
        );
        return false;
      }
      if (
        !(variant.rangeIndexes as number[]).every((index) =>
          (selected.rangeIndexes as number[]).includes(index),
        )
      ) {
        invalid?.(
          ["functions", functionIndex, "entryVariants", variantIndex, "rangeIndexes"],
          "entry variant ranges must belong to the function",
        );
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
    invalid?.(
      ["ranges"],
      "function-owned ranges must be listed by their owner and use a context for that function",
    );
    return false;
  }
  for (let symbolIndex = 0; symbolIndex < symbols.length; symbolIndex += 1) {
    const selected = symbols[symbolIndex]!;
    if (!areEvidenceIndexes(selected.locationIndexes, locations.length)) {
      invalid?.(
        ["symbols", symbolIndex, "locationIndexes"],
        "symbol location indexes must be ordered and in bounds",
      );
      return false;
    }
    if (
      !(selected.locationIndexes as number[]).every(
        (locationIndex) => locations[locationIndex]!.symbolIndex === symbolIndex,
      )
    ) {
      invalid?.(
        ["symbols", symbolIndex, "locationIndexes"],
        "symbol locations must refer back to the same symbol",
      );
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
    invalid?.(["locations"], "each location must be listed by its symbol");
    return false;
  }
  for (const [locationIndex, selected] of locations.entries()) {
    for (const rangeIndex of selected.liveRangeIndexes as number[]) {
      const range = ranges[rangeIndex]!;
      if (selected.contextIndex !== undefined && range.contextIndex !== selected.contextIndex) {
        invalid?.(
          ["locations", locationIndex, "liveRangeIndexes"],
          "live ranges must use the location's context",
        );
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
        invalid?.(
          ["optimizations", optimizationIndex, "outputRangeIndexes"],
          "output ranges must refer back to their optimization record",
        );
        return false;
      }
    }
  }
  for (const [rangeIndex, range] of ranges.entries()) {
    if (
      !(range.optimizationIndexes as number[]).every((index) =>
        (optimizations[index]!.outputRangeIndexes as number[]).includes(rangeIndex),
      )
    ) {
      invalid?.(
        ["ranges", rangeIndex, "optimizationIndexes"],
        "optimizations must list the range in their output indexes",
      );
      return false;
    }
  }
  return true;
}
