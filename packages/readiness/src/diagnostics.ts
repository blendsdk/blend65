import type { DiagnosticPhase, InventoryDiagnostic } from "./model.js";

const PHASE_ORDER: Readonly<Record<DiagnosticPhase, number>> = {
  input: 0,
  schema: 1,
  source: 2,
  declaration: 3,
  conflict: 4,
  ledger: 5,
  graph: 6,
  evolution: 7,
};

function compareOptionalNumber(left: number | undefined, right: number | undefined): number {
  return (left ?? Number.MAX_SAFE_INTEGER) - (right ?? Number.MAX_SAFE_INTEGER);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Compares diagnostics using the stable public ordering contract.
 *
 * @param left First diagnostic.
 * @param right Second diagnostic.
 * @returns Negative, zero, or positive ordering value.
 */
export function compareDiagnostics(left: InventoryDiagnostic, right: InventoryDiagnostic): number {
  return (
    PHASE_ORDER[left.phase] - PHASE_ORDER[right.phase] ||
    compareText(left.code, right.code) ||
    compareText(left.path, right.path) ||
    compareOptionalNumber(left.location?.line, right.location?.line) ||
    compareOptionalNumber(left.location?.column, right.location?.column) ||
    compareText(left.message, right.message)
  );
}

/**
 * Returns a sorted copy without mutating the caller's values.
 *
 * @param diagnostics Diagnostics to order.
 * @returns Newly allocated deterministic ordering.
 */
export function sortDiagnostics(
  diagnostics: readonly InventoryDiagnostic[],
): readonly InventoryDiagnostic[] {
  return [...diagnostics].sort(compareDiagnostics);
}

/**
 * Creates a complete diagnostic with standard defaults.
 *
 * @param diagnostic Required fields and optional defaults.
 * @returns Complete diagnostic value.
 */
export function createDiagnostic(
  diagnostic: Omit<InventoryDiagnostic, "relatedPaths" | "severity"> &
    Partial<Pick<InventoryDiagnostic, "relatedPaths" | "severity">>,
): InventoryDiagnostic {
  return {
    ...diagnostic,
    severity: diagnostic.severity ?? "error",
    relatedPaths: diagnostic.relatedPaths ?? [],
  };
}
