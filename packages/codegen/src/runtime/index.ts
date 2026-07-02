/**
 * `runtime/` barrel — RD-17 runtime-module embedding (03-04).
 */

export {
  RUNTIME_SECTION_HEADER,
  buildRuntimeSection,
  collectReferencedRoutines,
  loadRuntimeModule,
} from "./embed.js";
