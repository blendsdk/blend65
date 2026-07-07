/**
 * Regression oracle: a real gate build must yield a populated `symbolMap`.
 *
 * Written from the requirement, never from the implementation. Before a
 * prior fix, `invokeAcme` passed ACME's `-l` (native `name = $addr` format),
 * which `parseLabelFile` cannot read, so every real `build()` returned an
 * EMPTY `symbolMap`. This oracle would have caught that: it runs the real
 * gate `build()` through real ACME and asserts the map is non-empty and
 * carries the program's `_main` / `__startup` labels.
 *
 * Skip-if-no-ACME: mirrors the ACME process-layer convention elsewhere in
 * this package (CI installs ACME so this runs live there; a machine without
 * ACME skips cleanly).
 *
 * The EXACT addresses (`_main`=$0819, `__startup`=$080d) are build-sensitive
 * (any codegen/allocator change legitimately shifts `_main`), so they live in
 * the mutable `vice-label.impl.test.ts` smoke check — NOT here. This oracle
 * asserts only the immutable contract: non-empty map, the labels present,
 * addresses in the c64 load region (≥ $0801).
 */

import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDiagnosticBag } from "@blend65/core";
import { build } from "./../api/build.js";
import { discoverAcme } from "./discover-acme.js";
import { GATE_SRC } from "./../api/test-fixtures.js";

/** Whether a real ACME is discoverable (drives the skipIf guard). */
const ACME_AVAILABLE = discoverAcme({}, createDiagnosticBag()) !== null;

/** The lowest legal c64 program address (BASIC start, $0801). */
const C64_LOAD_FLOOR = 0x0801;

describe.skipIf(!ACME_AVAILABLE)("Specification: DEF-2 populated symbolMap (ST-01/ST-02)", () => {
  it("ST-01: a real gate build yields a non-empty symbolMap with _main and __startup", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "b65-def2-"));
    writeFileSync(join(cwd, "main.blend"), GATE_SRC, "utf8");
    try {
      // Absolute outDir so ACME's cwd/asmPath resolve consistently (mirrors
      // the facade's E2E convention; a relative outDir would double-resolve
      // against ACME's cwd).
      const result = await build({
        platform: "c64",
        cwd,
        sourceFiles: ["main.blend"],
        outDir: join(cwd, "out"),
      });

      expect(result.hasErrors).toBe(false);
      expect(result.symbolMap).toBeDefined();
      expect(result.symbolMap!.size).toBeGreaterThan(0);
      expect(result.symbolMap!.has("_main")).toBe(true);
      expect(result.symbolMap!.has("__startup")).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("ST-02: _main and __startup resolve to defined addresses in the c64 load region", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "b65-def2-"));
    writeFileSync(join(cwd, "main.blend"), GATE_SRC, "utf8");
    try {
      const result = await build({
        platform: "c64",
        cwd,
        sourceFiles: ["main.blend"],
        outDir: join(cwd, "out"),
      });

      const main = result.symbolMap!.get("_main");
      const startup = result.symbolMap!.get("__startup");
      // Immutable: both defined and in the load region — NOT their exact values.
      expect(main).toBeGreaterThanOrEqual(C64_LOAD_FLOOR);
      expect(startup).toBeGreaterThanOrEqual(C64_LOAD_FLOOR);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
