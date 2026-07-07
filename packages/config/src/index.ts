/**
 * Public API of `@blend65/config`: the `loadConfig()` loader, its
 * option/result types, the `CONFIG_SOURCE_ID` span sentinel, and the
 * `CONFIG_DEFAULTS` table. Everything else in this package is internal.
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
