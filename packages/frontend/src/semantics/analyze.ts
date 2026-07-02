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
  DiagnosticBag,
  IntrinsicRegistry,
  PlatformProfile,
  ProgramNode,
  SemanticModel,
} from "@blend65/core";
import { createEmptyModel, createIntrinsicRegistry } from "@blend65/core";
import type { PlatformProfile as CanonicalPlatformProfile } from "@blend65/core/platform";
import { collectDeclarations, resolveTypes, checkBodies, postCheck } from "./passes.js";

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
  // Pass 1 — declaration collection (RD-17 AR-P13): resolve struct/enum tables.
  const tables = collectDeclarations(input);

  // Pass 3 — body checking: the intrinsic-validation pass (RD-17 03-02).
  const registry = input.registry ?? createIntrinsicRegistry();
  const errorsBefore = input.bag.getErrors().length;
  checkBodies(input, tables, registry);
  const analyzerRecordedError = input.bag.getErrors().length > errorsBefore;

  // Build the model with the resolved type tables; other maps stay empty (deferred).
  const model: SemanticModel = {
    ...createEmptyModel(),
    structTypes: tables.structTypes,
    enumTypes: tables.enumTypes,
    hasErrors: analyzerRecordedError,
  };

  // Pass 2 / Pass 4 — DEFERRED(RD-04-checker) no-op seams, called for traceability.
  resolveTypes(input, model);
  postCheck(input, model);

  return model;
}
