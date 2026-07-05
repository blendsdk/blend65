/**
 * The Blend65 semantic-analysis entry point (RD-04 §3.17, R118–R121).
 *
 * `analyze()` is the third stage of the front-end pipeline, after `lex()` and
 * `parse()`. It consumes the parsed `ProgramNode`s and produces the
 * {@link SemanticModel} that SFA frame planning (RD-05), IL lowering (RD-06),
 * codegen (RD-07), and the language server (RD-14) all consume.
 *
 * RD-17 wires the FIRST real semantic checking into this skeleton: minimal
 * declaration collection (structs/enums → the resolved type tables) and the
 * intrinsic-validation pass (arity, literal-arg ranges, availability, reserved-name
 * shadowing, sizeof/offsetof resolution, W10120). The remaining RD-04 passes
 * (full type resolution, control flow, name resolution) stay deferred. The
 * passthrough contract for intrinsic-free programs is preserved (no diagnostics,
 * empty maps, never throws — AC-01).
 *
 * This module lives in `@blend65/frontend` and imports `@blend65/core` (+ its
 * `/platform` subpath) only — never `@blend65/codegen` (R15/AR-20).
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
import { typeCheckPrograms } from "./type-check/statement-typing.js";

/**
 * Everything the semantic analyzer needs (RD-04 R118–R119, D6).
 *
 * An object — not positional parameters — mirroring RD-03's `ParseInput` (AR-8),
 * so the analyzer can add **optional** fields without a breaking signature change
 * (F1-Extensible). RD-17 adds `registry` and `targetProfile` this way.
 */
export interface AnalyzeInput {
  /** Parsed ASTs from all source files (one `ProgramNode` per file). */
  readonly programs: readonly ProgramNode[];
  /** The shared diagnostic accumulator. */
  readonly bag: DiagnosticBag;
  /** The interim platform profile (RD-04 R120). Not used for intrinsic checks. */
  readonly profile: PlatformProfile;
  /**
   * The intrinsic registry (RD-17 AR-P3). When absent, a core-only registry is
   * constructed internally (non-breaking) so existing callers keep working.
   */
  readonly registry?: IntrinsicRegistry;
  /**
   * The canonical RD-10 target profile (carries `cpu`/`platformId`/`zpArgBlockSize`).
   * Availability checks (V4) run only when it is present (PF-014).
   */
  readonly targetProfile?: CanonicalPlatformProfile;
}

/**
 * Runs semantic analysis over the parsed programs (RD-04 R118). Never throws.
 *
 * Pass 1 (declaration collection) and Pass 3 (body checking → intrinsic validation)
 * carry RD-17's real logic; Pass 2 (type resolution) and Pass 4 (post-check) remain
 * deferred no-op seams. The returned model exposes the resolved struct/enum tables
 * and an `hasErrors` flag reflecting errors the analyzer itself recorded.
 *
 * @param input The programs, diagnostic bag, profile, and optional registry/target.
 * @returns The {@link SemanticModel} (populated struct/enum tables; other maps empty).
 */
export function analyze(input: AnalyzeInput): SemanticModel {
  // The empty model owns the lone global scope that Pass-1 collection populates.
  // A single instance is kept so `collectFunctions` builds the module scopes into
  // the very `globalScope` the returned model exposes (and `scopeOf` falls back to).
  const empty = createEmptyModel();

  // Pass 1 — declaration collection (RD-17 AR-P13): resolve struct/enum tables, and
  // (RD-18 Slice 3a) the function/local collection into the model's scope tree. Each
  // Pass-1 collector stays single-responsibility; `passes.ts` is untouched (PF-002).
  const tables = collectDeclarations(input);
  const functionTables = collectFunctions(input.programs, empty.globalScope);

  // The error delta spans every analyzer pass that follows (intrinsic checks +
  // Slice-3b typing + post-check), so `hasErrors` reflects them all.
  const errorsBefore = input.bag.getErrors().length;

  // Pass 3 — body checking: the intrinsic-validation pass (RD-17 03-02) plus the
  // RD-18 Slice 3b expression/statement type engine, which populates the maps.
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
  // functions (no edges — user calls arrive in Slice 5), `mainFunction`, `scopeOf`
  // resolving a decl → its body scope, and the now-real `typeMap`/`symbolMap` with
  // `typeOf`/`symbolOf` reading them (superseding the Slice-3a empty passthrough, AR-12).
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
  // Pass 4 — post-check: `main()` validity (RD-18 Slice 3b), wired into passes.ts.
  postCheck(input, model);

  return { ...model, hasErrors: input.bag.getErrors().length > errorsBefore };
}
