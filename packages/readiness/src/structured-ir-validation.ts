import type {
  GenerationDiagnostic,
  StructuredGenerationBudgetDimensionV2,
  StructuredIrValidationResult,
} from "./generator-ir.js";
import {
  inspectGeneratorInput,
  validateStructuredGeneratorIrSyntax,
} from "./generator-ir-validator.js";
import type { StructuredGenerationDiagnosticV2 } from "./structured-ir-diagnostics.js";
import {
  closeStructuredGenerationBudget,
  findStructuredShapeFailure,
  STRUCTURED_BUDGET_DOMAIN,
} from "./structured-ir-input.js";
import { validateStructuredModuleSemantics } from "./structured-ir-semantics.js";
import {
  deriveStructuredConstructionUsage,
  findStructuredBudgetFailure,
} from "./structured-ir-usage.js";

export type {
  StructuredDiagnosticFamilyV2,
  StructuredGenerationDiagnosticV2,
  StructuredGenerationReasonV2,
} from "./structured-ir-diagnostics.js";

/** Closed result of validating one structured generated program. */
export type StructuredGeneratorValidationResultV2 =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Deeply frozen structured module. */
      readonly module: Extract<StructuredIrValidationResult, { readonly ok: true }>["module"];
      /** Complete resource usage snapshot. */
      readonly usage: Readonly<Record<StructuredGenerationBudgetDimensionV2, bigint>>;
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Deterministic first-failure diagnostics. */
      readonly diagnostics: readonly StructuredGenerationDiagnosticV2[];
    };

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

function failed(
  value: StructuredGenerationDiagnosticV2,
): Extract<StructuredGeneratorValidationResultV2, { readonly ok: false }> {
  return Object.freeze({ ok: false, diagnostics: Object.freeze([Object.freeze(value)]) });
}

/**
 * Validates structured semantic closure for the legacy generator entry.
 *
 * @param module Structurally closed module.
 * @returns A compatible first failure, or `undefined` when closure succeeds.
 */
export function validateStructuredModuleForGenerator(
  module: Extract<StructuredIrValidationResult, { readonly ok: true }>["module"],
): GenerationDiagnostic | undefined {
  const failure = validateStructuredModuleSemantics(module);
  if (failure === undefined) return undefined;
  return Object.freeze({ code: failure.code, path: failure.path, message: failure.message });
}

/**
 * Validates, snapshots and accounts for one real structured generated program.
 *
 * @param module Unknown structured generator module.
 * @param budget Unknown structured resource budget.
 * @returns A deeply immutable module and usage snapshot, or one stable rejection.
 *
 * @example
 * ```ts
 * const result = validateStructuredGeneratorProgram(module, budget);
 * ```
 */
export function validateStructuredGeneratorProgram(
  module: unknown,
  budget: unknown,
): StructuredGeneratorValidationResultV2 {
  const inputFailure = inspectGeneratorInput(module, "", () => false);
  if (inputFailure !== undefined) {
    return failed({
      code: "generation-input-invalid",
      reason: inputFailure.message.includes("limit") ? "input-limit" : "input-invalid",
      path: inputFailure.path,
      message: inputFailure.message,
    });
  }
  const closedBudget = closeStructuredGenerationBudget(budget);
  if (closedBudget === undefined) {
    return failed({
      code: "generation-input-invalid",
      reason: "input-invalid",
      path: "/budget",
      message: `Structured budget must use ${STRUCTURED_BUDGET_DOMAIN}.`,
    });
  }
  const special = findStructuredShapeFailure(module);
  if (special !== undefined) return failed(special);
  const syntax = validateStructuredGeneratorIrSyntax(module);
  if (!syntax.ok) {
    const first = syntax.diagnostics[0];
    return failed({
      code: first?.code ?? "generation-input-invalid",
      reason: "input-invalid",
      path: first?.path ?? "",
      message: first?.message ?? "Structured module is invalid.",
    });
  }
  const semantic = validateStructuredModuleSemantics(syntax.module, closedBudget);
  if (semantic !== undefined) return failed(semantic);
  const usage = deriveStructuredConstructionUsage(syntax.module, closedBudget.maxLoopWork);
  const exceeded = findStructuredBudgetFailure(syntax.module, usage, closedBudget);
  if (exceeded !== undefined) return failed(exceeded);
  return Object.freeze({
    ok: true,
    module: syntax.module,
    usage: Object.freeze({ ...usage }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
