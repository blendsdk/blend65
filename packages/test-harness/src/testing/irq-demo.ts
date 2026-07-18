/**
 * Shared test support for the raster-IRQ measurement demo — a hand-written
 * ACME program (`test/asm/measure-irq-demo.asm`) that takes over the machine,
 * installs its own raster interrupt, and exposes a phase-locked, hand-computed
 * measurement window between `demo_from` and `demo_to`.
 *
 * Assembles the committed source into a fresh temp dir via real ACME (argv
 * array — never a shell string), emitting the `.prg` beside its VICE label
 * file so `setupEmulator({ binary })` picks the symbols up automatically.
 * Test-only: NOT re-exported from the package barrel.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The committed ACME source of the demo program. */
const DEMO_SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "test",
  "asm",
  "measure-irq-demo.asm",
);

/** An assembled demo: the `.prg` path (sibling `.lbl` beside it) + cleanup. */
export interface AssembledIrqDemo {
  readonly prgPath: string;
  readonly cleanup: () => void;
}

/**
 * Assemble the demo into a fresh temp dir with ACME, producing the `.prg`
 * and its VICE label file.
 *
 * @returns The assembled binary path and a temp-dir cleanup callback.
 * @throws If ACME is not installed or the source fails to assemble.
 */
export function assembleIrqDemo(): AssembledIrqDemo {
  const dir = mkdtempSync(join(tmpdir(), "b65-irq-demo-"));
  const prgPath = join(dir, "demo.prg");
  const lblPath = join(dir, "demo.lbl");
  execFileSync(
    "acme",
    ["--cpu", "6510", "--format", "cbm", "--vicelabels", lblPath, "-o", prgPath, DEMO_SOURCE],
    { stdio: "pipe" },
  );
  return {
    prgPath,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
