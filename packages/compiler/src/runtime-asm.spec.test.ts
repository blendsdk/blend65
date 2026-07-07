/**
 * Specification test for runtime-module ACME validity.
 *
 * Written from the requirement that every shipped `runtime/*.asm` module must
 * assemble under ACME with zero errors, standalone — never derived from
 * reading the implementation.
 *
 * Harness note: the word routines reference the allocator's `__zp_arg_N`
 * symbols, which live in the *program* symbol header at build time — the
 * modules themselves define no addresses. The harness therefore prepends a
 * short prelude (an origin + the `__zp_arg_0..3` definitions) so each module can
 * be syntax-checked in isolation; the module text itself is assembled verbatim.
 *
 * Skip-if-no-ACME: mirrors the ACME process-layer convention elsewhere in this
 * package (CI has no emulator/assembler tier yet); locally the test runs
 * against the real ACME.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { RT_ROUTINES } from "@blend65/core";
import { loadRuntimeModule } from "@blend65/codegen";

/** Resolve ACME from PATH (returns null → tests are skipped). */
function findAcme(): string | null {
  try {
    const out = execFileSync("which", ["acme"], { encoding: "utf8" }).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

const ACME = findAcme();
const WORK_DIR = mkdtempSync(join(tmpdir(), "blend65-rt-asm-"));

afterAll(() => {
  rmSync(WORK_DIR, { recursive: true, force: true });
});

/**
 * A minimal two-line prelude: an origin so ACME can place code, and the
 * `__zp_arg_0..3` symbols the program header normally provides.
 */
const PRELUDE = [
  "* = $8000",
  "__zp_arg_0 = $02",
  "__zp_arg_1 = $03",
  "__zp_arg_2 = $04",
  "__zp_arg_3 = $05",
  "",
].join("\n");

describe.skipIf(ACME === null)("Specification: RD-17 runtime .asm modules assemble (ST-30)", () => {
  it.each(RT_ROUTINES.map((d) => [d.name, d] as const))(
    "%s module assembles under ACME with zero errors",
    (name, descriptor) => {
      const moduleText = loadRuntimeModule(descriptor);
      const asmPath = join(WORK_DIR, `${name}.asm`);
      const binPath = join(WORK_DIR, `${name}.bin`);
      writeFileSync(asmPath, PRELUDE + moduleText, "utf8");

      // Explicit argv, no shell (mirrors the ACME invocation convention elsewhere in this package).
      execFileSync(ACME!, ["-f", "plain", "-o", binPath, asmPath], {
        encoding: "utf8",
      });

      // Zero errors → a non-empty binary was produced.
      const bin = readFileSync(binPath);
      expect(bin.length).toBeGreaterThan(0);
    },
  );
});
