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
export {
  emitBinary,
  defaultEmitDeps,
  type EmitOptions,
  type EmitDeps,
  type BuildResult,
} from "./acme/emit-binary.js";
