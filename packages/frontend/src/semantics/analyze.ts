/**
 * The Blend65 semantic-analysis entry point.
 *
 * `analyze()` is the third stage of the front-end pipeline, after `lex()` and
 * `parse()`. It consumes the parsed `ProgramNode`s and produces the
 * {@link SemanticModel} that SFA frame planning, IL lowering, codegen, and
 * the language server all consume.
 *
 * This is where the first real semantic checking was wired into what started
 * as a skeleton: minimal declaration collection (structs/enums → the resolved
 * type tables) and the intrinsic-validation pass (arity, literal-arg ranges,
 * availability, reserved-name shadowing, sizeof/offsetof resolution, W10120).
 * The remaining passes (full type resolution, control flow, name resolution)
 * stay deferred. The passthrough contract for intrinsic-free programs is
 * preserved (no diagnostics, empty maps, never throws).
 *
 * This module lives in `@blend65/frontend` and imports `@blend65/core` (+ its
 * `/platform` subpath) only — never `@blend65/codegen`, to keep the frontend/
 * language-server boundary intact.
 */

import type {
  AstNode,
  DiagnosticBag,
  ExprNode,
  IntrinsicRegistry,
  PlatformProfile,
  ProgramNode,
  SemanticModel,
  Symbol,
  Type,
} from "@blend65/core";
import { createEmptyModel, createIntrinsicRegistry, ERROR_TYPE } from "@blend65/core";
import type { PlatformProfile as CanonicalPlatformProfile } from "@blend65/core/platform";
import { collectDeclarations, resolveTypes, checkBodies, postCheck } from "./passes.js";
import { collectFunctions } from "./function-collection.js";
import { collectModuleVariables } from "./module-variable-collection.js";
import { typeCheckPrograms } from "./type-check/statement-typing.js";

/**
 * Everything the semantic analyzer needs.
 *
 * An object — not positional parameters — mirroring the parser's `ParseInput`,
 * so the analyzer can add **optional** fields without a breaking signature
 * change. `registry` and `targetProfile` were added this way.
 */
export interface AnalyzeInput {
  /** Parsed ASTs from all source files (one `ProgramNode` per file). */
  readonly programs: readonly ProgramNode[];
  /** The shared diagnostic accumulator. */
  readonly bag: DiagnosticBag;
  /** The interim platform profile. Not used for intrinsic checks. */
  readonly profile: PlatformProfile;
  /**
   * The intrinsic registry. When absent, a core-only registry is constructed
   * internally (non-breaking) so existing callers keep working.
   */
  readonly registry?: IntrinsicRegistry;
  /**
   * The canonical target profile (carries `cpu`/`platformId`/`zpArgBlockSize`).
   * Availability checks run only when it is present.
   */
  readonly targetProfile?: CanonicalPlatformProfile;
}

/**
 * Runs semantic analysis over the parsed programs. Never throws.
 *
 * Pass 1 (declaration collection) and Pass 3 (body checking → intrinsic
 * validation) carry the real logic; Pass 2 (type resolution) and Pass 4
 * (post-check) remain deferred no-op seams. The returned model exposes the
 * resolved struct/enum tables and an `hasErrors` flag reflecting errors the
 * analyzer itself recorded.
 *
 * @param input The programs, diagnostic bag, profile, and optional registry/target.
 * @returns The {@link SemanticModel} (populated struct/enum tables; other maps empty).
 */
export function analyze(input: AnalyzeInput): SemanticModel {
  // The empty model owns the lone global scope that Pass-1 collection populates.
  // A single instance is kept so `collectFunctions` builds the module scopes into
  // the very `globalScope` the returned model exposes (and `scopeOf` falls back to).
  const empty = createEmptyModel();

  // Pass 1 — declaration collection: resolve struct/enum tables, and the
  // function/local collection into the model's scope tree. Each Pass-1
  // collector stays single-responsibility; `passes.ts` is untouched.
  const tables = collectDeclarations(input);
  const functionTables = collectFunctions(input.programs, empty.globalScope);

  // The error delta spans every analyzer pass that follows (module-var collection +
  // intrinsic checks + expression/statement typing + post-check), so `hasErrors`
  // reflects them all.
  const errorsBefore = input.bag.getErrors().length;

  // Pass 1 (cont.) — collect module-level scalars into their module scopes, so
  // body references resolve to them and SFA can lay out `__var_*`. E10003 on a
  // duplicate top-level declaration.
  collectModuleVariables(input.programs, empty.globalScope, input.bag);

  // Pass 3 — body checking: the intrinsic-validation pass plus the
  // expression/statement type engine, which populates the maps.
  const registry = input.registry ?? createIntrinsicRegistry();
  checkBodies(input, tables, registry);

  const typeMap = new Map<ExprNode, Type>();
  const symbolMap = new Map<AstNode, Symbol>();
  typeCheckPrograms(input.programs, functionTables.scopeByNode, {
    bag: input.bag,
    typeMap,
    symbolMap,
  });

  // Build the populated model: struct/enum tables, the call graph over the collected
  // functions (no edges yet — user calls are wired in later), `mainFunction`, `scopeOf`
  // resolving a decl → its body scope, and the now-real `typeMap`/`symbolMap` with
  // `typeOf`/`symbolOf` reading them (superseding the earlier empty passthrough).
  const model: SemanticModel = {
    ...empty,
    structTypes: tables.structTypes,
    enumTypes: tables.enumTypes,
    typeMap,
    symbolMap,
    callGraph: {
      functions: functionTables.functions,
      edges: new Map(),
      findCycles: () => [],
    },
    mainFunction: functionTables.mainFunction,
    scopeOf: (node) => functionTables.scopeByNode.get(node) ?? empty.globalScope,
    typeOf: (expr) => typeMap.get(expr) ?? ERROR_TYPE,
    symbolOf: (node) => symbolMap.get(node) ?? null,
    hasErrors: false, // set below once the full error delta is known
  };

  // Pass 2 — DEFERRED no-op seam (no struct/enum sizing needed for scalars).
  resolveTypes(input, model);
  // Pass 4 — post-check: `main()` validity, wired into passes.ts.
  postCheck(input, model);

  return { ...model, hasErrors: input.bag.getErrors().length > errorsBefore };
}
