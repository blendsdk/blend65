/**
 * `runtime/` barrel — runtime-module embedding.
 */

export {
  RUNTIME_SECTION_HEADER,
  buildRuntimeSection,
  collectReferencedRoutines,
  loadPluginRuntimeModule,
  loadRuntimeModule,
} from "./embed.js";
