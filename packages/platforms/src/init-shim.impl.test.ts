/**
 * Implementation tests for the module-initializer startup wiring across all
 * five platform plugins — the shim calls the init routine after banking only
 * when asked to (default off, so initializer-free output is byte-identical),
 * both hook seams (`emitPreamble` and the standalone `emitStartupShim`)
 * thread the flag, and the `bare` variant stays empty (the user owns the
 * entire entry sequence, including calling the init routine).
 */

import { describe, expect, it } from "vitest";
import type { PlatformPlugin, StreamEntry } from "@blend65/core/platform";
import { a7800Plugin } from "./a7800.js";
import { a800xlPlugin } from "./a800xl.js";
import { c64Plugin } from "./c64.js";
import { c64uPlugin } from "./c64u.js";
import { cx16Plugin } from "./cx16.js";

const PLUGINS: readonly PlatformPlugin[] = [
  c64Plugin,
  c64uPlugin,
  cx16Plugin,
  a800xlPlugin,
  a7800Plugin,
];

/** Whether the entries contain a `JSR` to the init routine. */
function hasJsrInit(entries: readonly StreamEntry[]): boolean {
  return entries.some(
    (e) =>
      e.type === "instr" &&
      e.opcode === "JSR" &&
      e.operand.kind === "symbolRef" &&
      e.operand.name === "__init",
  );
}

describe.each(PLUGINS.map((p) => [p.id, p] as const))(
  "init startup wiring (%s)",
  (_id, plugin) => {
    it("calls the init routine from the shim only when asked", () => {
      expect(hasJsrInit(plugin.emitStartupShim("terminating", true))).toBe(true);
      expect(hasJsrInit(plugin.emitStartupShim("terminating"))).toBe(false);
      expect(hasJsrInit(plugin.emitStartupShim("non-terminating", true))).toBe(true);
      expect(hasJsrInit(plugin.emitStartupShim("non-terminating"))).toBe(false);
    });

    it("threads the flag through emitPreamble", () => {
      const base = {
        projectName: "x",
        shimVariant: "terminating" as const,
        needsBssZero: false,
        needsDataInit: false,
      };
      expect(hasJsrInit(plugin.emitPreamble({ ...base, hasInitCode: true }))).toBe(true);
      expect(hasJsrInit(plugin.emitPreamble(base))).toBe(false);
    });

    it("keeps the bare shim empty regardless of the flag", () => {
      expect(plugin.emitStartupShim("bare", true)).toEqual([]);
      expect(plugin.emitStartupShim("bare")).toEqual([]);
    });
  },
);
