/**
 * RD-09 ACME invocation — `invokeAcme`
 * (`plans/rd-09-acme-emitter/03-02-acme-process-layer.md`, R30–R33, R35–R38;
 * AR-67/AR-68).
 *
 * Runs the discovered ACME executable on a written `.asm` file to produce the
 * platform binary + VICE label file, then reports the outcome:
 *
 *   - **Exit 0** → success: the binary and label paths are returned along with the
 *     binary size (excluding the 2-byte PRG load header, R44).
 *   - **Non-zero exit** → an **internal compiler error** (`E90001` ICE, R35/R37):
 *     because every `Instr` is CPU-validated (AR-58), every address is
 *     compiler-assigned (AR-66), and the emitter produces valid ACME (R2), an ACME
 *     failure is by definition a compiler bug, never a user error. The full ACME
 *     stderr is embedded in the ICE so the bug can be reported with context. The
 *     `.asm` file is **retained** on failure for inspection (R36) — this function
 *     never deletes it.
 *
 * The child process and filesystem are injected through {@link AcmeRunner} so the
 * orchestration is unit-testable without spawning a real ACME binary (AR-27).
 * {@link defaultAcmeRunner} provides the real `node:child_process` /`node:fs`
 * implementation.
 *
 * Security (code.md r32-34): the real runner spawns ACME with an **explicit argv
 * array** (no shell string interpolation), so paths/filenames can never be used
 * for command injection. Lives in `@blend65/compiler` (R15/AR-20).
 */

import { execFile } from "node:child_process";
import { statSync } from "node:fs";
import { IceCode, type DiagnosticBag } from "@blend65/core";

/** Everything the invocation needs: the executable, the inputs, and the outputs. */
export interface AcmeInvocation {
  /** The resolved ACME executable (from `discoverAcme`). */
  readonly acmeExe: string;
  /** The written `.asm` input file. */
  readonly asmPath: string;
  /** Desired output binary path (e.g. `<out>/main.prg`). */
  readonly binaryPath: string;
  /** Desired VICE label-file path (ACME `--vicelabels`). */
  readonly labelPath: string;
  /** ACME `--report` file path (diagnostic capture). */
  readonly reportPath: string;
  /** Working directory for the child process (the build output dir). */
  readonly cwd: string;
}

/** The outcome of running ACME (R35/R44, AC-11/12). */
export interface AcmeResult {
  /** Whether ACME exited 0. */
  readonly success: boolean;
  /** Path to the binary output (present on success). */
  readonly binaryPath?: string;
  /** Path to the VICE label file (present on success). */
  readonly labelFilePath?: string;
  /** ACME stderr (present on failure, embedded in the ICE). */
  readonly stderr?: string;
  /** Binary size in bytes, excluding the 2-byte PRG load header (present on success). */
  readonly binarySize?: number;
}

/** The raw result of running the ACME child process. */
export interface AcmeRunOutput {
  /** The process exit code (0 = success). */
  readonly exitCode: number;
  /** Captured stderr. */
  readonly stderr: string;
}

/**
 * Injected process/FS seam — keeps {@link invokeAcme} testable without a real
 * ACME binary. Production wiring uses {@link defaultAcmeRunner}.
 */
export interface AcmeRunner {
  /** Spawn ACME (explicit argv, no shell) and resolve with its exit/stderr. */
  readonly run: (exe: string, argv: readonly string[], cwd: string) => Promise<AcmeRunOutput>;
  /** Size of the produced binary in bytes, excluding the PRG load header (R44). */
  readonly binarySize: (binaryPath: string) => number;
  /** Optional file-delete hook. Intentionally never called on failure (R36). */
  readonly deleteFile?: (path: string) => void;
}

