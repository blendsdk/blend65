/**
 * The `@blend65/core/platform` subpath barrel — RD-10 (D6/D7/D8).
 *
 * This is the **single new core subpath** RD-10 adds (D6). It surfaces:
 *
 * 1. The relocated pure-data Instr/stream model (`../instr-model/`) — promoted
 *    to core by D7 so the platform plugin hooks can return `StreamEntry[]` /
 *    `AcmeDirective` without a core→codegen dependency, and routed through this
 *    barrel by D8 (no separate `@blend65/core/instr-model` package export).
 * 2. (Phase 1.2, forthcoming) the canonical `PlatformProfile` data type, the
 *    `PlatformPlugin` interface + hook types, and `validateProfileFields`.
 *
 * The **root** `@blend65/core` barrel is untouched: it continues to export the
 * interim `PlatformProfile` (RD-04/RD-05) so shipped code and tests keep passing
 * (D6). The canonical RD-10 types are reachable only from this subpath.
 */

// Relocated pure-data Instr/stream model (D7/D8) — re-exported through this
// single subpath so `@blend65/codegen` and the platform plugins share one model.
export * from "../instr-model/index.js";

// Canonical RD-10 platform profile data type + value enums (Ch 15 §3, D6).
export type {
  PlatformProfile,
  OutputFormat,
  CharEncoding,
} from "./platform-profile.js";

// The PlatformPlugin contract + its hook types (R1–R3, R16–R22).
export type {
  PlatformPlugin,
  PreambleOptions,
  ShimVariant,
  MainTerminationPolicy,
  RuntimeModule,
  ValidationError,
  IntrinsicDescriptor,
} from "./platform-plugin.js";

// Shared profile-consistency helper (FR-21/R22).
export { validateProfileFields } from "./validate-profile.js";

