/**
 * Public entry point for `@blend65/platforms` — the built-in platform plugins
 * (RD-10). Surfaces the registry + loader and the five platform plugins so the
 * compiler driver (RD-15/16) can resolve a `--platform` flag to a
 * `PlatformPlugin`.
 */

export { PLATFORM_REGISTRY, DEFAULT_PLATFORM, loadPlatform } from "./registry.js";
export { c64Plugin } from "./c64.js";
export { c64uPlugin } from "./c64u.js";
export { cx16Plugin } from "./cx16.js";
export { a800xlPlugin } from "./a800xl.js";
export { a7800Plugin } from "./a7800.js";
