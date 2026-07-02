/**
 * Public API of `@blend65/config` (RD-16 §4.2, AR-P6): the `loadConfig()`
 * loader, its option/result types, the `CONFIG_SOURCE_ID` span sentinel
 * (AR-P2), and the `CONFIG_DEFAULTS` table (§4.1). Everything else in this
 * package is internal.
 */

export { loadConfig } from "./load-config.js";
export { CONFIG_DEFAULTS } from "./defaults.js";
export { CONFIG_SOURCE_ID } from "./types.js";
export type {
  BlendConfig,
  ConfigOverrides,
  LoadConfigOptions,
  LoadConfigResult,
} from "./types.js";
