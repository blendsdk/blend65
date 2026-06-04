/**
 * Public barrel for the Blend65 semantic analyzer (RD-04, frontend half).
 *
 * Re-exports the `analyze` entry point and its `AnalyzeInput` type. The semantic
 * *data* vocabulary (`SemanticModel`, `Type`, `Scope`, `Symbol`, …) lives in
 * `@blend65/core` and is imported from there, so `frontend` and `language-server`
 * share one source of semantic truth without importing `@blend65/codegen`
 * (R15/AR-20). The four internal pass seams (`passes.ts`) are deliberately NOT
 * re-exported — they are an implementation detail of `analyze()`.
 */
export { analyze } from "./analyze.js";
export type { AnalyzeInput } from "./analyze.js";
