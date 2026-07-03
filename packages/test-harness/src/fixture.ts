/**
 * The `setupEmulator` Vitest fixture (RD-12 §4.4, R25–R28, AC-11).
 *
 * Owns the emulator lifecycle (AR-24): resolves a binary + symbol map from either
 * an RD-15 `BuildResult` (R27) or a bare binary path + label file (R28/AC-15 —
 * works with ANY `.prg`, not just Blend65 output), launches a fresh `ViceDriver`
 * with `-autostart <binary>` (relaunch-per-binary, AR-H6), and returns the driver
 * + symbols. Callers own `describe.skipIf(no VICE)` at suite level (AC-13); the
 * exported {@link hasVice}/{@link hasAcme} guards make that clean.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseLabelFile, type BuildResult } from "@blend65/compiler";
import type { EmulatorDriver } from "./emulator/driver.js";
import { emulatorFor } from "./emulator/registry.js";

/** Options for {@link setupEmulator}. */
export interface SetupEmulatorOptions {
  /** An RD-15 facade result (symbolMap/binaryPath/binary) — the preferred source (R27, AR-H2). */
  build?: BuildResult;
  /** A pre-compiled binary path (R28); its sibling `.lbl` is parsed unless `labelFile` is set. */
  binary?: string;
  /** Explicit VICE label-file path (overrides the sibling `.lbl`). */
  labelFile?: string;
  /** Target platform; default `"c64"` → registry lookup (R7a). */
  platform?: string;
  /** Show the emulator GUI window (default headless). */
  gui?: boolean;
}

/** What {@link setupEmulator} returns: a launched driver and the program's symbols. */
export interface EmulatorEnv {
  driver: EmulatorDriver;
  symbols: Map<string, number>;
}

/** Resolve an executable name on `PATH`, or null when absent (discovery style, RD-09). */
function resolveOnPath(name: string): string | null {
  try {
    const out = execFileSync("which", [name], { encoding: "utf8" }).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Whether the emulator for `platform` is installed (drives suite-level
 * `describe.skipIf`, AC-13). Returns false for an unregistered platform.
 */
export function hasVice(platform = "c64"): boolean {
  try {
    return resolveOnPath(emulatorFor(platform).executableName) !== null;
  } catch {
    return false;
  }
}

/** Whether ACME is installed (compile-bearing suites gate on this too, PF-002). */
export function hasAcme(): boolean {
  return resolveOnPath("acme") !== null;
}

/** Acquire an ephemeral free TCP port for the monitor bind (avoids cross-suite clashes). */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

/** Resolve the binary path from options, materialising `build.binary` bytes if needed. */
function resolveBinaryPath(options: SetupEmulatorOptions): string {
  if (options.build?.binaryPath !== undefined) {
    return options.build.binaryPath;
  }
  if (options.binary !== undefined) {
    return options.binary;
  }
  if (options.build?.binary !== undefined) {
    const dir = mkdtempSync(join(tmpdir(), "b65-harness-bin-"));
    const path = join(dir, "program.prg");
    writeFileSync(path, options.build.binary);
    return path;
  }
  throw new Error("setupEmulator: no binary — provide `build` (with binaryPath/binary) or `binary`");
}

/** Resolve the symbol map: prefer `build.symbolMap`, else parse the label file (R28). */
function resolveSymbols(options: SetupEmulatorOptions, binaryPath: string): Map<string, number> {
  if (options.build?.symbolMap !== undefined) {
    return options.build.symbolMap;
  }
  const labelPath = options.labelFile ?? binaryPath.replace(/\.[^.]+$/, ".lbl");
  if (existsSync(labelPath)) {
    return parseLabelFile(readFileSync(labelPath, "utf8"));
  }
  return new Map<string, number>();
}

/**
 * Launch an emulator for the given build/binary and bind its symbol map (R25–R28,
 * AC-11). The caller owns `driver.shutdown()` (typically in `afterAll`/`afterEach`).
 *
 * @param options The build/binary source, optional label file, and platform.
 * @returns The launched {@link EmulatorEnv}.
 * @throws If VICE is not installed, or no binary source is provided.
 */
export async function setupEmulator(options: SetupEmulatorOptions): Promise<EmulatorEnv> {
  const platform = options.platform ?? "c64";
  const entry = emulatorFor(platform);
  const executablePath = resolveOnPath(entry.executableName);
  if (executablePath === null) {
    throw new Error(
      `setupEmulator: emulator '${entry.executableName}' for platform '${platform}' is not on PATH`,
    );
  }

  const binaryPath = resolveBinaryPath(options);
  const symbols = resolveSymbols(options, binaryPath);

  const driver = entry.createDriver();
  const port = await freePort();
  await driver.launch({
    executablePath,
    monitorPort: port,
    gui: options.gui ?? false,
    extraArgs: ["-autostart", binaryPath, ...entry.defaultArgs],
  });

  return { driver, symbols };
}
