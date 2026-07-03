/**
 * ST-40 — real-ACME build E2E (skipIf ACME undiscoverable).
 *
 * Derived from RD-15 AC-07 and AR-V4: the full `blendc build` path drives the
 * gate program through REAL ACME to a real `.prg`. Structural assertions only
 * (file exists, non-empty, PRG load address) — not byte-golden — so a differing
 * Ubuntu ACME build does not flake (02 Risks). Lives in `@blend65/cli` because
 * `runCli` does (a compiler-side file importing `runCli` would be a compiler→cli
 * cycle, PF-004). Skipped locally when ACME is absent; live in CI (AR-V4 workflow).
 */

import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDiagnosticBag } from "@blend65/core";
import { discoverAcme } from "@blend65/compiler";
import { runCli } from "./index.js";
import { fakeIo, GATE_SRC } from "./test-fixtures.js";

/** Whether a real ACME is discoverable (drives the skipIf guard). */
const ACME_AVAILABLE = discoverAcme({}, createDiagnosticBag()) !== null;

describe.skipIf(!ACME_AVAILABLE)("Specification: real-ACME build E2E (ST-40)", () => {
  it("builds the gate program to a real .prg with the c64 load address (ST-40)", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "b65-cli-e2e-"));
    const out = join(cwd, "out");
    writeFileSync(join(cwd, "main.blend"), GATE_SRC, "utf8");

    try {
      // No buildDeps override → the real defaultBuildDeps → real ACME.
      const io = fakeIo({ cwd });
      const code = await runCli(["build", "main.blend", "--platform", "c64", "--out-dir", out], io);

      expect(code).toBe(0);
      const prg = join(out, "main.prg");
      expect(existsSync(prg)).toBe(true);

      const bytes = readFileSync(prg);
      expect(bytes.length).toBeGreaterThan(2);
      // PRG load address for the c64: $0801 little-endian → 0x01 0x08.
      expect(bytes[0]).toBe(0x01);
      expect(bytes[1]).toBe(0x08);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
