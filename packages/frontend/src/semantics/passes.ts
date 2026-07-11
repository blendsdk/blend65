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
  AstNode,
  IntrinsicRegistry,
  ProgramNode,
  Scope,
  SemanticModel,
  SourceSpan,
  Symbol,
} from "@blend65/core";
import type { AnalyzeInput } from "./analyze.js";
import { collectDeclarationTables } from "./declaration-collection.js";
import type { DeclarationRegistration } from "./declaration-collection.js";
import { resolveDeclaredTypes } from "./annotation-resolution.js";
import type { ConstTypeEngine } from "./const-type-engine.js";
import { validateIntrinsics } from "./intrinsic-validation.js";
import { checkAllPathsReturn, checkMainValidity, checkRecursion } from "./post-check.js";

/**
 * Pass 1 — Declaration Collection (struct/enum half).
 *
 * Registers the top-level struct/enum declarations per module and declares
 * each as a symbol in its module scope (one namespace — collisions are
 * E10003). Layout resolution is the const/type engine's job in Pass 2. Runs
 * after function collection created the module scopes.
 *
 * @param input The analyzer input.
 * @param moduleScopeByProgram Each program → its module scope.
 * @returns The registries + the (engine-filled) FQN type tables.
 */
export function collectDeclarations(
  input: AnalyzeInput,
  moduleScopeByProgram: ReadonlyMap<ProgramNode, Scope>,
): DeclarationRegistration {
  return collectDeclarationTables(input.programs, moduleScopeByProgram, input.bag);
}

/**
 * Pass 2 — Type Resolution.
 *
 * Drives the const/type engine exhaustively (struct layouts, enum values,
 * module constants — deterministic module-then-declaration order; any
 * definition cycle is ONE path-carrying E10165/E10194), then finalizes every
 * variable/constant symbol's declared type: named/array annotations (incl.
 * import-bound and dotted `Mod.Type` forms, and constant-expression array
 * sizes through the engine) resolve for real, `void` value positions are
 * E10156, unknown names E10151, non-exported cross-module types E10012.
 *
 * @param engine The shared const/type engine (constructed after imports).
 * @param moduleScopes User-module name → its shared module scope.
 * @param scopeByNode Function decl → its body scope.
 * @param input The analyzer input (diagnostic bag).
 */
export function resolveTypes(
  engine: ConstTypeEngine,
  moduleScopes: ReadonlyMap<string, Scope>,
  scopeByNode: ReadonlyMap<AstNode, Scope>,
  input: AnalyzeInput,
): void {
  engine.driveAll();
  resolveDeclaredTypes(moduleScopes, scopeByNode, input.bag, engine);
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
 * @param moduleScopeByProgram Each program → its module scope (type lookups).
 * @param moduleScopes User-module name → its shared scope (dotted type args).
 * @param registry The populated intrinsic registry.
 */
export function checkBodies(
  input: AnalyzeInput,
  moduleScopeByProgram: ReadonlyMap<ProgramNode, Scope>,
  moduleScopes: ReadonlyMap<string, Scope>,
  registry: IntrinsicRegistry,
): void {
  validateIntrinsics(input.programs, {
    registry,
    moduleScopeByProgram,
    moduleScopes,
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