/**
 * Build the ACME argv (R31/R32): dump VICE labels to `labelPath`, write the
 * report to `reportPath`, assemble `asmPath`.
 *
 * The binary output is driven by the serializer's `!to "<name>.prg", cbm`
 * directive — NOT a `-o` command-line flag (RD-15 AR-V23 / DEF-1). Passing `-o`
 * makes ACME warn "Output file already chosen" and fall back to its **plain**
 * (headerless) format, dropping the 2-byte c64 load-address header that
 * `LOAD"*",8` requires; the `!to ...,cbm` path produces a proper header-bearing
 * PRG (the RD-09 golden test `assemble-rt.golden.spec.test.ts` proves this). The
 * `!to` filename is a basename, resolved against ACME's `cwd` (`inv.cwd` =
 * the emit `outDir`), so it lands at `inv.binaryPath` (`<outDir>/<name>.prg`).
 *
 * @param inv The invocation descriptor.
 * @returns The argv array passed to ACME (no shell interpolation).
 */
function acmeArgv(inv: AcmeInvocation): string[] {
  // --vicelabels (NOT -l/--symbollist): ACME's -l writes its native
  // `<name> = $<addr>` format, which `parseLabelFile` cannot read, leaving the
  // symbol map empty for every real build (DEF-2, RD-12 AR-H7). --vicelabels emits
  // `al C:xxxx .name` — exactly the VICE format `parseLabelFile` parses.
  return [
    "--vicelabels",
    inv.labelPath,
    "--report",
    inv.reportPath,
    inv.asmPath,
  ];
}

/**
 * Run ACME on the written `.asm` file and classify the outcome (R30–R38).
 *
 * @param inv The invocation descriptor (executable, inputs, outputs, cwd).
 * @param bag Diagnostic sink — receives an `E90001` ICE on a non-zero exit.
 * @param runner Injected process/FS runner (defaults to {@link defaultAcmeRunner}).
 * @returns The {@link AcmeResult}. On failure the `.asm` is retained (R36).
 */
export async function invokeAcme(
  inv: AcmeInvocation,
  bag: DiagnosticBag,
  runner: AcmeRunner = defaultAcmeRunner,
): Promise<AcmeResult> {
  const { exitCode, stderr } = await runner.run(inv.acmeExe, acmeArgv(inv), inv.cwd);

  if (exitCode !== 0) {
    // R35/R37: a non-zero exit is a compiler bug → ICE with the ACME stderr
    // embedded. R36: the `.asm` file is left on disk (we never delete it) so the
    // developer can inspect the exact assembler input.
    bag.addICE(
      IceCode.Unexpected,
      null,
      `ACME assembler failed (exit ${exitCode}) on '${inv.asmPath}'. This is a ` +
        `compiler bug — the generated assembly should always be valid. ACME ` +
        `output:\n${stderr}`,
    );
    return { success: false, stderr };
  }

  return {
    success: true,
    binaryPath: inv.binaryPath,
    labelFilePath: inv.labelPath,
    binarySize: runner.binarySize(inv.binaryPath),
    stderr,
  };
}

/** Bytes stripped from a `.prg` file size to get the content size (load header). */
const PRG_LOAD_HEADER_BYTES = 2;

/**
 * Production {@link AcmeRunner}: spawns ACME via `execFile` (explicit argv, no
 * shell — injection-safe, code.md r32-34) and sizes the binary via `node:fs`,
 * excluding the 2-byte PRG load header (R44).
 */
export const defaultAcmeRunner: AcmeRunner = {
  run(exe: string, argv: readonly string[], cwd: string): Promise<AcmeRunOutput> {
    return new Promise<AcmeRunOutput>((resolve) => {
      execFile(exe, [...argv], { cwd }, (error, _stdout, stderr) => {
        // `error.code` is the non-zero exit status when ACME fails; absent on success.
        const exitCode =
          error && typeof (error as { code?: unknown }).code === "number"
            ? ((error as { code: number }).code)
            : error
              ? 1
              : 0;
        resolve({ exitCode, stderr: stderr ?? "" });
      });
    });
  },
  binarySize(binaryPath: string): number {
    const total = statSync(binaryPath).size;
    // Exclude the 2-byte PRG load header so the figure is the content size (R44).
    return Math.max(0, total - PRG_LOAD_HEADER_BYTES);
  },
};
