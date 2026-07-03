/**
 * Public barrel for `@blend65/compiler` — the integration layer that drives the
 * compiler pipeline to a platform binary.
 *
 * RD-09 ships the ACME emitter/assembler-integration process layer (the `acme/`
 * module): ACME discovery, invocation, VICE label-file parsing, and the top-level
 * `emitBinary` orchestration with the post-ACME binary-size budget check. The pure
 * whole-program serializer (`serializeToAcme`) lives in `@blend65/codegen`; this
 * package owns the filesystem/process I/O (R15/AR-20).
 */

export const VERSION = "0.1.0";

// RD-09 ACME process layer.
export {
  discoverAcme,
  defaultAcmeProbes,
  ACME_NOT_FOUND_MESSAGE,
  type AcmeDiscovery,
  type AcmeProbes,
} from "./acme/discover-acme.js";
export {
  invokeAcme,
  defaultAcmeRunner,
  type AcmeInvocation,
  type AcmeResult,
  type AcmeRunner,
  type AcmeRunOutput,
} from "./acme/invoke-acme.js";
export { parseLabelFile } from "./acme/label-file.js";

// RD-15 disk-backed CompilerHost (R12/R47).
export * from "./host/index.js";
export {
  emitBinary,
  defaultEmitDeps,
  type EmitOptions,
  type EmitDeps,
  // PF-002: the acme-layer aggregate is `EmitBinaryResult`; the `BuildResult`
  // name is owned by the RD-15 facade result type (exported from `./api/`).
  type EmitBinaryResult,
} from "./acme/emit-binary.js";
