/**
 * Assemble a hand-written twin through real ACME for the twin tier.
 *
 * Stages ONLY the named twin plus the `.bin` assets beside it — never
 * sibling twins, which co-locate in the golden directory — into a fresh
 * scratch dir, then runs ACME with `--report` (the instruction stream) and
 * `--vicelabels` (the symbol map `setupEmulator` consumes). A twin's own
 * `!to` directive names its output; passing `-o` alongside it would make
 * ACME fall back to its headerless format, so `-o` is only used when the
 * twin has no `!to`. Test-only: NOT re-exported from the package barrel.
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

/** An assembled twin: PRG + VICE label file + report, in a scratch dir. */
export interface AssembledTwin {
  readonly prgPath: string;
  readonly labelPath: string;
  readonly reportPath: string;
  readonly cleanup: () => void;
}

/**
 * Assemble one twin via real ACME.
 *
 * @param twinPath Absolute path to the twin's `.asm` source.
 * @returns The assembled artifacts and a scratch-dir cleanup.
 * @throws {Error} Naming the twin and carrying ACME's stderr on failure.
 * @example
 * const twin = assembleTwin(join(root, "examples", "balloon", "balloon.asm"));
 */
export function assembleTwin(twinPath: string): AssembledTwin {
  const scratch = mkdtempSync(join(tmpdir(), "b65-twin-asm-"));
  const twinDir = dirname(twinPath);
  const twinName = basename(twinPath);
  copyFileSync(twinPath, join(scratch, twinName));
  for (const file of readdirSync(twinDir)) {
    if (file.endsWith(".bin")) {
      copyFileSync(join(twinDir, file), join(scratch, file));
    }
  }

  const source = readFileSync(twinPath, "utf8");
  const toMatch = /^\s*!to\s+"([^"]+)"/m.exec(source);
  const reportPath = join(scratch, "twin.report");
  const labelPath = join(scratch, "twin.lbl");
  const argv = [
    "--cpu",
    "6510",
    "--format",
    "cbm",
    "--report",
    reportPath,
    "--vicelabels",
    labelPath,
  ];
  let prgPath: string;
  if (toMatch !== null) {
    prgPath = join(scratch, toMatch[1]);
  } else {
    prgPath = join(scratch, "twin.prg");
    argv.push("-o", prgPath);
  }
  argv.push(join(scratch, twinName));

  try {
    execFileSync("acme", argv, { cwd: scratch, stdio: ["ignore", "ignore", "pipe"] });
  } catch (error) {
    rmSync(scratch, { recursive: true, force: true });
    const stderr = (error as { stderr?: Buffer }).stderr;
    const detail = stderr !== undefined ? stderr.toString() : (error as Error).message;
    throw new Error(`assembleTwin: ACME failed on twin '${twinPath}':\n${detail}`);
  }

  return {
    prgPath,
    labelPath,
    reportPath,
    cleanup: () => rmSync(scratch, { recursive: true, force: true }),
  };
}
