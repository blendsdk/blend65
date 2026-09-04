import {
  structuredDiagnostic,
  type StructuredGenerationDiagnosticV2,
} from "./structured-ir-diagnostics.js";

/** Builds the stable diagnostic used for structured semantic type failures. */
export function structuredTypeFailure(
  path: string,
  message: string,
  reason: StructuredGenerationDiagnosticV2["reason"] = "expression-type-mismatch",
): StructuredGenerationDiagnosticV2 {
  return structuredDiagnostic("generation-type-invalid", reason, path, message);
}

/** Builds the stable diagnostic used when a control-flow condition is not boolean. */
export function structuredConditionFailure(path: string): StructuredGenerationDiagnosticV2 {
  return structuredDiagnostic(
    "generation-type-invalid",
    "condition-not-boolean",
    path,
    "Control-flow conditions must be boolean.",
    { diagnosticFamily: "condition-boolean", expectedCompilerDiagnosticCode: "E10100" },
  );
}

/** Returns the stable name-conflict diagnostic when a declaration collides with visible scope. */
export function structuredNameConflict(
  path: string,
  conflicting: boolean,
): StructuredGenerationDiagnosticV2 | undefined {
  return conflicting
    ? structuredTypeFailure(
        path,
        "Declaration name shadows or duplicates a visible declaration.",
        "name-conflict",
      )
    : undefined;
}
