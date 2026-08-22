/**
 * Public barrel for `@blend65/compiler` — the integration layer that drives the
 * compiler pipeline to a platform binary.
 *
 * This package ships the ACME emitter/assembler-integration process layer (the
 * `acme/` module): ACME discovery, invocation, VICE label-file parsing, and the
 * top-level `emitBinary` orchestration with the post-ACME binary-size budget
 * check. The pure whole-program serializer (`serializeToAcme`) lives in
 * `@blend65/codegen`; this package owns the filesystem/process I/O, keeping
 * that boundary out of the frontend and language-server packages.
 */

export const VERSION = "0.1.0";

// The ACME process layer.
export {
  discoverAcme,
  defaultAcmeProbes,
  ACME_NOT_FOUND_MESSAGE,
  type AcmeDiscovery,
  type AcmeProbes,
} from "./acme/discover-acme.js";
export {
  invokeAcme,
  invokeBoundedAcmeV1,
  defaultAcmeRunner,
  type AcmeProcessControlsV1,
  type AcmeInvocation,
  type AcmeResult,
  type AcmeRunner,
  type AcmeRunOutput,
  type BoundedAcmeRunnerV1,
} from "./acme/invoke-acme.js";
export { parseLabelFile } from "./acme/label-file.js";
export { parseReportFile, cycleRange, type ReportInstruction } from "./acme/report-file.js";

// The disk-backed CompilerHost.
export * from "./host/index.js";

// The programmatic API (facade): compile/build/emitAsm/emitIl.
export * from "./api/index.js";
export {
  emitBinary,
  defaultEmitDeps,
  type EmitOptions,
  type EmitDeps,
  // The acme-layer aggregate is named `EmitBinaryResult`; `BuildResult` is
  // reserved for the facade result type (exported from `./api/`).
  type EmitBinaryResult,
} from "./acme/emit-binary.js";
