import type { GenArrayType, GenStructuredExpression } from "./generator-ir.js";
import type { StructuredCompileTimeValue } from "./structured-constant-evaluator.js";
import { foldStructuredCompileTimeExpression } from "./structured-constant-evaluator.js";
import {
  structuredDiagnostic,
  type StructuredGenerationDiagnosticV2,
} from "./structured-ir-diagnostics.js";

function elementBytes(type: GenArrayType["elementType"]): bigint {
  return type === "word" || type === "sword" ? 2n : 1n;
}

/**
 * Validates index width and any compile-time fixed-array bound.
 *
 * @param arrayType Resolved target array type.
 * @param index Validated unsigned index expression.
 * @param path Index expression path.
 * @param constants Evaluated module constant environment.
 * @returns Stable first array-index diagnostic, when invalid.
 */
export function validateStructuredArrayIndex(
  arrayType: GenArrayType,
  index: GenStructuredExpression,
  path: string,
  constants: ReadonlyMap<string, StructuredCompileTimeValue>,
): StructuredGenerationDiagnosticV2 | undefined {
  if (arrayType.extent !== null) {
    const totalBytes = BigInt(arrayType.extent) * elementBytes(arrayType.elementType);
    const expectedIndexType = totalBytes <= 256n ? "byte" : "word";
    if (index.type !== expectedIndexType) {
      const byteTier = expectedIndexType === "byte";
      return structuredDiagnostic(
        "generation-type-invalid",
        "array-index-tier-mismatch",
        path,
        `This fixed array requires a ${expectedIndexType} index.`,
        {
          diagnosticFamily: byteTier ? "array-index-byte-required" : "array-index-word-required",
          expectedCompilerDiagnosticCode: byteTier ? "E10117" : "E10118",
        },
      );
    }
  }
  const folded = foldStructuredCompileTimeExpression(index, constants);
  if (
    arrayType.extent !== null &&
    folded.kind === "constant" &&
    (folded.result.value < 0n || folded.result.value >= BigInt(arrayType.extent))
  ) {
    return structuredDiagnostic(
      "neighbor-invalid",
      "array-constant-index-out-of-range",
      path,
      "Constant index lies outside the fixed array extent.",
      { diagnosticFamily: "array-index-constant-out-of-range" },
    );
  }
  return undefined;
}
