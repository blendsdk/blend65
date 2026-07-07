/**
 * Build-sensitive smoke check pinning exact symbol addresses.
 *
 * Written after a prior label-file-format fix; complements the immutable
 * `vice-label.spec.test.ts` oracle. It pins the EXACT addresses the current
 * gate build emits (`_main`=$0819, `__startup`=$080d, verified live against
 * real ACME) — a useful regression signal, but MUTABLE: any codegen/allocator
 * change legitimately shifts `_main` (it is a function of the BASIC stub +
 * `__startup` body length + ZP allocation), so this is an impl test that is
 * fine to update when codegen moves, NOT an immutable spec oracle.
 *
 * Skip-if-no-ACME: same convention as the oracle.
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

describe.skipIf(!ACME_AVAILABLE)("DEF-2 exact-address smoke (build-sensitive, PF-003)", () => {
  it("pins the current gate build's _main and __startup addresses", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "b65-def2-smoke-"));
    writeFileSync(join(cwd, "main.blend"), GATE_SRC, "utf8");
    try {
      const result = await build({
        platform: "c64",
        cwd,
        sourceFiles: ["main.blend"],
        outDir: join(cwd, "out"),
      });

      // Live-pinned this session; update if codegen/allocation shifts them.
      expect(result.symbolMap!.get("__startup")).toBe(0x080d);
      expect(result.symbolMap!.get("_main")).toBe(0x0819);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
