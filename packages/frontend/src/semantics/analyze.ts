/**
 * The Blend65 semantic-analysis entry point (RD-04 §3.17, R118–R121).
 *
 * `analyze()` is the third stage of the front-end pipeline, after `lex()` and
 * `parse()`. It consumes the parsed `ProgramNode`s and produces the
 * {@link SemanticModel} that SFA frame planning (RD-05), IL lowering (RD-06),
 * codegen (RD-07), and the language server (RD-14) all consume.
 *
 * 🚧 PASSTHROUGH (RD-04 plan, D1/D2/D3): this implementation performs NO semantic
 * checking. It returns a structurally-valid **empty** `SemanticModel`
 * (`hasErrors === false`, `mainFunction === null`, a lone global scope, empty
 * maps), emits **no** diagnostics, and **never throws** (AC-01) — even on an AST
 * full of parser error-sentinels. The real four-pass type/scope/control-flow
 * analyzer is DEFERRED; see
 * plans/rd-04-semantic-analysis/08-deferred-semantics-ledger.md for the full map
 * of what is not yet implemented and which diagnostic codes each deferred check
 * will emit.
 *
 * This module lives in `@blend65/frontend` and imports `@blend65/core` only —
 * never `@blend65/codegen` (R15/AR-20).
 */

import type { DiagnosticBag, PlatformProfile, ProgramNode, SemanticModel } from "@blend65/core";
import { createEmptyModel } from "@blend65/core";
import { collectDeclarations, resolveTypes, checkBodies, postCheck } from "./passes.js";

/**
 * Everything the semantic analyzer needs (RD-04 R118–R119, D6).
 *
 * An object — not positional parameters — mirroring RD-03's `ParseInput` (AR-8),
 * so the future checker can add **optional** fields (options, a cancellation
 * token for the LSP) without a breaking signature change (F1-Extensible).
 */
export interface AnalyzeInput {
  /** Parsed ASTs from all source files (one `ProgramNode` per file). */
  readonly programs: readonly ProgramNode[];
  /** The shared diagnostic accumulator. PASSTHROUGH: nothing is added (D3). */
  readonly bag: DiagnosticBag;
  /** The platform profile (RD-04 R120). PASSTHROUGH: accepted but not read (D4). */
  readonly profile: PlatformProfile;
}

/**
 * Runs semantic analysis over the parsed programs (RD-04 R118). Never throws.
 *
 * In the passthrough skeleton this builds and returns the empty model, calling
 * each of the four pass seams once (in order) purely for traceability — they are
 * no-ops here. The returned model satisfies AC-01: a valid `SemanticModel` with
 * `hasErrors === false`, regardless of the input's contents.
 *
 * @param input The programs, diagnostic bag, and platform profile (D6).
 * @returns A structurally-valid, semantically-empty {@link SemanticModel} (D2).
 */
export function analyze(input: AnalyzeInput): SemanticModel {
  const model = createEmptyModel();

  // The four-pass architecture (RD-04 R1–R6) is represented by named seams. In
  // the passthrough these are no-ops; the future checker fills them in order.
  // Called for traceability only — they neither read the input nor mutate the
  // model in this skeleton.
  collectDeclarations(input, model); // Pass 1 — DEFERRED(RD-04-checker): R2
  resolveTypes(input, model); // Pass 2 — DEFERRED(RD-04-checker): R3
  checkBodies(input, model); // Pass 3 — DEFERRED(RD-04-checker): R4
  postCheck(input, model); // Pass 4 — DEFERRED(RD-04-checker): R5

  return model;
}
