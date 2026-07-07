/**
 * The `@blend65/core/platform` subpath barrel.
 *
 * This is the single dedicated core subpath for platform concerns. It surfaces:
 *
 * 1. The relocated pure-data Instr/stream model (`../instr-model/`) — moved
 *    to core so the platform plugin hooks can return `StreamEntry[]` /
 *    `AcmeDirective` without a core→codegen dependency, routed through this
 *    single barrel (no separate `@blend65/core/instr-model` package export).
 * 2. The canonical `PlatformProfile` data type, the `PlatformPlugin` interface
 *    + hook types, and `validateProfileFields`.
 *
 * The **root** `@blend65/core` barrel is untouched: it continues to export an
 * interim `PlatformProfile` so shipped code and tests keep passing. The
 * canonical types here are reachable only from this subpath.
 */

// Relocated pure-data Instr/stream model — re-exported through this single
// subpath so `@blend65/codegen` and the platform plugins share one model.
export * from "../instr-model/index.js";

// Canonical platform profile data type + value enums.
export type {
  PlatformProfile,
  OutputFormat,
  CharEncoding,
} from "./platform-profile.js";

// The PlatformPlugin contract + its hook types.
export type {
  PlatformPlugin,
  PreambleOptions,
  ShimVariant,
  MainTerminationPolicy,
  RuntimeModule,
  ValidationError,
  IntrinsicDescriptor,
} from "./platform-plugin.js";

// Shared profile-consistency helper.
export { validateProfileFields } from "./validate-profile.js";

