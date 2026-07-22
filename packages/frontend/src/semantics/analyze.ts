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
  AssetReader,
  AstNode,
  ConstValue,
  DiagnosticBag,
  ExprNode,
  ForLoopInfo,
  IntrinsicRegistry,
  PlatformProfile,
  ProgramNode,
  Scope,
  SemanticModel,
  SourceSpan,
  Symbol,
  Type,
} from "@blend65/core";
import {
  createEmptyModel,
  createIntrinsicRegistry,
  ERROR_TYPE,
  findCallCycles,
} from "@blend65/core";
import type {
  CharEncoder,
  PlatformProfile as CanonicalPlatformProfile,
} from "@blend65/core/platform";
import { encoderFor } from "@blend65/core/platform";
import { collectDeclarations, resolveTypes, checkBodies, postCheck } from "./passes.js";
import { ConstTypeEngine } from "./const-type-engine.js";
import { computePairAccessedParams } from "./pair-access.js";
import { checkParameterShadowing, collectFunctions } from "./function-collection.js";
import { collectModuleVariables } from "./module-variable-collection.js";
import { resolveImports } from "./import-resolution.js";
import { computeInitOrder } from "./init-order.js";
import { typeCheckPrograms } from "./type-check/statement-typing.js";
import type { FnSignature } from "./type-check/context.js";

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
  /**
   * The character encoder for string/char literals. When absent, it is
   * derived from `targetProfile.defaultEncoding` (raw ASCII when neither is
   * present) — the override exists for third-party platform plugins.
   */
  readonly encoder?: CharEncoder;
  /**
   * The binary asset reader backing `embed()`. Injected by compiler-layer
   * hosts; when absent (tests, editors without disk policy), an `embed()`
   * initialiser poisons silently — no diagnostic, no fabricated size.
   */
  readonly assetReader?: AssetReader;
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

  // The error delta spans every analyzer pass (collection + import resolution +
  // intrinsic checks + expression/statement typing + post-check), so
  // `hasErrors` reflects them all.
  const errorsBefore = input.bag.getErrors().length;

  // Pass 1 — declaration collection: the function/parameter/local collection
  // builds the module scopes first, then struct/enum collection resolves the
  // FQN-keyed type tables into those scopes (one namespace — a type name
  // colliding with a function is E10003). Each collector stays
  // single-responsibility.
  const functionTables = collectFunctions(input.programs, empty.globalScope, input.bag);
  const tables = collectDeclarations(input, functionTables.moduleScopeByProgram);

  // Pass 1 (cont.) — collect module-level scalars into their module scopes, so
  // body references resolve to them and SFA can lay out `__var_*`. E10003 on a
  // duplicate top-level declaration. The returned map records each `let`'s
  // initialiser for the initialization-order pass below.
  const initializers = collectModuleVariables(
    input.programs,
    functionTables.moduleScopeByProgram,
    input.bag,
  );

  // Pass 1 (cont.) — resolve user-module imports (aliasing exported symbols
  // into the importing module scope; E10012/E10003), then reject parameters
  // that shadow a module-level name (E10101) now that every module-level name
  // — declared or imported — exists. The returned import edges drive the
  // module ordering of the initialization-order pass.
  const importEdges = resolveImports(
    input.programs,
    functionTables.moduleScopeByProgram,
    functionTables.moduleScopeByName,
    input.bag,
  );
  checkParameterShadowing(functionTables.scopeByNode, input.bag);

  // Pass 2 — type resolution: with imports bound, the const/type engine
  // computes struct layouts / enum values / module constants (one
  // path-carrying diagnostic per definition cycle), then every variable/
  // constant symbol's declared type (named/array annotations, incl.
  // import-bound and dotted `Mod.Type` forms, and constant-expression array
  // sizes) is finalized in place.
  const engine = new ConstTypeEngine({
    registries: tables.registries,
    moduleScopes: functionTables.moduleScopeByName,
    structTypes: tables.mutableStructTypes,
    enumTypes: tables.mutableEnumTypes,
    bag: input.bag,
    encoder: input.encoder ?? encoderFor(input.targetProfile?.defaultEncoding),
  });
  resolveTypes(engine, functionTables.moduleScopeByName, functionTables.scopeByNode, input);

  // Pass 3 — body checking: the intrinsic-validation pass plus the
  // expression/statement type engine, which populates the maps and records
  // the call-graph edges.
  const registry = input.registry ?? createIntrinsicRegistry();
  checkBodies(input, functionTables.moduleScopeByProgram, functionTables.moduleScopeByName, registry);

  const typeMap = new Map<ExprNode, Type>();
  const symbolMap = new Map<AstNode, Symbol>();
  const forLoopInfo = new Map<AstNode, ForLoopInfo>();
  const callEdges = new Map<Symbol, Set<Symbol>>();
  const callSiteSpans = new Map<Symbol, Map<Symbol, SourceSpan>>();
  const constValues = new Map<Symbol, ConstValue>();
  const addressTakenFunctions = new Set<Symbol>();
  const embeddedAssets = new Map<string, string>();
  typeCheckPrograms(input.programs, functionTables.scopeByNode, functionTables.moduleScopeByProgram, {
    bag: input.bag,
    typeMap,
    symbolMap,
    forLoopInfo,
    signatures: new Map<Symbol, FnSignature>(),
    mainFunction: functionTables.mainFunction,
    callEdges,
    callSiteSpans,
    moduleScopes: functionTables.moduleScopeByName,
    constValues,
    addressTakenFunctions,
    registry,
    engine,
    ...(input.assetReader === undefined ? {} : { assetReader: input.assetReader }),
    embeddedAssets,
  });

  // The module-variable initialization order (spec Ch 10 §5.4) — needs the
  // symbol map typing just filled; one E10194 per dependency cycle.
  const modules: { name: string; scope: Scope }[] = [];
  const seenScopes = new Set<Scope>();
  for (const program of input.programs) {
    const scope = functionTables.moduleScopeByProgram.get(program);
    const name = program.moduleDecl?.name;
    if (scope === undefined || name === undefined || seenScopes.has(scope)) continue;
    seenScopes.add(scope);
    modules.push({ name, scope });
  }
  const initOrder = computeInitOrder({
    modules,
    importEdges,
    initializers,
    symbolMap,
    bag: input.bag,
  });

  // Build the populated model: struct/enum tables, the call graph over the
  // collected functions with the recorded edges (cycle detection is the
  // bounded Tarjan pass), `mainFunction`, `scopeOf` resolving a decl → its
  // body scope, and the now-real `typeMap`/`symbolMap` with `typeOf`/
  // `symbolOf` reading them (superseding the earlier empty passthrough).
  // The pair-access classification: which by-ref parameters are accessed
  // THROUGH their pointer (element/field access or whole-copy endpoint).
  // Frame planning and lowering both consume this one set.
  const pairAccessedParams = computePairAccessedParams(
    input.programs,
    functionTables.scopeByNode,
  );

  const functions = functionTables.functions;
  const model: SemanticModel = {
    ...empty,
    structTypes: tables.structTypes,
    enumTypes: tables.enumTypes,
    typeMap,
    symbolMap,
    forLoopInfo,
    pairAccessedParams,
    addressTakenFunctions,
    callGraph: {
      functions,
      edges: callEdges,
      findCycles: () => findCallCycles(functions, callEdges),
    },
    initOrder,
    constValues,
    embeddedAssets,
    mainFunction: functionTables.mainFunction,
    scopeOf: (node) => functionTables.scopeByNode.get(node) ?? empty.globalScope,
    typeOf: (expr) => typeMap.get(expr) ?? ERROR_TYPE,
    symbolOf: (node) => symbolMap.get(node) ?? null,
    hasErrors: false, // set below once the full error delta is known
  };

  // Pass 4 — post-check: `main()` validity, all-paths-return, and recursion
  // rejection (the E10174 poison must land before frame planning consumes
  // the call graph).
  postCheck(input, model, callSiteSpans);

  return { ...model, hasErrors: input.bag.getErrors().length > errorsBefore };
}
