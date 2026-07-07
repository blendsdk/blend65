/**
 * The four semantic-analysis pass seams (RD-04 §4.1, R1–R6).
 *
 * The RD-04 analyzer is a four-pass pipeline: declaration collection, type
 * resolution, body checking, and post-check validation. RD-17 fills in the two
 * passes its intrinsic work needs — Pass 1 (`collectDeclarations`) resolves the
 * minimal struct/enum tables (AR-P13) and Pass 3 (`checkBodies`) runs the
 * intrinsic-validation checks (03-02). Pass 2 (`resolveTypes`) and Pass 4
 * (`postCheck`) remain deferred no-op seams; see
 * plans/rd-04-semantic-analysis/08-deferred-semantics-ledger.md.
 */

import type { IntrinsicRegistry, SemanticModel } from "@blend65/core";
import type { AnalyzeInput } from "./analyze.js";
import { collectDeclarationTables } from "./declaration-collection.js";
import type { DeclarationTables } from "./declaration-collection.js";
import { validateIntrinsics } from "./intrinsic-validation.js";
import { checkAllPathsReturn, checkMainValidity } from "./post-check.js";

/**
 * Pass 1 — Declaration Collection (RD-04 R2, §4.1; RD-17 AR-P13).
 *
 * Resolves the top-level struct/enum declarations into the type tables that body
 * checking (V7) and codegen folding consume. The remaining RD-04 Pass-1 duties
 * (module registration, export visibility, duplicate-decl E10003) stay deferred.
 *
 * @param input The analyzer input.
 * @returns The resolved struct/enum type tables.
 */
export function collectDeclarations(input: AnalyzeInput): DeclarationTables {
  return collectDeclarationTables(input.programs);
}

/**
 * Pass 2 — Type Resolution (RD-04 R3, §4.1).
 *
 * DEFERRED(RD-04-checker): resolve named types, validate struct fields (no
 * recursion), validate enum backing values. Emits E10151/E10142/E10143/E10163.
 *
 * @param _input The analyzer input (unused in the skeleton).
 * @param _model The model under construction (unused in the skeleton).
 */
export function resolveTypes(_input: AnalyzeInput, _model: SemanticModel): void {
  // no-op (deferred)
}

/**
 * Pass 3 — Body Checking (RD-04 R4, §4.1; RD-17 03-02).
 *
 * Runs the intrinsic-validation pass: arity, literal-arg ranges, availability,
 * reserved-name shadowing, sizeof/offsetof resolution, and W10120. The broader
 * RD-04 body checking (general expression typing, const-eval, call graph) stays
 * deferred.
 *
 * @param input The analyzer input (programs, bag, optional target profile).
 * @param tables The resolved struct/enum type tables from Pass 1.
 * @param registry The populated intrinsic registry.
 */
export function checkBodies(
  input: AnalyzeInput,
  tables: DeclarationTables,
  registry: IntrinsicRegistry,
): void {
  validateIntrinsics(input.programs, {
    registry,
    tables,
    bag: input.bag,
    // `exactOptionalPropertyTypes`: omit the field entirely when there is no
    // target profile rather than passing `undefined`.
    ...(input.targetProfile !== undefined ? { targetProfile: input.targetProfile } : {}),
  });
}

/**
 * Pass 4 — Post-Check Validation (RD-04 R5, §4.1; RD-18 Slice 3b FR-5).
 *
 * Slice 3b fills the entry-point half of this seam: `main()` validity
 * (E10020/E10021/E10022) via {@link checkMainValidity}. RD-18 Slice 4a adds
 * all-paths-return validation (E10102) via {@link checkAllPathsReturn} (FR-6).
 * Both read `input.programs` directly. The remaining RD-04 Pass-4 duties
 * (recursion detection, module init order, unused variables, unreachable code)
 * stay deferred.
 *
 * @param input The analyzer input (programs + diagnostic bag).
 * @param _model The model under construction (unused — the checks read programs).
 */
export function postCheck(input: AnalyzeInput, _model: SemanticModel): void {
  checkMainValidity(input.programs, input.bag);
  checkAllPathsReturn(input.programs, input.bag);
}
