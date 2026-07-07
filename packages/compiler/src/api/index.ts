/**
 * Public barrel for the programmatic API (`api/`).
 *
 * The four facade functions over one shared pipeline core, plus their option and
 * result types and the `build()` injection seam. The pipeline internals
 * (`run-frontend`, result assembly, the asm helper) are intentionally NOT
 * re-exported — the facade is the public surface.
 */

export type { CompilerOptions } from "./options.js";
export type { CompileResult, EmitResult, BuildResult } from "./results.js";
export { compile } from "./compile.js";
export { emitIl, emitAsm } from "./emit.js";
export { build, defaultBuildDeps, type BuildDeps } from "./build.js";
