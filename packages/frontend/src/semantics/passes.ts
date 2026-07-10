/**
 * The four semantic-analysis pass seams.
 *
 * The analyzer is a four-pass pipeline: declaration collection, type
 * resolution, body checking, and post-check validation. The intrinsic work
 * fills in the two passes it needs — Pass 1 (`collectDeclarations`) resolves
 * the minimal struct/enum tables and Pass 3 (`checkBodies`) runs the
 * intrinsic-validation checks. Pass 2 (`resolveTypes`) and Pass 4
 * (`postCheck`) remain deferred no-op seams.
 */

import type {
  IntrinsicRegistry,
  SemanticModel,
  SourceSpan,
  Symbol,
} from "@blend65/core";
import type { AnalyzeInput } from "./analyze.js";
import { collectDeclarationTables } from "./declaration-collection.js";
import type { DeclarationTables } from "./declaration-collection.js";
import { validateIntrinsics } from "./intrinsic-validation.js";
import { checkAllPathsReturn, checkMainValidity, checkRecursion } from "./post-check.js";

/**
 * Pass 1 — Declaration Collection.
 *
 * Resolves the top-level struct/enum declarations into the type tables that body
 * checking and codegen folding consume. The remaining Pass-1 duties
 * (module registration, export visibility, duplicate-decl E10003) stay deferred.
 *
 * @param input The analyzer input.
 * @returns The resolved struct/enum type tables.
 */
export function collectDeclarations(input: AnalyzeInput): DeclarationTables {
  return collectDeclarationTables(input.programs);
}

/**
 * Pass 2 — Type Resolution.
 *
 * DEFERRED: resolve named types, validate struct fields (no recursion),
 * validate enum backing values. Emits E10151/E10142/E10143/E10163.
 *
 * @param _input The analyzer input (unused in the skeleton).
 * @param _model The model under construction (unused in the skeleton).
 */
export function resolveTypes(_input: AnalyzeInput, _model: SemanticModel): void {
  // no-op (deferred)
}

/**
 * Pass 3 — Body Checking.
 *
 * Runs the intrinsic-validation pass: arity, literal-arg ranges, availability,
 * reserved-name shadowing, sizeof/offsetof resolution, and W10120. The broader
 * body checking (general expression typing, const-eval, call graph) stays
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
 * Pass 4 — Post-Check Validation.
 *
 * Fills the entry-point half of this seam: `main()` validity
 * (E10020/E10021/E10022) via {@link checkMainValidity}, all-paths-return
 * validation (E10102) via {@link checkAllPathsReturn}, and recursion
 * rejection (one E10174 per call cycle) via {@link checkRecursion} over the
 * model's call graph. The remaining Pass-4 duties (module init order, unused
 * variables, unreachable code) stay deferred.
 *
 * @param input The analyzer input (programs + diagnostic bag).
 * @param model The model under construction (supplies the call graph).
 * @param callSiteSpans First call-site span per call edge (recursion anchors).
 */
export function postCheck(
  input: AnalyzeInput,
  model: SemanticModel,
  callSiteSpans: ReadonlyMap<Symbol, ReadonlyMap<Symbol, SourceSpan>> = new Map(),
): void {
  checkMainValidity(input.programs, input.bag);
  checkAllPathsReturn(input.programs, input.bag);
  checkRecursion(model.callGraph, callSiteSpans, input.bag);
}
